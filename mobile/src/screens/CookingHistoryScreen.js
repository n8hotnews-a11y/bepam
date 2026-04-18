import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import { cookingService } from '../services/cookingService';
import { supabase } from '../services/supabaseConfig';
import RecipeImage from '../components/RecipeImage';

const CookingHistoryScreen = ({ navigation }) => {
    const [history, setHistory] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                setRefreshing(false);
                return;
            }

            // Parallel fetch
            const [historyRes, statsRes] = await Promise.all([
                cookingService.getCookingHistory(user.id, { limit: 20 }),
                cookingService.getCookingStats(user.id)
            ]);

            if (historyRes.success) {
                setHistory(historyRes.history);
            }
            if (statsRes.success) {
                setStats(statsRes.stats);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const renderHeader = () => {
        if (!stats) return null;

        return (
            <View style={styles.statsContainer}>
                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <View style={[styles.iconCircle, { backgroundColor: '#DBEAFE' }]}>
                            <MaterialIcons name="restaurant-menu" size={24} color="#2563EB" />
                        </View>
                        <Text style={styles.statVal}>{stats.totalMealsCooked || 0}</Text>
                        <Text style={styles.statLabel}>Món đã nấu</Text>
                    </View>
                    <View style={styles.statCard}>
                        <View style={[styles.iconCircle, { backgroundColor: '#D1FAE5' }]}>
                            <MaterialIcons name="date-range" size={24} color="#059669" />
                        </View>
                        <Text style={styles.statVal}>{stats.mealsThisWeek || 0}</Text>
                        <Text style={styles.statLabel}>Tuần này</Text>
                    </View>
                </View>

                {stats.topIngredients && stats.topIngredients.length > 0 && (
                    <View style={styles.topIngContainer}>
                        <Text style={styles.sectionTitle}>Nguyên liệu hay dùng</Text>
                        <View style={styles.tagContainer}>
                            {stats.topIngredients.slice(0, 5).map((ing, idx) => (
                                <View key={idx} style={styles.tag}>
                                    <Text style={styles.tagText}>{ing.name} ({ing.count})</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}
            </View>
        );
    };

    const renderItem = ({ item }) => {
        const date = new Date(item.cooked_at);
        const formattedDate = date.toLocaleDateString('vi-VN');
        const formattedTime = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

        return (
            <View style={styles.historyCard}>
                <RecipeImage
                    uri={item.recipe_image}
                    style={styles.cardPreview}
                    defaultIcon="restaurant-menu"
                    iconSize={24}
                />
                <View style={styles.cardHeader}>
                    <View style={styles.dateBadge}>
                        <Text style={styles.dateText}>{formattedDate}</Text>
                        <Text style={styles.timeText}>{formattedTime}</Text>
                    </View>
                </View>
                <View style={styles.cardContent}>
                    <Text style={styles.recipeTitle}>{item.recipe_title}</Text>
                    {item.notes ? (
                        <Text style={styles.notes} numberOfLines={2}>Note: {item.notes}</Text>
                    ) : null}
                    {item.ingredients_used && item.ingredients_used.length > 0 && (
                        <Text style={styles.ingredientsUsed} numberOfLines={1}>
                            Dùng: {item.ingredients_used.map(i => i.name).join(', ')}
                        </Text>
                    )}
                </View>
                {/* Re-cook button logic could be added here later */}
                <TouchableOpacity
                    style={styles.recookBtn}
                    onPress={() => {
                        // Navigate to detail if we have recipe_id, or search
                        if (item.recipe_id && !item.recipe_id.startsWith('cust')) {
                            navigation.navigate('RecipeDetail', { 
                                recipeId: item.recipe_id,
                                recipeTitle: item.recipe_title,
                                recipeImage: item.recipe_image
                            });
                        }
                    }}
                >
                    <MaterialIcons name="chevron-right" size={24} color={COLORS.textMuted} />
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialIcons name="arrow-back" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Lịch sử nấu nướng</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : (
                <FlatList
                    data={history}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    ListHeaderComponent={renderHeader}
                    contentContainerStyle={styles.listContainer}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <MaterialIcons name="soup-kitchen" size={64} color={COLORS.border} />
                            <Text style={styles.emptyText}>Chưa có lịch sử nấu nướng</Text>
                            <Text style={styles.emptySubText}>
                                Khi bạn hoàn thành một món ăn, lịch sử sẽ xuất hiện ở đây.
                            </Text>
                        </View>
                    }
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
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderLight,
    },
    headerTitle: {
        ...TYPOGRAPHY.heading2,
        color: COLORS.textPrimary,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContainer: {
        padding: SPACING.md,
        paddingBottom: SPACING.xl,
    },
    statsContainer: {
        marginBottom: SPACING.lg,
    },
    statsRow: {
        flexDirection: 'row',
        gap: SPACING.md,
        marginBottom: SPACING.lg,
    },
    statCard: {
        flex: 1,
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.lg,
        padding: SPACING.lg,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.borderLight,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    iconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    statVal: {
        ...TYPOGRAPHY.heading1,
        color: COLORS.textPrimary,
    },
    statLabel: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
    },
    topIngContainer: {
        marginTop: SPACING.sm,
    },
    sectionTitle: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
        marginBottom: SPACING.sm,
    },
    tagContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
    },
    tag: {
        backgroundColor: COLORS.backgroundCard, // Or primaryMuted
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: RADIUS.pill,
        paddingHorizontal: SPACING.md,
        paddingVertical: 6,
    },
    tagText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textPrimary,
    },
    historyCard: {
        flexDirection: 'row',
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.md,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
        padding: SPACING.md,
        alignItems: 'center',
    },
    cardPreview: {
        width: 50,
        height: 50,
        borderRadius: RADIUS.sm,
        marginRight: SPACING.md,
    },
    cardHeader: {
        marginRight: SPACING.md,
    },
    dateBadge: {
        backgroundColor: COLORS.background,
        borderRadius: RADIUS.sm,
        padding: SPACING.sm,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.borderLight,
        minWidth: 70,
    },
    dateText: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
    },
    timeText: {
        fontSize: 10,
        color: COLORS.textMuted,
    },
    cardContent: {
        flex: 1,
    },
    recipeTitle: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
        marginBottom: 2,
    },
    notes: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
        fontStyle: 'italic',
    },
    ingredientsUsed: {
        fontSize: 10,
        color: COLORS.textMuted,
        marginTop: 2,
    },
    recookBtn: {
        padding: SPACING.xs,
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 40,
        paddingHorizontal: SPACING.xl,
    },
    emptyText: {
        ...TYPOGRAPHY.heading3,
        color: COLORS.textSecondary,
        marginTop: SPACING.lg,
    },
    emptySubText: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textMuted,
        textAlign: 'center',
        marginTop: SPACING.sm,
    },
});

export default CookingHistoryScreen;
