import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList, ActivityIndicator, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import { inventoryService } from '../services/inventoryService';
import { shoppingListService } from '../services/shoppingListService';
import { supabase } from '../services/supabaseConfig';
import { notificationService } from '../services/notificationService';
import { notificationReadService } from '../services/notificationReadService';

import FridgeHeader from '../components/FridgeHeader';
import CategoryFilter from '../components/CategoryFilter';
import FridgeItemCard from '../components/FridgeItemCard';
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
    const [activeCategory, setActiveCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const { setIsModalVisible } = useModal();

    // === DATA FETCHING ===
    const fetchItems = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        const user_id = user?.id;
        if (!user_id) {
            setLoading(false);
            return;
        }

        setLoading(true);
        const result = await inventoryService.getItems(user_id);
        if (result.success) {
            setItems(result.items);

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const warningItems = [];
            result.items.forEach(item => {
                if (!item.expiry_date) return;
                const expiry = new Date(item.expiry_date);
                expiry.setHours(0, 0, 0, 0);
                const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

                if (diffDays <= 3) {
                    notificationService.scheduleExpiryNotification(item, diffDays);
                    warningItems.push(item);
                }
            });

            const readNotifications = await notificationReadService.getReadNotifications();
            const unreadCount = warningItems.filter(item => !readNotifications.has(item.id)).length;
            setExpiredCount(unreadCount);
        } else {
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
                    setLoading(false);
                }
            };
            checkAuth();
        }, [])
    );

    // === COMPUTED VALUES ===
    const getDaysUntilExpiry = (expiryDate) => {
        if (!expiryDate) return null;
        const today = new Date();
        const expiry = new Date(expiryDate);
        return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    };

    const itemCounts = useMemo(() => {
        const counts = {};
        items.forEach(item => {
            const cat = item.category_id || 'other';
            counts[cat] = (counts[cat] || 0) + 1;
        });
        return counts;
    }, [items]);

    const statsData = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let expiringSoon = 0;
        let expired = 0;

        items.forEach(item => {
            if (!item.expiry_date) return;
            const expiry = new Date(item.expiry_date);
            expiry.setHours(0, 0, 0, 0);
            const diff = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
            if (diff < 0) expired++;
            else if (diff <= 3) expiringSoon++;
        });

        return { total: items.length, expiringSoon, expired };
    }, [items]);

    const sortedFilteredItems = useMemo(() => {
        let filtered = [...items];

        // Category filter
        if (activeCategory !== 'all') {
            filtered = filtered.filter(item => (item.category_id || 'other') === activeCategory);
        }

        // Search filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(item =>
                item.item_name?.toLowerCase().includes(q)
            );
        }

        // Sort by expiry (soonest first)
        filtered.sort((a, b) => {
            const daysA = getDaysUntilExpiry(a.expiry_date);
            const daysB = getDaysUntilExpiry(b.expiry_date);
            if (daysA === null && daysB === null) return 0;
            if (daysA === null) return 1;
            if (daysB === null) return -1;
            return daysA - daysB;
        });

        return filtered;
    }, [items, activeCategory, searchQuery]);

    // === SELECTION HANDLERS ===
    const handleItemLongPress = (item) => {
        if (!selectionMode) {
            setSelectionMode(true);
            setSelectedItems(new Set([item.id]));
        }
    };

    const handleItemPress = (item) => {
        if (selectionMode) {
            const newSelected = new Set(selectedItems);
            if (newSelected.has(item.id)) {
                newSelected.delete(item.id);
                if (newSelected.size === 0) setSelectionMode(false);
            } else {
                newSelected.add(item.id);
            }
            setSelectedItems(newSelected);
        } else {
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

    // === BULK ACTIONS ===
    const handleBulkAction = (action) => {
        if (selectedItems.size === 0) return;
        switch (action) {
            case 'delete': handleBulkDelete(); break;
            case 'mark_used': handleBulkMarkUsed(); break;
            case 'mark_expired': handleBulkMarkExpired(); break;
            case 'edit_expiry':
                setBulkActionModalVisible(false);
                setBulkEditExpiryModalVisible(true);
                break;
        }
    };

    const handleBulkDelete = () => {
        const names = Array.from(selectedItems).map(id =>
            items.find(item => item.id === id)?.item_name
        ).filter(Boolean);
        Alert.alert(
            'Xóa nhiều thực phẩm',
            `Xác nhận xóa ${selectedItems.size} thực phẩm: ${names.join(', ')}?`,
            [
                { text: 'Hủy', style: 'cancel' },
                {
                    text: 'Xóa', style: 'destructive',
                    onPress: async () => {
                        try {
                            for (const itemId of selectedItems) {
                                await inventoryService.deleteItem(itemId);
                            }
                            setItems(prev => prev.filter(item => !selectedItems.has(item.id)));
                            clearSelection();
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
        const names = Array.from(selectedItems).map(id =>
            items.find(item => item.id === id)?.item_name
        ).filter(Boolean);
        Alert.alert(
            'Đã dùng hết',
            `Xác nhận đã dùng hết ${selectedItems.size} thực phẩm: ${names.join(', ')}? Chúng sẽ được chuyển vào danh sách mua sắm.`,
            [
                { text: 'Hủy', style: 'cancel' },
                {
                    text: 'Xác nhận',
                    onPress: async () => {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (!user) return;
                        try {
                            for (const itemId of selectedItems) {
                                const item = items.find(i => i.id === itemId);
                                if (item) {
                                    await inventoryService.deleteItem(itemId);
                                    await shoppingListService.addItem(user.id, {
                                        item_name: item.item_name,
                                        amount: item.amount,
                                        unit: item.unit,
                                        category_id: item.category_id,
                                    });
                                }
                            }
                            setItems(prev => prev.filter(item => !selectedItems.has(item.id)));
                            clearSelection();
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
        const names = Array.from(selectedItems).map(id =>
            items.find(item => item.id === id)?.item_name
        ).filter(Boolean);
        Alert.alert(
            'Thực phẩm hết hạn',
            `Xác nhận ${selectedItems.size} thực phẩm đã hết hạn: ${names.join(', ')}? Chúng sẽ bị xóa.`,
            [
                { text: 'Hủy', style: 'cancel' },
                {
                    text: 'Xác nhận', style: 'destructive',
                    onPress: async () => {
                        try {
                            for (const itemId of selectedItems) {
                                await inventoryService.deleteItem(itemId);
                            }
                            setItems(prev => prev.filter(item => !selectedItems.has(item.id)));
                            clearSelection();
                            showSuccessToast(`Đã xóa ${selectedItems.size} thực phẩm hết hạn`);
                        } catch (error) {
                            Alert.alert('Lỗi', 'Không thể xóa một số thực phẩm');
                        }
                    }
                }
            ]
        );
    };

    // === SINGLE ITEM ACTIONS ===
    const handleMarkAsUsed = () => {
        Alert.alert(
            'Đã dùng hết',
            `Xác nhận đã dùng hết ${selectedItem.item_name}? Thực phẩm sẽ bị xóa khỏi tủ lạnh và thêm vào danh sách mua sắm.`,
            [
                { text: 'Hủy', style: 'cancel' },
                {
                    text: 'Xác nhận', style: 'destructive',
                    onPress: async () => {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (!user) return;
                        const deleteResult = await inventoryService.deleteItem(selectedItem.id);
                        if (!deleteResult.success) {
                            Alert.alert('Lỗi', deleteResult.error || 'Không thể xóa thực phẩm');
                            return;
                        }
                        await shoppingListService.addItem(user.id, {
                            item_name: selectedItem.item_name,
                            amount: selectedItem.amount,
                            unit: selectedItem.unit,
                            category_id: selectedItem.category_id,
                        });
                        setItems(prev => prev.filter(item => item.id !== selectedItem.id));
                        showSuccessToast('Đã chuyển thực phẩm vào danh sách mua sắm');
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
                    text: 'Xác nhận hết hạn', style: 'destructive',
                    onPress: async () => {
                        const result = await inventoryService.deleteItem(selectedItem.id);
                        if (result.success) {
                            setItems(prev => prev.filter(item => item.id !== selectedItem.id));
                            showSuccessToast('Đã ghi nhận thực phẩm hết hạn');
                        }
                    }
                }
            ]
        );
    };

    const handleSwipeUsed = (item) => {
        Alert.alert(
            'Đã dùng hết',
            `Xác nhận đã dùng hết ${item.item_name}? Chuyển vào danh sách mua sắm.`,
            [
                { text: 'Hủy', style: 'cancel' },
                {
                    text: 'Xác nhận', style: 'destructive',
                    onPress: async () => {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (!user) return;
                        const deleteResult = await inventoryService.deleteItem(item.id);
                        if (!deleteResult.success) return;
                        await shoppingListService.addItem(user.id, {
                            item_name: item.item_name,
                            amount: item.amount,
                            unit: item.unit,
                            category_id: item.category_id,
                        });
                        setItems(prev => prev.filter(i => i.id !== item.id));
                        showSuccessToast('Đã chuyển vào danh sách mua sắm');
                    }
                }
            ]
        );
    };

    const handleSwipeDelete = (item) => {
        Alert.alert(
            'Xoá thực phẩm',
            `Xác nhận xoá ${item.item_name}?`,
            [
                { text: 'Hủy', style: 'cancel' },
                {
                    text: 'Xoá', style: 'destructive',
                    onPress: async () => {
                        const result = await inventoryService.deleteItem(item.id);
                        if (result.success) {
                            setItems(prev => prev.filter(i => i.id !== item.id));
                            showSuccessToast('Đã xoá thực phẩm');
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
        fetchItems();
        showSuccessToast('Cập nhật thông tin thành công');
    };

    const handleBulkExpiryUpdated = () => {
        fetchItems();
        clearSelection();
    };

    // === ACTION SHEET CONFIG ===
    const actionSheetActions = [
        {
            title: 'Chỉnh sửa thông tin',
            subtitle: 'Thay đổi tên, số lượng, hạn sử dụng',
            icon: 'edit',
            onPress: handleEditItem,
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

    // === RENDER ===
    const renderItem = ({ item }) => (
        <FridgeItemCard
            item={item}
            onPress={handleItemPress}
            onLongPress={handleItemLongPress}
            onSwipeUsed={handleSwipeUsed}
            onSwipeDelete={handleSwipeDelete}
            selectionMode={selectionMode}
            isSelected={selectedItems.has(item.id)}
        />
    );

    if (loading && items.length === 0) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaView style={styles.container}>
                {/* Gradient Header */}
                <FridgeHeader
                    selectionMode={selectionMode}
                    selectedCount={selectedItems.size}
                    expiredCount={expiredCount}
                    onClearSelection={clearSelection}
                    onBulkAction={() => setBulkActionModalVisible(true)}
                    onToggleSelection={toggleSelectionMode}
                    onNavigateShopping={() => navigation.navigate('Shopping')}
                    onNavigateExpired={() => navigation.navigate('ExpiredItems')}
                />

                {/* Category Filter */}
                <CategoryFilter
                    activeCategory={activeCategory}
                    onSelect={setActiveCategory}
                    itemCounts={itemCounts}
                />

                {items.length === 0 ? (
                    /* EMPTY STATE */
                    <ScrollView contentContainerStyle={styles.emptyContent}>
                        <View style={styles.emptyStateContainer}>
                            <View style={styles.emptyIconContainer}>
                                <View style={styles.emptyCircle}>
                                    <MaterialIcons name="kitchen" size={48} color={COLORS.grayLight} />
                                </View>
                                <View style={styles.emptyMoodIcon}>
                                    <MaterialIcons name="sentiment-dissatisfied" size={24} color={COLORS.primary} />
                                </View>
                            </View>

                            <Text style={styles.emptyTitle}>Tủ lạnh đang trống!</Text>
                            <Text style={styles.emptyDescription}>
                                Hãy bắt đầu thêm thực phẩm để Bếp Trưởng AI có thể gợi ý những món ngon dành riêng cho bạn.
                            </Text>

                            <TouchableOpacity
                                style={styles.primaryButton}
                                onPress={() => navigation.navigate('ManualAdd')}
                            >
                                <MaterialIcons name="edit-note" size={24} color={COLORS.textOnPrimary} />
                                <Text style={styles.primaryButtonText}>Thêm thủ công</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                ) : (
                    /* MAIN CONTENT */
                    <View style={styles.listWrapper}>
                        {/* Summary Stats Bar */}
                        <View style={styles.statsBar}>
                            <View style={styles.statItem}>
                                <View style={[styles.statDot, { backgroundColor: COLORS.success }]} />
                                <Text style={styles.statText}>{statsData.total} items</Text>
                            </View>
                            <Text style={styles.statSeparator}>·</Text>
                            <TouchableOpacity
                                style={styles.statItem}
                                onPress={() => {/* could filter by expiring */ }}
                            >
                                <View style={[styles.statDot, { backgroundColor: COLORS.warningDark }]} />
                                <Text style={styles.statText}>{statsData.expiringSoon} sắp hết hạn</Text>
                            </TouchableOpacity>
                            <Text style={styles.statSeparator}>·</Text>
                            <TouchableOpacity
                                style={styles.statItem}
                                onPress={() => {/* could filter by expired */ }}
                            >
                                <View style={[styles.statDot, { backgroundColor: COLORS.danger }]} />
                                <Text style={styles.statText}>{statsData.expired} hết hạn</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Quick Search (show when >10 items) */}
                        {items.length > 10 && (
                            <View style={styles.searchBar}>
                                <MaterialIcons name="search" size={20} color={COLORS.textMuted} />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Tìm kiếm thực phẩm..."
                                    placeholderTextColor={COLORS.textMuted}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                />
                                {searchQuery.length > 0 && (
                                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                                        <MaterialIcons name="close" size={18} color={COLORS.textMuted} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}

                        {/* Item List */}
                        <FlatList
                            data={sortedFilteredItems}
                            keyExtractor={(item) => item.id}
                            renderItem={renderItem}
                            contentContainerStyle={styles.listContent}
                            showsVerticalScrollIndicator={false}
                            ListEmptyComponent={
                                <View style={styles.noResultsContainer}>
                                    <MaterialIcons name="search-off" size={40} color={COLORS.grayLight} />
                                    <Text style={styles.noResultsText}>Không tìm thấy thực phẩm</Text>
                                </View>
                            }
                        />

                        {/* FAB */}
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

                {/* Modals */}
                <ActionSheet
                    visible={actionSheetVisible}
                    onClose={() => setActionSheetVisible(false)}
                    title={selectedItem?.item_name}
                    actions={actionSheetActions}
                    onVisibilityChange={setIsModalVisible}
                />

                <EditItemModal
                    visible={editModalVisible}
                    onClose={() => setEditModalVisible(false)}
                    item={selectedItem}
                    onSuccess={handleItemUpdated}
                    onVisibilityChange={setIsModalVisible}
                />

                <BulkActionModal
                    visible={bulkActionModalVisible}
                    onClose={() => setBulkActionModalVisible(false)}
                    selectedCount={selectedItems.size}
                    onAction={handleBulkAction}
                    onVisibilityChange={setIsModalVisible}
                />

                <BulkEditExpiryModal
                    visible={bulkEditExpiryModalVisible}
                    onClose={() => setBulkEditExpiryModalVisible(false)}
                    selectedItems={selectedItems}
                    items={items}
                    onSuccess={handleBulkExpiryUpdated}
                    onVisibilityChange={setIsModalVisible}
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
    },
    // === STATS BAR ===
    statsBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.lg,
        backgroundColor: COLORS.backgroundCard,
        marginHorizontal: SPACING.lg,
        marginTop: SPACING.sm,
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    statDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statText: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.bold,
        color: COLORS.textSecondary,
    },
    statSeparator: {
        marginHorizontal: 8,
        color: COLORS.grayLight,
        fontSize: 16,
        fontWeight: 'bold',
    },
    // === SEARCH BAR ===
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.backgroundCard,
        marginHorizontal: SPACING.lg,
        marginTop: SPACING.sm,
        borderRadius: RADIUS.lg,
        paddingHorizontal: SPACING.md,
        height: 44,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
    },
    searchInput: {
        flex: 1,
        marginLeft: SPACING.sm,
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textPrimary,
    },
    // === LIST ===
    listWrapper: {
        flex: 1,
    },
    listContent: {
        paddingHorizontal: SPACING.lg,
        paddingTop: SPACING.md,
        paddingBottom: 100,
    },
    noResultsContainer: {
        alignItems: 'center',
        paddingTop: SPACING.xxl,
        gap: SPACING.md,
    },
    noResultsText: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textMuted,
    },
    // === EMPTY STATE ===
    emptyContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: SPACING.xl,
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
    emptyIconContainer: {
        marginBottom: SPACING.lg,
        position: 'relative',
    },
    emptyCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    emptyMoodIcon: {
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
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.primary,
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.xl,
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
    // === FAB ===
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
