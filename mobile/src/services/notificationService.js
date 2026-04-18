/* eslint-disable global-require */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { notificationReadService } from './notificationReadService';
import { inventoryService } from './inventoryService';

const NOTIFICATION_SETTINGS_KEY = '@ComNha_NotificationSettings';

// Helper to check for Expo Go
// Constants.executionEnvironment can be 'expo-go', 'standalone', or 'store-client'
const isExpoGo = Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'store-client';
const isAndroidExpoGo = Platform.OS === 'android' && isExpoGo;

// Lazy load expo-notifications to avoid initialization crashes
let Notifications = null;
try {
    Notifications = require('expo-notifications');
} catch (error) {
    console.warn('Failed to load expo-notifications module. Notifications will be disabled.', error);
}

// Configure notification handler safely
const configureNotifications = () => {
    if (!Notifications) return;

    // Skip handler setup completely on Android Expo Go to avoid native module crashes
    if (isAndroidExpoGo) {
        console.log('Skipping Notification Handler on Android Expo Go to prevent crashes.');
        return;
    }

    try {
        Notifications.setNotificationHandler({
            handleNotification: async () => ({
                shouldShowAlert: true,
                shouldPlaySound: true,
                shouldSetBadge: true,
            }),
        });
    } catch (error) {
        console.warn('Failed to set notification handler:', error);
    }
};

// Execute configuration immediately if safe
configureNotifications();

