import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';

const FamilyMemberCard = ({ member, onPress, onDelete }) => {
    const getRelationshipColor = (relationship) => {
        const colors = {
            'Bố': COLORS.primary,
            'Mẹ': COLORS.success,
            'Con trai': COLORS.warning,
            'Con gái': COLORS.danger,
            'Ông': COLORS.grayDark,
            'Bà': COLORS.grayDark,
        };
        return colors[relationship] || COLORS.primaryMuted;
    };

    const getGenderIcon = (gender) => {
        switch (gender) {
            case 'Nam': return 'male';
            case 'Nữ': return 'female';
            default: return 'person';
        }
    };

    const handleLongPress = () => {
        Alert.alert(
            'Tùy chọn',
            `Chọn hành động cho ${member.name}`,
            [
                { text: 'Hủy', style: 'cancel' },
                {
                    text: 'Chỉnh sửa',
                    onPress: onPress,
                },
                {
                    text: 'Xóa',
                    style: 'destructive',
                    onPress: onDelete,
                },
            ]
        );
    };

    return (
        <TouchableOpacity
            style={styles.card}
            onPress={onPress}
            onLongPress={handleLongPress}
            activeOpacity={0.7}
        >
            <View style={styles.cardContent}>
                {/* Avatar */}
                <View style={styles.avatarContainer}>
                    {member.avatar_url ? (
                        <Image source={{ uri: member.avatar_url }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatarPlaceholder, { backgroundColor: getRelationshipColor(member.relationship) }]}>
                            <MaterialIcons name={getGenderIcon(member.gender)} size={32} color={COLORS.white} />
                        </View>
                    )}
                </View>

                {/* Info */}
                <View style={styles.infoContainer}>
                    <View style={styles.nameRow}>
                        <Text style={styles.name}>{member.name}</Text>
                        <View style={[styles.relationshipBadge, { backgroundColor: getRelationshipColor(member.relationship) }]}>
                            <Text style={styles.relationshipText}>{member.relationship}</Text>
                        </View>
                    </View>

                    <Text style={styles.details}>
                        {member.age} tuổi • {member.gender}
                    </Text>

                    {/* Dietary preferences preview */}
                    {member.dietary_preferences && member.dietary_preferences.length > 0 && (
                        <View style={styles.preferencesRow}>
                            <MaterialIcons name="restaurant" size={16} color={COLORS.textMuted} />
                            <Text style={styles.preferencesText} numberOfLines={1}>
                                {member.dietary_preferences.slice(0, 2).join(', ')}
                                {member.dietary_preferences.length > 2 && ` +${member.dietary_preferences.length - 2} nữa`}
                            </Text>
                        </View>
                    )}

                    {/* Health conditions indicator */}
                    {(member.health_conditions?.predefined?.length > 0 || member.health_conditions?.notes) && (
                        <View style={styles.healthRow}>
                            <MaterialIcons name="health-and-safety" size={16} color={COLORS.warningDark} />
                            <Text style={styles.healthText}>
                                {member.health_conditions?.predefined?.length > 0 ? 'Có lưu ý sức khỏe' : 'Có ghi chú sức khỏe'}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Arrow */}
                <MaterialIcons name="chevron-right" size={24} color={COLORS.grayLight} />
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.lg,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
    },
    avatarContainer: {
        marginRight: SPACING.md,
    },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 2,
        borderColor: COLORS.primaryMuted,
    },
    avatarPlaceholder: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: COLORS.border,
    },
    infoContainer: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: SPACING.xs,
    },
    name: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
        flex: 1,
    },
    relationshipBadge: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
        borderRadius: RADIUS.sm,
    },
    relationshipText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.white,
        fontFamily: FONTS.bold,
        fontSize: 10,
    },
    details: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
        marginBottom: SPACING.xs,
    },
    preferencesRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
    },
    preferencesText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
        flex: 1,
    },
    healthRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        marginTop: 2,
    },
    healthText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.warningDark,
        fontFamily: FONTS.medium,
    },
});

export default FamilyMemberCard;