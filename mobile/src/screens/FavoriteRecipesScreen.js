import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import { favoriteService } from '../services/favoriteService';
import { supabase } from '../services/supabaseConfig';
import { recipeService } from '../services/recipeService';
import RecipeImage from '../components/RecipeImage';

const FavoriteRecipesScreen = ({ navigation }) => {
    const [favorites, setFavorites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchFavorites();
    }, []);

    const fetchFavorites = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                setRefreshing(false);
                return;
            }

            const result = await favoriteService.getFavorites(user.id);
            if (result.success) {
                setFavorites(result.data);
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
        fetchFavorites();
    };

    const handleRemoveFavorite = async (recipeId, recipeTitle) => {
        Alert.alert(
            "Xóa yêu thích",
            `Bạn có chắc muốn xóa "${recipeTitle}" khỏi danh sách yêu thích?`,
            [
                { text: "Hủy", style: "cancel" },
                {
                    text: "Xóa",
                    style: "destructive",
                    onPress: async () => {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (user) {
                            await favoriteService.removeFavorite(user.id, recipeId);
                            // Optimistic update
                            setFavorites(prev => prev.filter(item => item.recipe_id !== recipeId));
                        }
                    }
                }
            ]
        );
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('RecipeDetail', {
                recipeId: item.recipe_id,
                recipeTitle: item.recipe_title,
                recipeImage: item.recipe_image
            })}
        >
            <RecipeImage uri={item.recipe_image} style={styles.cardImage} defaultIcon="favorite" iconSize={32} />
            <View style={styles.cardContent}>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.recipe_title}</Text>
                <View style={styles.cardActions}>
                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleRemoveFavorite(item.recipe_id, item.recipe_title)}
                    >
                        <MaterialIcons name="favorite" size={24} color={COLORS.error} />
                    </TouchableOpacity>
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialIcons name="arrow-back" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Món ăn yêu thích</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : (
                <FlatList
                    data={favorites}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContainer}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <MaterialIcons name="favorite-border" size={64} color={COLORS.border} />
                            <Text style={styles.emptyText}>Chưa có món ăn yêu thích nào</Text>
                            <Text style={styles.emptySubText}>
                                Hãy thả tim các món ăn ngon để lưu vào đây nhé!
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
    },
    card: {
        flexDirection: 'row',
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.md,
        marginBottom: SPACING.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: COLORS.borderLight,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    cardImage: {
        width: 100,
        height: 100,
    },
    cardContent: {
        flex: 1,
        padding: SPACING.md,
        justifyContent: 'space-between',
    },
    cardTitle: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
    },
    cardActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    actionBtn: {
        padding: 4,
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 60,
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

export default FavoriteRecipesScreen;
