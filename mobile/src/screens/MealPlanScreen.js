import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import { mealPlanService } from '../services/mealPlanService';
import { supabase } from '../services/supabaseConfig';
import { showSuccessToast } from '../components/Toast';
import RecipesScreen from './RecipesScreen';
import ExplorationView from '../components/ExplorationView';
import RecipeImage from '../components/RecipeImage';

const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

const getWeekDays = () => {
    const dates = [];
    const today = new Date();
    // Start from today
    for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        dates.push({
            date: d,
            dayName: DAYS[d.getDay()],
            dateString: d.toISOString().split('T')[0],
            dayNum: d.getDate()
        });
    }
    return dates;
};

const MEAL_TYPES = [
    { id: 'breakfast', name: 'Bữa Sáng', icon: 'wb-twilight' },
    { id: 'lunch', name: 'Bữa Trưa', icon: 'wb-sunny' },
    { id: 'dinner', name: 'Bữa Tối', icon: 'nights-stay' }
];

const EMPTY_OBJ = {};


const MealPlanScreen = ({ navigation, route }) => {
    const [activeTab, setActiveTab] = useState('schedule'); // 'schedule' or 'recipes'

    // Check if we have filters from route
    const activeFilters = route.params?.activeFilters || {};

    // Auto-switch to recipes tab if we have filters or search intent
    useEffect(() => {
        if (route.params?.activeFilters) {
            setActiveTab('recipes');
        }
    }, [route.params?.activeFilters]);
    const [weekDates, setWeekDates] = useState(getWeekDays());
    const [selectedDate, setSelectedDate] = useState(weekDates[0].dateString);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [plans, setPlans] = useState([]);

    // State for adding item
    const [targetSlot, setTargetSlot] = useState(null); // { date, mealType }

    const fetchPlans = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        const user_id = user?.id;
        if (!user_id) return;

        setLoading(true);
        const result = await mealPlanService.getPlan(user_id);
        if (result.success) {
            setPlans(result.data);
        }
        setLoading(false);
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchPlans();
            return () => { }; // Cleanup if needed
        }, [fetchPlans])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchPlans().then(() => setRefreshing(false));
    };

    const handleRemove = async (id) => {
        Alert.alert(
            "Xoá món",
            "Bạn có chắc muốn xoá món này khỏi thực đơn?",
            [
                { text: "Huỷ", style: "cancel" },
                {
                    text: "Xoá", onPress: async () => {
                        const result = await mealPlanService.removeFromPlan(id);
                        if (result.success) {
                            setPlans(plans.filter(p => p.id !== id));
                            showSuccessToast("Đã xoá món ăn");
                        }
                    }
                }
            ]
        );
    };

    // Auto-switch to recipes tab or results tab
    useEffect(() => {
        if (route.params?.activeFilters && Object.keys(route.params.activeFilters).length > 0) {
            setActiveTab('results');
        } else if (route.params?.activeFilters === null) {
            setActiveTab('recipes');
        }
    }, [route.params?.activeFilters]);

    const onRecipeSelect = async (item) => {
        if (!targetSlot) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Pass full item as recipeData to preserve instruction and other fields in mealplans table
        const result = await mealPlanService.addToPlan(
            user.id,
            item.id,
            item.title,
            item.image,
            targetSlot.date,
            targetSlot.mealType,
            item 
        );

        if (result.success) {
            showSuccessToast(`Đã thêm ${item.title} vào ${targetSlot.mealType === 'breakfast' ? 'bữa sáng' : targetSlot.mealType === 'lunch' ? 'bữa trưa' : 'bữa tối'}`);
            fetchPlans();
            setActiveTab('schedule');
            setTargetSlot(null);
        } else {
            Alert.alert("Lỗi", "Không thể thêm món ăn vào thực đơn");
        }
    };

    const handleAddDish = (mealType) => {
        setTargetSlot({ date: selectedDate, mealType });
        setActiveTab('recipes');
    };

    const handleMarkAsCooked = (item) => {
        navigation.navigate('CookingComplete', {
            planId: item.id,
            recipeId: item.recipe_id || item.recipeId,
            recipeTitle: item.recipe_title || item.recipeTitle,
            recipeImage: item.recipe_image || item.recipeImage,
            initialRecipeData: item.recipe_data // Use data already in the plan object
        });
    };

    const renderMealSection = (mealType) => {
        // Fallback: If mealType is missing in DB (due to retry logic), default it to 'lunch'
        const meals = plans.filter(p =>
            p.date === selectedDate &&
            (p.mealType === mealType.id || (!p.mealType && mealType.id === 'lunch'))
        );

        return (
            <View style={styles.mealSection} key={mealType.id}>
                <View style={styles.mealHeader}>
                    <View style={styles.mealTitleRow}>
                        <MaterialIcons name={mealType.icon} size={20} color={COLORS.primary} />
                        <Text style={styles.mealTitle}>{mealType.name}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleAddDish(mealType.id)}>
                        <Text style={styles.addText}>+ Thêm món</Text>
                    </TouchableOpacity>
                </View>

                {meals.length > 0 ? (
                    meals.map(item => {
                        const isCooked = item.status === 'cooked';
                        return (
                            <View
                                key={item.id}
                                style={[
                                    styles.mealCard,
                                    isCooked && styles.mealCardCooked
                                ]}
                            >
                                <RecipeImage
                                    uri={item.recipe_image || item.recipeImage}
                                    style={[
                                        styles.mealImage,
                                        isCooked && styles.mealImageCooked
                                    ]}
                                    defaultIcon={mealType.icon}
                                    iconSize={24}
                                />
                                <View style={styles.mealInfo}>
                                    <Text
                                        style={[
                                            styles.mealName,
                                            isCooked && styles.mealNameCooked
                                        ]}
                                        numberOfLines={2}
                                    >
                                        {item.recipe_title || item.recipeTitle}
                                    </Text>
                                    {isCooked && (
                                        <View style={styles.cookedBadge}>
                                            <MaterialIcons name="check-circle" size={12} color={COLORS.success} />
                                            <Text style={styles.cookedBadgeText}>Đã nấu</Text>
                                        </View>
                                    )}
                                </View>
                                <View style={styles.mealActions}>
                                    {!isCooked && (
                                        <TouchableOpacity
                                            onPress={() => handleMarkAsCooked(item)}
                                            style={styles.cookBtn}
                                        >
                                            <MaterialIcons name="restaurant" size={18} color={COLORS.primary} />
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity onPress={() => handleRemove(item.id)} style={styles.removeBtn}>
                                        <MaterialIcons name="close" size={18} color={COLORS.textSecondary} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })
                ) : (
                    <TouchableOpacity
                        style={styles.emptySlot}
                        onPress={() => handleAddDish(mealType.id)}
                    >
                        <Text style={styles.emptySlotText}>Chưa có món nào</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };


    return (
        <SafeAreaView style={styles.container}>
            {/* Header Tabs */}
            <View style={styles.tabHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                        style={[styles.tabBtn, activeTab === 'schedule' && styles.tabBtnActive]}
                        onPress={() => setActiveTab('schedule')}
                    >
                        <Text style={[styles.tabText, activeTab === 'schedule' && styles.tabTextActive]}>Lịch ăn</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabBtn, activeTab === 'recipes' && styles.tabBtnActive]}
                        onPress={() => setActiveTab('recipes')}
                    >
                        <Text style={[styles.tabText, activeTab === 'recipes' && styles.tabTextActive]}>Khám phá</Text>
                    </TouchableOpacity>
                    {Object.keys(activeFilters).length > 0 && (
                        <TouchableOpacity
                            style={[styles.tabBtn, activeTab === 'results' && styles.tabBtnActive]}
                            onPress={() => setActiveTab('results')}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <MaterialIcons name="filter-list" size={16} color={activeTab === 'results' ? COLORS.primary : COLORS.textMuted} />
                                <Text style={[styles.tabText, activeTab === 'results' && styles.tabTextActive]}>Kết quả lọc</Text>
                            </View>
                        </TouchableOpacity>
                    )}
                </View>

                {/* AI Plan Button */}
                <TouchableOpacity
                    style={styles.aiPlanBtn}
                    onPress={() => navigation.navigate('AIAuto')}
                >
                    <MaterialIcons name="auto-awesome" size={20} color={COLORS.primary} />
                    <Text style={styles.aiPlanText}>AI Auto</Text>
                </TouchableOpacity>
            </View>

            {activeTab === 'schedule' ? (
                <View style={{ flex: 1 }}>
                    {/* Week Strip */}
                    <View style={styles.weekStrip}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SPACING.md }}>
                            {weekDates.map((item) => (
                                <TouchableOpacity
                                    key={item.dateString}
                                    style={[styles.dayItem, selectedDate === item.dateString && styles.dayItemActive]}
                                    onPress={() => setSelectedDate(item.dateString)}
                                >
                                    <Text style={[styles.dayName, selectedDate === item.dateString && styles.dayNameActive]}>{item.dayName}</Text>
                                    <View style={[styles.dayNumParams, selectedDate === item.dateString && styles.dayNumActive]}>
                                        <Text style={[styles.dayNum, selectedDate === item.dateString && styles.textWhite]}>{item.dayNum}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    <ScrollView
                        style={styles.scheduleContent}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    >
                        {MEAL_TYPES.map(type => renderMealSection(type))}
                        <View style={{ height: 100 }} />
                    </ScrollView>
                </View>
            ) : activeTab === 'recipes' ? (
                <ExplorationView 
                    navigation={navigation} 
                    selectedDate={selectedDate}
                    existingPlans={plans.filter(p => p.date === selectedDate)}
                    onPlanUpdated={fetchPlans}
                />
            ) : (
                <RecipesScreen
                    navigation={navigation}
                    embedded={true}
                    targetDate={targetSlot?.date}
                    targetMealType={targetSlot?.mealType}
                    externalFilters={activeFilters}
                    isFilterView={true}
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
    tabHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between', // Changed for AI button
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
        paddingTop: SPACING.sm,
        paddingBottom: SPACING.md,
        backgroundColor: COLORS.backgroundCard,
    },
    aiPlanBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFBEB',
        paddingHorizontal: SPACING.md,
        paddingVertical: 6,
        borderRadius: RADIUS.pill,
        borderWidth: 1,
        borderColor: '#F59E0B',
        gap: 4,
    },
    aiPlanText: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.bold,
        color: '#B45309',
    },
    tabBtn: {
        marginRight: SPACING.lg,
        paddingBottom: SPACING.xs,
    },
    tabBtnActive: {
        borderBottomWidth: 2,
        borderBottomColor: COLORS.primary,
    },
    tabText: {
        ...TYPOGRAPHY.heading2,
        color: COLORS.textSecondary,
    },
    tabTextActive: {
        color: COLORS.primary,
    },
    weekStrip: {
        paddingVertical: SPACING.md,
        backgroundColor: COLORS.backgroundCard,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderLight,
    },
    dayItem: {
        alignItems: 'center',
        marginHorizontal: SPACING.xs,
        width: 50,
    },
    dayName: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.bold,
        color: COLORS.textSecondary,
        marginBottom: SPACING.xs,
    },
    dayNameActive: {
        color: COLORS.primary,
    },
    dayNumParams: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
    },
    dayNumActive: {
        backgroundColor: COLORS.primary,
    },
    dayNum: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
    },
    textWhite: {
        color: COLORS.white,
    },
    scheduleContent: {
        flex: 1,
        padding: SPACING.md,
    },
    mealSection: {
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.lg,
        padding: SPACING.md,
        marginBottom: SPACING.lg,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    mealHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    mealTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    mealTitle: {
        ...TYPOGRAPHY.heading3,
        color: COLORS.textPrimary,
    },
    addText: {
        ...TYPOGRAPHY.bodyRegular,
        fontFamily: FONTS.bold,
        color: COLORS.primary,
    },
    mealCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderLight,
    },
    mealImage: {
        width: 48,
        height: 48,
        borderRadius: RADIUS.sm,
        marginRight: SPACING.md,
    },
    mealInfo: {
        flex: 1,
    },
    mealName: {
        ...TYPOGRAPHY.bodyRegular,
        fontFamily: FONTS.medium,
        color: COLORS.textPrimary,
    },
    removeBtn: {
        padding: SPACING.xs,
    },
    emptySlot: {
        paddingVertical: SPACING.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        borderStyle: 'dashed',
        borderRadius: RADIUS.md,
    },
    emptySlotText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
    },
    mealCardCooked: {
        opacity: 0.7,
        backgroundColor: COLORS.background,
    },
    mealImageCooked: {
        opacity: 0.6,
    },
    mealNameCooked: {
        textDecorationLine: 'line-through',
        color: COLORS.textSecondary,
    },
    cookedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    cookedBadgeText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.success,
        fontSize: 11,
    },
    mealActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
    },
    cookBtn: {
        padding: SPACING.xs,
        backgroundColor: COLORS.primaryMuted,
        borderRadius: RADIUS.sm,
    },
});

export default MealPlanScreen;
