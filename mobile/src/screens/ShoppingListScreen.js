import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
// Text input for ingredient-based recipe suggestions
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, TextInput, Animated, Keyboard, Platform, ScrollView, Modal, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import { shoppingListService } from '../services/shoppingListService';
import { inventoryService } from '../services/inventoryService';
import { supabase } from '../services/supabaseConfig';
import { showSuccessToast } from '../components/Toast';

const AddItemModal = ({
    visible,
    onClose,
    onAdd,
    bottomSheetAnim
}) => {
    const [name, setName] = useState('');
    const [quantity, setQuantity] = useState('');

    useEffect(() => {
        if (visible) {
            setName('');
            setQuantity('');
        }
    }, [visible]);

    const handleAdd = () => {
        onAdd(name, quantity);
    };

    const scale = useMemo(() => bottomSheetAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.9, 1]
    }), [bottomSheetAnim]);

    const translateY = useMemo(() => bottomSheetAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [20, 0]
    }), [bottomSheetAnim]);

    const opacity = useMemo(() => bottomSheetAnim.interpolate({
        inputRange: [0.01, 1],
        outputRange: [0, 1]
    }), [bottomSheetAnim]);

    const KeyboardWrapper = Platform.OS === 'ios' ? KeyboardAvoidingView : View;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <KeyboardWrapper
                style={{ flex: 1, justifyContent: 'center', padding: SPACING.lg }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                <Animated.View
                    style={[styles.bottomSheetBackdropModal, { opacity: bottomSheetAnim }]}
                >
                    <TouchableOpacity
                        style={{ flex: 1 }}
                        activeOpacity={1}
                        onPress={onClose}
                    />
                </Animated.View>
                <Animated.View
                    style={[
                        styles.centerModal,
                        {
                            transform: [{ scale }, { translateY }],
                            opacity
                        }
                    ]}
                >
                    <Text style={styles.bottomSheetTitle}>Thêm món cần mua</Text>

                    <TextInput
                        style={styles.bottomSheetInput}
                        placeholder="Tên món (ví dụ: Thịt bò)"
                        placeholderTextColor={COLORS.textMuted}
                        value={name}
                        onChangeText={setName}
                        autoFocus={Platform.OS === 'ios'}
                        returnKeyType="next"
                        blurOnSubmit={false}
                    />
                    <TextInput
                        style={styles.bottomSheetInput}
                        placeholder="Số lượng (ví dụ: 500g)"
                        placeholderTextColor={COLORS.textMuted}
                        value={quantity}
                        onChangeText={setQuantity}
                        returnKeyType="done"
                        onSubmitEditing={handleAdd}
                    />

                    <View style={styles.bottomSheetActions}>
                        <TouchableOpacity style={styles.bottomSheetCancelBtn} onPress={onClose}>
                            <Text style={styles.bottomSheetCancelText}>Hủy</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.bottomSheetAddBtn, !name.trim() && { opacity: 0.5 }]}
                            onPress={handleAdd}
                            disabled={!name.trim()}
                        >
                            <Text style={styles.bottomSheetAddText}>Thêm</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </KeyboardWrapper>
        </Modal>
    );
};

