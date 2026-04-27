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
    Alert,
    Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import { recipeService } from '../services/recipeService';
import { subscriptionService } from '../services/subscriptionService';
import { supabase } from '../services/supabaseConfig';
import { familyRecipeMatcherService } from '../services/familyRecipeMatcherService';
import FamilyCompatibilityBadge from '../components/FamilyCompatibilityBadge';
import RecipeImage from '../components/RecipeImage';

const CookingLoadingVisual = () => {
    const bounceAnim = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(bounceAnim, {
                    toValue: -20,
                    duration: 400,
                    useNativeDriver: true,
                }),
                Animated.timing(bounceAnim, {
                    toValue: 0,
                    duration: 500,
                    useNativeDriver: true,
                })
            ])
        ).start();
    }, [bounceAnim]);

    return (
        <View style={styles.loadingContainer}>
            <Animated.View style={{ transform: [{ translateY: bounceAnim }] }}>
                <Text style={{ fontSize: 70 }}>👨‍🍳🍳</Text>
            </Animated.View>
            <Text style={styles.loadingTitle}>Bếp trưởng AI đang nêm nếm...</Text>
            <Text style={styles.loadingSub}>Đang lựa chọn những món tuyệt vời nhất cho bạn</Text>
        </View>
    );
};

const AIIngredientScreen = ({ navigation, route }) => {
    const { initialPrompt } = route.params || {};
    const [prompt, setPrompt] = useState(initialPrompt || '');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState([]);

    React.useEffect(() => {
        if (initialPrompt) {
            handleSearch(initialPrompt);
        }
    }, [initialPrompt]);

    const getStrictAIPrompt = (ingredient) => `Bạn là một chuyên gia ẩm thực chuyên lên thực đơn cho các gia đình Việt Nam.
Nhiệm vụ của bạn là gợi ý các món ăn ngon, thiết thực và bắt buộc phải sử dụng nguyên liệu đầu vào.

NGUYÊN LIỆU CHÍNH: "${ingredient}"

RÀNG BUỘC TỐI THƯỢNG:
1. Bạn TUYỆT ĐỐI KHÔNG được gợi ý bất kỳ món ăn nào không có chứa nguyên liệu "${ingredient}".
2. Nguyên liệu "${ingredient}" phải đóng vai trò là thành phần chính hoặc linh hồn của món ăn, không phải gia vị trang trí.
3. Các món ăn phải thực tế, dễ nấu và phù hợp với khẩu vị bữa cơm gia đình Việt Nam.

ĐỊNH DẠNG ĐẦU RA BẮT BUỘC (JSON):
Trình bày danh sách các món ăn trong 1 đối tượng JSON duy nhất có dạng { "recipes": [ ... ] }.
Với mỗi món ăn, hãy trình bày theo cấu trúc JSON sau:
- "title": Tên món ăn
- "reason": Giải thích ngắn gọn 1 câu về cách "${ingredient}" làm nên hương vị món ăn. Tại sao món này phù hợp.
- "ingredients": Mảng các chuỗi, bắt buộc liệt kê "${ingredient}" đầu tiên.
- "instructions": Chuỗi mô tả các bước nấu, trong đó chỉ rõ bước chế biến "${ingredient}".
- "image_search": Từ khóa tiếng Anh ngắn gọn để tìm ảnh thực tế của món ăn.`;

    const handleSearch = async (overridePrompt = null) => {
        const query = (typeof overridePrompt === 'string' ? overridePrompt : prompt);
        if (!query || !query.trim()) return;

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const user_id = user?.id;

            const activeCustomPrompt = getStrictAIPrompt(query);

            const result = await recipeService.suggestRecipesGenAI(query, 'AI Ingredient', user_id, activeCustomPrompt);
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
                {item.reason ? (
                    <Text style={styles.cardReason} numberOfLines={2}>{item.reason}</Text>
                ) : null}
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
                <Text style={styles.headerTitle}>Gợi ý từ Nguyên liệu</Text>
                <View style={{ width: 40 }} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <View style={styles.searchSection}>
                    <View style={styles.inputWrapper}>
                        <MaterialIcons name="kitchen" size={24} color={COLORS.primary} />
                        <TextInput
                            style={styles.input}
                            placeholder="Nhập tên nguyên liệu (VD: Thịt gà, hành tây...)"
                            placeholderTextColor={COLORS.textMuted}
                            value={prompt}
                            onChangeText={setPrompt}
                            multiline
                            scrollEnabled={true}
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
                                <MaterialIcons name="restaurant-menu" size={20} color={COLORS.white} />
                                <Text style={styles.searchBtnText}>Tìm món ăn</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <CookingLoadingVisual />
                ) : results.length > 0 ? (
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
                        <MaterialIcons name="restaurant-menu" size={64} color={COLORS.primaryMuted} />
                        <Text style={styles.emptyText}>Tìm món theo nguyên liệu</Text>
                        <Text style={styles.emptySubText}>
                            Hãy nhập các nguyên liệu bạn đang có để Bếp Trưởng chuẩn bị một bữa ăn tuyệt vời nhé!
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
        maxHeight: 160,
    },
    input: {
        flex: 1,
        marginLeft: SPACING.sm,
        ...TYPOGRAPHY.bodyLarge,
        color: COLORS.textPrimary,
        paddingTop: 0,
        minHeight: 40,
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
    cardReason: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
        fontStyle: 'italic',
        marginTop: 4,
        marginBottom: 2,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.xl,
    },
    loadingTitle: {
        ...TYPOGRAPHY.heading3,
        color: COLORS.textPrimary,
        marginTop: SPACING.xl,
    },
    loadingSub: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textMuted,
        marginTop: SPACING.sm,
        textAlign: 'center',
    },
});

export default AIIngredientScreen;
