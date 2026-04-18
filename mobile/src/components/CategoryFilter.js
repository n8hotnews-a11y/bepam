import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';

const CATEGORIES = [
    { id: 'all', label: 'Tất cả', emoji: '📦' },
    { id: 'vegetables', label: 'Rau củ', emoji: '🥬' },
    { id: 'meat', label: 'Thịt', emoji: '🥩' },
    { id: 'seafood', label: 'Hải sản', emoji: '🦐' },
    { id: 'fruits', label: 'Trái cây', emoji: '🍎' },
    { id: 'dairy', label: 'Sữa/Trứng', emoji: '🥛' },
    { id: 'spices', label: 'Gia vị', emoji: '🧂' },
    { id: 'other', label: 'Khác', emoji: '🍱' },
];

const CategoryFilter = ({ activeCategory, onSelect, itemCounts = {} }) => {
    return (
        <View style={styles.container}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {CATEGORIES.map((cat) => {
                    const isActive = activeCategory === cat.id;
                    const count = cat.id === 'all'
                        ? Object.values(itemCounts).reduce((sum, c) => sum + c, 0)
                        : (itemCounts[cat.id] || 0);

                    // Skip categories with 0 items (except 'all')
                    if (cat.id !== 'all' && count === 0) return null;

                    return (
                        <TouchableOpacity
                            key={cat.id}
                            style={[styles.chip, isActive && styles.chipActive]}
                            onPress={() => onSelect(cat.id)}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.chipEmoji}>{cat.emoji}</Text>
                            <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>
                                {cat.label}
                            </Text>
                            {count > 0 && (
                                <View style={[styles.countBadge, isActive && styles.countBadgeActive]}>
                                    <Text style={[styles.countText, isActive && styles.countTextActive]}>
                                        {count}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: -SPACING.md, // Overlap with header gradient slightly
        zIndex: 1,
    },
    scrollContent: {
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
        gap: SPACING.sm,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.backgroundCard,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: RADIUS.pill,
        gap: 6,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    chipActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
        shadowColor: COLORS.primary,
        shadowOpacity: 0.3,
        elevation: 3,
    },
    chipEmoji: {
        fontSize: 16,
    },
    chipLabel: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.bold,
        color: COLORS.textSecondary,
    },
    chipLabelActive: {
        color: COLORS.white,
    },
    countBadge: {
        backgroundColor: COLORS.background,
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 1,
        minWidth: 20,
        alignItems: 'center',
    },
    countBadgeActive: {
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    countText: {
        fontSize: 10,
        fontFamily: FONTS.bold,
        color: COLORS.textMuted,
    },
    countTextActive: {
        color: COLORS.white,
    },
});

export default CategoryFilter;
