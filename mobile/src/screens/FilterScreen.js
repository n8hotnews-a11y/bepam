import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';

const FILTERS = [
    {
        id: 'type', name: 'Loại món', options: [
            { id: 'kho', name: 'Món Kho' },
            { id: 'xao', name: 'Món Xào' },
            { id: 'canh', name: 'Món Canh' },
            { id: 'luoc', name: 'Món Luộc' },
            { id: 'chien', name: 'Món Chiên' },
            { id: 'nuong', name: 'Món Nướng' },
            { id: 'hap', name: 'Món Hấp' }
        ]
    }
];

const FilterScreen = ({ navigation, route }) => {
    const initialFilters = route.params?.activeFilters || {};
    const [activeFilters, setActiveFilters] = useState(initialFilters);

    const toggleFilter = (type, value) => {
        const newFilters = { ...activeFilters };
        if (newFilters[type] === value) {
            delete newFilters[type];
        } else {
            newFilters[type] = value;
        }
        setActiveFilters(newFilters);
    };

    const applyFilters = () => {
        navigation.navigate('Main', {
            screen: 'Recipes',
            params: { activeFilters }
        });
    };

    const resetFilters = () => {
        setActiveFilters({});
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialIcons name="arrow-back" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Bộ lọc tìm kiếm</Text>
                <TouchableOpacity onPress={resetFilters}>
                    <Text style={styles.resetText}>Đặt lại</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Fridge Filter Toggle */}
                <View style={styles.filterGroup}>
                    <Text style={styles.filterGroupTitle}>Nguyên liệu</Text>
                    <TouchableOpacity
                        style={[
                            styles.fridgeToggleRow,
                            activeFilters.useFridge !== false && styles.fridgeToggleRowActive
                        ]}
                        onPress={() => {
                            const newFilters = { ...activeFilters };
                            if (newFilters.useFridge === false) {
                                delete newFilters.useFridge; // Default to true by removing the false flag
                            } else {
                                newFilters.useFridge = false;
                            }
                            setActiveFilters(newFilters);
                        }}
                    >
                        <MaterialIcons
                            name={activeFilters.useFridge !== false ? "check-circle" : "radio-button-unchecked"}
                            size={24}
                            color={activeFilters.useFridge !== false ? COLORS.primary : COLORS.textMuted}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={[
                                styles.fridgeToggleText,
                                activeFilters.useFridge !== false && styles.fridgeToggleTextActive
                            ]}>Ưu tiên thực phẩm trong tủ lạnh</Text>
                            <Text style={styles.fridgeToggleSub}>Chỉ hiển thị món ăn có sẵn nguyên liệu</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {FILTERS.map(group => (
                    <View key={group.id} style={styles.filterGroup}>
                        <Text style={styles.filterGroupTitle}>{group.name}</Text>
                        <View style={styles.filterOptions}>
                            {group.options.map(opt => (
                                <TouchableOpacity
                                    key={opt.id}
                                    style={[
                                        styles.filterChip,
                                        activeFilters[group.id] === opt.id && styles.filterChipActive
                                    ]}
                                    onPress={() => toggleFilter(group.id, opt.id)}
                                >
                                    <Text style={[
                                        styles.filterChipText,
                                        activeFilters[group.id] === opt.id && styles.filterChipTextActive
                                    ]}>{opt.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                ))}

                <View style={styles.hintSection}>
                    <MaterialIcons name="info-outline" size={20} color={COLORS.textMuted} />
                    <Text style={styles.hintText}>
                        Chọn các tiêu chí để thu hẹp kết quả tìm kiếm công thức nấu ăn của bạn.
                    </Text>
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.applyBtn} onPress={applyFilters}>
                    <Text style={styles.applyBtnText}>Áp dụng bộ lọc</Text>
                </TouchableOpacity>
            </View>
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
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        backgroundColor: COLORS.backgroundCard,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderLight,
    },
    headerTitle: {
        ...TYPOGRAPHY.heading2,
        color: COLORS.textPrimary,
    },
    backBtn: {
        padding: SPACING.xs,
    },
    resetText: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.primary,
        fontFamily: FONTS.bold,
    },
    content: {
        flex: 1,
        padding: SPACING.lg,
    },
    filterGroup: {
        marginBottom: SPACING.xl,
    },
    filterGroupTitle: {
        ...TYPOGRAPHY.heading3,
        color: COLORS.textPrimary,
        marginBottom: SPACING.md,
    },
    fridgeToggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.backgroundCard,
        padding: SPACING.md,
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
        gap: SPACING.md,
    },
    fridgeToggleRowActive: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.primaryFade,
    },
    fridgeToggleText: {
        ...TYPOGRAPHY.bodyMedium,
        fontFamily: FONTS.bold,
        color: COLORS.textSecondary,
    },
    fridgeToggleTextActive: {
        color: COLORS.primary,
    },
    fridgeToggleSub: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
        marginTop: 2,
    },
    filterOptions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
    },
    filterChip: {
        paddingHorizontal: SPACING.lg,
        paddingVertical: 10,
        borderRadius: RADIUS.pill,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.white,
    },
    filterChipActive: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.primaryMuted,
    },
    filterChipText: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textSecondary,
    },
    filterChipTextActive: {
        color: COLORS.primary,
        fontFamily: FONTS.bold,
    },
    hintSection: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.backgroundCard,
        padding: SPACING.md,
        borderRadius: RADIUS.md,
        gap: SPACING.sm,
        marginTop: SPACING.md,
    },
    hintText: {
        flex: 1,
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
    },
    footer: {
        padding: SPACING.lg,
        backgroundColor: COLORS.backgroundCard,
        borderTopWidth: 1,
        borderTopColor: COLORS.borderLight,
    },
    applyBtn: {
        backgroundColor: COLORS.primary,
        paddingVertical: 16,
        borderRadius: RADIUS.lg,
        alignItems: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    applyBtnText: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: COLORS.white,
    },
});

export default FilterScreen;
