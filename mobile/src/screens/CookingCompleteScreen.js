import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    Switch,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import { cookingService } from '../services/cookingService';
import { recipeStorageService } from '../services/recipeStorageService';
import { supabase } from '../services/supabaseConfig';
import { showSuccessToast } from '../components/Toast';

import RecipeImage from '../components/RecipeImage';

const CookingCompleteScreen = ({ route, navigation }) => {
    const params = route.params || {};
    const { planId, recipeId, recipeTitle, recipeImage, initialRecipeData } = params;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [ingredients, setIngredients] = useState([]);
    const [recipe, setRecipe] = useState(initialRecipeData || null);
    const [activeTab, setActiveTab] = useState('ingredients'); // 'ingredients' or 'steps'
    const [addToShoppingList, setAddToShoppingList] = useState(true);
    const [notes, setNotes] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                Alert.alert('Lỗi', 'Vui lòng đăng nhập lại');
                navigation.goBack();
                return;
            }

            let recipeData = null;
            let extractedIngredients = [];

            // PRIORITY 1: Use initialRecipeData directly if available (passed from RecipeDetailScreen)
            if (initialRecipeData && initialRecipeData.extendedIngredients) {
                console.log('[CookingComplete] Using initialRecipeData directly');
                recipeData = initialRecipeData;
                extractedIngredients = (initialRecipeData.extendedIngredients || []).map(ing => {
                    let amount = ing.amount;
                    let unit = ing.unit || '';
                    
                    if (amount === 0 && ing.original) {
                        const match = ing.original.match(/^([\d./]+)\s*(.*)$/);
                        if (match) {
                            if (match[1].includes('/')) {
                                const parts = match[1].split('/');
                                amount = parseFloat(parts[0]) / parseFloat(parts[1]);
                            } else {
                                amount = parseFloat(match[1]);
                            }
                            if (!unit && match[2]) unit = match[2].trim().split(' ')[0];
                        }
                    }

                    return {
                        name: ing.nameClean || ing.name,
                        amount: Math.round(amount * 10) / 10 || 1,
                        unit: unit || 'phần',
                        originalAmount: amount,
                        id: ing.id
                    };
                });
            } else {
                // FALLBACK: Fetch from cookingService (for non-AI or meal plan recipes)
                console.log('[CookingComplete] Fetching from cookingService');
                const res = await cookingService.getRecipeIngredients(recipeId, recipeTitle);
                if (res.success) {
                    recipeData = res.recipe;
                    extractedIngredients = res.ingredients;
                } else {
                    console.warn('[CookingComplete] cookingService failed:', res.error);
                }
            }

            if (recipeData) {
                setRecipe(recipeData);
                // Lưu vào persistent storage để xem lại bất cứ lúc nào
                recipeStorageService.saveRecipe(recipeData);
            }

            // Match with inventory (works even with empty ingredients)
            const matchResult = await cookingService.matchWithInventory(user.id, extractedIngredients);
            if (!matchResult.success) {
                // Still allow cooking even if inventory match fails
                console.warn('[CookingComplete] Inventory match failed, using raw ingredients');
                setIngredients(extractedIngredients.map(ing => ({
                    ...ing,
                    inventoryItemId: null,
                    availableAmount: 0,
                    isAvailable: false,
                    willBeEmpty: false,
                    amountToDeduct: 0,
                    editableAmount: '0',
                    isUsed: false,
                })));
            } else {
                // Set ingredients with editable amounts
                setIngredients(matchResult.matched.map(ing => ({
                    ...ing,
                    editableAmount: (ing.amountToDeduct || 0).toString(),
                    isUsed: ing.isAvailable,
                })));
            }

        } catch (error) {
            console.error('Error loading data:', error);
            Alert.alert('Lỗi', 'Đã có lỗi xảy ra');
        } finally {
            setLoading(false);
        }
    };

    const toggleIngredientUsed = (index) => {
        setIngredients(prev => {
            const updated = [...prev];
            updated[index].isUsed = !updated[index].isUsed;
            return updated;
        });
    };

    const updateIngredientAmount = (index, value) => {
        setIngredients(prev => {
            const updated = [...prev];
            updated[index].editableAmount = value;
            return updated;
        });
    };

    const handleConfirm = async () => {
        try {
            setSaving(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Prepare ingredients with updated amounts
            const ingredientsToDeduct = ingredients
                .filter(ing => ing.isUsed && ing.inventoryItemId)
                .map(ing => ({
                    ...ing,
                    amountToDeduct: parseFloat(ing.editableAmount) || 0,
                }));

            const result = await cookingService.markAsCooked(
                user.id,
                planId,
                ingredientsToDeduct,
                {
                    addDepletedToShoppingList: addToShoppingList,
                    notes,
                    recipeInfo: {
                        recipeId,
                        recipeTitle,
                    }
                }
            );

            if (result.success) {
                showSuccessToast('Đã cập nhật tủ lạnh!');

                if (result.depleted && result.depleted.length > 0) {
                    Alert.alert(
                        'Nguyên liệu đã hết',
                        `${result.depleted.map(d => d.name).join(', ')} đã hết và ${addToShoppingList ? 'được thêm vào danh sách mua sắm.' : 'cần mua thêm.'}`,
                        [{ text: 'OK', onPress: () => navigation.goBack() }]
                    );
                } else {
                    navigation.goBack();
                }
            } else {
                Alert.alert('Lỗi', result.error || 'Không thể cập nhật');
            }
        } catch (error) {
            console.error('Error confirming:', error);
            Alert.alert('Lỗi', 'Đã có lỗi xảy ra');
        } finally {
            setSaving(false);
        }
    };

    const handleSkip = () => {
        Alert.alert(
            'Bỏ qua cập nhật?',
            'Tủ lạnh sẽ không được cập nhật. Bạn có chắc chắn?',
            [
                { text: 'Hủy', style: 'cancel' },
                { text: 'Bỏ qua', onPress: () => navigation.goBack() },
            ]
        );
    };

    const availableCount = ingredients.filter(i => i.isAvailable).length;
    const usedCount = ingredients.filter(i => i.isUsed).length;

    // Helper to render steps
    const renderSteps = () => {
        const steps = recipe?.analyzedInstructions?.[0]?.steps || [];
        if (steps.length === 0) {
            return (
                <View style={styles.emptyContainer}>
                    <MaterialIcons name="description" size={48} color={COLORS.border} />
                    <Text style={styles.emptyText}>Không tìm thấy hướng dẫn nấu.</Text>
                </View>
            );
        }

        return (
            <View style={styles.stepsContainer}>
                {steps.map((step, idx) => (
                    <View key={idx} style={styles.stepItem}>
                        <View style={styles.stepNumber}>
                            <Text style={styles.stepNumberText}>{step.number || idx + 1}</Text>
                        </View>
                        <Text style={styles.stepText}>{step.step}</Text>
                    </View>
                ))}
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Đang chuẩn bị...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <MaterialIcons name="close" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Đang nấu</Text>
                <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
                    <Text style={styles.skipText}>Bỏ qua</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Recipe Info */}
                <View style={styles.recipeCard}>
                    <RecipeImage
                        uri={recipeImage || recipe?.image}
                        style={styles.recipeImage}
                        defaultIcon="restaurant"
                        iconSize={40}
                    />
                    <View style={styles.recipeInfo}>
                        <Text style={styles.recipeTitle}>{recipeTitle || recipe?.title}</Text>
                        <View style={styles.statsRow}>
                            <View style={styles.statItem}>
                                <MaterialIcons name="restaurant-menu" size={16} color={COLORS.primary} />
                                <Text style={styles.statText}>{ingredients.length} nguyên liệu</Text>
                            </View>
                            {recipe?.readyInMinutes && (
                                <View style={styles.statItem}>
                                    <MaterialIcons name="timer" size={16} color={COLORS.warning} />
                                    <Text style={styles.statText}>{recipe.readyInMinutes} phút</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>

                {/* Tabs */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'ingredients' && styles.activeTab]}
                        onPress={() => setActiveTab('ingredients')}
                    >
                        <Text style={[styles.tabText, activeTab === 'ingredients' && styles.activeTabText]}>Nguyên liệu</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'steps' && styles.activeTab]}
                        onPress={() => setActiveTab('steps')}
                    >
                        <Text style={[styles.tabText, activeTab === 'steps' && styles.activeTabText]}>Cách nấu</Text>
                    </TouchableOpacity>
                </View>

                {activeTab === 'ingredients' ? (
                    <>
                        {/* Instructions */}
                        <View style={styles.instructionCard}>
                            <MaterialIcons name="info-outline" size={20} color={COLORS.primary} />
                            <Text style={styles.instructionText}>
                                Đánh dấu nguyên liệu bạn đã dùng. Số lượng sẽ được trừ trong tủ lạnh.
                            </Text>
                        </View>

                        {/* Ingredients List */}
                        <Text style={styles.sectionTitle}>Nguyên liệu đã dùng ({usedCount})</Text>

                        {ingredients.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <MaterialIcons name="list" size={48} color={COLORS.border} />
                                <Text style={styles.emptyText}>Không tìm thấy nguyên liệu.</Text>
                            </View>
                        ) : (
                            ingredients.map((ing, index) => (
                                <View
                                    key={index}
                                    style={[
                                        styles.ingredientCard,
                                        !ing.isAvailable && styles.ingredientCardUnavailable,
                                    ]}
                                >
                                    <TouchableOpacity
                                        style={styles.checkbox}
                                        onPress={() => toggleIngredientUsed(index)}
                                        disabled={!ing.isAvailable}
                                    >
                                        <MaterialIcons
                                            name={ing.isUsed ? "check-box" : "check-box-outline-blank"}
                                            size={24}
                                            color={ing.isAvailable ? (ing.isUsed ? COLORS.primary : COLORS.border) : COLORS.textMuted}
                                        />
                                    </TouchableOpacity>

                                    <View style={styles.ingredientInfo}>
                                        <Text style={[
                                            styles.ingredientName,
                                            !ing.isAvailable && styles.ingredientNameUnavailable,
                                        ]}>
                                            {ing.name}
                                        </Text>
                                        {ing.isAvailable ? (
                                            <Text style={styles.availableText}>
                                                Trong tủ lạnh: {ing.availableAmount} {ing.availableUnit}
                                            </Text>
                                        ) : (
                                            <Text style={styles.unavailableText}>
                                                Không có trong tủ lạnh
                                            </Text>
                                        )}
                                    </View>

                                    {ing.isAvailable && (
                                        <View style={styles.amountContainer}>
                                            <TextInput
                                                style={styles.amountInput}
                                                value={ing.editableAmount}
                                                onChangeText={(val) => updateIngredientAmount(index, val)}
                                                keyboardType="numeric"
                                                editable={ing.isUsed}
                                            />
                                            <Text style={styles.unitText}>{ing.unit || ing.availableUnit}</Text>
                                        </View>
                                    )}

                                    {ing.willBeEmpty && ing.isUsed && (
                                        <View style={styles.depletedBadge}>
                                            <MaterialIcons name="warning" size={14} color={COLORS.warning} />
                                        </View>
                                    )}
                                </View>
                            ))
                        )}

                        {/* Options */}
                        <View style={styles.optionCard}>
                            <View style={styles.optionRow}>
                                <View style={styles.optionInfo}>
                                    <MaterialIcons name="shopping-cart" size={24} color={COLORS.primary} />
                                    <View style={styles.optionTextContainer}>
                                        <Text style={styles.optionTitle}>Tự động thêm vào danh sách mua sắm</Text>
                                        <Text style={styles.optionSubtitle}>Khi nguyên liệu trong tủ lạnh đã dùng hết</Text>
                                    </View>
                                </View>
                                <Switch
                                    value={addToShoppingList}
                                    onValueChange={setAddToShoppingList}
                                    trackColor={{ false: COLORS.border, true: COLORS.primaryMuted }}
                                    thumbColor={addToShoppingList ? COLORS.primary : COLORS.grayLight}
                                />
                            </View>
                        </View>

                        {/* Notes */}
                        <View style={styles.notesContainer}>
                            <Text style={styles.notesLabel}>Ghi chú bữa ăn</Text>
                            <TextInput
                                style={styles.notesInput}
                                placeholder="Ví dụ: Thêm chút ớt, giảm muối..."
                                value={notes}
                                onChangeText={setNotes}
                                multiline
                                numberOfLines={2}
                            />
                        </View>
                    </>
                ) : (
                    renderSteps()
                )}

                <View style={styles.bottomSpacer} />
            </ScrollView>

            {/* Bottom Button */}
            <View style={styles.bottomActions}>
                <TouchableOpacity
                    style={[styles.confirmButton, (saving || ingredients.length === 0) && styles.buttonDisabled]}
                    onPress={handleConfirm}
                    disabled={saving || ingredients.length === 0}
                >
                    {saving ? (
                        <ActivityIndicator color={COLORS.textOnPrimary} />
                    ) : (
                        <>
                            <MaterialIcons name="check" size={24} color={COLORS.textOnPrimary} />
                            <Text style={styles.confirmButtonText}>Xác nhận & Cập nhật tủ lạnh</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
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
    loadingText: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textSecondary,
        marginTop: SPACING.md,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderLight,
    },
    backButton: {
        padding: SPACING.xs,
    },
    headerTitle: {
        ...TYPOGRAPHY.heading2,
        color: COLORS.textPrimary,
    },
    skipButton: {
        padding: SPACING.xs,
    },
    skipText: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textSecondary,
    },
    content: {
        flex: 1,
        paddingHorizontal: SPACING.lg,
    },
    recipeCard: {
        flexDirection: 'row',
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.lg,
        padding: SPACING.md,
        marginTop: SPACING.lg,
        gap: SPACING.md,
    },
    recipeImage: {
        width: 80,
        height: 80,
        borderRadius: RADIUS.md,
    },
    recipeInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    recipeTitle: {
        ...TYPOGRAPHY.heading3,
        color: COLORS.textPrimary,
        marginBottom: SPACING.xs,
    },
    statsRow: {
        flexDirection: 'row',
        gap: SPACING.md,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.md,
        padding: 4,
        marginTop: SPACING.lg,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
    },
    tab: {
        flex: 1,
        paddingVertical: SPACING.sm,
        alignItems: 'center',
        borderRadius: RADIUS.sm,
    },
    activeTab: {
        backgroundColor: COLORS.primary,
    },
    tabText: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textSecondary,
        fontFamily: FONTS.medium,
    },
    activeTabText: {
        color: COLORS.textOnPrimary,
    },
    instructionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primaryMuted,
        borderRadius: RADIUS.md,
        padding: SPACING.md,
        marginTop: SPACING.md,
        gap: SPACING.sm,
    },
    instructionText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.primary,
        flex: 1,
    },
    sectionTitle: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
        marginTop: SPACING.lg,
        marginBottom: SPACING.sm,
    },
    ingredientCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.md,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
    },
    ingredientCardUnavailable: {
        opacity: 0.6,
        backgroundColor: COLORS.background,
    },
    checkbox: {
        marginRight: SPACING.sm,
    },
    ingredientInfo: {
        flex: 1,
    },
    ingredientName: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textPrimary,
        fontFamily: FONTS.medium,
    },
    ingredientNameUnavailable: {
        color: COLORS.textMuted,
    },
    availableText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.success,
        marginTop: 2,
    },
    unavailableText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
        marginTop: 2,
    },
    amountContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
    },
    amountInput: {
        width: 60,
        height: 36,
        backgroundColor: COLORS.background,
        borderRadius: RADIUS.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
        textAlign: 'center',
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textPrimary,
    },
    unitText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
        minWidth: 30,
    },
    depletedBadge: {
        marginLeft: SPACING.xs,
    },
    stepsContainer: {
        marginTop: SPACING.lg,
    },
    stepItem: {
        flexDirection: 'row',
        marginBottom: SPACING.lg,
        gap: SPACING.md,
    },
    stepNumber: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: COLORS.primaryMuted,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    stepNumberText: {
        ...TYPOGRAPHY.bodySmall,
        color: COLORS.primary,
        fontFamily: FONTS.bold,
    },
    stepText: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textPrimary,
        flex: 1,
        lineHeight: 22,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.lg,
        marginTop: SPACING.lg,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
        borderStyle: 'dashed',
    },
    emptyText: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textMuted,
        marginTop: SPACING.md,
    },
    optionCard: {
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.md,
        padding: SPACING.md,
        marginTop: SPACING.lg,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    optionInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: SPACING.md,
    },
    optionTextContainer: {
        flex: 1,
    },
    optionTitle: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textPrimary,
        fontFamily: FONTS.medium,
    },
    optionSubtitle: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    notesContainer: {
        marginTop: SPACING.lg,
    },
    notesLabel: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textSecondary,
        marginBottom: SPACING.xs,
    },
    notesInput: {
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: SPACING.md,
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textPrimary,
        minHeight: 60,
        textAlignVertical: 'top',
    },
    bottomSpacer: {
        height: 120,
    },
    bottomActions: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: COLORS.backgroundCard,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        paddingBottom: SPACING.xl,
        borderTopWidth: 1,
        borderTopColor: COLORS.borderLight,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    confirmButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.primary,
        borderRadius: RADIUS.lg,
        paddingVertical: SPACING.md,
        gap: SPACING.sm,
    },
    buttonDisabled: {
        opacity: 0.7,
        backgroundColor: COLORS.border,
    },
    confirmButtonText: {
        ...TYPOGRAPHY.bodyLarge,
        color: COLORS.textOnPrimary,
        fontFamily: FONTS.bold,
    },
});

export default CookingCompleteScreen;
