import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import DraggableModal from './DraggableModal';

const { height: screenHeight } = Dimensions.get('window');

const BulkActionModal = ({ visible, onClose, selectedCount, onAction, onVisibilityChange }) => {
    const actions = [
        {
            id: 'delete',
            title: 'Xóa thực phẩm',
            subtitle: 'Xóa vĩnh viễn khỏi tủ lạnh',
            icon: 'delete',
            iconColor: COLORS.dangerLight,
            iconTextColor: COLORS.danger,
            destructive: true,
        },
        {
            id: 'mark_used',
            title: 'Đã dùng hết',
            subtitle: 'Chuyển vào danh sách mua sắm',
            icon: 'check-circle',
            iconColor: COLORS.successLight,
            iconTextColor: COLORS.success,
        },
        {
            id: 'mark_expired',
            title: 'Đã hết hạn',
            subtitle: 'Ghi nhận lãng phí thực phẩm',
            icon: 'delete-forever',
            iconColor: COLORS.dangerLight,
            iconTextColor: COLORS.danger,
            destructive: true,
        },
        {
            id: 'edit_expiry',
            title: 'Cập nhật hạn sử dụng',
            subtitle: 'Thay đổi ngày hết hạn',
            icon: 'edit-calendar',
            iconColor: COLORS.primaryMuted,
            iconTextColor: COLORS.primary,
        },
    ];

    return (
        <DraggableModal
            visible={visible}
            onClose={onClose}
            onVisibilityChange={onVisibilityChange}
            minHeight={screenHeight * 0.4}
            maxHeight={screenHeight * 0.66}
        >
            <View style={styles.header}>
                <Text style={styles.title}>
                    Hành động cho {selectedCount} thực phẩm
                </Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <MaterialIcons name="close" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
            </View>

            <View style={styles.actionsContainer}>
                {actions.map((action) => (
                    <TouchableOpacity
                        key={action.id}
                        style={[
                            styles.actionButton,
                            action.destructive && styles.destructiveAction
                        ]}
                        onPress={() => {
                            onClose();
                            onAction(action.id);
                        }}
                        activeOpacity={0.7}
                    >
                        <View style={styles.actionContent}>
                            <View style={[styles.actionIcon, { backgroundColor: action.iconColor }]}>
                                <MaterialIcons
                                    name={action.icon}
                                    size={20}
                                    color={action.iconTextColor}
                                />
                            </View>
                            <View style={styles.actionTextContainer}>
                                <Text style={[styles.actionTitle, action.destructive && styles.destructiveText]}>
                                    {action.title}
                                </Text>
                                <Text style={styles.actionSubtitle}>
                                    {action.subtitle}
                                </Text>
                            </View>
                            <MaterialIcons name="chevron-right" size={20} color={COLORS.grayLight} />
                        </View>
                    </TouchableOpacity>
                ))}
            </View>
        </DraggableModal>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: SPACING.xl,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderLight,
    },
    title: {
        ...TYPOGRAPHY.heading1,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
        flex: 1,
    },
    closeButton: {
        width: 40,
        alignItems: 'center',
    },
    actionsContainer: {
        padding: SPACING.md,
    },
    actionButton: {
        backgroundColor: COLORS.background,
        borderRadius: RADIUS.lg,
        marginVertical: 2,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
    },
    destructiveAction: {
        borderColor: COLORS.dangerLight,
    },
    actionContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
    },
    actionIcon: {
        width: 40,
        height: 40,
        borderRadius: RADIUS.md,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.md,
    },
    actionTextContainer: {
        flex: 1,
    },
    actionTitle: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
    },
    destructiveText: {
        color: COLORS.danger,
    },
    actionSubtitle: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
        marginTop: 2,
    },
});

export default BulkActionModal;