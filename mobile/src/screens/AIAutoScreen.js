import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    FlatList,
    Image,
    Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import { recipeService } from '../services/recipeService';
import { subscriptionService } from '../services/subscriptionService';
import { supabase } from '../services/supabaseConfig';
import { familyRecipeMatcherService } from '../services/familyRecipeMatcherService';
import FamilyCompatibilityBadge from '../components/FamilyCompatibilityBadge';

const AIAutoScreen = ({ navigation }) => {
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [isPremium, setIsPremium] = useState(false);

    React.useEffect(() => {
        checkPremium();
    }, []);

    const checkPremium = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const status = await subscriptionService.getSubscriptionStatus(user.id);
            setIsPremium(status.isPremium || status.is_premium);
        }
    };

    const handleSearch = async () => {
        if (!prompt.trim()) return;

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const user_id = user?.id;

            const result = await recipeService.suggestRecipesGenAI(prompt, 'AI Search', user_id);
            if (result.success) {
                let aiRecipes = result.recipes;

                // Enrich with Family Compatibility if not already done by recipeService
                if (user_id) {
                    const enrichment = await familyRecipeMatcherService.enrichRecipesWithFamilyInfo(aiRecipes, user_id);
                    if (enrichment.success) {
                        aiRecipes = enrichment.recipes;
                    }
                }

                setResults(aiRecipes);
            } else {
                Alert.alert("Lỗi", result.error || "Không thể tìm kiếm lúc này.");
            }
        } catch (error) {
            console.error("AI Search Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const renderRecipeCard = ({ item }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('RecipeDetail', {
                recipeId: item.id,
                initialRecipeData: item
            })}
        >
            <Image
                source={{ uri: item.image || 'https://via.placeholder.com/300x200?text=Com+Nha' }}
                style={styles.cardImage}
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
                        <Text style={styles.metaText}>Healthy</Text>
                    </View>
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
                <Text style={styles.headerTitle}>AI Auto Search</Text>
                <View style={{ width: 40 }} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <View style={styles.searchSection}>
                    <View style={styles.inputWrapper}>
                        <MaterialIcons name="auto-awesome" size={24} color={COLORS.primary} />
                        <TextInput
                            style={styles.input}
                            placeholder="Món gì cho người ăn kiêng? Món nhậu đơn giản?..."
                            value={prompt}
                            onChangeText={setPrompt}
                            multiline
                        />
                    </View>
                    <TouchableOpacity
                        style={[styles.searchBtn, !prompt.trim() && styles.searchBtnDisabled]}
                        onPress={handleSearch}
                        disabled={loading || !prompt.trim()}
                    >
                        {loading ? (
                            <ActivityIndicator color={COLORS.white} />
                        ) : (
                            <>
                                <MaterialIcons name="send" size={20} color={COLORS.white} />
                                <Text style={styles.searchBtnText}>Tìm với AI</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {results.length > 0 ? (
                    <FlatList
                        data={results}
                        renderItem={renderRecipeCard}
                        keyExtractor={(item, index) => index.toString()}
                        contentContainerStyle={styles.listContent}
                        numColumns={2}
                        columnWrapperStyle={styles.columnWrapper}
                    />
                ) : (
                    <View style={styles.emptyState}>
                        <MaterialIcons name="psychology" size={64} color={COLORS.primaryMuted} />
                        <Text style={styles.emptyText}>Hỏi Bếp Trưởng bất cứ điều gì!</Text>
                        <Text style={styles.emptySubText}>
                            Ví dụ: "Gợi ý bữa tối lãng phí ít ỏi cho 2 người" hoặc "Món ăn dặm từ cà rốt"
                        </Text>
                    </View>
                )}
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
        backgroundColor: COLORS.backgroundCard,
    },
    headerTitle: {
        ...TYPOGRAPHY.heading2,
        color: COLORS.textPrimary,
    },
    backBtn: {
        padding: SPACING.xs,
    },
    searchSection: {
        padding: SPACING.lg,
        backgroundColor: COLORS.backgroundCard,
        borderBottomLeftRadius: RADIUS.xl,
        borderBottomRightRadius: RADIUS.xl,
        gap: SPACING.md,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: COLORS.background,
        borderRadius: RADIUS.lg,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.primaryMuted,
        minHeight: 80,
    },
    input: {
        flex: 1,
        marginLeft: SPACING.sm,
        ...TYPOGRAPHY.bodyLarge,
        color: COLORS.textPrimary,
        paddingTop: 0,
    },
    searchBtn: {
        backgroundColor: COLORS.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: RADIUS.lg,
        gap: 8,
    },
    searchBtnDisabled: {
        backgroundColor: COLORS.grayLight,
    },
    searchBtnText: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: COLORS.white,
    },
    listContent: {
        padding: SPACING.lg,
    },
    columnWrapper: {
        justifyContent: 'space-between',
        marginBottom: SPACING.md,
    },
    card: {
        width: '48%',
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.lg,
        overflow: 'hidden',
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
        gap: 4,
    },
    metaText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.xl,
    },
    emptyText: {
        ...TYPOGRAPHY.heading3,
        color: COLORS.textPrimary,
        marginTop: SPACING.md,
    },
    emptySubText: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textMuted,
        textAlign: 'center',
        marginTop: SPACING.sm,
    },
    cardTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 4,
    },
});

export default AIAutoScreen;
