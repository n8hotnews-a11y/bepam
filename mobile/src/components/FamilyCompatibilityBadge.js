import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';

/**
 * Badge component to display family compatibility status for a recipe
 * 
 * @param {object} props
 * @param {object} props.familyScore - Score object from familyRecipeMatcherService
 * @param {boolean} props.compact - Show compact version (icon only)
 * @param {function} props.onPress - Callback when badge is pressed (to show details)
 */
const FamilyCompatibilityBadge = ({ familyScore, compact = false, onPress }) => {
    if (!familyScore || familyScore.score === undefined) {
        return null;
    }

    const { badge, score, warnings = [], issues = [] } = familyScore;

    if (!badge) {
        return null;
    }

    const getBadgeStyle = () => {
        switch (badge.type) {
            case 'success':
                return {
                    container: styles.badgeSuccess,
                    text: styles.badgeTextSuccess,
                };
            case 'info':
                return {
                    container: styles.badgeInfo,
                    text: styles.badgeTextInfo,
                };
            case 'warning':
                return {
                    container: styles.badgeWarning,
                    text: styles.badgeTextWarning,
                };
            case 'danger':
                return {
                    container: styles.badgeDanger,
                    text: styles.badgeTextDanger,
                };
            default:
                return {
                    container: styles.badgeDefault,
                    text: styles.badgeTextDefault,
                };
        }
    };

    const badgeStyle = getBadgeStyle();
    const totalIssues = warnings.length + issues.length;

    if (compact) {
        return (
            <TouchableOpacity
                style={[styles.compactBadge, badgeStyle.container]}
                onPress={onPress}
                disabled={!onPress}
            >
                <MaterialIcons
                    name={badge.icon}
                    size={16}
                    color={badge.color}
                />
                {totalIssues > 0 && (
                    <View style={[styles.countBadge, { backgroundColor: badge.color }]}>
                        <Text style={styles.countText}>{totalIssues}</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity
            style={[styles.badge, badgeStyle.container]}
            onPress={onPress}
            disabled={!onPress}
            activeOpacity={onPress ? 0.7 : 1}
        >
            <MaterialIcons
                name={badge.icon}
                size={14}
                color={badge.color}
            />
            <Text style={[styles.badgeText, badgeStyle.text]}>
                {badge.label}
            </Text>
            {score < 100 && score > 0 && (
                <Text style={[styles.scoreText, { color: badge.color }]}>
                    {score}%
                </Text>
            )}
        </TouchableOpacity>
    );
};

/**
 * Detailed warning component to show why a recipe may not be suitable
 */
export const FamilyDietaryWarning = ({ familyScore, memberRestrictions }) => {
    if (!familyScore || (familyScore.warnings?.length === 0 && familyScore.issues?.length === 0)) {
        return null;
    }

    const { warnings = [], issues = [] } = familyScore;

    return (
        <View style={styles.warningContainer}>
            {/* Critical Issues (must avoid) */}
            {issues.map((issue, index) => (
                <View key={`issue-${index}`} style={styles.issueRow}>
                    <MaterialIcons name="error" size={18} color={COLORS.danger} />
                    <View style={styles.issueContent}>
                        <Text style={styles.issueIngredient}>{issue.ingredient}</Text>
                        <Text style={styles.issueReason}>{issue.reason}</Text>
                    </View>
                </View>
            ))}

            {/* Warnings (should limit) */}
            {warnings.map((warning, index) => (
                <View key={`warn-${index}`} style={styles.warningRow}>
                    <MaterialIcons name="warning" size={18} color={COLORS.warning} />
                    <View style={styles.warningContent}>
                        <Text style={styles.warningIngredient}>{warning.ingredient}</Text>
                        <Text style={styles.warningReason}>{warning.reason}</Text>
                    </View>
                </View>
            ))}
        </View>
    );
};

/**
 * Simple inline indicator for recipe cards
 */
export const FamilyScoreIndicator = ({ score, size = 'small' }) => {
    if (score === undefined || score === null) return null;

    const getColor = () => {
        if (score >= 90) return COLORS.success;
        if (score >= 70) return COLORS.info || '#3B82F6';
        if (score >= 50) return COLORS.warning;
        return COLORS.danger;
    };

    const iconSize = size === 'small' ? 16 : 20;

    return (
        <View style={[styles.indicator, { backgroundColor: `${getColor()}20` }]}>
            <MaterialIcons
                name={score >= 70 ? "family-restroom" : "warning"}
                size={iconSize}
                color={getColor()}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
        borderRadius: RADIUS.md,
        gap: 4,
    },
    badgeSuccess: {
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#A7F3D0',
    },
    badgeInfo: {
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    badgeWarning: {
        backgroundColor: '#FFFBEB',
        borderWidth: 1,
        borderColor: '#FDE68A',
    },
    badgeDanger: {
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    badgeDefault: {
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    badgeText: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.medium,
    },
    badgeTextSuccess: {
        color: '#059669',
    },
    badgeTextInfo: {
        color: '#2563EB',
    },
    badgeTextWarning: {
        color: '#D97706',
    },
    badgeTextDanger: {
        color: '#DC2626',
    },
    badgeTextDefault: {
        color: COLORS.textSecondary,
    },
    scoreText: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.bold,
        marginLeft: 2,
    },
    compactBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    countBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        width: 16,
        height: 16,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    countText: {
        color: '#fff',
        fontSize: 10,
        fontFamily: FONTS.bold,
    },
    warningContainer: {
        backgroundColor: COLORS.background,
        borderRadius: RADIUS.md,
        padding: SPACING.md,
        gap: SPACING.sm,
    },
    issueRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: SPACING.sm,
        backgroundColor: '#FEF2F2',
        padding: SPACING.sm,
        borderRadius: RADIUS.sm,
    },
    issueContent: {
        flex: 1,
    },
    issueIngredient: {
        ...TYPOGRAPHY.bodyRegular,
        fontFamily: FONTS.medium,
        color: '#DC2626',
    },
    issueReason: {
        ...TYPOGRAPHY.caption,
        color: '#991B1B',
        marginTop: 2,
    },
    warningRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: SPACING.sm,
        backgroundColor: '#FFFBEB',
        padding: SPACING.sm,
        borderRadius: RADIUS.sm,
    },
    warningContent: {
        flex: 1,
    },
    warningIngredient: {
        ...TYPOGRAPHY.bodyRegular,
        fontFamily: FONTS.medium,
        color: '#D97706',
    },
    warningReason: {
        ...TYPOGRAPHY.caption,
        color: '#92400E',
        marginTop: 2,
    },
    indicator: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default FamilyCompatibilityBadge;