export const notificationService = {
    /**
     * Initialize notifications
     */
    async initialize() {
        if (!Notifications) {
            console.log('Notifications module not loaded, skipping initialization.');
            return;
        }
        try {
            await this.registerForPushNotificationsAsync();
        } catch (error) {
            console.warn('Failed to initialize notifications:', error);
        }
    },

    /**
     * Register for push notifications permission
     */
    async registerForPushNotificationsAsync() {
        if (!Notifications) return;

        // STRICT CHECK: Skip on Android Expo Go
        if (isAndroidExpoGo) {
            console.log('Android Expo Go detected: Skipping notification registration.');
            return;
        }

        try {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                console.log('Failed to get notification permissions!');
                return;
            }

            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('default', {
                    name: 'default',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#FF231F7C',
                });
            }
        } catch (error) {
            console.warn('Error registering notifications:', error);
        }
    },

    /**
     * Get notification settings from storage
     */
    async getSettings() {
        try {
            const jsonValue = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
            if (jsonValue != null) {
                const settings = JSON.parse(jsonValue);
                if (settings.breakfastTime) settings.breakfastTime = new Date(settings.breakfastTime);
                if (settings.lunchTime) settings.lunchTime = new Date(settings.lunchTime);
                if (settings.dinnerTime) settings.dinnerTime = new Date(settings.dinnerTime);
                return settings;
            }
            return {
                expiringSoon: true,
                expired: true,
                refrigeratorEmpty: false,
                breakfastRemind: true,
                lunchRemind: true,
                dinnerRemind: true,
                breakfastTime: new Date(new Date().setHours(7, 0, 0, 0)),
                lunchTime: new Date(new Date().setHours(11, 30, 0, 0)),
                dinnerTime: new Date(new Date().setHours(18, 0, 0, 0)),
            };
        } catch (error) {
            console.error('Error loading notification settings:', error);
            return null;
        }
    },

    /**
     * Save notification settings to storage
     */
    async saveSettings(settings) {
        try {
            const jsonValue = JSON.stringify(settings);
            await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, jsonValue);
            return true;
        } catch (error) {
            console.error('Error saving settings:', error);
            return false;
        }
    },

    /**
     * Schedule a notification for an expiring item
     */
    async scheduleExpiryNotification(item, daysRemaining) {
        if (!Notifications) return;
        // Skip scheduling on Android Expo Go for safety
        if (isAndroidExpoGo) return;

        try {
            const settings = await this.getSettings();
            if (!settings) return;

            // Check if user has already read this notification
            const isRead = await notificationReadService.isRead(item.id);
            if (isRead) {
                console.log(`Skipping notification for ${item.item_name} - already marked as read`);
                return;
            }

            if (daysRemaining < 0 && !settings.expired) return;
            if (daysRemaining >= 0 && daysRemaining <= 3 && !settings.expiringSoon) return;

            let title = '';
            let body = '';

            if (daysRemaining < 0) {
                title = '⚠️ Thực phẩm hết hạn!';
                body = `${item.item_name} đã hết hạn ${Math.abs(daysRemaining)} ngày. Hãy kiểm tra lại!`;
            } else if (daysRemaining === 0) {
                title = '⏰ Hết hạn hôm nay!';
                body = `${item.item_name} sẽ hết hạn vào hôm nay. Hãy dùng ngay!`;
            } else {
                title = '⏳ Sắp hết hạn';
                body = `${item.item_name} còn ${daysRemaining} ngày nữa là hết hạn.`;
            }

            await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    data: { itemId: item.id, screen: 'ExpiredItems' },
                },
                trigger: null, // Send immediately for now as a demo
            });
        } catch (error) {
            console.warn('Failed to schedule notification:', error);
        }
    },

    /**
     * Schedule a cooking suggestion based on favorites
     */
    async scheduleCookingSuggestion(userId) {
        if (!Notifications || isAndroidExpoGo) return false;

        try {
            const { favoriteService } = require('./favoriteService'); // Lazy load to avoid cycle
            const suggestion = await favoriteService.suggestFavoriteToCook(userId);

            if (suggestion) {
                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: '👨‍🍳 Gợi ý hôm nay',
                        body: `Bạn có muốn nấu món "${suggestion.recipe_title}" không? Nhấn để xem công thức ngay!`,
                        data: { recipeId: suggestion.recipe_id, screen: 'RecipeDetail' },
                    },
                    trigger: { seconds: 2 }, // Delay slightly to simulate "thinking" or schedule properly
                });
                return true;
            }
            return false;
        } catch (error) {
            console.error("Cooking Suggestion Error:", error);
            return false;
        }
    },

    /**
     * Cancel all scheduled notifications
     */
    async cancelAllScheduledNotifications() {
        if (!Notifications || isAndroidExpoGo) return;

        try {
            const scheduled = await Notifications.getAllScheduledNotificationsAsync();
            for (const notification of scheduled) {
                await Notifications.cancelScheduledNotificationAsync(notification.identifier);
            }
            console.log('[NotificationService] All scheduled notifications cancelled');
        } catch (error) {
            console.warn('Failed to cancel scheduled notifications:', error);
        }
    },

    /**
     * Schedule a daily meal reminder at a specific time
     */
    async scheduleMealReminder(type, time, enabled) {
        if (!Notifications || isAndroidExpoGo) return;

        try {
            // Cancel existing notification for this meal type
            await Notifications.cancelScheduledNotificationAsync(`meal_${type}`);

            if (!enabled) {
                console.log(`[NotificationService] ${type} reminder disabled`);
                return;
            }

            const hour = time.getHours();
            const minute = time.getMinutes();

            const titles = {
                breakfast: '🌅 Bữa sáng',
                lunch: '☀️ Bữa trưa',
                dinner: '🌙 Bữa tối'
            };

            const bodies = {
                breakfast: 'Sáng nay bạn muốn ăn gì? Hãy lên thực đơn cho gia đình nhé!',
                lunch: 'Trưa nay nấu gì đây? Khám phá các công thức mới nào!',
                dinner: 'Tối nay gia đình ăn gì? Để Bếp Trưởng AI gợi ý cho bạn!'
            };

            await Notifications.scheduleNotificationAsync({
                content: {
                    title: titles[type] || '🍽️ Nhắc nhở bữa ăn',
                    body: bodies[type] || 'Đã đến giờ lên kế hoạch bữa ăn cho gia đình!',
                    data: { screen: 'Home' },
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DAILY,
                    hour,
                    minute,
                },
                identifier: `meal_${type}`,
            });

            console.log(`[NotificationService] ${type} reminder scheduled at ${hour}:${minute}`);
        } catch (error) {
            console.warn(`Failed to schedule ${type} reminder:`, error);
        }
    },

    /**
     * Setup all meal reminders based on settings
     */
    async setupMealReminders(settings) {
        if (!settings) return;

        try {
            // Cancel all first to avoid duplicates
            await this.cancelAllScheduledNotifications();

            // Schedule each meal if enabled
            if (settings.breakfastTime) {
                await this.scheduleMealReminder('breakfast', settings.breakfastTime, settings.breakfastRemind);
            }
            if (settings.lunchTime) {
                await this.scheduleMealReminder('lunch', settings.lunchTime, settings.lunchRemind);
            }
            if (settings.dinnerTime) {
                await this.scheduleMealReminder('dinner', settings.dinnerTime, settings.dinnerRemind);
            }

            console.log('[NotificationService] All meal reminders configured');
        } catch (error) {
            console.warn('Failed to setup meal reminders:', error);
        }
    },

    /**
     * Send immediate notification for empty fridge
     */
    async notifyEmptyFridge() {
        if (!Notifications || isAndroidExpoGo) return;

        try {
            const settings = await this.getSettings();
            if (!settings || !settings.refrigeratorEmpty) return;

            await Notifications.scheduleNotificationAsync({
                content: {
                    title: '🛒 Tủ lạnh đang trống',
                    body: 'Hãy lên danh sách mua sắm để bổ sung thực phẩm cho gia đình nhé!',
                    data: { screen: 'Shopping' },
                },
                trigger: null, // Send immediately
            });
        } catch (error) {
            console.warn('Failed to send empty fridge notification:', error);
        }
    },

    /**
     * Check fridge inventory and notify if empty
     */
    async checkAndNotifyEmptyFridge(userId, minItems = 3) {
        if (!Notifications || isAndroidExpoGo) return;

        try {
            const result = await inventoryService.getItems(userId);
            if (result.success && result.items.length < minItems) {
                await this.notifyEmptyFridge();
            }
        } catch (error) {
            console.warn('Failed to check fridge:', error);
        }
    }
};
