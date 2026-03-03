import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import DraggableModal from './DraggableModal';

const { height: screenHeight } = Dimensions.get('window');

const ActionSheet = ({ visible, onClose, actions, title, onVisibilityChange }) => {
    return (
        <DraggableModal
            visible={visible}
            onClose={onClose}
            onVisibilityChange={onVisibilityChange}
            minHeight={screenHeight * 0.3}
            maxHeight={screenHeight * 0.66}
        >
            <SafeAreaView style={styles.safeArea} edges={['bottom']}>
                {/* Title */}
                {title && (
                    <View style={styles.titleContainer}>
                        <Text style={styles.title}>{title}</Text>
                    </View>
                )}

                {/* Actions */}
                <View style={styles.actionsContainer}>
                    {actions.map((action, index) => (
                        <TouchableOpacity
                            key={index}
                            style={[
                                styles.actionButton,
                                action.destructive && styles.destructiveAction,
                                index === 0 && styles.firstAction,
                                index === actions.length - 1 && styles.lastAction,
                            ]}
                            onPress={() => {
                                onClose();
                                action.onPress();
                            }}
                            activeOpacity={0.7}
                        >
                            <View style={styles.actionContent}>
                                <View style={[styles.actionIcon, { backgroundColor: action.iconColor || COLORS.primaryMuted }]}>
                                    <MaterialIcons
                                        name={action.icon}
                                        size={20}
                                        color={action.iconTextColor || (action.destructive ? COLORS.danger : COLORS.primary)}
                                    />
                                </View>
                                <View style={styles.actionTextContainer}>
                                    <Text style={[styles.actionTitle, action.destructive && styles.destructiveText]}>
                                        {action.title}
                                    </Text>
                                    {action.subtitle && (
                                        <Text style={styles.actionSubtitle}>
                                            {action.subtitle}
                                        </Text>
                                    )}
                                </View>
                                {action.showChevron && (
                                    <MaterialIcons name="chevron-right" size={20} color={COLORS.grayLight} />
                                )}
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Cancel Button */}
                <View style={styles.cancelContainer}>
                    <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={onClose}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.cancelText}>Hủy</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </DraggableModal>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    titleContainer: {
        paddingHorizontal: SPACING.xl,
        paddingBottom: SPACING.sm,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderLight,
    },
    title: {
        ...TYPOGRAPHY.heading2,
        textAlign: 'center',
        color: COLORS.textPrimary,
    },
    actionsContainer: {
        paddingHorizontal: SPACING.md,
    },
    actionButton: {
        backgroundColor: COLORS.background,
        borderRadius: RADIUS.lg,
        marginHorizontal: SPACING.md,
        marginVertical: SPACING.xs,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
    },
    destructiveAction: {
        borderColor: COLORS.dangerLight,
    },
    firstAction: {
        marginTop: SPACING.sm,
    },
    lastAction: {
        marginBottom: SPACING.sm,
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
    cancelContainer: {
        padding: SPACING.sm,
        paddingBottom: Platform.OS === 'ios' ? 40 : SPACING.xl,
    },
    cancelButton: {
        backgroundColor: COLORS.background,
        borderRadius: RADIUS.lg,
        padding: SPACING.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    cancelText: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
    },
});

export default ActionSheet;