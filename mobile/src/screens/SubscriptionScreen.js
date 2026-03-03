import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
    Image,
    Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import { subscriptionService, SUBSCRIPTION_PACKAGES } from '../services/subscriptionService';
import { supabase } from '../services/supabaseConfig';
import { showSuccessToast } from '../components/Toast';

const { width } = Dimensions.get('window');

const SubscriptionScreen = ({ navigation }) => {
    const [loading, setLoading] = useState(false);
    const [currentSubscription, setCurrentSubscription] = useState(null);
    const [selectedPackage, setSelectedPackage] = useState(SUBSCRIPTION_PACKAGES[1].id); // Default yearly

    useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const status = await subscriptionService.getSubscriptionStatus(user.id);
            setCurrentSubscription(status);
        }
    };

    const handlePurchase = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            Alert.alert("Yêu cầu đăng nhập", "Vui lòng đăng nhập để đăng ký gói thành viên.");
            return;
        }

        setLoading(true);
        // Simulate network delay for realistic feel
        setTimeout(async () => {
            const result = await subscriptionService.purchaseSubscription(user.id, selectedPackage);
            setLoading(false);

            if (result.success) {
                Alert.alert("Thành công", "Chào mừng bạn đến với Bếp Ấm +! Tận hưởng các tính năng cao cấp ngay hôm nay.", [
                    {
                        text: "Tuyệt vời", onPress: () => {
                            checkStatus();
                            navigation.goBack();
                        }
                    }
                ]);
            } else {
                Alert.alert("Lỗi", "Thanh toán thất bại. Vui lòng thử lại.");
            }
        }, 1500);
    };

    const BenefitItem = ({ text, isPremium = true }) => (
        <View style={styles.benefitItem}>
            <View style={[styles.checkCircle, isPremium ? styles.premiumCheck : styles.freeCheck]}>
                <MaterialIcons name="check" size={16} color={COLORS.white} />
            </View>
            <Text style={styles.benefitText}>{text}</Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
                        <MaterialIcons name="close" size={24} color={COLORS.textPrimary} />
                    </TouchableOpacity>
                    <Image
                        source={{ uri: 'https://via.placeholder.com/150x150.png?text=Premium' }}
                        style={styles.heroImage}
                    />
                    <Text style={styles.title}>Nâng cấp <Text style={{ color: COLORS.primary }}>Bếp Ấm +</Text></Text>
                    <Text style={styles.subtitle}>Mở khóa sức mạnh AI cho căn bếp của bạn</Text>
                </View>

                {/* Features Comparison */}
                <View style={styles.featuresContainer}>
                    <Text style={styles.sectionTitle}>Quyền lợi thành viên</Text>

                    <View style={styles.card}>
                        <BenefitItem text="Gợi ý món ăn thông minh từ tủ lạnh (AI)" />
                        <BenefitItem text="Chat không giới hạn với Đầu bếp AI" />
                        <BenefitItem text="Lên thực đơn tự động cho cả tuần" />
                        <BenefitItem text="Truy cập kho 5000+ món Âu/Mỹ" />
                        <BenefitItem text="Không quảng cáo làm phiền" />
                    </View>
                </View>

                {/* Packages */}
                <View style={styles.packagesContainer}>
                    <Text style={styles.sectionTitle}>Chọn gói phù hợp</Text>

                    {SUBSCRIPTION_PACKAGES.map(pkg => {
                        const isSelected = selectedPackage === pkg.id;
                        return (
                            <TouchableOpacity
                                key={pkg.id}
                                style={[styles.packageCard, isSelected && styles.packageCardActive]}
                                onPress={() => setSelectedPackage(pkg.id)}
                            >
                                <View style={styles.packageHeader}>
                                    <View>
                                        <Text style={[styles.packageName, isSelected && styles.textActive]}>{pkg.name}</Text>
                                        <Text style={styles.packageDesc}>{pkg.description}</Text>
                                    </View>
                                    <View style={styles.radioButton}>
                                        {isSelected && <View style={styles.radioInner} />}
                                    </View>
                                </View>
                                <Text style={[styles.packagePrice, isSelected && styles.textActive]}>
                                    {pkg.price.toLocaleString('vi-VN')}đ <Text style={styles.duration}>/ {pkg.durationMonth === 1 ? 'tháng' : 'năm'}</Text>
                                </Text>
                                {pkg.id === 'yearly' && (
                                    <View style={styles.saveBadge}>
                                        <Text style={styles.saveText}>Tiết kiệm 17%</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <View style={styles.footerInfo}>
                    <Text style={styles.disclaimer}>
                        Thanh toán sẽ được tính vào tài khoản của bạn. Gói đăng ký sẽ tự động gia hạn trừ khi hủy ít nhất 24 giờ trước khi kết thúc kỳ hạn hiện tại.
                    </Text>
                </View>
            </ScrollView>

            {/* Bottom Button */}
            <View style={styles.bottomBar}>
                {currentSubscription?.is_premium ? (
                    <View style={styles.activePlanContainer}>
                        <MaterialIcons name="verified" size={24} color={COLORS.success} />
                        <Text style={styles.activePlanText}>Bạn đang sử dụng gói Premium</Text>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={styles.payBtn}
                        onPress={handlePurchase}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={COLORS.textOnPrimary} />
                        ) : (
                            <Text style={styles.payBtnText}>Đăng ký ngay</Text>
                        )}
                    </TouchableOpacity>
                )}
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
        alignItems: 'center',
        padding: SPACING.xl,
    },
    closeBtn: {
        position: 'absolute',
        top: SPACING.md,
        left: SPACING.md,
        padding: SPACING.sm,
        zIndex: 1,
    },
    heroImage: {
        width: 120,
        height: 120,
        marginBottom: SPACING.lg,
    },
    title: {
        ...TYPOGRAPHY.heading1,
        fontSize: 28,
        color: COLORS.textPrimary,
        marginBottom: SPACING.xs,
    },
    subtitle: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textSecondary,
        textAlign: 'center',
    },
    featuresContainer: {
        paddingHorizontal: SPACING.xl,
        marginBottom: SPACING.xl,
    },
    sectionTitle: {
        ...TYPOGRAPHY.heading3,
        color: COLORS.textPrimary,
        marginBottom: SPACING.md,
    },
    card: {
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.lg,
        padding: SPACING.lg,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
        gap: SPACING.md,
    },
    benefitItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
    },
    checkCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    premiumCheck: {
        backgroundColor: COLORS.primary,
    },
    freeCheck: {
        backgroundColor: COLORS.textMuted,
    },
    benefitText: {
        ...TYPOGRAPHY.bodyLarge,
        color: COLORS.textPrimary,
        flex: 1,
    },
    packagesContainer: {
        paddingHorizontal: SPACING.xl,
        marginBottom: SPACING.xl,
        gap: SPACING.md,
    },
    packageCard: {
        backgroundColor: COLORS.background,
        borderWidth: 2,
        borderColor: COLORS.border,
        borderRadius: RADIUS.lg,
        padding: SPACING.lg,
        flexDirection: 'column',
    },
    packageCardActive: {
        borderColor: COLORS.primary,
        backgroundColor: '#FFF8F6', // Light primary tint
    },
    packageHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: SPACING.sm,
    },
    packageName: {
        ...TYPOGRAPHY.heading3,
        color: COLORS.textPrimary,
    },
    packageDesc: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
        marginTop: 4,
    },
    packagePrice: {
        ...TYPOGRAPHY.heading2,
        color: COLORS.textPrimary,
    },
    duration: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textSecondary,
        fontWeight: 'normal',
    },
    textActive: {
        color: COLORS.primary,
    },
    radioButton: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: COLORS.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: COLORS.primary,
    },
    saveBadge: {
        position: 'absolute',
        top: -10,
        right: 16,
        backgroundColor: '#D97706',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: RADIUS.sm,
    },
    saveText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.white,
        fontFamily: FONTS.bold,
        fontSize: 10,
    },
    footerInfo: {
        paddingHorizontal: SPACING.xl,
    },
    disclaimer: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
        textAlign: 'center',
        fontSize: 11,
    },
    bottomBar: {
        padding: SPACING.xl,
        borderTopWidth: 1,
        borderTopColor: COLORS.borderLight,
        backgroundColor: COLORS.background,
    },
    payBtn: {
        backgroundColor: COLORS.primary,
        paddingVertical: 16,
        borderRadius: RADIUS.lg,
        alignItems: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    payBtnText: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: COLORS.textOnPrimary,
        fontSize: 18,
    },
    activePlanContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.sm,
        paddingVertical: 10,
        backgroundColor: '#ECFDF5',
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: '#10B981',
    },
    activePlanText: {
        color: '#047857',
        fontFamily: FONTS.bold,
    }
});

export default SubscriptionScreen;