const ShoppingListScreen = ({ navigation }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [bottomSheetVisible, setBottomSheetVisible] = useState(false);
    const [ingredientInput, setIngredientInput] = useState('');
    const bottomSheetAnim = useRef(new Animated.Value(0)).current;

    const openBottomSheet = useCallback(() => {
        bottomSheetAnim.setValue(0);
        setBottomSheetVisible(true);
        Animated.spring(bottomSheetAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 65,
            friction: 11,
        }).start();
    }, [bottomSheetAnim]);

    const closeBottomSheet = useCallback(() => {
        Keyboard.dismiss();
        Animated.timing(bottomSheetAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
        }).start(() => setBottomSheetVisible(false));
    }, [bottomSheetAnim]);

    const fetchShoppingList = useCallback(async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const result = await shoppingListService.getItems(user.id);
            if (result.success) {
                setItems(result.data || []);
            }
        }
        setLoading(false);
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchShoppingList();
        }, [fetchShoppingList])
    );

    const filteredItems = useMemo(() => items.filter(item => {
        if (activeTab === 'pending') return !item.checked;
        if (activeTab === 'purchased') return item.checked;
        return true;
    }), [items, activeTab]);

    const pendingCount = useMemo(() => items.filter(i => !i.checked).length, [items]);
    const purchasedCount = useMemo(() => items.filter(i => i.checked).length, [items]);

    const toggleItemPurchased = useCallback(async (item) => {
        const newStatus = !item.checked;
        await shoppingListService.updateItem(item.id, { checked: newStatus });
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, checked: newStatus } : i));
    }, []);

    const handleDeleteItem = useCallback(async (itemId) => {
        Alert.alert(
            'Xóa món',
            'Bạn có chắc muốn xóa món này?',
            [
                { text: 'Hủy', style: 'cancel' },
                {
                    text: 'Xóa',
                    style: 'destructive',
                    onPress: async () => {
                        await shoppingListService.deleteItem(itemId);
                        setItems(prev => prev.filter(i => i.id !== itemId));
                    }
                }
            ]
        );
    }, []);

    const handleBulkAddToFridge = useCallback(async () => {
        if (selectedItems.size === 0) return;

        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            let successCount = 0;
            const selectedIds = Array.from(selectedItems);

            for (const itemId of selectedIds) {
                const item = items.find(i => i.id === itemId);
                if (item) {
                    const addResult = await inventoryService.addItem(user.id, {
                        item_name: item.item_name,
                        amount: parseFloat(item.amount) || 1,
                        unit: item.unit || 'cái',
                        category_id: item.category_id || 'others',
                        expiry_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    });

                    if (addResult.success) {
                        await shoppingListService.deleteItem(itemId);
                        successCount++;
                    }
                }
            }

            if (successCount > 0) {
                showSuccessToast(`Đã thêm ${successCount} món vào tủ lạnh`);
                setSelectedItems(new Set());
                fetchShoppingList();
            }
        } catch (error) {
            console.error('Error:', error);
            fetchShoppingList();
        } finally {
            setLoading(false);
        }
    }, [selectedItems, items, fetchShoppingList]);

    const handleAddFromModal = useCallback(async (name, quantity) => {
        if (!name.trim()) return;

        let parsedAmount = 1;
        let parsedUnit = 'cái';
        const quantityInput = quantity.trim();

        if (quantityInput) {
            const match = quantityInput.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
            if (match) {
                parsedAmount = parseFloat(match[1]);
                const unitPart = match[2].trim();
                if (unitPart) parsedUnit = unitPart;
            }
        }

        closeBottomSheet();
        showSuccessToast('Đã thêm món vào danh sách');

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await shoppingListService.addItem(user.id, {
                item_name: name,
                amount: parsedAmount,
                unit: parsedUnit,
            });
            fetchShoppingList();
        }
    }, [closeBottomSheet, fetchShoppingList]);

    const renderSwipeableItem = useCallback(({ item }) => {
        const isPurchased = item.checked;
        const isSelected = selectedItems.has(item.id);

        const renderRightActions = () => (
            <TouchableOpacity
                style={styles.swipeDeleteBtn}
                onPress={() => handleDeleteItem(item.id)}
            >
                <MaterialIcons name="delete" size={22} color={COLORS.white} />
                <Text style={styles.swipeDeleteText}>Xoá</Text>
            </TouchableOpacity>
        );

        return (
            <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
                <TouchableOpacity
                    style={[styles.itemRow, isPurchased && styles.itemPurchased, isSelected && styles.itemSelected]}
                    onPress={() => {
                        if (selectedItems.size > 0) {
                            const newSelected = new Set(selectedItems);
                            if (newSelected.has(item.id)) newSelected.delete(item.id);
                            else newSelected.add(item.id);
                            setSelectedItems(newSelected);
                        }
                    }}
                    onLongPress={() => {
                        const newSelected = new Set(selectedItems);
                        newSelected.add(item.id);
                        setSelectedItems(newSelected);
                    }}
                >
                    <TouchableOpacity
                        style={[styles.checkbox, isPurchased && styles.checkboxChecked]}
                        onPress={() => toggleItemPurchased(item)}
                    >
                        {isPurchased && <MaterialIcons name="check" size={16} color={COLORS.white} />}
                    </TouchableOpacity>

                    <View style={styles.itemInfo}>
                        <Text style={[styles.itemName, isPurchased && styles.itemNamePurchased]}>
                            {item.item_name}
                        </Text>
                        <Text style={styles.itemQuantity}>{item.amount} {item.unit}</Text>
                    </View>

                    {!isPurchased && selectedItems.size === 0 && (
                        <TouchableOpacity style={styles.grabMartBtn} onPress={() => showSuccessToast("Tính năng liên kết siêu thị đang phát triển!")}>
                            <MaterialIcons name="local-mall" size={16} color={COLORS.primary} />
                        </TouchableOpacity>
                    )}

                    {selectedItems.size > 0 && (
                        <View style={[styles.selectIndicator, isSelected && styles.selectIndicatorActive]}>
                            {isSelected && <MaterialIcons name="check" size={16} color={COLORS.white} />}
                        </View>
                    )}
                </TouchableOpacity>
            </Swipeable>
        );
    }, [selectedItems, toggleItemPurchased, handleDeleteItem]);

    const renderEmptyState = useCallback(() => (
        <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
                <MaterialIcons name="add-shopping-cart" size={64} color={COLORS.primaryMuted} />
            </View>
            <Text style={styles.emptyTitle}>Giỏ hàng rỗng</Text>
            <Text style={styles.emptySubtitle}>
                Bạn có thể thêm món thủ công, hoặc dùng tính năng Quét bằng AI ở trên để tìm thêm ý tưởng!
            </Text>
            <TouchableOpacity style={styles.emptyButton} onPress={openBottomSheet}>
                <MaterialIcons name="add" size={20} color={COLORS.white} />
                <Text style={styles.emptyButtonText}>Thêm món</Text>
            </TouchableOpacity>
        </View>
    ), [openBottomSheet]);

    const getStrictAIPrompt = (ingredient) => `Bạn là một chuyên gia ẩm thực chuyên lên thực đơn cho các gia đình Việt Nam.
            Nhiệm vụ của bạn là gợi ý các món ăn ngon, thiết thực và bắt buộc phải sử dụng nguyên liệu đầu vào.

            NGUYÊN LIỆU CHÍNH: "${ingredient}"

            RÀNG BUỘC TỐI THƯỢNG:
            1. Bạn TUYỆT ĐỐI KHÔNG được gợi ý bất kỳ món ăn nào không có chứa nguyên liệu "${ingredient}".
            2. Nguyên liệu "${ingredient}" phải đóng vai trò là thành phần chính hoặc linh hồn của món ăn, không phải gia vị trang trí.
            3. Các món ăn phải thực tế, dễ nấu và phù hợp với khẩu vị bữa cơm gia đình Việt Nam.

            ĐỊNH DẠNG ĐẦU RA BẮT BUỘC (JSON):
            Trình bày danh sách các món ăn trong 1 đối tượng JSON duy nhất có dạng { "recipes": [ ... ] }.
            Với mỗi món ăn, hãy trình bày theo cấu trúc JSON sau:
            - "title": Tên món ăn
            - "reason": Giải thích ngắn gọn 1 câu về cách "${ingredient}" làm nên hương vị món ăn. Tại sao món này phù hợp.
            - "ingredients": Mảng các chuỗi, bắt buộc liệt kê "${ingredient}" đầu tiên.
            - "instructions": Chuỗi mô tả các bước nấu, trong đó chỉ rõ bước chế biến "${ingredient}".
            - "image_search": Từ khóa tiếng Anh ngắn gọn để tìm ảnh thực tế của món ăn.`;

    const handleIngredientSearch = () => {
        const text = ingredientInput.trim();
        if (!text) return;
        Keyboard.dismiss();
        const systemPrompt = getStrictAIPrompt(text);
        navigation.navigate('AIAuto', { initialPrompt: text, systemPrompt: systemPrompt });
        setIngredientInput('');
    };

    const handleQuickChip = (chipText) => {
        const systemPrompt = getStrictAIPrompt(chipText);
        navigation.navigate('AIAuto', { initialPrompt: chipText, systemPrompt: systemPrompt });
    };

    const renderHeader = useCallback(() => (
        <View style={styles.heroSection}>
            <TouchableOpacity
                style={styles.heroBanner}
                onPress={() => navigation.navigate('SmartScan')}
            >
                <View style={styles.heroContent}>
                    <Text style={styles.heroTitle}>Khám phá siêu thị bằng AI</Text>
                    <Text style={styles.heroSubtitle}>Chụp nguyên liệu để nhận công thức & thêm những thứ còn thiếu vào giỏ hàng!</Text>
                </View>
                <View style={styles.heroIconContainer}>
                    <MaterialIcons name="document-scanner" size={32} color={COLORS.white} />
                </View>
            </TouchableOpacity>

            <View style={styles.ingredientInputSection}>
                <View style={styles.ingredientInputHeader}>
                    <MaterialIcons name="restaurant-menu" size={18} color={COLORS.primary} />
                    <Text style={styles.ingredientInputLabel}>Hoặc gõ tên nguyên liệu</Text>
                </View>
                <View style={styles.ingredientInputRow}>
                    <View style={styles.ingredientInputWrapper}>
                        <MaterialIcons name="search" size={20} color={COLORS.textMuted} />
                        <TextInput
                            style={styles.ingredientInput}
                            placeholder="VD: Thịt bò, cà chua, hành tây..."
                            placeholderTextColor={COLORS.textMuted}
                            value={ingredientInput}
                            onChangeText={setIngredientInput}
                            onSubmitEditing={handleIngredientSearch}
                            returnKeyType="search"
                        />
                        {ingredientInput.length > 0 && (
                            <TouchableOpacity onPress={() => setIngredientInput('')} style={styles.ingredientClearBtn}>
                                <MaterialIcons name="close" size={16} color={COLORS.textMuted} />
                            </TouchableOpacity>
                        )}
                    </View>
                    <TouchableOpacity
                        style={[styles.ingredientSearchBtn, !ingredientInput.trim() && styles.ingredientSearchBtnDisabled]}
                        onPress={handleIngredientSearch}
                        disabled={!ingredientInput.trim()}
                    >
                        <MaterialIcons name="auto-awesome" size={20} color={COLORS.white} />
                    </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickChipsScroll}>
                    {['Thịt bò', 'Cá hồi', 'Gà', 'Tôm', 'Đậu hũ', 'Rau cải'].map((chip) => (
                        <TouchableOpacity
                            key={chip}
                            style={styles.quickChip}
                            onPress={() => handleQuickChip(chip)}
                        >
                            <Text style={styles.quickChipText}>{chip}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <View style={styles.promoCarousel}>
                <Text style={styles.promoTitle}>Đi chợ hôm nay</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.promoScroll}>
                    <View style={styles.promoCard}><Text style={styles.promoEmoji}>🥩</Text><Text style={styles.promoText}>Thịt tươi</Text></View>
                    <View style={styles.promoCard}><Text style={styles.promoEmoji}>🥬</Text><Text style={styles.promoText}>Rau xanh</Text></View>
                    <View style={styles.promoCard}><Text style={styles.promoEmoji}>🍎</Text><Text style={styles.promoText}>Hoa quả</Text></View>
                    <View style={styles.promoCard}><Text style={styles.promoEmoji}>🥚</Text><Text style={styles.promoText}>Trứng Sữa</Text></View>
                    <View style={styles.promoCard}><Text style={styles.promoEmoji}>🌶️</Text><Text style={styles.promoText}>Gia vị</Text></View>
                </ScrollView>
            </View>
        </View>
    ), [ingredientInput, navigation]);

    const renderTabs = useCallback(() => (
        <View style={styles.filterChipContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipScroll}>
                <TouchableOpacity
                    style={[styles.filterChip, activeTab === 'all' && styles.filterChipActive]}
                    onPress={() => setActiveTab('all')}
                >
                    <Text style={[styles.filterChipText, activeTab === 'all' && styles.filterChipTextActive]}>Tất cả ({items.length})</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.filterChip, activeTab === 'pending' && styles.filterChipActive]}
                    onPress={() => setActiveTab('pending')}
                >
                    <Text style={[styles.filterChipText, activeTab === 'pending' && styles.filterChipTextActive]}>Cần mua ({pendingCount})</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.filterChip, activeTab === 'purchased' && styles.filterChipActive]}
                    onPress={() => setActiveTab('purchased')}
                >
                    <Text style={[styles.filterChipText, activeTab === 'purchased' && styles.filterChipTextActive]}>Đã mua ({purchasedCount})</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    ), [activeTab, items.length, pendingCount, purchasedCount]);

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Mua sắm</Text>
                    <View style={styles.headerActions}>
                        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('SmartScan')}>
                            <MaterialIcons name="camera-alt" size={24} color={COLORS.primary} />
                        </TouchableOpacity>
                        {selectedItems.size > 0 && (
                            <TouchableOpacity style={styles.headerBtn} onPress={handleBulkAddToFridge}>
                                <MaterialIcons name="kitchen" size={24} color={COLORS.success} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {selectedItems.size > 0 && (
                    <View style={styles.selectionBar}>
                        <Text style={styles.selectionText}>{selectedItems.size} đã chọn</Text>
                        <TouchableOpacity onPress={() => setSelectedItems(new Set())}>
                            <MaterialIcons name="close" size={20} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.content}>
                    {renderTabs()}
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={COLORS.primary} />
                        </View>
                    ) : (
                        <FlatList
                            data={filteredItems}
                            renderItem={renderSwipeableItem}
                            keyExtractor={item => item.id}
                            ListHeaderComponent={renderHeader()}
                            ListEmptyComponent={renderEmptyState()}
                            contentContainerStyle={styles.listContent}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        />
                    )}
                </View>

                <TouchableOpacity style={styles.fab} onPress={openBottomSheet}>
                    <MaterialIcons name="add" size={28} color={COLORS.white} />
                </TouchableOpacity>

                <AddItemModal
                    visible={bottomSheetVisible}
                    onClose={closeBottomSheet}
                    onAdd={handleAddFromModal}
                    bottomSheetAnim={bottomSheetAnim}
                />
            </SafeAreaView>
        </GestureHandlerRootView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        backgroundColor: COLORS.backgroundCard,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderLight,
    },
    headerTitle: {
        ...TYPOGRAPHY.heading1,
        color: COLORS.textPrimary,
    },
    headerActions: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    headerBtn: {
        padding: SPACING.xs,
    },
    selectionBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: COLORS.primaryMuted,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
    },
    selectionText: {
        ...TYPOGRAPHY.bodyMedium,
        color: COLORS.primary,
        fontFamily: FONTS.bold,
    },
    content: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        paddingHorizontal: SPACING.lg,
        paddingBottom: 100,
    },
    heroSection: {
        marginBottom: SPACING.md,
    },
    heroBanner: {
        backgroundColor: COLORS.primary,
        borderRadius: RADIUS.lg,
        padding: SPACING.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: SPACING.sm,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    heroContent: {
        flex: 1,
        paddingRight: SPACING.md,
    },
    heroTitle: {
        ...TYPOGRAPHY.heading2,
        color: COLORS.white,
        marginBottom: SPACING.xs,
    },
    heroSubtitle: {
        ...TYPOGRAPHY.caption,
        color: COLORS.white,
        opacity: 0.9,
    },
    heroIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    ingredientInputSection: {
        marginTop: SPACING.md,
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.lg,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
    },
    ingredientInputHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        marginBottom: SPACING.sm,
    },
    ingredientInputLabel: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.bold,
        color: COLORS.primary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    ingredientInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    ingredientInputWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        borderRadius: RADIUS.md,
        paddingHorizontal: SPACING.sm,
        paddingVertical: Platform.OS === 'ios' ? SPACING.sm : 0,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    ingredientInput: {
        flex: 1,
        marginLeft: SPACING.xs,
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textPrimary,
        paddingVertical: SPACING.sm,
    },
    ingredientClearBtn: {
        padding: 4,
    },
    ingredientSearchBtn: {
        width: 44,
        height: 44,
        borderRadius: RADIUS.md,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    ingredientSearchBtnDisabled: {
        backgroundColor: COLORS.grayLight,
        shadowOpacity: 0,
        elevation: 0,
    },
    quickChipsScroll: {
        marginTop: SPACING.sm,
        flexDirection: 'row',
    },
    quickChip: {
        backgroundColor: COLORS.primaryMuted,
        borderRadius: RADIUS.pill,
        paddingHorizontal: SPACING.md,
        paddingVertical: 6,
        marginRight: SPACING.sm,
    },
    quickChipText: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.medium,
        color: COLORS.primaryDark,
    },
    promoCarousel: {
        marginTop: SPACING.lg,
    },
    promoTitle: {
        ...TYPOGRAPHY.heading3,
        color: COLORS.textPrimary,
        marginBottom: SPACING.sm,
    },
    promoScroll: {
        flexDirection: 'row',
        paddingBottom: SPACING.sm,
    },
    promoCard: {
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.lg,
        padding: SPACING.md,
        marginRight: SPACING.md,
        alignItems: 'center',
        width: 80,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
    },
    promoEmoji: {
        fontSize: 24,
        marginBottom: SPACING.xs,
    },
    promoText: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.medium,
        color: COLORS.textSecondary,
    },
    grabMartBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.primaryMuted,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: SPACING.sm,
    },
    filterChipContainer: {
        backgroundColor: COLORS.background,
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.lg,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderLight,
        zIndex: 10,
    },
    filterChipScroll: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    filterChip: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: RADIUS.pill,
        backgroundColor: COLORS.backgroundCard,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
    },
    filterChipActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    filterChipText: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.medium,
        color: COLORS.textSecondary,
    },
    filterChipTextActive: {
        color: COLORS.white,
        fontFamily: FONTS.bold,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.backgroundCard,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
    },
    itemPurchased: {
        backgroundColor: COLORS.background,
        opacity: 0.7,
    },
    itemSelected: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.primaryMuted,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: RADIUS.sm,
        borderWidth: 2,
        borderColor: COLORS.border,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.md,
    },
    checkboxChecked: {
        backgroundColor: COLORS.success,
        borderColor: COLORS.success,
    },
    itemInfo: {
        flex: 1,
    },
    itemName: {
        ...TYPOGRAPHY.bodyMedium,
        color: COLORS.textPrimary,
        fontFamily: FONTS.medium,
    },
    itemNamePurchased: {
        textDecorationLine: 'line-through',
        color: COLORS.textMuted,
    },
    itemQuantity: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    selectIndicator: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: COLORS.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    selectIndicatorActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    swipeDeleteBtn: {
        backgroundColor: COLORS.danger,
        justifyContent: 'center',
        alignItems: 'center',
        width: 80,
        borderRadius: RADIUS.md,
        marginBottom: SPACING.sm,
        marginLeft: SPACING.sm,
        gap: 4,
    },
    swipeDeleteText: {
        color: COLORS.white,
        fontSize: 11,
        fontFamily: FONTS.bold,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: SPACING.xl,
        paddingVertical: 40,
        opacity: 0.6,
    },
    emptyIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: COLORS.primaryMuted,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.lg,
    },
    emptyTitle: {
        ...TYPOGRAPHY.heading2,
        color: COLORS.textPrimary,
        marginBottom: SPACING.sm,
    },
    emptySubtitle: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginBottom: SPACING.xl,
    },
    emptyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.xl,
        borderRadius: RADIUS.pill,
        gap: SPACING.sm,
    },
    emptyButtonText: {
        color: COLORS.white,
        fontFamily: FONTS.bold,
    },
    fab: {
        position: 'absolute',
        bottom: 90,
        right: SPACING.lg,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    bottomSheetBackdropModal: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    centerModal: {
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.xl,
        padding: SPACING.lg,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    bottomSheetTitle: {
        ...TYPOGRAPHY.heading2,
        color: COLORS.textPrimary,
        textAlign: 'center',
        marginBottom: SPACING.lg,
    },
    bottomSheetInput: {
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: RADIUS.md,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textPrimary,
    },
    bottomSheetActions: {
        flexDirection: 'row',
        gap: SPACING.md,
        marginTop: SPACING.sm,
    },
    bottomSheetCancelBtn: {
        flex: 1,
        padding: SPACING.md,
        alignItems: 'center',
        backgroundColor: COLORS.background,
        borderRadius: RADIUS.md,
    },
    bottomSheetCancelText: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.bold,
    },
    bottomSheetAddBtn: {
        flex: 1,
        padding: SPACING.md,
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        borderRadius: RADIUS.md,
    },
    bottomSheetAddText: {
        color: COLORS.white,
        fontFamily: FONTS.bold,
    },
});

export default ShoppingListScreen;
