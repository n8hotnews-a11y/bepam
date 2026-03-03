import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import { authService } from '../services/authService';
import { supabase } from '../services/supabaseConfig';
import { subscriptionService } from '../services/subscriptionService'; // Import
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native'; // Use FocusEffect to refresh when going back

const ProfileScreen = ({ navigation }) => {
    const [user, setUser] = useState(null);
    const [subscription, setSubscription] = useState(null);

    useFocusEffect(
        React.useCallback(() => {
            const fetchData = async () => {
                const { data: { user } } = await supabase.auth.getUser();
                setUser(user);
                if (user) {
                    const subStatus = await subscriptionService.getSubscriptionStatus(user.id);
                    setSubscription(subStatus);
                }
            };
            fetchData();
        }, [])
    );

    const handleLogout = async () => {
        Alert.alert(
            "Đăng xuất",
            "Bạn có chắc chắn muốn đăng xuất khỏi Bếp Ấm?",
            [
                { text: "Hủy", style: "cancel" },
                {
                    text: "Đăng xuất",
                    style: "destructive",
                    onPress: async () => {
                        await authService.logout();
                    }
                }
            ]
        );
    };

    const MenuItem = ({ icon, title, color = COLORS.textPrimary, onPress, badge }) => (
        <TouchableOpacity style={styles.menuItem} onPress={onPress}>
            <View style={[styles.menuIconCircle, { backgroundColor: color === COLORS.danger ? 'rgba(231, 76, 60, 0.1)' : COLORS.primaryMuted }]}>
                <MaterialIcons name={icon} size={22} color={color === COLORS.danger ? COLORS.danger : COLORS.primary} />
            </View>
            <Text style={[styles.menuText, { color: color }]}>{title}</Text>
            {badge && (
                <View style={styles.menuBadge}>
                    <Text style={styles.menuBadgeText}>{badge}</Text>
                </View>
            )}
            <MaterialIcons name="chevron-right" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <View style={styles.avatarWrapper}>
                        <View style={[styles.avatarContainer, subscription?.is_premium && styles.avatarPremium]}>
                            <MaterialIcons name="person" size={60} color={subscription?.is_premium ? '#B45309' : COLORS.primary} />
                        </View>
                        {subscription?.is_premium && (
                            <View style={styles.premiumBadge}>
                                <MaterialIcons name="verified" size={16} color={COLORS.white} />
                            </View>
                        )}
                        <TouchableOpacity style={styles.editAvatarBtn}>
                            <MaterialIcons name="camera-alt" size={18} color={COLORS.white} />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.userName}>{user?.email?.split('@')[0] || 'Người dùng'}</Text>
                    <Text style={styles.userEmail}>{user?.email}</Text>

                    {subscription?.is_premium ? (
                        <View style={styles.planBadge}>
                            <Text style={styles.planText}>Bếp Ấm +</Text>
                        </View>
                    ) : (
                        <TouchableOpacity onPress={() => navigation.navigate('Subscription')} style={styles.upgradeBanner}>
                            <MaterialIcons name="auto-awesome" size={20} color={COLORS.white} />
                            <Text style={styles.upgradeText}>Nâng cấp Premium</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* ... existing stats row ... */}
                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={styles.statVal}>12</Text>
                        <Text style={styles.statLabel}>Món đã nấu</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statVal}>45</Text>
                        <Text style={styles.statLabel}>Công thức lưu</Text>
                    </View>
                </View>

                <View style={styles.menuSection}>
                    {!subscription?.is_premium && (
                        <View style={{ marginBottom: 20 }}>
                            <MenuItem
                                icon="star"
                                title="Nâng cấp gói thành viên"
                                color="#D97706"
                                onPress={() => navigation.navigate('Subscription')}
                                badge="HOT"
                            />
                        </View>
                    )}

                    <Text style={styles.sectionTitle}>Tài khoản</Text>
                    <MenuItem icon="person-outline" title="Thông tin cá nhân" onPress={() => navigation.navigate('UserInfo')} />
                    <MenuItem icon="family-restroom" title="Gia đình của tôi" onPress={() => navigation.navigate('Family')} badge="MỚI" />
                    <MenuItem icon="groups" title="Thành viên & Chế độ ăn" onPress={() => navigation.navigate('FamilyMembers')} />

                    {/* ... existing items ... */}
                    <MenuItem icon="favorite-border" title="Món ăn yêu thích" onPress={() => navigation.navigate('FavoriteRecipes')} />
                    <MenuItem icon="history" title="Lịch sử nấu nướng" onPress={() => navigation.navigate('CookingHistory')} />

                    <Text style={styles.sectionTitle}>Ứng dụng</Text>
                    <MenuItem icon="settings" title="Cài đặt" onPress={() => navigation.navigate('NotificationSettings')} />
                    <MenuItem icon="help-outline" title="Hỗ trợ & Góp ý" onPress={() => navigation.navigate('Support')} />
                    <MenuItem icon="logout" title="Đăng xuất" color={COLORS.danger} onPress={handleLogout} />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    // ... existing styles ...
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 20,
    },
    header: {
        alignItems: 'center',
        paddingVertical: SPACING.xl,
        backgroundColor: COLORS.backgroundCard,
        borderBottomLeftRadius: RADIUS.xxl,
        borderBottomRightRadius: RADIUS.xxl,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 4,
    },
    avatarWrapper: {
        position: 'relative',
        marginBottom: SPACING.md,
    },
    avatarContainer: {
        width: 110,
        height: 110,
        borderRadius: 55,
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: COLORS.primaryMuted,
    },
    avatarPremium: {
        borderColor: '#F59E0B',
        backgroundColor: '#FFFBEB',
    },
    premiumBadge: {
        position: 'absolute',
        top: 0,
        right: 10,
        backgroundColor: '#F59E0B',
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: COLORS.white,
        zIndex: 2,
    },
    editAvatarBtn: {
        position: 'absolute',
        right: 0,
        bottom: 0,
        backgroundColor: COLORS.primary,
        width: 34,
        height: 34,
        borderRadius: 17,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: COLORS.backgroundCard,
    },
    userName: {
        ...TYPOGRAPHY.heading1,
        color: COLORS.textPrimary,
    },
    userEmail: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textSecondary,
        marginTop: SPACING.xs,
    },
    upgradeBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#D97706',
        paddingHorizontal: SPACING.lg,
        paddingVertical: 8,
        borderRadius: RADIUS.pill,
        marginTop: SPACING.md,
        gap: SPACING.xs,
        shadowColor: '#D97706',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    upgradeText: {
        ...TYPOGRAPHY.bodyRegular,
        fontFamily: FONTS.bold,
        color: COLORS.white,
    },
    planBadge: {
        backgroundColor: '#ECFDF5',
        paddingHorizontal: SPACING.lg,
        paddingVertical: 4,
        borderRadius: RADIUS.pill,
        marginTop: SPACING.md,
        borderWidth: 1,
        borderColor: '#10B981',
    },
    planText: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.bold,
        color: '#047857',
    },
    statsRow: {
        flexDirection: 'row',
        backgroundColor: COLORS.backgroundCard,
        marginHorizontal: SPACING.xl,
        marginTop: -24,
        borderRadius: RADIUS.xl,
        paddingVertical: SPACING.lg,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statVal: {
        ...TYPOGRAPHY.heading2,
        color: COLORS.primary,
    },
    statLabel: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    statDivider: {
        width: 1,
        height: '60%',
        backgroundColor: COLORS.borderLight,
        alignSelf: 'center',
    },
    menuSection: {
        marginTop: SPACING.lg,
        paddingHorizontal: SPACING.xl,
    },
    sectionTitle: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.bold,
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        marginBottom: SPACING.sm,
        marginLeft: SPACING.sm,
        letterSpacing: 1,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.lg,
        marginBottom: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
    },
    menuIconCircle: {
        width: 40,
        height: 40,
        borderRadius: RADIUS.md,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.md,
    },
    menuText: {
        flex: 1,
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
    },
    menuBadge: {
        backgroundColor: '#EF4444',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginRight: 8,
    },
    menuBadgeText: {
        fontSize: 10,
        color: COLORS.white,
        fontFamily: FONTS.bold,
    }
});

export default ProfileScreen;
