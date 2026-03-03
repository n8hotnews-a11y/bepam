import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    ActivityIndicator,
    Share,
    Alert,
    Dimensions,
    Platform,
    Modal,
    Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import { recipeService } from '../services/recipeService';
import { shoppingListService } from '../services/shoppingListService';
import { mealPlanService } from '../services/mealPlanService';
import { inventoryService } from '../services/inventoryService';
import { favoriteService } from '../services/favoriteService';
import { supabase } from '../services/supabaseConfig';
import ChefFAB from '../components/ChefFAB';
import { WebView } from 'react-native-webview';

const { width } = Dimensions.get('window');

const RecipeDetailScreen = ({ route, navigation }) => {
    const { recipeId, initialRecipeData, recipeTitle } = route.params;
    const [recipe, setRecipe] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('ingredients');
    const [selectedIngredients, setSelectedIngredients] = useState([]);
    const [addingToCart, setAddingToCart] = useState(false);
    const [isFavorite, setIsFavorite] = useState(false);

    const [inventoryItems, setInventoryItems] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const { data: { user } } = await supabase.auth.getUser();
                const user_id = user?.id;

                // 1. Fetch Recipe Details
                let detailsRes;
                if (initialRecipeData) {
                    let processed;
                    // Check if already transformed (has extendedIngredients)
                    if (initialRecipeData.extendedIngredients) {
                        processed = initialRecipeData;
                    } else {
                        processed = recipeService.transformAIRecipe(initialRecipeData);
                    }

                    if (processed) {
                        detailsRes = { success: true, data: processed };
                        // Save to cache for future lookups (e.g. from Meal Plan)
                        recipeService.saveAIRecipeToCache(processed);
                    } else {
                        detailsRes = await recipeService.getRecipeDetails(recipeId);
                    }
                } else {
                    detailsRes = await recipeService.getRecipeDetails(recipeId);
                }

                // 1.5 Fallback: Reconstruct AI Recipe if missing locally
                if (!detailsRes.success && recipeTitle && recipeId && String(recipeId).startsWith('ai_')) {
                    const recoverRes = await recipeService.reconstructAIRecipe(recipeTitle);
                    if (recoverRes.success) {
                        detailsRes = recoverRes;
                    }
                }

                // 2. Fetch User Inventory (if logged in)
                let currentInventory = [];
                if (user_id) {
                    const invRes = await inventoryService.getItems(user_id);
                    if (invRes.success) {
                        currentInventory = invRes.items.map(i => i.item_name.toLowerCase());
                    }
                }
                setInventoryItems(currentInventory);

                if (detailsRes.success) {
                    const detailData = detailsRes.data;

                    // Preserve image from listing if available (better UX for recovered recipes)
                    if (route.params?.recipeImage && (!detailData.image || detailData.image.includes('placeholder'))) {
                        detailData.image = route.params.recipeImage;
                    }

                    setRecipe(detailData);

                    // 3. Mark Missing Ingredients
                    // Auto-select ingredients that are MISSING from inventory
                    const missingIndices = [];
                    if (detailData.extendedIngredients && Array.isArray(detailData.extendedIngredients)) {
                        detailData.extendedIngredients.forEach((ing, idx) => {
                            const rawName = ing.nameClean || ing.name || "";
                            const ingName = rawName.toLowerCase();

                            // Simple check: if ingredient name contains inventory item or vice versa
                            const isAvailable = currentInventory.some(invItem =>
                                ingName.includes(invItem) || invItem.includes(ingName)
                            );

                            if (!isAvailable) {
                                missingIndices.push(idx);
                            }
                        });
                    }

                    setSelectedIngredients(missingIndices);

                    // 4. Check Favorite Status
                    if (user_id) {
                        const favStatus = await favoriteService.isFavorite(user_id, recipeId);
                        setIsFavorite(favStatus);
                    }
                } else {
                    console.error("Recipe Load Failed:", detailsRes.error);
                }
            } catch (error) {
                console.error("FetchDetail Error:", error);
                Alert.alert("Lỗi", "Đã có lỗi xảy ra khi tải thông tin món ăn.");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [recipeId]);

    // const handleShare = async () => {
    //     try {
    //         await Share.share({
    //             message: `Xem công thức món ${recipe.title} cực ngon trên Cơm Nhà này!`,
    //             url: recipe.sourceUrl || "https://comnha.app",
    //         });
    //     } catch (error) {
    //         console.error(error.message);
    //     }
    // };

    const toggleFavorite = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            Alert.alert('Yêu cầu đăng nhập', 'Bạn cần đăng nhập để lưu món yêu thích.');
            return;
        }

        if (isFavorite) {
            const result = await favoriteService.removeFavorite(user.id, recipeId);
            if (result.success) setIsFavorite(false);
        } else {
            const result = await favoriteService.addFavorite(user.id, {
                id: recipeId,
                title: recipe.title,
                image: recipe.image
            });
            if (result.success) setIsFavorite(true);
        }
    };

    const toggleIngredient = (idx) => {
        if (selectedIngredients.includes(idx)) {
            setSelectedIngredients(selectedIngredients.filter(i => i !== idx));
        } else {
            setSelectedIngredients([...selectedIngredients, idx]);
        }
    };

    const addToShoppingList = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        const user_id = user?.id;
        if (!user_id) {
            Alert.alert('Yêu cầu đăng nhập', 'Bạn cần đăng nhập để lưu danh sách đi chợ.');
            return;
        }

        if (selectedIngredients.length === 0) {
            Alert.alert('Thông báo', 'Bạn chưa chọn nguyên liệu nào để thêm.');
            return;
        }

        setAddingToCart(true);
        try {
            const ingredientsToAdd = recipe.extendedIngredients
                .filter((_, idx) => selectedIngredients.includes(idx))
                .map(ing => ({
                    name: ing.nameClean || ing.name,
                    amount: Math.round(ing.amount),
                    unit: ing.unit,
                    recipeId: recipeId,
                    recipeTitle: recipe.title
                }));

            const result = await shoppingListService.addBatchItems(user_id, ingredientsToAdd);
            if (result.success) {
                Alert.alert('Thành công', `Đã thêm ${ingredientsToAdd.length} nguyên liệu còn thiếu vào danh sách đi chợ!`);
            } else {
                Alert.alert('Lỗi', result.error || 'Không thể thêm vào danh sách đi chợ.');
            }
        } catch (error) {
            console.error("AddBatch Error:", error);
            Alert.alert('Lỗi', 'Đã có lỗi hệ thống xảy ra.');
        } finally {
            setAddingToCart(false);
        }
    };

    const [mealSelectionVisible, setMealSelectionVisible] = useState(false);

    // If navigated with initialMealType, maybe prompt immediately? 
    // Or just let user click. 
    // Let's keep it manual trigger to avoid intrusive popups unless we are VERY sure.
    // However, if we came from "Add Dish" button in MealPlan, user INTENDS to add.
    // So let's auto-open modal if initialDate is set?

    useEffect(() => {
        if (route.params?.initialDate) {
            // Optional: Auto open modal if we came from a specific Planner slot
            // setMealSelectionVisible(true); 
            // Better to let user explore first, then click Calendar icon.
        }
    }, []);

    const handlePlan = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            Alert.alert('Yêu cầu đăng nhập', 'Bạn cần đăng nhập để lên lịch nấu ăn.');
            return;
        }

        // Use passed initialMealType if available to skip modal? 
        // User requested "with option to add to each meal".
        // But if context implies a specific meal (e.g. from Lunch slot), maybe we should just confirm?
        // Let's stick to showing modal for flexibility unless user insists on auto-add.
        setMealSelectionVisible(true);
    };

    const confirmAddToPlan = async (mealType) => {
        setMealSelectionVisible(false);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Use initialDate if passed (e.g. adding for Tomorrow), else Today.
        const planDate = route.params?.initialDate || new Date().toISOString().split('T')[0];

        const result = await mealPlanService.addToPlan(
            user.id,
            recipeId,
            recipe.title,
            recipe.image,
            planDate,
            mealType
        );

        if (result.success) {
            Alert.alert('Đã lên lịch', `Món ăn đã được thêm vào ${mealType === 'breakfast' ? 'bữa sáng' : mealType === 'lunch' ? 'bữa trưa' : 'bữa tối'} ngày ${planDate.split('-').reverse().join('/')}!`);
            // Go back if we came from a specific slot selection flow
            if (route.params?.initialDate) {
                navigation.goBack();
            }
        } else {
            console.error(result.error);
            Alert.alert('Lỗi', 'Không thể thêm vào thực đơn. Vui lòng thử lại.');
        }
    };

    const handleWatchVideo = () => {
        const query = encodeURIComponent(recipe.title);
        const url = `https://www.youtube.com/results?search_query=${query}`;
        Linking.openURL(url).catch(err => {
            console.error("Couldn't load page", err);
            Alert.alert('Lỗi', 'Không thể mở Youtube.');
        });
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    if (!recipe) {
        return (
            <View style={styles.loadingContainer}>
                <Text>Không tìm thấy công thức!</Text>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={{ color: COLORS.primary, marginTop: 20 }}>Quay lại</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.imageContainer}>
                    {recipe.image && !recipe.image.includes('placeholder') ? (
                        <Image source={{ uri: recipe.image }} style={styles.headerImage} />
                    ) : (
                        <View style={[styles.headerImage, styles.placeholderContainer]}>
                            <MaterialIcons name="restaurant-menu" size={80} color={COLORS.white} />
                        </View>
                    )}
                    <SafeAreaView style={styles.headerOverlay}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
                            <MaterialIcons name="chevron-left" size={28} color={COLORS.textPrimary} />
                        </TouchableOpacity>
                        <View style={styles.headerActions}>
                            <TouchableOpacity onPress={handleWatchVideo} style={[styles.iconBtn, { backgroundColor: '#FFEEED' }]}>
                                <MaterialIcons name="play-circle-fill" size={28} color="#FF0000" />
                            </TouchableOpacity>
                            {/* <TouchableOpacity onPress={handleShare} style={styles.iconBtn}>
                                <MaterialIcons name="share" size={24} color={COLORS.textPrimary} />
                            </TouchableOpacity> */}
                            <TouchableOpacity onPress={toggleFavorite} style={styles.iconBtn}>
                                <MaterialIcons
                                    name={isFavorite ? "favorite" : "favorite-border"}
                                    size={24}
                                    color={isFavorite ? COLORS.error : COLORS.textPrimary}
                                />
                            </TouchableOpacity>
                        </View>
                    </SafeAreaView>
                </View>

                <View style={styles.contentCard}>
                    <View style={styles.titleRow}>
                        <Text style={styles.title}>{recipe.title}</Text>
                        <View style={styles.ratingBadge}>
                            <MaterialIcons name="star" size={18} color="#F59E0B" />
                            <Text style={styles.ratingText}>{(recipe.healthScore / 20).toFixed(1)}</Text>
                        </View>
                    </View>

                    <View style={styles.metaRow}>
                        <View style={styles.metaItem}>
                            <View style={styles.metaIconCircle}>
                                <MaterialIcons name="timer" size={20} color={COLORS.primary} />
                            </View>
                            <Text style={styles.metaVal}>{recipe.readyInMinutes}p</Text>
                            <Text style={styles.metaLabel}>Thời gian</Text>
                        </View>
                        <View style={styles.metaItem}>
                            <View style={styles.metaIconCircle}>
                                <MaterialIcons name="groups" size={20} color={COLORS.primary} />
                            </View>
                            <Text style={styles.metaVal}>{recipe.servings}</Text>
                            <Text style={styles.metaLabel}>Khẩu phần</Text>
                        </View>
                        <View style={styles.metaItem}>
                            <View style={styles.metaIconCircle}>
                                <MaterialIcons name="local-fire-department" size={20} color={COLORS.primary} />
                            </View>
                            <Text style={styles.metaVal}>{Math.round(recipe.nutrition?.nutrients[0]?.amount)}</Text>
                            <Text style={styles.metaLabel}>Calo</Text>
                        </View>
                    </View>

                    <View style={styles.tabBar}>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'ingredients' && styles.tabActive]}
                            onPress={() => setActiveTab('ingredients')}
                        >
                            <Text style={[styles.tabText, activeTab === 'ingredients' && styles.tabTextActive]}>Nguyên liệu</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'instructions' && styles.tabActive]}
                            onPress={() => setActiveTab('instructions')}
                        >
                            <Text style={[styles.tabText, activeTab === 'instructions' && styles.tabTextActive]}>Cách làm</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.tabContent}>
                        {activeTab === 'ingredients' ? (
                            <View>
                                {selectedIngredients.length > 0 && (
                                    <View style={styles.warningBanner}>
                                        <MaterialIcons name="warning" size={20} color="#92400E" />
                                        <Text style={styles.warningText}>
                                            Bạn đang thiếu <Text style={{ fontFamily: FONTS.bold }}>{selectedIngredients.length}</Text> nguyên liệu cho món ăn này.
                                        </Text>
                                    </View>
                                )}
                                {recipe.extendedIngredients.map((ing, idx) => (
                                    <TouchableOpacity
                                        key={idx}
                                        style={styles.ingredientRow}
                                        onPress={() => toggleIngredient(idx)}
                                    >
                                        <MaterialIcons
                                            name={selectedIngredients.includes(idx) ? "check-circle" : "radio-button-unchecked"}
                                            size={24}
                                            color={selectedIngredients.includes(idx) ? COLORS.primary : COLORS.border}
                                        />
                                        <Text style={[
                                            styles.ingredientText,
                                            !selectedIngredients.includes(idx) && styles.ingredientDisabledText
                                        ]}>
                                            {ing.amount > 0 && <Text style={styles.ingAmount}>{Math.round(ing.amount)} {ing.unit} </Text>}
                                            {ing.nameClean || ing.name}
                                        </Text>
                                    </TouchableOpacity>
                                ))}

                                <TouchableOpacity
                                    style={[styles.addShoppingBtn, addingToCart && { opacity: 0.7 }]}
                                    onPress={addToShoppingList}
                                    disabled={addingToCart}
                                >
                                    {addingToCart ? (
                                        <ActivityIndicator color={COLORS.textOnPrimary} />
                                    ) : (
                                        <>
                                            <MaterialIcons name="add-shopping-cart" size={22} color={COLORS.textOnPrimary} />
                                            <Text style={styles.addShoppingBtnText}>Thêm vào danh sách đi chợ</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        ) : (
                            recipe.analyzedInstructions[0]?.steps.map((step, idx) => (
                                <View key={idx} style={styles.stepItem}>
                                    <View style={styles.stepHeader}>
                                        <View style={styles.stepNumberCircle}>
                                            <Text style={styles.stepNumberText}>{step.number}</Text>
                                        </View>
                                        <View style={styles.stepLine} />
                                    </View>
                                    <View style={styles.stepContent}>
                                        <Text style={styles.stepText}>{step.step}</Text>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                </View>
            </ScrollView>

            <View style={styles.bottomActions}>
                <TouchableOpacity style={styles.planBtn} onPress={handlePlan}>
                    <MaterialIcons name="calendar-today" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.startBtn}
                    activeOpacity={0.8}
                    onPress={() => {
                        navigation.navigate('CookingComplete', {
                            planId: null, // No planId because it might be a direct cook
                            recipeId: recipeId,
                            recipeTitle: recipe.title,
                            recipeImage: recipe.image
                        });
                    }}
                >
                    <Text style={styles.startBtnText}>Bắt đầu nấu ngay</Text>
                    <MaterialIcons name="arrow-forward" size={24} color={COLORS.textOnPrimary} />
                </TouchableOpacity>
            </View>

            {/* Meal Selection Modal */}
            {mealSelectionVisible && (
                <Modal
                    animationType="slide"
                    transparent={true}
                    visible={mealSelectionVisible}
                    onRequestClose={() => setMealSelectionVisible(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Chọn bữa ăn</Text>
                                <TouchableOpacity onPress={() => setMealSelectionVisible(false)}>
                                    <MaterialIcons name="close" size={24} color={COLORS.textPrimary} />
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.modalSubtitle}>Bạn muốn thêm món này vào bữa nào?</Text>

                            <View style={styles.mealOptions}>
                                {[
                                    { id: 'breakfast', name: 'Bữa Sáng', icon: 'wb-twilight' },
                                    { id: 'lunch', name: 'Bữa Trưa', icon: 'wb-sunny' },
                                    { id: 'dinner', name: 'Bữa Tối', icon: 'nights-stay' }
                                ].map((meal) => (
                                    <TouchableOpacity
                                        key={meal.id}
                                        style={styles.mealOptionItem}
                                        onPress={() => confirmAddToPlan(meal.id)}
                                    >
                                        <View style={[styles.mealIconCircle, { backgroundColor: COLORS.primaryMuted }]}>
                                            <MaterialIcons name={meal.icon} size={24} color={COLORS.primary} />
                                        </View>
                                        <Text style={styles.mealOptionText}>{meal.name}</Text>
                                        <MaterialIcons name="chevron-right" size={24} color={COLORS.textMuted} />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </View>
                </Modal>
            )}

            <ChefFAB screenContext="recipeDetail" />
        </View>
    );
};

const styles = StyleSheet.create({
    // ... existing styles ...
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: COLORS.background,
        borderTopLeftRadius: RADIUS.xl,
        borderTopRightRadius: RADIUS.xl,
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.lg,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderLight,
    },
    modalTitle: {
        ...TYPOGRAPHY.heading2,
        color: COLORS.textPrimary,
    },
    modalSubtitle: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textSecondary,
        paddingHorizontal: SPACING.lg,
        marginTop: SPACING.md,
        marginBottom: SPACING.sm,
    },
    mealOptions: {
        paddingHorizontal: SPACING.lg,
    },
    mealOptionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderLight,
    },
    mealIconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.md,
    },
    mealOptionText: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.medium,
        color: COLORS.textPrimary,
        flex: 1,
    },
    // ... existing styles continued ...
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
    },
    imageContainer: {
        height: 400,
        width: width,
    },
    headerImage: {
        width: '100%',
        height: '100%',
    },
    placeholderContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.primaryMuted || '#E0E0E0',
    },
    headerOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.xl,
        paddingTop: SPACING.sm,
    },
    headerActions: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    iconBtn: {
        width: 44,
        height: 44,
        borderRadius: RADIUS.md,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    contentCard: {
        marginTop: -32,
        backgroundColor: COLORS.backgroundCard,
        borderTopLeftRadius: RADIUS.xxl,
        borderTopRightRadius: RADIUS.xxl,
        padding: SPACING.xl,
        minHeight: 600,
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: SPACING.lg,
    },
    title: {
        ...TYPOGRAPHY.heading1,
        color: COLORS.textPrimary,
        flex: 1,
        marginRight: SPACING.sm,
    },
    ratingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFBEB',
        paddingHorizontal: SPACING.sm,
        paddingVertical: 6,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: '#FEF3C7',
    },
    ratingText: {
        ...TYPOGRAPHY.bodyRegular,
        fontFamily: FONTS.bold,
        color: '#D97706',
        marginLeft: 4,
    },
    metaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: SPACING.xl,
    },
    metaItem: {
        flex: 1,
        alignItems: 'center',
    },
    metaIconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.primaryMuted,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    metaVal: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
    },
    metaLabel: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: COLORS.background,
        borderRadius: RADIUS.lg,
        padding: 6,
        marginBottom: SPACING.lg,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    tab: {
        flex: 1,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: RADIUS.md,
    },
    tabActive: {
        backgroundColor: COLORS.backgroundCard,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    tabText: {
        ...TYPOGRAPHY.bodyRegular,
        fontFamily: FONTS.bold,
        color: COLORS.textSecondary,
    },
    tabTextActive: {
        color: COLORS.primary,
    },
    tabContent: {
        paddingBottom: 150,
    },
    warningBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFBEB',
        padding: SPACING.md,
        borderRadius: RADIUS.md,
        marginBottom: SPACING.lg,
        borderWidth: 1,
        borderColor: '#FEF3C7',
        gap: SPACING.sm,
    },
    warningText: {
        ...TYPOGRAPHY.caption,
        color: '#92400E',
        flex: 1,
    },
    ingredientRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.md,
        padding: SPACING.md,
        backgroundColor: COLORS.background,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
        gap: SPACING.md,
    },
    ingredientText: {
        ...TYPOGRAPHY.bodyLarge,
        color: COLORS.textPrimary,
        flex: 1,
    },
    ingredientDisabledText: {
        color: COLORS.textMuted,
        textDecorationLine: 'line-through',
    },
    ingAmount: {
        fontFamily: FONTS.bold,
        color: COLORS.primary,
    },
    addShoppingBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.primary,
        paddingVertical: 16,
        borderRadius: RADIUS.lg,
        marginTop: SPACING.sm,
        gap: SPACING.sm,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    addShoppingBtnText: {
        ...TYPOGRAPHY.bodyLarge,
        color: COLORS.textOnPrimary,
    },
    stepItem: {
        flexDirection: 'row',
        marginBottom: SPACING.xs,
    },
    stepHeader: {
        alignItems: 'center',
        width: 40,
    },
    stepNumberCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    stepNumberText: {
        ...TYPOGRAPHY.bodyRegular,
        fontFamily: FONTS.bold,
        color: COLORS.textOnPrimary,
    },
    stepLine: {
        width: 2,
        flex: 1,
        backgroundColor: COLORS.borderLight,
        marginVertical: 4,
    },
    stepContent: {
        flex: 1,
        paddingBottom: SPACING.lg,
        paddingLeft: SPACING.sm,
    },
    stepText: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.medium,
        color: COLORS.textSecondary,
        lineHeight: 24,
    },
    bottomActions: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.md,
        flexDirection: 'row',
        gap: SPACING.md,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    planBtn: {
        width: 60,
        height: 60,
        borderRadius: RADIUS.lg,
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: COLORS.primary,
    },
    startBtn: {
        flex: 1,
        backgroundColor: COLORS.primary,
        height: 60,
        borderRadius: RADIUS.lg,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: SPACING.md,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
    },
    startBtnText: {
        ...TYPOGRAPHY.bodyLarge,
        fontSize: 18,
        color: COLORS.textOnPrimary,
    },
});

export default RecipeDetailScreen;
