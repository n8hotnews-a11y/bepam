import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Image,
    Dimensions
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import { recipeService } from '../services/recipeService';
import { supabase } from '../services/supabaseConfig';
import RecipeImage from './RecipeImage';
import FamilyCompatibilityBadge from './FamilyCompatibilityBadge';

const { width } = Dimensions.get('window');

const ExplorationView = ({ navigation }) => {
    const [dailyMeals, setDailyMeals] = useState(null);
    const [loadingAI, setLoadingAI] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [isPremium, setIsPremium] = useState(false);

    useEffect(() => {
        fetchDailyMeals();
        checkPremiumStatus();
    }, []);

    // Live search logic
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (searchQuery.trim().length > 0) {
                handleSearch(searchQuery);
            } else {
                setSearchResults([]);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const handleSearch = async (query) => {
        setSearching(true);
        try {
            const result = await recipeService.searchRecipes(query);
            if (result.success) {
                setSearchResults(result.results || []);
            }
        } catch (error) {
            console.error("Search Error:", error);
        } finally {
            setSearching(false);
        }
    };

    const checkPremiumStatus = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setIsPremium(true);
        }
    };

    const fetchDailyMeals = async () => {
        setLoadingAI(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const result = await recipeService.suggestDailyMealsAI(user.id);
                if (result.success) {
                    setDailyMeals(result.meals);
                }
            }
        } catch (error) {
            console.error("Fetch Daily Meals Error:", error);
        } finally {
            setLoadingAI(false);
        }
    };

    const handleRecipePress = (recipe) => {
        if (!recipe) return;
        navigation.navigate('RecipeDetail', {
            recipeId: recipe.id,
            initialRecipeData: recipe
        });
    };

    const renderAIMealItem = (recipe, label, icon) => (
        <TouchableOpacity
            style={styles.mealCard}
            onPress={() => handleRecipePress(recipe)}
        >
            <View style={styles.mealIconWrapper}>
                <MaterialIcons name={icon} size={20} color={COLORS.primary} />
            </View>
            <View style={styles.mealInfo}>
                <Text style={styles.mealLabel}>{label}</Text>
                <Text style={styles.mealTitle} numberOfLines={1}>
                    {recipe?.title || 'Đang tính toán...'}
                </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>
    );

    const renderSearchResult = (item) => (
        <TouchableOpacity
            key={item.id}
            style={styles.searchResultCard}
            onPress={() => handleRecipePress(item)}
        >
            <RecipeImage
                uri={item.image}
                style={styles.searchResultImage}
                defaultIcon="restaurant"
                iconSize={32}
            />
            <View style={styles.searchResultInfo}>
                <Text style={styles.searchResultTitle} numberOfLines={1}>{item.title}</Text>
                <View style={styles.searchResultMeta}>
                    <Text style={styles.searchResultMetaText}>{item.readyInMinutes || 30}p</Text>
                    <Text style={styles.searchResultSeparator}>•</Text>
                    <Text style={styles.searchResultMetaText}>{item.healthScore || 0}đ sức khỏe</Text>
                </View>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>
    );

    return (
        <ScrollView
            style={styles.container}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
        >
            {/* 1. Tự động hóa AI Section */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <View style={styles.aiHeaderTitle}>
                        <MaterialIcons name="auto-awesome" size={20} color={COLORS.primary} />
                        <Text style={styles.sectionTitle}>Gợi ý thực đơn hôm nay</Text>
                    </View>
                    <TouchableOpacity onPress={fetchDailyMeals}>
                        <MaterialIcons name="refresh" size={20} color={COLORS.primary} />
                    </TouchableOpacity>
                </View>

                <View style={styles.aiCard}>
                    {loadingAI ? (
                        <View style={styles.loaderContainer}>
                            <ActivityIndicator size="small" color={COLORS.primary} />
                            <Text style={styles.loaderText}>AI đang cân đối dinh dưỡng...</Text>
                        </View>
                    ) : (
                        <View style={styles.mealsContainer}>
                            {renderAIMealItem(dailyMeals?.breakfast, 'Bữa sáng', 'wb-twilight')}
                            <View style={styles.divider} />
                            {renderAIMealItem(dailyMeals?.lunch, 'Bữa trưa', 'wb-sunny')}
                            <View style={styles.divider} />
                            {renderAIMealItem(dailyMeals?.dinner, 'Bữa tối', 'nights-stay')}
                        </View>
                    )}
                </View>
            </View>

            {/* 2. Tìm kiếm cùng AI Banner */}
            <TouchableOpacity
                style={styles.aiSearchBanner}
                onPress={() => navigation.navigate('AIAuto')}
            >
                <View style={styles.aiBannerContent}>
                    <View style={styles.aiBannerText}>
                        <Text style={styles.aiBannerTitle}>Tìm món cùng Bếp Trưởng AI</Text>
                        <Text style={styles.aiBannerSub}>Nhập yêu cầu đặc biệt: "Món ít dầu mỡ", "Bữa tối cho bé"...</Text>
                    </View>
                    <View style={styles.aiBannerIcon}>
                        <MaterialIcons name="psychology" size={32} color={COLORS.white} />
                    </View>
                </View>
                <View style={styles.aiBannerSearch}>
                    <Text style={styles.aiBannerPlaceholder}>Hỏi gì cũng được...</Text>
                    <MaterialIcons name="send" size={18} color={COLORS.primary} />
                </View>
            </TouchableOpacity>

            {/* 3. Kho công thức / Tìm kiếm đơn giản */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Kho công thức truyền thống</Text>
                </View>

                {/* Simplified Search Bar */}
                <View style={styles.searchBarWrapper}>
                    <MaterialIcons name="search" size={22} color={COLORS.textMuted} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Tìm món ăn hoặc nguyên liệu..."
                        placeholderTextColor={COLORS.textMuted}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <MaterialIcons name="close" size={20} color={COLORS.textMuted} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Results Display */}
                <View style={styles.resultsContainer}>
                    {searching ? (
                        <View style={styles.searchingLoader}>
                            <ActivityIndicator size="small" color={COLORS.primary} />
                        </View>
                    ) : searchQuery.length > 0 ? (
                        searchResults.length > 0 ? (
                            <View style={styles.resultsList}>
                                {searchResults.map(renderSearchResult)}
                            </View>
                        ) : (
                            <View style={styles.emptyResults}>
                                <Text style={styles.emptyResultsText}>Không tìm thấy món nào.</Text>
                            </View>
                        )
                    ) : (
                        <View style={styles.initialState}>
                            <MaterialIcons name="restaurant-menu" size={40} color={COLORS.border} />
                            <Text style={styles.initialStateText}>Nhập tên món để khám phá hàng ngàn công thức Việt</Text>
                        </View>
                    )}
                </View>
            </View>

            <View style={{ height: 40 }} />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        padding: SPACING.lg,
    },
    section: {
        marginBottom: SPACING.xl,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    aiHeaderTitle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionTitle: {
        ...TYPOGRAPHY.heading2,
        color: COLORS.textPrimary,
    },
    aiCard: {
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.xl,
        padding: SPACING.md,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 4,
        borderWidth: 1,
        borderColor: COLORS.primaryMuted,
    },
    loaderContainer: {
        padding: SPACING.xl,
        alignItems: 'center',
        gap: SPACING.sm,
    },
    loaderText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
        fontFamily: FONTS.medium,
    },
    mealsContainer: {
        gap: 0,
    },
    mealCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.sm,
    },
    mealIconWrapper: {
        width: 40,
        height: 40,
        borderRadius: RADIUS.md,
        backgroundColor: COLORS.primaryFade,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.md,
    },
    mealInfo: {
        flex: 1,
    },
    mealLabel: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
        marginBottom: 2,
    },
    mealTitle: {
        ...TYPOGRAPHY.bodyMedium,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
    },
    fridgeToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: SPACING.md,
        paddingVertical: 4,
    },
    fridgeToggleText: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textMuted,
        fontFamily: FONTS.medium,
    },
    fridgeToggleTextActive: {
        color: COLORS.textPrimary,
        fontFamily: FONTS.bold,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.borderLight,
        marginLeft: 56,
    },
    aiSearchBanner: {
        backgroundColor: COLORS.primary,
        borderRadius: RADIUS.xl,
        padding: SPACING.lg,
        marginBottom: SPACING.xl,
    },
    aiBannerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    aiBannerText: {
        flex: 1,
    },
    aiBannerTitle: {
        ...TYPOGRAPHY.heading3,
        color: COLORS.white,
    },
    aiBannerSub: {
        ...TYPOGRAPHY.caption,
        color: 'rgba(255, 255, 255, 0.8)',
        marginTop: 4,
    },
    aiBannerIcon: {
        marginLeft: SPACING.md,
    },
    aiBannerSearch: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.white,
        borderRadius: RADIUS.lg,
        paddingHorizontal: SPACING.md,
        height: 44,
    },
    aiBannerPlaceholder: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textMuted,
    },
    searchBarWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.lg,
        paddingHorizontal: SPACING.md,
        height: 52,
        marginTop: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
    },
    searchInput: {
        flex: 1,
        marginLeft: SPACING.sm,
        ...TYPOGRAPHY.bodyLarge,
        color: COLORS.textPrimary,
    },
    resultsContainer: {
        marginTop: SPACING.lg,
        minHeight: 100,
    },
    searchingLoader: {
        padding: SPACING.xl,
        alignItems: 'center',
    },
    resultsList: {
        gap: SPACING.md,
    },
    searchResultCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.lg,
        padding: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
    },
    searchResultImage: {
        width: 60,
        height: 60,
        borderRadius: RADIUS.md,
    },
    searchResultInfo: {
        flex: 1,
        marginLeft: SPACING.md,
    },
    searchResultTitle: {
        ...TYPOGRAPHY.bodyMedium,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
    },
    searchResultMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    searchResultMetaText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
    },
    searchResultSeparator: {
        marginHorizontal: 6,
        color: COLORS.border,
        fontSize: 8,
    },
    emptyResults: {
        padding: SPACING.xl,
        alignItems: 'center',
    },
    emptyResultsText: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textMuted,
    },
    initialState: {
        padding: SPACING.xl,
        alignItems: 'center',
        gap: SPACING.md,
    },
    initialStateText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
        textAlign: 'center',
        lineHeight: 18,
    },
});

export default ExplorationView;
