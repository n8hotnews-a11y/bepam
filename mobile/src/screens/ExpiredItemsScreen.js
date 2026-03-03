import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Alert,
    ActivityIndicator,
    Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import { inventoryService } from '../services/inventoryService';
import { supabase } from '../services/supabaseConfig';
import { showSuccessToast } from '../components/Toast';
import { notificationReadService } from '../services/notificationReadService';

const ExpiredItemsScreen = ({ navigation }) => {
    const [expiredItems, setExpiredItems] = useState([]);
    const [expiringSoonItems, setExpiringSoonItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [readNotifications, setReadNotifications] = useState(new Set());

    const fetchData = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const result = await inventoryService.getItems(user.id);
        if (result.success) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const expired = [];
            const soon = [];

            result.items.forEach(item => {
                if (!item.expiry_date) return;

                const expiry = new Date(item.expiry_date);
                expiry.setHours(0, 0, 0, 0);

                const diffTime = expiry - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays < 0) {
                    expired.push({ ...item, daysLeft: diffDays });
                } else if (diffDays <= 3) {
                    soon.push({ ...item, daysLeft: diffDays });
                }
            });

            setExpiredItems(expired);
            setExpiringSoonItems(soon);

            // Load read notifications
            const readIds = await notificationReadService.getReadNotifications();
            setReadNotifications(readIds);

            // Cleanup read notifications for deleted items
            const allItemIds = result.items.map(item => item.id);
            await notificationReadService.cleanup(allItemIds);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleDelete = async (item) => {
        Alert.alert(
            'Xác nhận xóa',
            `Bạn có chắc chắn muốn xóa ${item.item_name} khỏi tủ lạnh?`,
            [
                { text: 'Hủy', style: 'cancel' },
                {
                    text: 'Xóa',
                    style: 'destructive',
                    onPress: async () => {
                        const result = await inventoryService.deleteItem(item.id);
                        if (result.success) {
                            showSuccessToast('Đã xóa thực phẩm');
                            // Clear read status when item is deleted
                            await notificationReadService.clearReadStatus(item.id);
                            fetchData();
                        }
                    }
                }
            ]
        );
    };

    const handleMarkAsRead = async (item) => {
        const success = await notificationReadService.markAsRead(item.id);
        if (success) {
            const updatedReadIds = await notificationReadService.getReadNotifications();
            setReadNotifications(updatedReadIds);
            showSuccessToast('Đã đánh dấu đã đọc');
        }
    };

    const handleMarkAsUnread = async (item) => {
        const success = await notificationReadService.markAsUnread(item.id);
        if (success) {
            const updatedReadIds = await notificationReadService.getReadNotifications();
            setReadNotifications(updatedReadIds);
            showSuccessToast('Đã đánh dấu chưa đọc');
        }
    };

    const handleMarkAllAsRead = async () => {
        const allItemIds = [...expiredItems, ...expiringSoonItems].map(item => item.id);
        const success = await notificationReadService.markMultipleAsRead(allItemIds);
        if (success) {
            const updatedReadIds = await notificationReadService.getReadNotifications();
            setReadNotifications(updatedReadIds);
            showSuccessToast('Đã đánh dấu tất cả đã đọc');
        }
    };

    const renderItem = ({ item, isExpired }) => {
        const isRead = readNotifications.has(item.id);

        return (
            <View style={[styles.itemCard, isRead && styles.itemCardRead]}>
                <View style={styles.itemIconContainer}>
                    {item.image_url ? (
                        <Image source={{ uri: item.image_url }} style={styles.itemImage} />
                    ) : (
                        <MaterialIcons
                            name={isExpired ? "error-outline" : "warning-amber"}
                            size={24}
                            color={isExpired ? COLORS.danger : COLORS.warning}
                        />
                    )}
                </View>
                <View style={styles.itemInfo}>
                    <View style={styles.itemNameRow}>
                        <Text style={styles.itemName}>{item.item_name}</Text>
                        {isRead && (
                            <View style={styles.readBadge}>
                                <MaterialIcons name="check-circle" size={16} color={COLORS.success} />
                                <Text style={styles.readBadgeText}>Đã đọc</Text>
                            </View>
                        )}
                    </View>
                    <Text style={[styles.expiryText, { color: isExpired ? COLORS.danger : COLORS.warningDark }]}>
                        {isExpired
                            ? `Đã hết hạn ${Math.abs(item.daysLeft)} ngày`
                            : item.daysLeft === 0 ? 'Hết hạn hôm nay' : `Sắp hết hạn trong ${item.daysLeft} ngày`
                        }
                    </Text>
                </View>
                <View style={styles.actionButtons}>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => isRead ? handleMarkAsUnread(item) : handleMarkAsRead(item)}
                    >
                        <MaterialIcons
                            name={isRead ? "mark-email-unread" : "mark-email-read"}
                            size={20}
                            color={isRead ? COLORS.textSecondary : COLORS.primary}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleDelete(item)}
                    >
                        <MaterialIcons name="delete-outline" size={20} color={COLORS.danger} />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const sections = [
        { title: 'ĐÃ HẾT HẠN', data: expiredItems, isExpired: true },
        { title: 'SẮP HẾT HẠN', data: expiringSoonItems, isExpired: false },
    ].filter(s => s.data.length > 0);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Cảnh báo thực phẩm</Text>
                {(expiredItems.length > 0 || expiringSoonItems.length > 0) && (
                    <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.markAllButton}>
                        <MaterialIcons name="done-all" size={24} color={COLORS.primary} />
                    </TouchableOpacity>
                )}
                {(expiredItems.length === 0 && expiringSoonItems.length === 0) && (
                    <View style={styles.placeholder} />
                )}
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : sections.length === 0 ? (
                <View style={styles.emptyState}>
                    <MaterialIcons name="check-circle-outline" size={64} color={COLORS.success} />
                    <Text style={styles.emptyTitle}>Tất cả đều ổn!</Text>
                    <Text style={styles.emptyText}>Hiện tại không có thực phẩm nào hết hạn.</Text>
                </View>
            ) : (
                <FlatList
                    data={sections}
                    keyExtractor={item => item.title}
                    renderItem={({ item: section }) => (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>{section.title}</Text>
                            {section.data.map(item => (
                                <React.Fragment key={item.id}>
                                    {renderItem({ item, isExpired: section.isExpired })}
                                </React.Fragment>
                            ))}
                        </View>
                    )}
                    contentContainerStyle={styles.listContent}
                />
            )}
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
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderLight,
    },
    headerTitle: {
        ...TYPOGRAPHY.heading2,
        color: COLORS.textPrimary,
    },
    backButton: {
        padding: SPACING.xs,
    },
    markAllButton: {
        padding: SPACING.xs,
    },
    placeholder: {
        width: 32,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: SPACING.md,
    },
    section: {
        marginBottom: SPACING.lg,
    },
    sectionTitle: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
        marginBottom: SPACING.sm,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    itemCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.backgroundCard,
        padding: SPACING.md,
        borderRadius: RADIUS.md,
        marginBottom: SPACING.sm,
    },
    itemCardRead: {
        opacity: 0.7,
        backgroundColor: COLORS.background,
    },
    itemIconContainer: {
        width: 48,
        height: 48,
        borderRadius: RADIUS.sm,
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.md,
    },
    itemImage: {
        width: 48,
        height: 48,
        borderRadius: RADIUS.sm,
    },
    itemInfo: {
        flex: 1,
    },
    itemNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
    },
    itemName: {
        ...TYPOGRAPHY.bodyLarge,
        color: COLORS.textPrimary,
        fontWeight: 'bold',
        flex: 1,
    },
    readBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.successLight || COLORS.background,
        paddingHorizontal: SPACING.xs,
        paddingVertical: 2,
        borderRadius: RADIUS.sm,
        gap: 4,
    },
    readBadgeText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.success,
        fontSize: 11,
        fontWeight: '600',
    },
    expiryText: {
        ...TYPOGRAPHY.caption,
        marginTop: 2,
    },
    actionButtons: {
        flexDirection: 'row',
        gap: SPACING.xs,
    },
    actionButton: {
        padding: SPACING.sm,
    },
    deleteButton: {
        padding: SPACING.sm,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.xxl,
    },
    emptyTitle: {
        ...TYPOGRAPHY.h2,
        color: COLORS.textPrimary,
        marginTop: SPACING.md,
    },
    emptyText: {
        ...TYPOGRAPHY.bodyMedium,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginTop: SPACING.sm,
    }
});

export default ExpiredItemsScreen;
