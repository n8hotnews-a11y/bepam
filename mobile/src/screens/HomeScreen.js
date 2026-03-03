import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList, ActivityIndicator, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import { inventoryService } from '../services/inventoryService';
import { shoppingListService } from '../services/shoppingListService';
import { supabase } from '../services/supabaseConfig';
import { notificationService } from '../services/notificationService';
import { notificationReadService } from '../services/notificationReadService';

import ActionSheet from '../components/ActionSheet';
import EditItemModal from '../components/EditItemModal';
import BulkActionModal from '../components/BulkActionModal';
import BulkEditExpiryModal from '../components/BulkEditExpiryModal';
import { showSuccessToast } from '../components/Toast';
import { useModal } from '../contexts/ModalContext';

const HomeScreen = ({ navigation }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionSheetVisible, setActionSheetVisible] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [bulkActionModalVisible, setBulkActionModalVisible] = useState(false);
    const [bulkEditExpiryModalVisible, setBulkEditExpiryModalVisible] = useState(false);
    const [expiredCount, setExpiredCount] = useState(0);
    const { setIsModalVisible } = useModal();

    const fetchItems = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        const user_id = user?.id;
        if (!user_id) {
            console.log('No authenticated user found');
            setLoading(false);
            return;
        }

        console.log('Fetching items for user:', user_id);
        setLoading(true);
        const result = await inventoryService.getItems(user_id);
        if (result.success) {
            console.log('Successfully fetched items:', result.items.length);
            setItems(result.items);

            // Calculate expired/expiring soon count
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const warningItems = [];
            const count = result.items.reduce((acc, item) => {
                if (!item.expiry_date) return acc;
                const expiry = new Date(item.expiry_date);
                expiry.setHours(0, 0, 0, 0);
                const diffTime = expiry - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                // Trigger notification for each item (internally checks settings)
                if (diffDays <= 3) {
                    notificationService.scheduleExpiryNotification(item, diffDays);
                    warningItems.push(item);
                    return acc + 1;
                }
                return acc;
            }, 0);

            // Get unread notifications count
            const readNotifications = await notificationReadService.getReadNotifications();
            const unreadCount = warningItems.filter(item => !readNotifications.has(item.id)).length;
            setExpiredCount(unreadCount);
        } else {
            console.error('Error getting items:', result.error);
            Alert.alert('Lỗi', 'Không thể tải danh sách thực phẩm. Vui lòng thử lại.');
        }
        setLoading(false);
    };

    useFocusEffect(
        useCallback(() => {
            const checkAuth = async () => {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    fetchItems();
                } else {
                    console.log('User not authenticated, skipping fetch');
                    setLoading(false);
                }
            };
            checkAuth();
        }, [])
    );

    // Calculate days until expiry
    const getDaysUntilExpiry = (expiry_date) => {
        if (!expiry_date) return null;
        const today = new Date();
        const expiry = new Date(expiry_date);
        const diffTime = expiry - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    // Get expiry status and color
    const getExpiryStatus = (daysUntilExpiry) => {
        if (daysUntilExpiry === null) return { status: 'unknown', color: COLORS.textMuted };
        if (daysUntilExpiry < 0) return { status: 'expired', color: COLORS.danger };
        if (daysUntilExpiry <= 3) return { status: 'expiring_soon', color: COLORS.warningDark };
        if (daysUntilExpiry <= 7) return { status: 'expiring_week', color: COLORS.warning };
        return { status: 'fresh', color: COLORS.success };
    };

    // Sort items by expiry date (soonest first)
    const sortedItems = [...items].sort((a, b) => {
        const daysA = getDaysUntilExpiry(a.expiry_date);
        const daysB = getDaysUntilExpiry(b.expiry_date);

        // Handle null dates (put at end)
        if (daysA === null && daysB === null) return 0;
        if (daysA === null) return 1;
        if (daysB === null) return -1;

        return daysA - daysB;
    });

    const handleItemLongPress = (item) => {
        if (!selectionMode) {
            // Enter selection mode
            setSelectionMode(true);
            setSelectedItems(new Set([item.id]));
        }
    };

    const handleItemPress = (item) => {
        if (selectionMode) {
            // Toggle selection
            const newSelected = new Set(selectedItems);
            if (newSelected.has(item.id)) {
                newSelected.delete(item.id);
                if (newSelected.size === 0) {
                    setSelectionMode(false);
                }
            } else {
                newSelected.add(item.id);
            }
            setSelectedItems(newSelected);
        } else {
            // Normal item press - could open detail or quick actions
            handleItemMenuPress(item);
        }
    };

    const handleItemMenuPress = (item) => {
        setSelectedItem(item);
        setActionSheetVisible(true);
    };

    const toggleSelectionMode = () => {
        setSelectionMode(!selectionMode);
        setSelectedItems(new Set());
    };

    const clearSelection = () => {
        setSelectedItems(new Set());
        setSelectionMode(false);
    };

    const handleBulkAction = (action) => {
        if (selectedItems.size === 0) return;

        switch (action) {
            case 'delete':
                handleBulkDelete();
                break;
            case 'mark_used':
                handleBulkMarkUsed();
                break;
            case 'mark_expired':
                handleBulkMarkExpired();
                break;
            case 'edit_expiry':
                setBulkActionModalVisible(false); // Close bulk action modal
                setBulkEditExpiryModalVisible(true); // Open edit expiry modal
                break;
        }
    };

    const handleBulkDelete = () => {
        const item_names = Array.from(selectedItems).map(id =>
            items.find(item => item.id === id)?.item_name
        ).filter(Boolean);

        Alert.alert(
            'Xóa nhiều thực phẩm',
            `Xác nhận xóa ${selectedItems.size} thực phẩm: ${item_names.join(', ')}?`,
            [
                { text: 'Hủy', style: 'cancel' },
                {
                    text: 'Xóa',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            for (const itemId of selectedItems) {
                                await inventoryService.deleteItem(itemId);
                            }
                            setItems(prev => prev.filter(item => !selectedItems.has(item.id)));
                            setSelectedItems(new Set());
                            setSelectionMode(false);
                            showSuccessToast(`Đã xóa ${selectedItems.size} thực phẩm`);
                        } catch (error) {
                            Alert.alert('Lỗi', 'Không thể xóa một số thực phẩm');
                        }
                    }
                }
            ]
        );
    };

    const handleBulkMarkUsed = () => {
        const item_names = Array.from(selectedItems).map(id =>
            items.find(item => item.id === id)?.item_name
        ).filter(Boolean);

        Alert.alert(
            'Đã dùng hết',
            `Xác nhận đã dùng hết ${selectedItems.size} thực phẩm: ${item_names.join(', ')}? Chúng sẽ được chuyển vào danh sách mua sắm.`,
            [
                { text: 'Hủy', style: 'cancel' },
                {
                    text: 'Xác nhận',
                    onPress: async () => {
                        const { data: { user } } = await supabase.auth.getUser();
                        const user_id = user?.id;
                        if (!user_id) return;

                        try {
                            for (const itemId of selectedItems) {
                                const item = items.find(i => i.id === itemId);
                                if (item) {
                                    await inventoryService.deleteItem(itemId);
                                    await shoppingListService.addItem(user_id, {
                                        item_name: item.item_name,
                                        amount: item.amount,
                                        unit: item.unit,
                                        category_id: item.category_id,
                                    });
                                }
                            }
                            setItems(prev => prev.filter(item => !selectedItems.has(item.id)));
                            setSelectedItems(new Set());
                            setSelectionMode(false);
                            showSuccessToast(`Đã chuyển ${selectedItems.size} thực phẩm vào danh sách mua sắm`);
                        } catch (error) {
                            Alert.alert('Lỗi', 'Không thể xử lý một số thực phẩm');
                        }
                    }
                }
            ]
        );
    };

    const handleBulkMarkExpired = () => {
        const item_names = Array.from(selectedItems).map(id =>
            items.find(item => item.id === id)?.item_name
        ).filter(Boolean);

        Alert.alert(
            'Thực phẩm hết hạn',
            `Xác nhận ${selectedItems.size} thực phẩm đã hết hạn: ${item_names.join(', ')}? Chúng sẽ bị xóa.`,
            [
                { text: 'Hủy', style: 'cancel' },
                {
                    text: 'Xác nhận',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            for (const itemId of selectedItems) {
                                await inventoryService.deleteItem(itemId);
                            }
                            setItems(prev => prev.filter(item => !selectedItems.has(item.id)));
                            setSelectedItems(new Set());
                            setSelectionMode(false);
                            showSuccessToast(`Đã xóa ${selectedItems.size} thực phẩm hết hạn`);
                        } catch (error) {
                            Alert.alert('Lỗi', 'Không thể xóa một số thực phẩm');
                        }
                    }
                }
            ]
        );
    };

    const handleActionSheetClose = () => {
        setActionSheetVisible(false);
    };

    const handleEditModalClose = () => {
        setEditModalVisible(false);
    };

    const handleMarkAsUsed = () => {
        Alert.alert(
            'Đã dùng hết',
            `Xác nhận đã dùng hết ${selectedItem.item_name}? Thực phẩm sẽ bị xóa khỏi tủ lạnh và thêm vào danh sách mua sắm.`,
            [
                { text: 'Hủy', style: 'cancel' },
                {
                    text: 'Xác nhận',
                    style: 'destructive',
                    onPress: async () => {
                        const { data: { user } } = await supabase.auth.getUser();
                        const user_id = user?.id;
                        if (!user_id) return;

                        // Delete from inventory
                        const deleteResult = await inventoryService.deleteItem(selectedItem.id);
                        if (!deleteResult.success) {
                            Alert.alert('Lỗi', deleteResult.error || 'Không thể xóa thực phẩm');
                            return;
                        }

                        // Add to shopping list
                        const addResult = await shoppingListService.addItem(user_id, {
                            item_name: selectedItem.item_name,
                            amount: selectedItem.amount,
                            unit: selectedItem.unit,
                            category_id: selectedItem.category_id,
                        });

                        if (addResult.success) {
                            setItems(prev => prev.filter(item => item.id !== selectedItem.id));
                            showSuccessToast('Đã chuyển thực phẩm vào danh sách mua sắm');
                        } else {
                            Alert.alert('Lỗi', addResult.error || 'Không thể thêm vào danh sách mua sắm');
                        }
                    }
                }
            ]
        );
    };

    const handleMarkAsExpired = () => {
        Alert.alert(
            'Thực phẩm hết hạn',
            `Xác nhận ${selectedItem.item_name} đã hết hạn? Thực phẩm sẽ bị xóa và ghi nhận lãng phí.`,
            [
                { text: 'Hủy', style: 'cancel' },
                {
                    text: 'Xác nhận hết hạn',
                    style: 'destructive',
                    onPress: async () => {
                        const result = await inventoryService.deleteItem(selectedItem.id);
                        if (result.success) {
                            setItems(prev => prev.filter(item => item.id !== selectedItem.id));
                            showSuccessToast('Đã ghi nhận thực phẩm hết hạn');
                        } else {
                            Alert.alert('Lỗi', result.error || 'Không thể xóa thực phẩm');
                        }
                    }
                }
            ]
        );
    };

    const handleEditItem = () => {
        setActionSheetVisible(false);
        setEditModalVisible(true);
    };

    const handleShareToCommunity = () => {
        setActionSheetVisible(false);
        navigation.navigate('CreateListing', { prefillItem: selectedItem });
    };

    const handleItemUpdated = () => {
        fetchItems(); // Refresh the list
        showSuccessToast('Cập nhật thông tin thành công');
        // Modal visibility will be handled by onClose callback
    };

    const handleBulkExpiryUpdated = () => {
        fetchItems(); // Refresh the list
        setSelectedItems(new Set());
        setSelectionMode(false);
        // Modal visibility will be handled by onClose callback
    };

    const actionSheetActions = [
        {
            title: 'Chỉnh sửa thông tin',
            subtitle: 'Thay đổi tên, số lượng, hạn sử dụng',
            icon: 'edit',
            onPress: handleEditItem,
            showChevron: true,
        },
        {
            title: 'Bán/Tặng cho hàng xóm',
            subtitle: 'Đăng lên Chợ cư dân',
            icon: 'share',
            iconColor: COLORS.primaryMuted,
            iconTextColor: COLORS.primary,
            onPress: handleShareToCommunity,
            showChevron: true,
        },
        {
            title: 'Đã dùng hết sạch',
            subtitle: 'Chuyển vào danh sách mua sắm',
            icon: 'check-circle',
            iconColor: COLORS.successLight,
            iconTextColor: COLORS.success,
            onPress: handleMarkAsUsed,
        },
        {
            title: 'Bỏ đi (Hết hạn)',
            subtitle: 'Ghi nhận lãng phí thực phẩm',
            icon: 'delete-forever',
            iconColor: COLORS.dangerLight,
            iconTextColor: COLORS.danger,
            onPress: handleMarkAsExpired,
            destructive: true,
        },
    ];

    const renderItem = ({ item }) => {
        const daysUntilExpiry = getDaysUntilExpiry(item.expiry_date);
        const expiryInfo = getExpiryStatus(daysUntilExpiry);
        const isSelected = selectedItems.has(item.id);

        return (
            <TouchableOpacity
                style={[
                    styles.itemCard,
                    selectionMode && isSelected && styles.itemCardSelected,
                    selectionMode && styles.itemCardSelectionMode
                ]}
                onPress={() => handleItemPress(item)}
                onLongPress={() => handleItemLongPress(item)}
                activeOpacity={0.9}
            >
                {selectionMode && (
                    <View style={styles.checkboxContainer}>
                        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                            {isSelected && (
                                <MaterialIcons name="check" size={16} color={COLORS.white} />
                            )}
                        </View>
                    </View>
                )}

                <View style={styles.itemIconContainer}>
                    {item.image_url ? (
                        <Image
                            source={{ uri: item.image_url }}
                            style={styles.itemImage}
                            resizeMode="cover"
                        />
                    ) : (
                        <MaterialIcons
                            name={
                                item.category_id === 'vegetables' ? 'eco' :
                                    item.category_id === 'meat' ? 'kebab-dining' :
                                        item.category_id === 'seafood' ? 'set-meal' :
                                            item.category_id === 'fruits' ? 'apple' :
                                                item.category_id === 'dairy' ? 'egg' :
                                                    item.category_id === 'spices' ? 'grain' :
                                                        'kitchen'
                            }
                            size={24}
                            color={selectionMode ? COLORS.grayLight : COLORS.primary}
                        />
                    )}
                </View>

                <View style={styles.itemInfo}>
                    <Text style={[styles.item_nameText, selectionMode && styles.item_nameTextMuted]}>
                        {item.item_name}
                    </Text>
                    <View style={styles.itemDetailsRow}>
                        <Text style={[styles.itemSubText, selectionMode && styles.itemSubTextMuted]}>
                            {item.amount} {item.unit}
                        </Text>
                        <View style={styles.expiryContainer}>
                            <MaterialIcons
                                name="schedule"
                                size={14}
                                color={expiryInfo.color}
                                style={styles.expiryIcon}
                            />
                            <Text style={[styles.expiryText, { color: expiryInfo.color }]}>
                                {daysUntilExpiry === null ? 'Không rõ' :
                                    daysUntilExpiry < 0 ? 'Đã hết hạn' :
                                        daysUntilExpiry === 0 ? 'Hết hạn hôm nay' :
                                            `${daysUntilExpiry} ngày`}
                            </Text>
                        </View>
                    </View>
                </View>

                {!selectionMode && (
                    <TouchableOpacity
                        style={styles.actionIndicator}
                        onPress={() => handleItemMenuPress(item)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <MaterialIcons name="more-vert" size={20} color={COLORS.grayLight} />
                    </TouchableOpacity>
                )}
            </TouchableOpacity>
        );
    };

    if (loading && items.length === 0) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <MaterialIcons name="kitchen" size={24} color={COLORS.primary} />
                    <Text style={styles.headerTitle}>
                        {selectionMode ? `${selectedItems.size} đã chọn` : 'Tủ lạnh'}
                    </Text>
                </View>
                <View style={{ flexDirection: 'row' }}>
                    {selectionMode ? (
                        <>
                            <TouchableOpacity
                                style={[styles.actionButton, { marginRight: SPACING.sm }]}
                                onPress={clearSelection}
                            >
                                <MaterialIcons name="close" size={24} color={COLORS.textPrimary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => setBulkActionModalVisible(true)}
                                disabled={selectedItems.size === 0}
                            >
                                <MaterialIcons
                                    name="more-vert"
                                    size={24}
                                    color={selectedItems.size > 0 ? COLORS.primary : COLORS.grayLight}
                                />
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <TouchableOpacity
                                style={[styles.actionButton, { marginRight: SPACING.sm }]}
                                onPress={toggleSelectionMode}
                            >
                                <MaterialIcons name="checklist" size={24} color={COLORS.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actionButton, { marginRight: SPACING.sm }]}
                                onPress={() => navigation.navigate('Shopping')}
                            >
                                <MaterialIcons name="shopping-cart" size={24} color={COLORS.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => navigation.navigate('ExpiredItems')}
                            >
                                <MaterialIcons name="notifications" size={24} color={expiredCount > 0 ? COLORS.danger : COLORS.textPrimary} />
                                {expiredCount > 0 && (
                                    <View style={styles.notificationBadge}>
                                        <Text style={styles.badgeText}>{expiredCount > 9 ? '9+' : expiredCount}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>

            {items.length === 0 ? (
                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.emptyStateContainer}>
                        <View style={styles.iconContainer}>
                            <View style={styles.circle}>
                                <MaterialIcons name="kitchen" size={48} color={COLORS.grayLight} />
                            </View>
                            <View style={styles.moodIcon}>
                                <MaterialIcons name="sentiment-dissatisfied" size={24} color={COLORS.primary} />
                            </View>
                        </View>

                        <Text style={styles.emptyTitle}>Tủ lạnh đang trống!</Text>
                        <Text style={styles.emptyDescription}>
                            Hãy bắt đầu thêm thực phẩm để Bếp Trưởng AI có thể gợi ý những món ngon dành riêng cho bạn.
                        </Text>

                        {selectionMode && (
                            <View style={styles.selectionHint}>
                                <Text style={styles.selectionHintText}>
                                    Nhấn giữ hoặc nhấn vào biểu tượng checklist để chọn nhiều thực phẩm cùng lúc.
                                </Text>
                            </View>
                        )}

                        <View style={styles.buttonContainer}>
                            <TouchableOpacity
                                style={styles.primaryButton}
                                onPress={() => navigation.navigate('ManualAdd')}
                            >
                                <MaterialIcons name="edit-note" size={24} color={COLORS.textOnPrimary} />
                                <Text style={styles.primaryButtonText}>Thêm thủ công</Text>
                            </TouchableOpacity>

                        </View>
                    </View>
                </ScrollView>
            ) : (
                <View style={styles.listWrapper}>
                    <FlatList
                        data={sortedItems}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    />

                    {!selectionMode && (
                        <View style={styles.fabContainer}>

                            <TouchableOpacity
                                style={styles.mainFab}
                                onPress={() => navigation.navigate('ManualAdd')}
                            >
                                <MaterialIcons name="add" size={32} color={COLORS.white} />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            )}



            {/* Action Sheet */}
            <ActionSheet
                visible={actionSheetVisible}
                onClose={handleActionSheetClose}
                title={selectedItem?.item_name}
                actions={actionSheetActions}
                onVisibilityChange={setIsModalVisible}
            />

            {/* Edit Item Modal */}
            <EditItemModal
                visible={editModalVisible}
                onClose={handleEditModalClose}
                item={selectedItem}
                onSuccess={handleItemUpdated}
                onVisibilityChange={setIsModalVisible}
            />

            {/* Bulk Action Modal */}
            <BulkActionModal
                visible={bulkActionModalVisible}
                onClose={() => setBulkActionModalVisible(false)}
                selectedCount={selectedItems.size}
                onAction={handleBulkAction}
                onVisibilityChange={setIsModalVisible}
            />

            {/* Bulk Edit Expiry Modal */}
            <BulkEditExpiryModal
                visible={bulkEditExpiryModalVisible}
                onClose={() => setBulkEditExpiryModalVisible(false)}
                selectedItems={selectedItems}
                items={items}
                onSuccess={handleBulkExpiryUpdated}
                onVisibilityChange={setIsModalVisible}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.xl, // 32px
        paddingVertical: SPACING.md, // 16px
        backgroundColor: COLORS.backgroundCard,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm, // 8px
    },
    headerTitle: {
        ...TYPOGRAPHY.heading1,
    },
    actionButton: {
        padding: SPACING.sm,
        borderRadius: RADIUS.md,
        backgroundColor: COLORS.background,
    },
    content: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: SPACING.xl,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
    },
    listWrapper: {
        flex: 1,
    },
    listContent: {
        paddingHorizontal: SPACING.xl,
        paddingTop: SPACING.lg,
        paddingBottom: 100,
    },
    itemCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.lg,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
    },
    itemIconContainer: {
        width: 52,
        height: 52,
        borderRadius: RADIUS.md,
        backgroundColor: COLORS.primaryMuted,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.md,
    },
    itemImage: {
        width: 52,
        height: 52,
        borderRadius: RADIUS.md,
    },
    itemInfo: {
        flex: 1,
    },
    item_nameText: {
        ...TYPOGRAPHY.bodyLarge,
        color: COLORS.textPrimary,
    },
    itemSubText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
        marginTop: SPACING.xs,
    },
    actionIndicator: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: RADIUS.sm,
    },
    checkboxContainer: {
        marginRight: SPACING.md,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: COLORS.border,
        backgroundColor: COLORS.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxSelected: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    itemCardSelected: {
        backgroundColor: COLORS.primaryMuted,
        borderColor: COLORS.primary,
        borderWidth: 2,
    },
    itemCardSelectionMode: {
        opacity: 0.9,
    },
    item_nameTextMuted: {
        color: COLORS.textSecondary,
    },
    itemSubTextMuted: {
        color: COLORS.textMuted,
    },
    itemDetailsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: SPACING.xs,
    },
    expiryContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    expiryIcon: {
        marginRight: 2,
    },
    expiryText: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.bold,
    },
    fab: {
        position: 'absolute',
        bottom: SPACING.xl,
        right: SPACING.xl,
        width: 64,
        height: 64,
        borderRadius: RADIUS.pill,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 8,
    },
    emptyStateContainer: {
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.xxl,
        padding: SPACING.xl,
        alignItems: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 4,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    iconContainer: {
        marginBottom: SPACING.lg,
        position: 'relative',
    },
    circle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    moodIcon: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.md,
        padding: 6,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    emptyTitle: {
        ...TYPOGRAPHY.heading2,
        textAlign: 'center',
        marginBottom: SPACING.sm,
    },
    emptyDescription: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginBottom: SPACING.xl,
    },
    buttonContainer: {
        width: '100%',
        gap: SPACING.md,
    },
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.primary,
        paddingVertical: SPACING.md,
        borderRadius: RADIUS.lg,
        gap: SPACING.sm,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryButtonText: {
        ...TYPOGRAPHY.bodyLarge,
        color: COLORS.textOnPrimary,
    },
    secondaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.backgroundCard,
        paddingVertical: SPACING.md,
        borderRadius: RADIUS.lg,
        borderWidth: 2,
        borderColor: COLORS.primary,
        gap: SPACING.sm,
    },
    secondaryButtonText: {
        ...TYPOGRAPHY.bodyLarge,
        color: COLORS.primary,
    },
    selectionHint: {
        marginTop: SPACING.md,
        padding: SPACING.md,
        backgroundColor: COLORS.warningLight,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.warning,
    },
    selectionHintText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.warningDark,
        textAlign: 'center',
        fontStyle: 'italic',
    },
    notificationBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: COLORS.danger,
        borderRadius: 10,
        width: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: COLORS.backgroundCard,
    },
    badgeText: {
        color: COLORS.white,
        fontSize: 10,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    fabContainer: {
        position: 'absolute',
        bottom: 90,
        right: SPACING.xl,
        alignItems: 'center',
        gap: SPACING.md,
    },
    mainFab: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },

});

export default HomeScreen;
