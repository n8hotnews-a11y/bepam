import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    FlatList,
    Image,
    ScrollView,
    ActivityIndicator,
    RefreshControl,
    Dimensions,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import { recipeService } from '../services/recipeService';
import { inventoryService } from '../services/inventoryService';
import { supabase } from '../services/supabaseConfig';


const { width } = Dimensions.get('window');

const DISH_TYPES = [
    { id: 'all', name: 'Tất cả' },
    { id: 'kho', name: 'Món Kho' },
    { id: 'xao', name: 'Món Xào' },
    { id: 'canh', name: 'Món Canh' },
    { id: 'luoc', name: 'Món Luộc' },
    { id: 'chien', name: 'Món Chiên' },
    { id: 'nuong', name: 'Món Nướng' },
    { id: 'hap', name: 'Món Hấp' }
];

import { subscriptionService } from '../services/subscriptionService';
import { Alert } from 'react-native';
import { familyRecipeMatcherService } from '../services/familyRecipeMatcherService';
import FamilyCompatibilityBadge from '../components/FamilyCompatibilityBadge';
import RecipeImage from '../components/RecipeImage';

const RecipesScreen = ({ navigation, onSelect, embedded, targetDate, targetMealType, externalFilters, isFilterView }) => {
    const [recipes, setRecipes] = useState([]);
    const [vnFridgeRecipes, setVnFridgeRecipes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilters, setActiveFilters] = useState(externalFilters || {});
    const [showAllFromFridge, setShowAllFromFridge] = useState(false);
    const [familyRestrictions, setFamilyRestrictions] = useState(null);

    useFocusEffect(
        useCallback(() => {
            let isActive = true;
            recipeService.ensureInitialized().then(() => {
                if (isActive) fetchRecipes();
            });
            return () => { isActive = false; };
        }, [fetchRecipes])
    );

    useEffect(() => {
        if (externalFilters) {
            setActiveFilters(externalFilters);
        }
    }, [externalFilters]);

    // Force re-fetch when filters change while screen is focused
    useEffect(() => {
        fetchRecipes();
    }, [activeFilters]);

    const fetchRecipes = useCallback(async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            const user_id = user?.id;

            // 1. Get Inventory & Filter Expired
            let inventoryItems = [];
            if (user_id) {
                const inventory = await inventoryService.getItems(user_id);
                if (inventory.success) {
                    const now = new Date();
                    now.setHours(0, 0, 0, 0);

                    inventoryItems = inventory.items
                        .filter(item => {
                            if (!item.expiry_date) return true;
                            const expiry = new Date(item.expiry_date);
                            expiry.setHours(0, 0, 0, 0);
                            return expiry >= now;
                        })
                        .map(i => i.item_name);
                }
            }

            // 2. Parallel Requests
            const promises = [];

            // A. Vietnamese from Fridge (Local Data)
            // Include active type filter in fridge options
            const fridgeOptions = {
                limit: showAllFromFridge ? 50 : 10,
                type: activeFilters.type
            };

            if (inventoryItems.length > 0) {
                promises.push(recipeService.getVietnameseInventoryMatches(inventoryItems, fridgeOptions)
                    .then(res => res.success ? res.results : []));
            } else {
                promises.push(Promise.resolve([]));
            }

            // B. General Search Results (based on query + filters)
            // If useFridge is false, we want general matches based on searchQuery or activeFilters (type)
            const effectiveOptions = searchQuery ? {} : { ...activeFilters };
            // Ensure we don't pass useFridge as a DB filter
            delete effectiveOptions.useFridge;

            promises.push(recipeService.searchRecipes(searchQuery, effectiveOptions)
                .then(res => res.success ? res.results : []));

            const results = await Promise.all(promises);
            let vnResults = results[0] || [];
            let searchResults = results[1] || [];

            // 4. Handle fridge filter logic
            if (activeFilters.useFridge === false) {
                // If user doesn't want fridge filtering, we clear vnResults (which is only fridge matches)
                // and show only search results
                vnResults = [];
            } else if (inventoryItems.length === 0) {
                // If fridge mode is ON but fridge is empty, maybe show empty or fallback
                vnResults = [];
            }

            // 3. Enrich with Family Compatibility
            if (user_id) {
                const enrichVn = await familyRecipeMatcherService.enrichRecipesWithFamilyInfo(vnResults, user_id);
                const enrichSearch = await familyRecipeMatcherService.enrichRecipesWithFamilyInfo(searchResults, user_id);

                if (enrichVn.success) vnResults = enrichVn.recipes;
                if (enrichSearch.success) searchResults = enrichSearch.recipes;
                if (enrichVn.restrictions) setFamilyRestrictions(enrichVn.restrictions);
            }

            setVnFridgeRecipes(vnResults);
            setRecipes(searchResults);

        } catch (error) {
            console.error("Fetch Recipes Error:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [searchQuery, activeFilters, showAllFromFridge]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchRecipes(true);
    };

    const openFilter = () => {
        navigation.navigate('Filter', { activeFilters });
    };

    const removeFilter = (type) => {
        const newFilters = { ...activeFilters };
        delete newFilters[type];

        // If no filters left, go back to main discovery via navigation
        if (Object.keys(newFilters).length === 0) {
            navigation.navigate('Main', {
                screen: 'Recipes',
                params: { activeFilters: null }
            });
        } else {
            setActiveFilters(newFilters);
        }
    };

    const handlePress = (item) => {
        navigation.navigate('RecipeDetail', {
            recipeId: item.id,
            initialDate: targetDate,
            initialMealType: targetMealType
        });
    };

    const renderRecipeCard = ({ item }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => handlePress(item)}
        >
            <RecipeImage
                uri={item.image}
                style={styles.cardImage}
                defaultIcon="restaurant"
                iconSize={40}
            />
            <View style={styles.cardContent}>
                <View style={styles.cardTitleRow}>
                    <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                    {item.familyScore && (
                        <FamilyCompatibilityBadge familyScore={item.familyScore} compact />
                    )}
                </View>
                <View style={styles.cardMeta}>
                    <View style={styles.metaItem}>
                        <MaterialIcons name="timer" size={14} color={COLORS.primary} />
                        <Text style={styles.metaText}>{item.readyInMinutes || 30}p</Text>
                    </View>
                    <View style={styles.metaItem}>
                        <MaterialIcons name="local-fire-department" size={14} color={COLORS.primary} />
                        <Text style={styles.metaText}>{item.healthScore || 0}đ</Text>
                    </View>
                </View>
                {item.familyScore?.badge?.type === 'success' && !item.familyScore.fullyCompatible && (
                    <View style={styles.compatibilityDetails}>
                        <Text style={styles.compatibilityLabel}>Phù hợp: {item.familyScore.score}%</Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );

    const renderFridgeSuggestion = ({ item }) => (
        <TouchableOpacity
            style={styles.fridgeCard}
            onPress={() => handlePress(item)}
        >
            <RecipeImage
                uri={item.image}
                style={styles.fridgeCardImage}
                defaultIcon="kitchen"
                iconSize={32}
            />
            <View style={styles.fridgeCardOverlay}>
                <View style={styles.fridgeBadgeRow}>
                    <View style={styles.fridgeBadge}>
                        <MaterialIcons name="inventory" size={10} color={COLORS.white} />
                        <Text style={styles.fridgeBadgeText}>Từ tủ lạnh</Text>
                    </View>
                    {item.familyScore && (
                        <FamilyCompatibilityBadge familyScore={item.familyScore} compact />
                    )}
                </View>
                <Text style={styles.fridgeCardTitle} numberOfLines={1}>{item.title}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            {!embedded && (
                <View style={styles.header}>
                    <Text style={styles.greetText}>Khám phá món ngon</Text>
                    <Text style={styles.subGreetText}>Tìm kiếm cảm hứng cho bữa cơm gia đình</Text>

                    {!isFilterView && (
                        <>
                            <View style={styles.searchContainer}>
                                <MaterialIcons name="search" size={24} color={COLORS.textMuted} />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Tìm món Việt, nguyên liệu..."
                                    placeholderTextColor={COLORS.textMuted}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                />
                            </View>

                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={styles.typeFilterScroll}
                                contentContainerStyle={styles.typeFilterContent}
                            >
                                {DISH_TYPES.map(type => {
                                    const isActive = activeFilters.type === type.id || (!activeFilters.type && type.id === 'all');
                                    return (
                                        <TouchableOpacity
                                            key={type.id}
                                            style={[styles.typeChip, isActive && styles.typeChipActive]}
                                            onPress={() => {
                                                const newFilters = { ...activeFilters };
                                                if (type.id === 'all') {
                                                    delete newFilters.type;
                                                } else {
                                                    newFilters.type = type.id;
                                                }
                                                setActiveFilters(newFilters);
                                                setShowAllFromFridge(false); // Reset show all when filtering
                                            }}
                                        >
                                            <Text style={[styles.typeText, isActive && styles.typeTextActive]}>{type.name}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </>
                    )}
                </View>
            )}
            {embedded && !isFilterView && (
                <View style={{ backgroundColor: COLORS.backgroundCard, paddingBottom: SPACING.md }}>
                    <View style={[styles.searchContainer, { marginHorizontal: SPACING.xl, marginTop: SPACING.md, marginBottom: SPACING.sm }]}>
                        <MaterialIcons name="search" size={24} color={COLORS.textMuted} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Tìm món Việt để thêm..."
                            placeholderTextColor={COLORS.textMuted}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={[styles.typeFilterScroll, { paddingLeft: SPACING.xl }]}
                        contentContainerStyle={styles.typeFilterContent}
                    >
                        {DISH_TYPES.map(type => {
                            const isActive = activeFilters.type === type.id || (!activeFilters.type && type.id === 'all');
                            return (
                                <TouchableOpacity
                                    key={type.id}
                                    style={[styles.typeChip, isActive && styles.typeChipActive]}
                                    onPress={() => {
                                        const newFilters = { ...activeFilters };
                                        if (type.id === 'all') {
                                            delete newFilters.type;
                                        } else {
                                            newFilters.type = type.id;
                                        }
                                        setActiveFilters(newFilters);
                                        setShowAllFromFridge(false); // Reset show all when filtering
                                    }}
                                >
                                    <Text style={[styles.typeText, isActive && styles.typeTextActive]}>{type.name}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>
            )}

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
                    }
                >
                    {loading ? (
                        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
                    ) : (
                        <View style={styles.content}>
                            {isFilterView ? (
                                <View style={{ marginTop: SPACING.md }}>
                                    {/* Active Filter Chips */}
                                    <View style={styles.activeFiltersRow}>
                                        {Object.entries(activeFilters).map(([type, value]) => {
                                            if (type === 'useFridge') {
                                                if (value === false) return null; // Only show if "On"
                                                return (
                                                    <TouchableOpacity
                                                        key={type}
                                                        style={styles.activeFilterChip}
                                                        onPress={() => removeFilter(type)}
                                                    >
                                                        <Text style={styles.activeFilterText}>Có trong tủ lạnh</Text>
                                                        <MaterialIcons name="close" size={14} color={COLORS.primary} />
                                                    </TouchableOpacity>
                                                );
                                            }
                                            return (
                                                <TouchableOpacity
                                                    key={type}
                                                    style={styles.activeFilterChip}
                                                    onPress={() => removeFilter(type)}
                                                >
                                                    <Text style={styles.activeFilterText}>
                                                        {type === 'cuisine' ? 'Ẩm thực: ' : 'Loại: '}{value}
                                                    </Text>
                                                    <MaterialIcons name="close" size={14} color={COLORS.primary} />
                                                </TouchableOpacity>
                                            );
                                        })}
                                        <TouchableOpacity onPress={openFilter} style={styles.editFilterBtn}>
                                            <MaterialIcons name="edit" size={16} color={COLORS.textMuted} />
                                        </TouchableOpacity>
                                    </View>

                                    {/* Vietnamese Matches with Filter */}
                                    <View style={styles.section}>
                                        <View style={styles.sectionHeader}>
                                            <Text style={styles.sectionTitle}>Món ăn phù hợp</Text>
                                        </View>
                                        <FlatList
                                            data={vnFridgeRecipes}
                                            renderItem={renderRecipeCard}
                                            keyExtractor={item => item.id.toString()}
                                            numColumns={2}
                                            scrollEnabled={false}
                                            columnWrapperStyle={styles.columnWrapper}
                                            ListEmptyComponent={<Text style={styles.emptySearchText}>Không có món khớp bộ lọc</Text>}
                                        />
                                    </View>
                                </View>
                            ) : (
                                <>
                                    {/* 1. Show All From Fridge Mode */}
                                    {showAllFromFridge ? (
                                        <View style={styles.section}>
                                            <View style={styles.sectionHeader}>
                                                <Text style={styles.sectionTitle}>Tất cả món từ tủ lạnh</Text>
                                                <TouchableOpacity onPress={() => setShowAllFromFridge(false)}>
                                                    <Text style={styles.seeAll}>Quay lại</Text>
                                                </TouchableOpacity>
                                            </View>
                                            <FlatList
                                                data={vnFridgeRecipes}
                                                renderItem={renderRecipeCard}
                                                keyExtractor={item => item.id.toString()}
                                                numColumns={2}
                                                scrollEnabled={false}
                                                columnWrapperStyle={styles.columnWrapper}
                                                ListEmptyComponent={<Text style={styles.emptySearchText}>Không tìm thấy món phù hợp</Text>}
                                            />
                                        </View>
                                    ) : (
                                        <>
                                            {/* 1. Search Results - Only show if Query active in Discovery Mode */}
                                            {searchQuery.length > 0 && (
                                                <View style={styles.section}>
                                                    <View style={styles.sectionHeader}>
                                                        <Text style={styles.sectionTitle}>Kết quả tìm kiếm</Text>
                                                    </View>
                                                    <FlatList
                                                        data={recipes}
                                                        renderItem={renderRecipeCard}
                                                        keyExtractor={item => item.id.toString()}
                                                        numColumns={2}
                                                        scrollEnabled={false}
                                                        columnWrapperStyle={styles.columnWrapper}
                                                        ListEmptyComponent={(
                                                            <Text style={styles.emptySearchText}>Không tìm thấy món phù hợp</Text>
                                                        )}
                                                    />
                                                </View>
                                            )}

                                            {/* 2. Nấu ngay từ tủ lạnh (Vietnamese Local) */}
                                            {vnFridgeRecipes.length > 0 && searchQuery.length === 0 && (
                                                <View style={styles.section}>
                                                    <View style={styles.sectionHeader}>
                                                        <Text style={styles.sectionTitle}>
                                                            {activeFilters.type ? 'Từ tủ lạnh (Phù hợp)' : 'Nấu ngay từ tủ lạnh'}
                                                        </Text>
                                                        <TouchableOpacity onPress={() => setShowAllFromFridge(true)}>
                                                            <Text style={styles.seeAll}>Xem thêm</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                    <FlatList
                                                        data={vnFridgeRecipes}
                                                        renderItem={renderFridgeSuggestion}
                                                        keyExtractor={item => item.id.toString()}
                                                        horizontal
                                                        showsHorizontalScrollIndicator={false}
                                                        contentContainerStyle={styles.fridgeList}
                                                        ItemSeparatorComponent={() => <View style={{ width: SPACING.md }} />}
                                                    />
                                                </View>
                                            )}

                                            {/* 3. Món phổ biến / Filtered by Type (Discovery Mode) */}
                                            {searchQuery.length === 0 && recipes.length > 0 && (
                                                <View style={styles.section}>
                                                    <View style={styles.sectionHeader}>
                                                        <Text style={styles.sectionTitle}>
                                                            {activeFilters.type ? `Món ${activeFilters.type}` : 'Gợi ý hôm nay'}
                                                        </Text>
                                                    </View>
                                                    <FlatList
                                                        data={activeFilters.type ? recipes : recipes.slice(0, 10)}
                                                        renderItem={renderRecipeCard}
                                                        keyExtractor={item => item.id.toString()}
                                                        numColumns={2}
                                                        scrollEnabled={false}
                                                        columnWrapperStyle={styles.columnWrapper}
                                                    />
                                                </View>
                                            )}
                                        </>
                                    )}
                                </>
                            )}
                        </View>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>

        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        paddingHorizontal: SPACING.xl,
        paddingTop: SPACING.sm,
        backgroundColor: COLORS.backgroundCard,
        paddingBottom: SPACING.xl,
        borderBottomLeftRadius: RADIUS.xxl,
        borderBottomRightRadius: RADIUS.xxl,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 3,
    },
    greetText: {
        ...TYPOGRAPHY.heading1,
        color: COLORS.textPrimary,
    },
    subGreetText: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textSecondary,
        marginTop: SPACING.xs,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        borderRadius: RADIUS.lg,
        paddingHorizontal: SPACING.md,
        marginTop: SPACING.lg,
        height: 56,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    typeFilterScroll: {
        marginTop: SPACING.md,
    },
    typeFilterContent: {
        paddingRight: SPACING.xl,
        gap: SPACING.sm,
    },
    typeChip: {
        paddingHorizontal: SPACING.lg,
        paddingVertical: 8,
        borderRadius: RADIUS.pill,
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    typeChipActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    typeText: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.bold,
        color: COLORS.textSecondary,
    },
    typeTextActive: {
        color: COLORS.white,
    },
    searchInput: {
        flex: 1,
        marginLeft: SPACING.sm,
        ...TYPOGRAPHY.bodyLarge,
        color: COLORS.textPrimary,
    },
    filterBtn: {
        width: 40,
        height: 40,
        backgroundColor: COLORS.primary,
        borderRadius: RADIUS.md,
        justifyContent: 'center',
        alignItems: 'center',
    },
    categoryScroll: {
        paddingHorizontal: SPACING.xl,
        paddingTop: SPACING.lg,
        paddingBottom: SPACING.sm,
    },
    subCategoryContainer: {
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderLight,
        backgroundColor: COLORS.background,
    },
    subCategoryScroll: {
        paddingHorizontal: SPACING.xl,
        paddingBottom: SPACING.md,
    },
    subCategoryChip: {
        paddingHorizontal: SPACING.lg,
        paddingVertical: 6,
        borderRadius: RADIUS.pill,
        backgroundColor: COLORS.background,
        marginRight: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    subCategoryChipActive: {
        backgroundColor: COLORS.primaryMuted,
        borderColor: COLORS.primary,
    },
    subCategoryText: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.bold,
        color: COLORS.textMuted,
    },
    subCategoryTextActive: {
        color: COLORS.primary,
    },
    categoryChip: {
        paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.sm,
        borderRadius: RADIUS.lg,
        backgroundColor: COLORS.backgroundCard,
        marginRight: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    categoryChipActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    categoryText: {
        ...TYPOGRAPHY.bodyRegular,
        fontFamily: FONTS.bold,
        color: COLORS.textSecondary,
    },
    categoryTextActive: {
        color: COLORS.textOnPrimary,
    },
    content: {
        paddingHorizontal: SPACING.xl,
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
    sectionTitle: {
        ...TYPOGRAPHY.heading2,
        color: COLORS.textPrimary,
    },
    seeAll: {
        ...TYPOGRAPHY.bodyRegular,
        fontFamily: FONTS.bold,
        color: COLORS.primary,
    },
    fridgeList: {
        paddingBottom: SPACING.sm,
    },
    fridgeCard: {
        width: 200,
        height: 120,
        borderRadius: RADIUS.lg,
        overflow: 'hidden',
        backgroundColor: COLORS.backgroundCard,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    fridgeCardImage: {
        width: '100%',
        height: '100%',
    },
    fridgeCardOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: SPACING.sm,
        backgroundColor: 'rgba(74, 35, 17, 0.6)',
    },
    fridgeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: RADIUS.sm,
        alignSelf: 'flex-start',
        marginBottom: 4,
        gap: 4,
    },
    fridgeBadgeText: {
        ...TYPOGRAPHY.caption,
        fontSize: 10,
        color: COLORS.white,
        textTransform: 'uppercase',
    },
    fridgeCardTitle: {
        ...TYPOGRAPHY.bodyRegular,
        fontFamily: FONTS.bold,
        color: COLORS.white,
    },
    columnWrapper: {
        justifyContent: 'space-between',
        marginBottom: SPACING.md,
    },
    card: {
        width: (width - SPACING.xl * 2 - SPACING.md) / 2,
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.lg,
        overflow: 'hidden',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
    },
    cardImage: {
        width: '100%',
        height: 120,
    },
    cardContent: {
        padding: SPACING.sm,
    },
    cardTitle: {
        ...TYPOGRAPHY.bodyRegular,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
        height: 40,
    },
    cardMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: SPACING.sm,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
    },
    metaText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
    },
    activeFiltersRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
        marginBottom: SPACING.lg,
        alignItems: 'center',
    },
    activeFilterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primaryMuted,
        paddingHorizontal: SPACING.md,
        paddingVertical: 6,
        borderRadius: RADIUS.pill,
        borderWidth: 1,
        borderColor: COLORS.primary,
        gap: 6,
    },
    activeFilterText: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.bold,
        color: COLORS.primary,
        textTransform: 'capitalize',
    },
    editFilterBtn: {
        width: 32,
        height: 32,
        borderRadius: RADIUS.pill,
        backgroundColor: COLORS.backgroundCard,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.borderLight,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: COLORS.background,
        borderTopLeftRadius: RADIUS.xl,
        borderTopRightRadius: RADIUS.xl,
        height: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.lg,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderLight,
    },
    modalTitle: {
        ...TYPOGRAPHY.heading2,
        color: COLORS.textPrimary,
    },
    filterScroll: {
        padding: SPACING.lg,
    },
    aiFilterSection: {
        marginBottom: SPACING.xl,
        padding: SPACING.md,
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.primaryMuted,
    },
    aiHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    filterSectionTitle: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
    },
    aiInput: {
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: RADIUS.md,
        padding: SPACING.md,
        backgroundColor: COLORS.white,
        textAlignVertical: 'top',
        minHeight: 60,
    },
    emptySearchText: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textMuted,
        textAlign: 'center',
        marginTop: SPACING.xl,
        width: width - SPACING.xl * 2,
    },
    filterGroup: {
        marginBottom: SPACING.lg,
    },
    filterGroupTitle: {
        ...TYPOGRAPHY.heading3,
        color: COLORS.textPrimary,
        marginBottom: SPACING.md,
    },
    filterOptions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
    },
    filterChip: {
        paddingHorizontal: SPACING.md,
        paddingVertical: 8,
        borderRadius: RADIUS.pill,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.background,
    },
    filterChipActive: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.primaryMuted,
    },
    filterChipText: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.medium,
        color: COLORS.textSecondary,
    },
    filterChipTextActive: {
        color: COLORS.primary,
        fontFamily: FONTS.bold,
    },
    modalFooter: {
        flexDirection: 'row',
        padding: SPACING.lg,
        borderTopWidth: 1,
        borderTopColor: COLORS.borderLight,
        gap: SPACING.md,
    },
    resetBtn: {
        flex: 1,
        paddingVertical: 14,
        alignItems: 'center',
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    resetBtnText: {
        ...TYPOGRAPHY.bodyLarge,
        color: COLORS.textPrimary,
    },
    applyBtn: {
        flex: 1,
        paddingVertical: 14,
        alignItems: 'center',
        borderRadius: RADIUS.lg,
        backgroundColor: COLORS.primary,
    },
    applyBtnText: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: COLORS.white,
    },
    cardTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 4,
    },
    fridgeBadgeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        marginBottom: 4,
    },
    compatibilityDetails: {
        marginTop: 4,
    },
    compatibilityLabel: {
        ...TYPOGRAPHY.caption,
        color: '#059669',
        fontSize: 10,
        fontFamily: FONTS.medium,
    },
});

export default RecipesScreen;
