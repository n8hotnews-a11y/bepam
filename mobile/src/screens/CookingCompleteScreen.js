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
import { supabase } from '../services/supabaseConfig';
import { showSuccessToast } from '../components/Toast';

import RecipeImage from '../components/RecipeImage';

const CookingCompleteScreen = ({ route, navigation }) => {
    const params = route.params || {};
    const { planId, recipeId, recipeTitle, recipeImage } = params;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [ingredients, setIngredients] = useState([]);
    const [addToShoppingList, setAddToShoppingList] = useState(true);
    const [notes, setNotes] = useState('');

    useEffect(() => {
        loadIngredients();
    }, []);

    const loadIngredients = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                Alert.alert('Lỗi', 'Vui lòng đăng nhập lại');
                navigation.goBack();
                return;
            }

            // Get recipe ingredients
            const ingResult = await cookingService.getRecipeIngredients(recipeId, recipeTitle);
            if (!ingResult.success) {
                Alert.alert('Lỗi', 'Không thể tải nguyên liệu');
                navigation.goBack();
                return;
            }

            // Match with inventory
            const matchResult = await cookingService.matchWithInventory(user.id, ingResult.ingredients);
            if (!matchResult.success) {
                Alert.alert('Lỗi', 'Không thể kiểm tra tủ lạnh');
                navigation.goBack();
                return;
            }

            // Set ingredients with editable amounts
            setIngredients(matchResult.matched.map(ing => ({
                ...ing,
                editableAmount: (ing.amountToDeduct || 0).toString(),
                isUsed: ing.isAvailable, // Default to checked if available in inventory
            })));

        } catch (error) {
            console.error('Error loading ingredients:', error);
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

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Đang tải nguyên liệu...</Text>
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
                <Text style={styles.headerTitle}>Đã nấu xong!</Text>
                <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
                    <Text style={styles.skipText}>Bỏ qua</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Recipe Info */}
                <View style={styles.recipeCard}>
                    <RecipeImage
                        uri={recipeImage}
                        style={styles.recipeImage}
                        defaultIcon="restaurant"
                        iconSize={40}
                    />
                    <View style={styles.recipeInfo}>
                        <Text style={styles.recipeTitle}>{recipeTitle}</Text>
                        <View style={styles.statsRow}>
                            <View style={styles.statItem}>
                                <MaterialIcons name="check-circle" size={16} color={COLORS.success} />
                                <Text style={styles.statText}>{availableCount} có sẵn</Text>
                            </View>
                            <View style={styles.statItem}>
                                <MaterialIcons name="remove-shopping-cart" size={16} color={COLORS.warning} />
                                <Text style={styles.statText}>{ingredients.length - availableCount} thiếu</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Instructions */}
                <View style={styles.instructionCard}>
                    <MaterialIcons name="info-outline" size={20} color={COLORS.primary} />
                    <Text style={styles.instructionText}>
                        Điều chỉnh số lượng nguyên liệu bạn đã sử dụng. Tủ lạnh sẽ được cập nhật tự động.
                    </Text>
                </View>

                {/* Ingredients List */}
                <Text style={styles.sectionTitle}>Nguyên liệu đã dùng ({usedCount})</Text>

                {ingredients.map((ing, index) => (
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
                                    Có sẵn: {ing.availableAmount} {ing.availableUnit}
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
                ))}

                {/* Options */}
                <View style={styles.optionCard}>
                    <View style={styles.optionRow}>
                        <View style={styles.optionInfo}>
                            <MaterialIcons name="shopping-cart" size={24} color={COLORS.primary} />
                            <View style={styles.optionTextContainer}>
                                <Text style={styles.optionTitle}>Thêm nguyên liệu hết vào danh sách mua sắm</Text>
                                <Text style={styles.optionSubtitle}>Tự động thêm khi nguyên liệu đã dùng hết</Text>
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
                    <Text style={styles.notesLabel}>Ghi chú (tùy chọn)</Text>
                    <TextInput
                        style={styles.notesInput}
                        placeholder="Ví dụ: Thêm chút ớt, giảm muối..."
                        value={notes}
                        onChangeText={setNotes}
                        multiline
                        numberOfLines={2}
                    />
                </View>

                <View style={styles.bottomSpacer} />
            </ScrollView>

            {/* Bottom Button */}
            <View style={styles.bottomActions}>
                <TouchableOpacity
                    style={[styles.confirmButton, saving && styles.buttonDisabled]}
                    onPress={handleConfirm}
                    disabled={saving}
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
        height: 100,
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
    },
    confirmButtonText: {
        ...TYPOGRAPHY.bodyLarge,
        color: COLORS.textOnPrimary,
        fontFamily: FONTS.bold,
    },
});

export default CookingCompleteScreen;
