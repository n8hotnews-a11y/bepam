import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Switch,
    Platform,
    ActivityIndicator,
    Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import { notificationService } from '../services/notificationService';
import { recipeService } from '../services/recipeService';
import { showSuccessToast } from '../components/Toast';

const NotificationSettingsScreen = ({ navigation }) => {
    // State for toggles and times
    const [settings, setSettings] = useState({
        // Cảnh báo thực phẩm
        expiringSoon: true,
        expired: true,
        refrigeratorEmpty: false,

        // Lên kế hoạch bữa ăn
        breakfastRemind: true,
        lunchRemind: true,
        dinnerRemind: true,
        breakfastTime: new Date(new Date().setHours(7, 0, 0, 0)),
        lunchTime: new Date(new Date().setHours(11, 30, 0, 0)),
        dinnerTime: new Date(new Date().setHours(18, 0, 0, 0)),
    });

    const [loading, setLoading] = useState(true);
    const [activePicker, setActivePicker] = useState(null); // 'breakfast', 'lunch', 'dinner'

    // Load settings on mount
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const savedSettings = await notificationService.getSettings();
                if (savedSettings) {
                    setSettings(savedSettings);
                }
            } catch (error) {
                console.error('Failed to load settings:', error);
            } finally {
                setLoading(false);
            }
        };

        loadSettings();
    }, []);

    const toggleSwitch = async (key) => {
        const newSettings = { ...settings, [key]: !settings[key] };
        setSettings(newSettings);
        await notificationService.saveSettings(newSettings);
        
        // Setup meal reminders when any meal-related setting changes
        if (['breakfastRemind', 'lunchRemind', 'dinnerRemind', 'breakfastTime', 'lunchTime', 'dinnerTime'].includes(key)) {
            await notificationService.setupMealReminders(newSettings);
        }
    };

    const handleTimeChange = async (event, selectedDate) => {
        const key = activePicker === 'breakfast' ? 'breakfastTime' :
            activePicker === 'lunch' ? 'lunchTime' : 'dinnerTime';

        // Hide picker for Android, keep for iOS internal management
        if (Platform.OS === 'android') {
            setActivePicker(null);
        }

        if (selectedDate) {
            const newSettings = { ...settings, [key]: selectedDate };
            setSettings(newSettings);
            await notificationService.saveSettings(newSettings);
            
            // Update meal reminders when time changes
            await notificationService.setupMealReminders(newSettings);
        }
    };

    const formatTime = (date) => {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
    };

    const handleClearCache = async () => {
        Alert.alert(
            "Xóa bộ nhớ đệm AI",
            "Tất cả công thức món ăn AI đã lưu sẽ bị xóa. Bạn sẽ cần kết nối mạng để tải lại chúng lần sau. Bạn có chắc chắn?",
            [
                { text: "Hủy", style: "cancel" },
                {
                    text: "Xóa sạch",
                    style: "destructive",
                    onPress: async () => {
                        const result = await recipeService.clearAICache();
                        if (result.success) {
                            showSuccessToast('Đã xóa bộ nhớ đệm thành công');
                        } else {
                            Alert.alert('Lỗi', 'Không thể xóa bộ nhớ đệm');
                        }
                    }
                }
            ]
        );
    };

    const SettingGroup = ({ title, children, headerRight }) => (
        <View style={styles.groupContainer}>
            <View style={styles.groupHeader}>
                <Text style={styles.groupTitle}>{title}</Text>
                {headerRight}
            </View>
            <View style={styles.card}>
                {children}
            </View>
        </View>
    );

    const SettingItem = ({ icon, title, subtitle, value, onToggle, showDivider = true, rightElement }) => (
        <View style={styles.itemWrapper}>
            <View style={styles.itemContainer}>
                <View style={styles.iconBackground}>
                    <MaterialIcons name={icon} size={22} color={COLORS.primary} />
                </View>
                <View style={styles.textContainer}>
                    <Text style={styles.itemTitle}>{title}</Text>
                    {subtitle && <Text style={styles.itemSubtitle}>{subtitle}</Text>}
                    {rightElement && <View style={styles.customRightElement}>{rightElement}</View>}
                </View>
                <Switch
                    trackColor={{ false: COLORS.grayLight, true: COLORS.primaryMuted }}
                    thumbColor={value ? COLORS.primary : '#f4f3f4'}
                    ios_backgroundColor={COLORS.grayLight}
                    onValueChange={onToggle}
                    value={value}
                />
            </View>
            {showDivider && <View style={styles.divider} />}
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <MaterialIcons name="chevron-left" size={32} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Cài đặt thông báo</Text>
                <View style={styles.placeholder} />
            </View>
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.loadingText}>Đang tải cài đặt...</Text>
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                    {/* 1. Cảnh báo thực phẩm */}
                    <SettingGroup title="CẢNH BÁO THỰC PHẨM">
                        <SettingItem
                            icon="alarm"
                            title="Sắp hết hạn"
                            subtitle="Nhắc nhở đồ sắp hỏng trước 1-3 ngày"
                            value={settings.expiringSoon}
                            onToggle={() => toggleSwitch('expiringSoon')}
                        />
                        <SettingItem
                            icon="warning"
                            title="Đã hết hạn"
                            subtitle="Thông báo ngay khi thực phẩm hết hạn"
                            value={settings.expired}
                            onToggle={() => toggleSwitch('expired')}
                        />
                        <SettingItem
                            icon="kitchen"
                            title="Nhắc nhở tủ lạnh trống"
                            subtitle="Khi kho đồ cần được lấp đầy"
                            value={settings.refrigeratorEmpty}
                            onToggle={() => toggleSwitch('refrigeratorEmpty')}
                            showDivider={false}
                        />
                    </SettingGroup>

                    {/* 2. Lên kế hoạch bữa ăn */}
                    <SettingGroup
                        title="LÊN KẾ HOẠCH BỮA ĂN"
                        headerRight={<Text style={styles.aiHint}>Gợi ý bởi AI</Text>}
                    >
                        <SettingItem
                            icon="light-mode"
                            title="Bữa Sáng"
                            value={settings.breakfastRemind}
                            onToggle={() => toggleSwitch('breakfastRemind')}
                            rightElement={
                                <TouchableOpacity
                                    style={styles.timeTag}
                                    onPress={() => setActivePicker('breakfast')}
                                >
                                    <Text style={styles.timeText}>Nhắc lúc: {formatTime(settings.breakfastTime)}</Text>
                                    <MaterialIcons name="edit" size={12} color={COLORS.textSecondary} style={{ marginLeft: 4 }} />
                                </TouchableOpacity>
                            }
                        />
                        <SettingItem
                            icon="wb-sunny"
                            title="Bữa Trưa"
                            value={settings.lunchRemind}
                            onToggle={() => toggleSwitch('lunchRemind')}
                            rightElement={
                                <TouchableOpacity
                                    style={styles.timeTag}
                                    onPress={() => setActivePicker('lunch')}
                                >
                                    <Text style={styles.timeText}>Nhắc lúc: {formatTime(settings.lunchTime)}</Text>
                                    <MaterialIcons name="edit" size={12} color={COLORS.textSecondary} style={{ marginLeft: 4 }} />
                                </TouchableOpacity>
                            }
                        />
                        <SettingItem
                            icon="nightlight"
                            title="Bữa Tối"
                            value={settings.dinnerRemind}
                            onToggle={() => toggleSwitch('dinnerRemind')}
                            showDivider={false}
                            rightElement={
                                <TouchableOpacity
                                    style={styles.timeTag}
                                    onPress={() => setActivePicker('dinner')}
                                >
                                    <Text style={styles.timeText}>Nhắc lúc: {formatTime(settings.dinnerTime)}</Text>
                                    <MaterialIcons name="edit" size={12} color={COLORS.textSecondary} style={{ marginLeft: 4 }} />
                                </TouchableOpacity>
                            }
                        />
                    </SettingGroup>


                    {/* 5. Dữ liệu & Bộ nhớ */}
                    <SettingGroup title="DỮ LIỆU & BỘ NHỚ">
                        <View style={styles.cacheContainer}>
                            <View style={styles.cacheInfo}>
                                <Text style={styles.cacheTitle}>Bộ nhớ đệm AI</Text>
                                <Text style={styles.cacheHelpText}>
                                    Ứng dụng lưu trữ các món ăn do AI gợi ý trong 30 ngày để bạn có thể xem lại nhanh chóng ngay cả khi không có mạng và tiết kiệm lượt dùng AI.
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={styles.clearCacheBtn}
                                onPress={handleClearCache}
                            >
                                <MaterialIcons name="delete-sweep" size={20} color={COLORS.danger} />
                                <Text style={styles.clearCacheText}>Xóa bộ nhớ</Text>
                            </TouchableOpacity>
                        </View>
                    </SettingGroup>

                    <View style={styles.footerSpace} />
                </ScrollView>
            )}

            {/* Time Pickers */}
            {activePicker && (
                <View style={Platform.OS === 'ios' ? styles.iosPickerContainer : null}>
                    {Platform.OS === 'ios' && (
                        <View style={styles.iosPickerHeader}>
                            <TouchableOpacity onPress={() => setActivePicker(null)}>
                                <Text style={styles.iosPickerDone}>Xong</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    <DateTimePicker
                        value={activePicker === 'breakfast' ? settings.breakfastTime :
                            activePicker === 'lunch' ? settings.lunchTime : settings.dinnerTime}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={handleTimeChange}
                    />
                </View>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background, // Nền kem đầm ấm
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        ...TYPOGRAPHY.bodyMedium,
        color: COLORS.textSecondary,
        marginTop: SPACING.md,
        fontFamily: FONTS.medium,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        ...TYPOGRAPHY.heading2,
        color: COLORS.textPrimary,
        fontFamily: FONTS.bold,
    },
    placeholder: {
        width: 40,
    },
    scrollContent: {
        paddingHorizontal: SPACING.xl,
        paddingBottom: SPACING.xxl,
    },
    groupContainer: {
        marginTop: SPACING.lg,
    },
    groupHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingRight: SPACING.sm,
        marginBottom: SPACING.sm,
    },
    groupTitle: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.bold,
        color: COLORS.textMuted,
        marginLeft: SPACING.sm,
        letterSpacing: 1,
    },
    card: {
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.xl,
        paddingVertical: SPACING.sm,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    itemWrapper: {
        paddingHorizontal: SPACING.md,
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.md,
    },
    iconBackground: {
        width: 44,
        height: 44,
        borderRadius: RADIUS.md,
        backgroundColor: COLORS.primaryMuted,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.md,
    },
    textContainer: {
        flex: 1,
    },
    itemTitle: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
    },
    itemSubtitle: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.borderLight,
        marginLeft: 60,
    },
    aiHint: {
        ...TYPOGRAPHY.caption,
        color: COLORS.primary,
        fontFamily: FONTS.bold,
    },
    timeTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.borderLight,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 6,
        borderRadius: RADIUS.sm,
        marginTop: 4,
        alignSelf: 'flex-start',
    },
    timeText: {
        fontSize: 12,
        color: COLORS.textSecondary,
        fontFamily: FONTS.bold,
    },
    customRightElement: {
        marginTop: 2,
    },
    footerSpace: {
        height: 40,
    },
    iosPickerContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: COLORS.white,
        paddingBottom: 20,
        borderTopWidth: 1,
        borderTopColor: COLORS.borderLight,
    },
    iosPickerHeader: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderLight,
    },
    iosPickerDone: {
        ...TYPOGRAPHY.bodyLarge,
        color: COLORS.primary,
        fontFamily: FONTS.bold,
    },
    cacheContainer: {
        padding: SPACING.md,
    },
    cacheInfo: {
        marginBottom: SPACING.md,
    },
    cacheTitle: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
        marginBottom: 4,
    },
    cacheHelpText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
        lineHeight: 18,
    },
    clearCacheBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.danger,
        gap: 8,
    },
    clearCacheText: {
        ...TYPOGRAPHY.bodyMedium,
        color: COLORS.danger,
        fontFamily: FONTS.bold,
    }
});

export default NotificationSettingsScreen;

