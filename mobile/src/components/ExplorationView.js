import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Image,
    Dimensions,
    Modal,
    Alert
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import { recipeService } from '../services/recipeService';
import { supabase } from '../services/supabaseConfig';
import { mealPlanService } from '../services/mealPlanService';
import RecipeImage from './RecipeImage';
import FamilyCompatibilityBadge from './FamilyCompatibilityBadge';

const { width } = Dimensions.get('window');

const ExplorationView = ({ navigation, selectedDate, existingPlans, onPlanUpdated }) => {
    const [suggestedRecipes, setSuggestedRecipes] = useState([]);
    const [selectedMeals, setSelectedMeals] = useState({ breakfast: [], lunch: [], dinner: [] });
    const [loadingAI, setLoadingAI] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [isPremium, setIsPremium] = useState(false);
    const [suggestionMode, setSuggestionMode] = useState('creative'); // 'traditional' or 'creative'
    const [actionSheetVisible, setActionSheetVisible] = useState(false);
    const [selectedRecipeForAction, setSelectedRecipeForAction] = useState(null);

    // Đồng bộ hóa trạng thái từ Lịch ăn (Meal Plan) nếu tồn tại
    useEffect(() => {
        if (existingPlans) {
            const newSelectedMeals = { breakfast: [], lunch: [], dinner: [] };
            existingPlans.forEach(plan => {
                const mealType = plan.mealType || 'lunch';
                if (newSelectedMeals[mealType]) {
                    newSelectedMeals[mealType].push({
                        id: plan.recipe_id || plan.recipeId,
                        title: plan.recipe_title || plan.recipeTitle,
                        image: plan.recipe_image || plan.recipeImage,
                        planId: plan.id
                    });
                }
            });
            // Update selectedMeals to match the DB state for the selected date
            setSelectedMeals(newSelectedMeals);
        }
    }, [existingPlans]);

    useEffect(() => {
        fetchDailyMeals();
        checkPremiumStatus();
    }, []);

    // Live search logic
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (searchQuery.trim().length > 0) {
                handleSearch(searchQuery);
            } else {
                setSearchResults([]);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const handleSearch = async (query) => {
        setSearching(true);
        try {
            const result = await recipeService.searchRecipes(query);
            if (result.success) {
                setSearchResults(result.results || []);
            }
        } catch (error) {
            console.error("Search Error:", error);
        } finally {
            setSearching(false);
        }
    };

    const checkPremiumStatus = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setIsPremium(true);
        }
    };

    const fetchDailyMeals = async (mode = suggestionMode, isRefresh = false) => {
        setLoadingAI(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // Lần mở đầu tiên: kiểm tra cache trước
                if (!isRefresh) {
                    const cached = await recipeService.getDailySuggestionsCache();
                    if (cached && cached.success) {
                        setSuggestedRecipes(cached.suggestions);
                        setLoadingAI(false);
                        return;
                    }
                }

                // Refresh hoặc không có cache: gọi AI với danh sách loại trừ
                const excludeList = isRefresh ? await recipeService.getDailyExcludeList() : [];
                const result = await recipeService.suggestDailyMealsAI(user.id, mode, excludeList);
                if (result && result.success && result.suggestions) {
                    setSuggestedRecipes(result.suggestions);
                } else if (result && !result.success) {
                    Alert.alert('Có lỗi!', result.error || 'Server bận, vui lòng thử lại.');
                }
            }
        } catch (error) {
            console.error("Fetch Daily Meals Error:", error);
        } finally {
            setLoadingAI(false);
        }
    };

    const handleAddToMeal = async (mealType) => {
        if (!selectedRecipeForAction) return;

        const recipeToAdd = selectedRecipeForAction;

        setSelectedMeals(prev => ({
            ...prev,
            [mealType]: [...prev[mealType], recipeToAdd]
        }));
        setSuggestedRecipes(prev => prev.filter(r => r.id !== recipeToAdd.id));
        setActionSheetVisible(false);
        setSelectedRecipeForAction(null);

        // Sync with backend immediately
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const targetDate = selectedDate || new Date().toISOString().split('T')[0];
                const result = await mealPlanService.addToPlan(
                    user.id,
                    recipeToAdd.id,
                    recipeToAdd.title,
                    recipeToAdd.image,
                    targetDate,
                    mealType
                );
                
                if (result.success && result.id) {
                    setSelectedMeals(prev => ({
                        ...prev,
                        [mealType]: prev[mealType].map(r => r.id === recipeToAdd.id ? {...r, planId: result.id} : r)
                    }));
                    if (onPlanUpdated) { onPlanUpdated(); }
                }
            }
        } catch (error) {
            console.error("Meal Plan Sync Error:", error);
        }
    };

    const handleRemoveFromMeal = async (mealType, recipeId) => {
        const recipeToRestore = selectedMeals[mealType].find(r => r.id === recipeId);
        
        if (recipeToRestore) {
            setSuggestedRecipes(prev => [recipeToRestore, ...prev]);

            if (recipeToRestore.planId) {
                try {
                    await mealPlanService.removeFromPlan(recipeToRestore.planId);
                    if (onPlanUpdated) { onPlanUpdated(); }
                } catch(e) {
                    console.error("Meal Plan Remove Error:", e);
                }
            }
        }

        setSelectedMeals(prev => ({
            ...prev,
            [mealType]: prev[mealType].filter(r => r.id !== recipeId)
        }));
    };

    const handleRecipePress = (recipe) => {
        if (!recipe) return;
        navigation.navigate('RecipeDetail', {
            recipeId: recipe.id,
            initialRecipeData: recipe
        });
    };

    const renderMealSection = (recipes, label, icon, mealType) => {
        return (
            <View style={styles.mealGroup}>
                <View style={styles.mealGroupHeader}>
                    <View style={styles.mealIconWrapper}>
                        <MaterialIcons name={icon} size={20} color={COLORS.primary} />
                    </View>
                    <Text style={styles.mealGroupLabel}>{label.toUpperCase()}</Text>
                </View>
                {(!recipes || recipes.length === 0) ? (
                    <Text style={styles.emptyMealText}>Chưa có món nào. Thêm từ danh sách gợi ý 👆</Text>
                ) : (
                    recipes.map((recipe, index) => (
                        <TouchableOpacity
                            key={recipe.planId ? `plan_${recipe.planId}` : `recipe_${recipe.id}_${index}`}
                            style={styles.mealCard}
                            onPress={() => handleRecipePress(recipe)}
                        >
                            <RecipeImage
                                uri={recipe?.image}
                                style={styles.mealThumbnail}
                                defaultIcon="restaurant"
                                iconSize={18}
                            />
                            <View style={styles.mealInfo}>
                                <Text style={styles.mealTitle} numberOfLines={1}>
                                    {recipe?.title || 'Đang tải...'}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => handleRemoveFromMeal(mealType, recipe.id)} style={styles.removeMealBtn}>
                                <MaterialIcons name="close" size={20} color={'#FF3B30'} />
                            </TouchableOpacity>
                        </TouchableOpacity>
                    ))
                )}
            </View>
        );
    };

    const renderSearchResult = (item) => (
        <TouchableOpacity
            key={item.id}
            style={styles.searchResultCard}
            onPress={() => handleRecipePress(item)}
        >
            <RecipeImage
                uri={item.image}
                style={styles.searchResultImage}
                defaultIcon="restaurant"
                iconSize={32}
            />
            <View style={styles.searchResultInfo}>
                <Text style={styles.searchResultTitle} numberOfLines={1}>{item.title}</Text>
                <View style={styles.searchResultMeta}>
                    <Text style={styles.searchResultMetaText}>{item.readyInMinutes || 30}p</Text>
                    <Text style={styles.searchResultSeparator}>•</Text>
                    <Text style={styles.searchResultMetaText}>{item.healthScore || 0}đ sức khỏe</Text>
                </View>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>
    );

    return (
        <ScrollView
            style={styles.container}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
        >
            {/* 1. Tự động hóa AI Section */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <View style={styles.aiHeaderTitle}>
                        <MaterialIcons name="auto-awesome" size={20} color={COLORS.primary} />
                        <Text style={styles.sectionTitle}>Gợi ý thực đơn hôm nay</Text>
                    </View>
                    <TouchableOpacity onPress={() => fetchDailyMeals(suggestionMode, true)}>
                        <MaterialIcons name="refresh" size={20} color={COLORS.primary} />
                    </TouchableOpacity>
                </View>

                {/* --- TOGGLE TRUYỀN THỐNG / SÁNG TẠO --- */}
                <View style={styles.toggleContainer}>
                    <TouchableOpacity 
                        style={[styles.toggleButton, suggestionMode === 'traditional' && styles.toggleButtonActive]}
                        onPress={() => {
                            if (suggestionMode !== 'traditional') {
                                setSuggestionMode('traditional');
                                fetchDailyMeals('traditional'); // Fetch with new mode
                            }
                        }}
                    >
                        <Text style={[styles.toggleText, suggestionMode === 'traditional' && styles.toggleTextActive]}>Truyền thống</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.toggleButton, suggestionMode === 'creative' && styles.toggleButtonActive]}
                        onPress={() => {
                            if (suggestionMode !== 'creative') {
                                setSuggestionMode('creative');
                                fetchDailyMeals('creative');
                            }
                        }}
                    >
                        <Text style={[styles.toggleText, suggestionMode === 'creative' && styles.toggleTextActive]}>Sáng tạo</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.aiCard}>
                    {loadingAI ? (
                        <View style={styles.loaderContainer}>
                            <ActivityIndicator size="small" color={COLORS.primary} />
                            <Text style={styles.loaderText}>AI đang cân đối dinh dưỡng...</Text>
                        </View>
                    ) : (
                        <View style={styles.mealsContainer}>
                            {/* Danh sách gợi ý phẳng */}
                            <View style={styles.suggestionsWrapper}>
                                <Text style={styles.suggestionsHeader}>Danh sách gợi ý</Text>
                                {suggestedRecipes && suggestedRecipes.length > 0 ? (
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsScroll}>
                                        {suggestedRecipes.map(recipe => (
                                            <TouchableOpacity key={recipe.id} style={styles.suggestionCard} onPress={() => handleRecipePress(recipe)}>
                                                <RecipeImage uri={recipe.image} style={styles.suggestionImage} defaultIcon="restaurant" />
                                                <Text style={styles.suggestionTitle} numberOfLines={2}>{recipe.title}</Text>
                                                <TouchableOpacity 
                                                    style={styles.addRecipeBtn}
                                                    onPress={() => {
                                                        setSelectedRecipeForAction(recipe);
                                                        setActionSheetVisible(true);
                                                    }}
                                                >
                                                    <MaterialIcons name="add" size={20} color={COLORS.white} />
                                                </TouchableOpacity>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                ) : (
                                    <View style={{ padding: SPACING.lg, alignItems: 'center', backgroundColor: COLORS.white, borderRadius: RADIUS.lg, marginHorizontal: SPACING.sm }}>
                                        <Text style={{ ...TYPOGRAPHY.bodyRegular, color: COLORS.textMuted, marginBottom: SPACING.md, textAlign: 'center' }}>
                                            Đã hết món gợi ý, hãy bấm làm mới nhé!
                                        </Text>
                                        <TouchableOpacity 
                                            style={{ backgroundColor: COLORS.primaryFade, paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.md }}
                                            onPress={() => fetchDailyMeals(suggestionMode, true)}
                                        >
                                            <Text style={{ fontFamily: FONTS.bold, color: COLORS.primary }}>Tự động lên thêm món</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>

                            {(suggestedRecipes?.length > 0 || selectedMeals?.breakfast?.length > 0) && (
                                <View style={styles.dividerFull} />
                            )}

                            {/* 3 Khay Bữa ăn */}
                            {renderMealSection(selectedMeals.breakfast, 'Bữa sáng', 'wb-twilight', 'breakfast')}
                            <View style={styles.divider} />
                            {renderMealSection(selectedMeals.lunch, 'Bữa trưa', 'wb-sunny', 'lunch')}
                            <View style={styles.divider} />
                            {renderMealSection(selectedMeals.dinner, 'Bữa tối', 'nights-stay', 'dinner')}
                        </View>
                    )}
                </View>
            </View>

            {/* 2. Tìm kiếm cùng AI Banner */}
            <TouchableOpacity
                style={styles.aiSearchBanner}
                onPress={() => navigation.navigate('AIAuto')}
            >
                <View style={styles.aiBannerContent}>
                    <View style={styles.aiBannerText}>
                        <Text style={styles.aiBannerTitle}>Tìm món cùng Bếp Trưởng AI</Text>
                        <Text style={styles.aiBannerSub}>Nhập yêu cầu đặc biệt: "Món ít dầu mỡ", "Bữa tối cho bé"...</Text>
                    </View>
                    <View style={styles.aiBannerIcon}>
                        <MaterialIcons name="psychology" size={32} color={COLORS.white} />
                    </View>
                </View>
                <View style={styles.aiBannerSearch}>
                    <Text style={styles.aiBannerPlaceholder}>Hỏi gì cũng được...</Text>
                    <MaterialIcons name="send" size={18} color={COLORS.primary} />
                </View>
            </TouchableOpacity>

            {/* 3. Kho công thức / Tìm kiếm đơn giản */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Kho công thức truyền thống</Text>
                </View>

                {/* Simplified Search Bar */}
                <View style={styles.searchBarWrapper}>
                    <MaterialIcons name="search" size={22} color={COLORS.textMuted} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Tìm món ăn hoặc nguyên liệu..."
                        placeholderTextColor={COLORS.textMuted}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <MaterialIcons name="close" size={20} color={COLORS.textMuted} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Results Display */}
                <View style={styles.resultsContainer}>
                    {searching ? (
                        <View style={styles.searchingLoader}>
                            <ActivityIndicator size="small" color={COLORS.primary} />
                        </View>
                    ) : searchQuery.length > 0 ? (
                        searchResults.length > 0 ? (
                            <View style={styles.resultsList}>
                                {searchResults.map(renderSearchResult)}
                            </View>
                        ) : (
                            <View style={styles.emptyResults}>
                                <Text style={styles.emptyResultsText}>Không tìm thấy món nào.</Text>
                            </View>
                        )
                    ) : (
                        <View style={styles.initialState}>
                            <MaterialIcons name="restaurant-menu" size={40} color={COLORS.border} />
                            <Text style={styles.initialStateText}>Nhập tên món để khám phá hàng ngàn công thức Việt</Text>
                        </View>
                    )}
                </View>
            </View>

            <View style={{ height: 40 }} />

            {/* Modal for Selecting Meal */}
            <Modal transparent visible={actionSheetVisible} animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Thêm món này vào bữa nào?</Text>
                        <TouchableOpacity style={styles.modalOption} onPress={() => handleAddToMeal('breakfast')}>
                            <Text style={styles.modalOptionText}>Bữa sáng</Text>
                        </TouchableOpacity>
                        <View style={styles.modalDivider} />
                        <TouchableOpacity style={styles.modalOption} onPress={() => handleAddToMeal('lunch')}>
                            <Text style={styles.modalOptionText}>Bữa trưa</Text>
                        </TouchableOpacity>
                        <View style={styles.modalDivider} />
                        <TouchableOpacity style={styles.modalOption} onPress={() => handleAddToMeal('dinner')}>
                            <Text style={styles.modalOptionText}>Bữa tối</Text>
                        </TouchableOpacity>
                        <View style={styles.modalDivider} />
                        <TouchableOpacity style={styles.modalCancel} onPress={() => setActionSheetVisible(false)}>
                            <Text style={styles.modalCancelText}>Hủy bỏ</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        padding: SPACING.lg,
    },
    section: {
        marginBottom: SPACING.xl,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    aiHeaderTitle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionTitle: {
        ...TYPOGRAPHY.heading2,
        color: COLORS.textPrimary,
    },
    toggleContainer: {
        flexDirection: 'row',
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.lg,
        padding: 4,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
    },
    toggleButton: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: RADIUS.md,
    },
    toggleButtonActive: {
        backgroundColor: COLORS.primaryFade,
    },
    toggleText: {
        ...TYPOGRAPHY.bodyMedium,
        fontFamily: FONTS.medium,
        color: COLORS.textMuted,
    },
    toggleTextActive: {
        color: COLORS.primary,
        fontFamily: FONTS.bold,
    },
    aiCard: {
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.xl,
        padding: SPACING.md,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 4,
        borderWidth: 1,
        borderColor: COLORS.primaryMuted,
    },
    loaderContainer: {
        padding: SPACING.xl,
        alignItems: 'center',
        gap: SPACING.sm,
    },
    loaderText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
        fontFamily: FONTS.medium,
    },
    emptyText: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textMuted,
        textAlign: 'center',
        paddingVertical: SPACING.md,
    },
    mealsContainer: {
        gap: 0,
    },
    mealGroup: {
        marginBottom: SPACING.sm,
    },
    mealGroupHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.xs,
    },
    mealGroupLabel: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.bold,
        color: COLORS.primary,
        letterSpacing: 1,
    },
    mealOrdinal: {
        ...TYPOGRAPHY.bodyMedium,
        fontFamily: FONTS.bold,
        color: COLORS.primary,
        marginRight: SPACING.sm,
        width: 20,
    },
    mealThumbnail: {
        width: 40,
        height: 40,
        borderRadius: RADIUS.md,
        marginRight: SPACING.sm,
    },
    mealCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.sm,
    },
    mealIconWrapper: {
        width: 40,
        height: 40,
        borderRadius: RADIUS.md,
        backgroundColor: COLORS.primaryFade,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.md,
    },
    mealInfo: {
        flex: 1,
    },
    mealLabel: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
        marginBottom: 2,
    },
    mealTitle: {
        ...TYPOGRAPHY.bodyMedium,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
    },
    removeMealBtn: {
        padding: SPACING.xs,
        marginLeft: SPACING.sm,
    },
    emptyMealText: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textMuted,
        fontStyle: 'italic',
        marginBottom: SPACING.sm,
        marginLeft: 56,
        fontSize: 13,
    },
    suggestionsWrapper: {
        marginBottom: SPACING.md,
    },
    suggestionsHeader: {
        ...TYPOGRAPHY.bodyMedium,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
        marginBottom: SPACING.sm,
        paddingHorizontal: SPACING.sm,
    },
    suggestionsScroll: {
        paddingHorizontal: SPACING.xs,
        paddingBottom: SPACING.sm,
        gap: SPACING.sm,
    },
    suggestionCard: {
        width: 120,
        backgroundColor: COLORS.white,
        borderRadius: RADIUS.lg,
        padding: SPACING.sm,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.borderLight,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    suggestionImage: {
        width: 100,
        height: 80,
        borderRadius: RADIUS.md,
        marginBottom: SPACING.xs,
    },
    suggestionTitle: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.medium,
        color: COLORS.textPrimary,
        textAlign: 'center',
        marginBottom: SPACING.xs,
        height: 32,
    },
    addRecipeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dividerFull: {
        height: 1,
        backgroundColor: COLORS.borderLight,
        marginVertical: SPACING.md,
    },
    fridgeToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: SPACING.md,
        paddingVertical: 4,
    },
    fridgeToggleText: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textMuted,
        fontFamily: FONTS.medium,
    },
    fridgeToggleTextActive: {
        color: COLORS.textPrimary,
        fontFamily: FONTS.bold,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.borderLight,
        marginLeft: 56,
    },
    aiSearchBanner: {
        backgroundColor: COLORS.primary,
        borderRadius: RADIUS.xl,
        padding: SPACING.lg,
        marginBottom: SPACING.xl,
    },
    aiBannerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    aiBannerText: {
        flex: 1,
    },
    aiBannerTitle: {
        ...TYPOGRAPHY.heading3,
        color: COLORS.white,
    },
    aiBannerSub: {
        ...TYPOGRAPHY.caption,
        color: 'rgba(255, 255, 255, 0.8)',
        marginTop: 4,
    },
    aiBannerIcon: {
        marginLeft: SPACING.md,
    },
    aiBannerSearch: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.white,
        borderRadius: RADIUS.lg,
        paddingHorizontal: SPACING.md,
        height: 44,
    },
    aiBannerPlaceholder: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textMuted,
    },
    searchBarWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.lg,
        paddingHorizontal: SPACING.md,
        height: 52,
        marginTop: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
    },
    searchInput: {
        flex: 1,
        marginLeft: SPACING.sm,
        ...TYPOGRAPHY.bodyLarge,
        color: COLORS.textPrimary,
    },
    resultsContainer: {
        marginTop: SPACING.lg,
        minHeight: 100,
    },
    searchingLoader: {
        padding: SPACING.xl,
        alignItems: 'center',
    },
    resultsList: {
        gap: SPACING.md,
    },
    searchResultCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.lg,
        padding: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
    },
    searchResultImage: {
        width: 60,
        height: 60,
        borderRadius: RADIUS.md,
    },
    searchResultInfo: {
        flex: 1,
        marginLeft: SPACING.md,
    },
    searchResultTitle: {
        ...TYPOGRAPHY.bodyMedium,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
    },
    searchResultMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    searchResultMetaText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
    },
    searchResultSeparator: {
        marginHorizontal: 6,
        color: COLORS.border,
        fontSize: 8,
    },
    emptyResults: {
        padding: SPACING.xl,
        alignItems: 'center',
    },
    emptyResultsText: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textMuted,
    },
    initialState: {
        padding: SPACING.xl,
        alignItems: 'center',
        gap: SPACING.md,
    },
    initialStateText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
        textAlign: 'center',
        lineHeight: 18,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: COLORS.background,
        borderTopLeftRadius: RADIUS.xl,
        borderTopRightRadius: RADIUS.xl,
        padding: SPACING.xl,
        paddingBottom: 40,
    },
    modalTitle: {
        ...TYPOGRAPHY.heading3,
        color: COLORS.textPrimary,
        textAlign: 'center',
        marginBottom: SPACING.lg,
    },
    modalOption: {
        paddingVertical: SPACING.md,
        alignItems: 'center',
    },
    modalOptionText: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.medium,
        color: COLORS.primary,
    },
    modalDivider: {
        height: 1,
        backgroundColor: COLORS.borderLight,
    },
    modalCancel: {
        paddingVertical: SPACING.md,
        alignItems: 'center',
        marginTop: SPACING.md,
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.lg,
    },
    modalCancelText: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: '#FF3B30',
    },
});

export default ExplorationView;
