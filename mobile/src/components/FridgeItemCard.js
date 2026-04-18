import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';

const CATEGORY_CONFIG = {
    vegetables: { icon: 'eco', bgColor: '#E8F5E9', iconColor: '#4CAF50' },
    meat: { icon: 'kebab-dining', bgColor: '#FFEBEE', iconColor: '#E53935' },
    seafood: { icon: 'set-meal', bgColor: '#E3F2FD', iconColor: '#1E88E5' },
    fruits: { icon: 'apple', bgColor: '#FFF3E0', iconColor: '#FB8C00' },
    dairy: { icon: 'egg', bgColor: '#FFF8E1', iconColor: '#FFB300' },
    spices: { icon: 'grain', bgColor: '#F3E5F5', iconColor: '#8E24AA' },
    other: { icon: 'kitchen', bgColor: '#ECEFF1', iconColor: '#546E7A' },
};

const getDaysUntilExpiry = (expiryDate) => {
    if (!expiryDate) return null;
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const getExpiryColor = (days) => {
    if (days === null) return COLORS.textMuted;
    if (days < 0) return COLORS.danger;
    if (days <= 3) return COLORS.warningDark;
    if (days <= 7) return '#F5A623';
    return COLORS.success;
};

const getProgressWidth = (days) => {
    if (days === null) return 0.5;
    if (days < 0) return 1;
    if (days <= 14) return Math.max(0.1, 1 - (days / 14));
    return 0.05;
};

const FridgeItemCard = ({
    item,
    onPress,
    onLongPress,
    onSwipeUsed,
    onSwipeDelete,
    selectionMode,
    isSelected,
}) => {
    const daysUntilExpiry = getDaysUntilExpiry(item.expiry_date);
    const expiryColor = getExpiryColor(daysUntilExpiry);
    const progressWidth = getProgressWidth(daysUntilExpiry);
    const catConfig = CATEGORY_CONFIG[item.category_id] || CATEGORY_CONFIG.other;

    const renderRightActions = () => {
        if (selectionMode) return null;
        return (
            <View style={styles.swipeActionsContainer}>
                <TouchableOpacity
                    style={[styles.swipeAction, styles.swipeActionUsed]}
                    onPress={() => onSwipeUsed?.(item)}
                >
                    <MaterialIcons name="check-circle" size={22} color={COLORS.white} />
                    <Text style={styles.swipeActionText}>Đã dùng</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.swipeAction, styles.swipeActionDelete]}
                    onPress={() => onSwipeDelete?.(item)}
                >
                    <MaterialIcons name="delete" size={22} color={COLORS.white} />
                    <Text style={styles.swipeActionText}>Xoá</Text>
                </TouchableOpacity>
            </View>
        );
    };

    const expiryLabel = daysUntilExpiry === null
        ? '—'
        : daysUntilExpiry < 0
            ? 'Hết hạn'
            : daysUntilExpiry === 0
                ? 'Hôm nay'
                : `${daysUntilExpiry}d`;

    const cardContent = (
        <TouchableOpacity
            style={[
                styles.card,
                selectionMode && isSelected && styles.cardSelected,
            ]}
            onPress={() => onPress?.(item)}
            onLongPress={() => onLongPress?.(item)}
            activeOpacity={0.85}
        >
            {/* Selection checkbox */}
            {selectionMode && (
                <View style={styles.checkboxArea}>
                    <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                        {isSelected && (
                            <MaterialIcons name="check" size={14} color={COLORS.white} />
                        )}
                    </View>
                </View>
            )}

            {/* Category Icon */}
            <View style={[styles.iconBox, { backgroundColor: catConfig.bgColor }]}>
                {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.itemImage} resizeMode="cover" />
                ) : (
                    <MaterialIcons name={catConfig.icon} size={22} color={catConfig.iconColor} />
                )}
            </View>

            {/* Info */}
            <View style={styles.infoArea}>
                <Text style={styles.itemName} numberOfLines={1}>{item.item_name}</Text>
                <Text style={styles.itemQuantity}>{item.amount} {item.unit}</Text>

                {/* Expiry Progress Bar */}
                <View style={styles.progressTrack}>
                    <View
                        style={[
                            styles.progressFill,
                            {
                                width: `${progressWidth * 100}%`,
                                backgroundColor: expiryColor,
                            },
                        ]}
                    />
                </View>
            </View>

            {/* Expiry Badge */}
            <View style={[styles.expiryBadge, { backgroundColor: expiryColor + '18' }]}>
                <Text style={[styles.expiryBadgeText, { color: expiryColor }]}>{expiryLabel}</Text>
            </View>
        </TouchableOpacity>
    );

    if (selectionMode) {
        return cardContent;
    }

    return (
        <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
            {cardContent}
        </Swipeable>
    );
};

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.lg,
        paddingVertical: 12,
        paddingHorizontal: SPACING.md,
        marginBottom: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
    },
    cardSelected: {
        backgroundColor: COLORS.primaryMuted,
        borderColor: COLORS.primary,
        borderWidth: 2,
    },
    checkboxArea: {
        marginRight: SPACING.sm,
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: COLORS.border,
        backgroundColor: COLORS.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxChecked: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    iconBox: {
        width: 46,
        height: 46,
        borderRadius: RADIUS.md,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.md,
    },
    itemImage: {
        width: 46,
        height: 46,
        borderRadius: RADIUS.md,
    },
    infoArea: {
        flex: 1,
        marginRight: SPACING.sm,
    },
    itemName: {
        ...TYPOGRAPHY.bodyRegular,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
    },
    itemQuantity: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
        marginTop: 2,
    },
    progressTrack: {
        height: 3,
        backgroundColor: COLORS.borderLight,
        borderRadius: 2,
        marginTop: 6,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
    expiryBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: RADIUS.pill,
        minWidth: 48,
        alignItems: 'center',
    },
    expiryBadgeText: {
        fontSize: 12,
        fontFamily: FONTS.bold,
    },
    swipeActionsContainer: {
        flexDirection: 'row',
        marginBottom: SPACING.sm,
        marginLeft: SPACING.sm,
    },
    swipeAction: {
        justifyContent: 'center',
        alignItems: 'center',
        width: 72,
        borderRadius: RADIUS.lg,
        gap: 4,
    },
    swipeActionUsed: {
        backgroundColor: COLORS.success,
        marginRight: 4,
    },
    swipeActionDelete: {
        backgroundColor: COLORS.danger,
    },
    swipeActionText: {
        color: COLORS.white,
        fontSize: 10,
        fontFamily: FONTS.bold,
    },
});

export default FridgeItemCard;
