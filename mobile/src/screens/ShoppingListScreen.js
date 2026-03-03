import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';


import { shoppingListService } from '../services/shoppingListService';
import { inventoryService } from '../services/inventoryService';
import { supabase } from '../services/supabaseConfig';
import { showSuccessToast } from '../components/Toast';
import { Modal, TextInput } from 'react-native';

// Mock data (sẽ thay bằng Firebase/Service sau)
const NEEDED_ITEMS = [
    { id: '1', name: 'Trứng gà', quantity: '10 quả', category: 'Cần mua gấp' },
    { id: '2', name: 'Sữa tươi', quantity: '2 hộp', category: 'Dự kiến' },
    { id: '3', name: 'Rau muống', quantity: '1 bó', category: 'Cần mua gấp' },
];


const ShoppingListScreen = ({ navigation }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [addItemModalVisible, setAddItemModalVisible] = useState(false);
    const [newItemName, setNewItemName] = useState('');
    const [newItemQuantity, setNewItemQuantity] = useState('');

    const fetchShoppingList = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const result = await shoppingListService.getItems(user.id);
            if (result.success) {
                setItems(result.data || []);
            }
        }
        setLoading(false);
    };

    useFocusEffect(
        useCallback(() => {
            fetchShoppingList();
        }, [])
    );

    const toggleSelection = (id) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(id)) {
            newSelected.delete(id);
            if (newSelected.size === 0) setSelectionMode(false);
        } else {
            newSelected.add(id);
            setSelectionMode(true);
        }
        setSelectedItems(newSelected);
    };

    const handleBulkDelete = async () => {
        const itemsToDelete = Array.from(selectedItems);
        if (itemsToDelete.length === 0) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const count = itemsToDelete.length;

            // Optimistic update: remove from local state immediately
            const previousItems = [...items];
            setItems(prev => prev.filter(item => !selectedItems.has(item.id)));
            setSelectionMode(false);
            setSelectedItems(new Set());

            // Perform deletions in parallel
            const results = await Promise.all(itemsToDelete.map(id => shoppingListService.deleteItem(id)));

            const failed = results.filter(r => !r.success);

            if (failed.length > 0) {
                console.error('Some deletions failed:', failed);
                Alert.alert(
                    "Không thể xoá",
                    `Không thể xoá ${failed.length} sản phẩm. Vui lòng kiểm tra lại quyền hạn hoặc RLS Policy trên Supabase cho bảng 'shoppinglist'.`,
                    [{ text: "OK", onPress: fetchShoppingList }]
                );
            } else {
                showSuccessToast(`Đã xoá ${count} món`);
                // Refresh to ensure sync with server
                fetchShoppingList();
            }
        } catch (error) {
            console.error('Error in handleBulkDelete:', error);
            Alert.alert("Lỗi", "Đã có lỗi xảy ra khi xoá sản phẩm.");
            fetchShoppingList(); // Refresh to restore correct state
        }
    };

    const handleBulkAddToFridge = async () => {
        const itemsToProcess = Array.from(selectedItems);
        if (itemsToProcess.length === 0) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            setLoading(true);
            let successCount = 0;
            const processedIds = [];

            for (const itemId of itemsToProcess) {
                const item = items.find(i => i.id === itemId);
                if (item) {
                    // Add to inventory
                    const addResult = await inventoryService.addItem(user.id, {
                        item_name: item.item_name,
                        amount: parseFloat(item.amount) || 1,
                        unit: item.unit || 'cái',
                        category_id: item.category_id || 'others',
                        expiry_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    });

                    if (addResult.success) {
                        // Mark for deletion from shopping list
                        const delResult = await shoppingListService.deleteItem(itemId);
                        if (delResult.success) {
                            processedIds.push(itemId);
                            successCount++;
                        }
                    }
                }
            }

            if (successCount > 0) {
                showSuccessToast(`Đã thêm ${successCount} món vào tủ lạnh`);
            }

            if (successCount < itemsToProcess.length) {
                Alert.alert("Thông báo", `Chỉ có ${successCount}/${itemsToProcess.length} món được xử lý thành công.`);
            }

            setSelectionMode(false);
            setSelectedItems(new Set());
            fetchShoppingList();
        } catch (error) {
            console.error('Error in handleBulkAddToFridge:', error);
            fetchShoppingList();
        } finally {
            setLoading(false);
        }
    };

    const handleQuickAdd = async () => {
        if (!newItemName.trim()) return;

        let parsedAmount = 1;
        let parsedUnit = 'cái';

        const quantityInput = newItemQuantity.trim();
        if (quantityInput) {
            const match = quantityInput.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
            if (match) {
                parsedAmount = parseFloat(match[1]);
                const unitPart = match[2].trim();
                if (unitPart) parsedUnit = unitPart;
            } else {
                parsedUnit = quantityInput;
            }
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await shoppingListService.addItem(user.id, {
                item_name: newItemName,
                amount: parsedAmount,
                unit: parsedUnit,
            });
            fetchShoppingList();
        }

        setAddItemModalVisible(false);
        setNewItemName('');
        setNewItemQuantity('');
        showSuccessToast('Đã thêm món vào danh sách');
    };

    const renderItem = ({ item, isLast }) => {
        const isSelected = selectedItems.has(item.id);
        return (
            <TouchableOpacity
                style={[
                    styles.itemRow,
                    !isLast && styles.itemBorder,
                    isSelected && styles.itemSelected
                ]}
                onLongPress={() => toggleSelection(item.id)}
                onPress={() => {
                    if (selectionMode) toggleSelection(item.id);
                }}
            >
                <View style={styles.itemLeft}>
                    <TouchableOpacity
                        style={[styles.checkbox, isSelected && styles.checkboxChecked]}
                        onPress={() => toggleSelection(item.id)}
                    >
                        {isSelected && <MaterialIcons name="check" size={18} color={COLORS.white} />}
                    </TouchableOpacity>
                    <View>
                        <Text style={styles.itemName}>{item.item_name}</Text>
                        <Text style={styles.itemQuantity}>{item.amount} {item.unit}</Text>
                    </View>
                </View>

            </TouchableOpacity>
        );
    };

    const renderEmptyNeeded = () => (
        <View style={styles.emptyStateContainer}>
            <View style={styles.emptyStateIconContainer}>
                <MaterialIcons name="shopping-basket" size={100} color={COLORS.primaryMuted} />
            </View>
            <Text style={styles.emptyStateTitle}>Giỏ hàng đang trống</Text>
            <Text style={styles.emptyStateSubtitle}>
                Có vẻ như bạn chưa cần mua gì. Hãy thêm món mới vào danh sách hoặc quét hóa đơn để AI tự động lên danh sách nhé!
            </Text>
            <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={() => setAddItemModalVisible(true)}
            >
                <Text style={styles.emptyStateButtonText}>Thêm món ngay</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                {selectionMode ? (
                    <View style={styles.selectionHeader}>
                        <TouchableOpacity onPress={() => {
                            setSelectionMode(false);
                            setSelectedItems(new Set());
                        }}>
                            <MaterialIcons name="close" size={24} color={COLORS.textPrimary} />
                        </TouchableOpacity>
                        <Text style={styles.selectionTitle}>{selectedItems.size} đã chọn</Text>
                        <View style={styles.selectionActions}>
                            <TouchableOpacity onPress={handleBulkDelete} style={styles.actionBtn}>
                                <MaterialIcons name="delete" size={24} color={COLORS.danger} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleBulkAddToFridge} style={styles.actionBtn}>
                                <MaterialIcons name="kitchen" size={24} color={COLORS.primary} />
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <>
                        <Text style={styles.headerTitle}>Danh sách mua sắm</Text>
                        <TouchableOpacity style={styles.actionBtn}>
                            <MaterialIcons name="more-horiz" size={28} color={COLORS.textPrimary} />
                        </TouchableOpacity>
                    </>
                )}
            </View>

            <View style={styles.content}>
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                    </View>
                ) : (
                    <FlatList
                        data={items}
                        renderItem={({ item, index }) => renderItem({ item, isLast: index === items.length - 1 })}
                        keyExtractor={item => item.id}
                        contentContainerStyle={[styles.listContent, items.length === 0 && { flex: 1, justifyContent: 'center' }]}
                        ListHeaderComponent={
                            items.length > 0 ? (
                                <View style={styles.sectionContainer}>
                                    <View style={styles.sectionHeader}>
                                        <Text style={styles.sectionTitle}>Chưa mua</Text>
                                        <View style={styles.badge}>
                                            <Text style={styles.badgeText}>{items.length} món</Text>
                                        </View>
                                    </View>
                                    <View style={styles.card}>
                                        {/* Items are rendered by FlatList */}
                                    </View>
                                </View>
                            ) : null
                        }
                        ListEmptyComponent={renderEmptyNeeded}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </View>



            <View style={styles.fabContainer}>
                <TouchableOpacity
                    style={styles.manualFab}
                    onPress={() => setAddItemModalVisible(true)}
                >
                    <MaterialIcons name="add" size={20} color={COLORS.primary} />
                    <Text style={styles.manualFabText}>Thêm món</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.smartScanFab}
                    onPress={() => navigation.navigate('SmartScan')}
                >
                    <MaterialIcons name="camera" size={24} color={COLORS.white} />
                    <Text style={styles.smartScanText}>Quét thông minh</Text>
                </TouchableOpacity>


            </View>

            {/* Quick Add Modal */}
            <Modal
                transparent={true}
                visible={addItemModalVisible}
                animationType="fade"
                onRequestClose={() => setAddItemModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.quickAddModal}>
                        <Text style={styles.modalTitle}>Thêm nhanh món cần mua</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Tên món (ví dụ: Thịt bò)"
                            value={newItemName}
                            onChangeText={setNewItemName}
                            autoFocus
                        />
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Số lượng (ví dụ: 500g)"
                            value={newItemQuantity}
                            onChangeText={setNewItemQuantity}
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => setAddItemModalVisible(false)}
                            >
                                <Text style={styles.modalCancelText}>Hủy</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalAddBtn}
                                onPress={handleQuickAdd}
                            >
                                <Text style={styles.modalAddText}>Thêm</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>


        </SafeAreaView >
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
        paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.md,
        backgroundColor: COLORS.backgroundCard,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    headerTitle: {
        ...TYPOGRAPHY.heading1,
        color: COLORS.textPrimary,
    },
    actionBtn: {
        padding: SPACING.xs,
    },
    content: {
        flex: 1,
    },
    listContent: {
        paddingHorizontal: SPACING.xl,
        paddingBottom: 120,
    },
    sectionContainer: {
        marginBottom: SPACING.lg,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    sectionTitle: {
        ...TYPOGRAPHY.heading2,
        color: COLORS.textPrimary,
    },
    badge: {
        backgroundColor: 'rgba(230, 126, 34, 0.1)',
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs,
        borderRadius: RADIUS.sm,
        borderWidth: 1,
        borderColor: COLORS.primaryMuted,
    },
    badgeText: {
        color: COLORS.primary,
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.bold,
    },
    card: {
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.xl,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
        overflow: 'hidden',
    },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.md,
    },
    itemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderLight,
    },
    itemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
    },
    checkbox: {
        width: 26,
        height: 26,
        borderRadius: RADIUS.sm,
        borderWidth: 2,
        borderColor: COLORS.border,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
    },
    checkboxChecked: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    itemSelected: {
        backgroundColor: COLORS.primaryMuted,
    },
    itemName: {
        ...TYPOGRAPHY.bodyLarge,
        color: COLORS.textPrimary,
    },
    itemCheckedText: {
        color: COLORS.textMuted,
        textDecorationLine: 'line-through',
    },
    itemQuantity: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
        marginTop: SPACING.xs,
    },
    moveButton: {
        width: 44,
        height: 44,
        borderRadius: RADIUS.md,
        backgroundColor: COLORS.primaryMuted,
        justifyContent: 'center',
        alignItems: 'center',
    },
    fabContainer: {
        position: 'absolute',
        bottom: 90,
        right: SPACING.xl,
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: SPACING.md,
    },
    manualFab: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.backgroundCard,
        paddingVertical: 12,
        paddingHorizontal: SPACING.lg,
        borderRadius: RADIUS.pill,
        borderWidth: 2,
        borderColor: COLORS.primary,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        gap: SPACING.sm,
    },
    manualFabText: {
        fontFamily: FONTS.bold,
        color: COLORS.primary,
        ...TYPOGRAPHY.bodyRegular,
    },
    smartScanFab: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primaryDark,
        paddingVertical: 12,
        paddingHorizontal: SPACING.lg,
        borderRadius: RADIUS.pill,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
        gap: SPACING.sm,
    },
    smartScanText: {
        fontFamily: FONTS.bold,
        color: COLORS.white,
        ...TYPOGRAPHY.bodyRegular,
    },

    selectionHeader: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    selectionTitle: {
        ...TYPOGRAPHY.heading2,
        color: COLORS.textPrimary,
    },
    selectionActions: {
        flexDirection: 'row',
        gap: SPACING.md,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: SPACING.xl,
    },
    quickAddModal: {
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.xl,
        padding: SPACING.lg,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 10,
    },
    modalTitle: {
        ...TYPOGRAPHY.heading2,
        marginBottom: SPACING.lg,
        textAlign: 'center',
        color: COLORS.textPrimary,
    },
    modalInput: {
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: RADIUS.md,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        ...TYPOGRAPHY.bodyRegular,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: SPACING.sm,
    },
    modalCancelBtn: {
        flex: 1,
        padding: SPACING.md,
        alignItems: 'center',
        marginRight: SPACING.sm,
        backgroundColor: COLORS.background,
        borderRadius: RADIUS.md,
    },
    modalAddBtn: {
        flex: 1,
        padding: SPACING.md,
        alignItems: 'center',
        marginLeft: SPACING.sm,
        backgroundColor: COLORS.primary,
        borderRadius: RADIUS.md,
    },
    modalCancelText: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.bold,
    },
    modalAddText: {
        color: COLORS.white,
        fontFamily: FONTS.bold,
    },
    // Empty State Styles
    emptyStateContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: SPACING.xxl,
    },
    emptyStateIconContainer: {
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: COLORS.primaryMuted,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.xl,
        opacity: 0.8,
    },
    emptyStateTitle: {
        ...TYPOGRAPHY.heading2,
        color: COLORS.textPrimary,
        marginBottom: SPACING.sm,
        textAlign: 'center',
    },
    emptyStateSubtitle: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: SPACING.xxl,
    },
    emptyStateButton: {
        backgroundColor: COLORS.primary,
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.xxl,
        borderRadius: RADIUS.pill,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    emptyStateButtonText: {
        color: COLORS.white,
        fontFamily: FONTS.bold,
        fontSize: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default ShoppingListScreen;
