import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';

const { width: screenWidth } = Dimensions.get('window');

// Toast Manager để quản lý multiple toasts
let toastQueue = [];
let currentToastId = 0;

const Toast = ({ id, message, type = 'success', duration = 3000, onHide }) => {
    const [fadeAnim] = useState(new Animated.Value(0));
    const [slideAnim] = useState(new Animated.Value(-100));

    useEffect(() => {
        // Slide in animation
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.spring(slideAnim, {
                toValue: 0,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
            }),
        ]).start();

        // Auto hide after duration
        const timer = setTimeout(() => {
            hideToast();
        }, duration);

        return () => clearTimeout(timer);
    }, []);

    const hideToast = () => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: -100,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onHide && onHide(id);
        });
    };

    const getToastConfig = () => {
        switch (type) {
            case 'success':
                return {
                    backgroundColor: COLORS.successLight,
                    borderColor: COLORS.success,
                    icon: 'check-circle',
                    iconColor: COLORS.success,
                };
            case 'error':
                return {
                    backgroundColor: COLORS.dangerLight,
                    borderColor: COLORS.danger,
                    icon: 'error',
                    iconColor: COLORS.danger,
                };
            case 'warning':
                return {
                    backgroundColor: COLORS.warningLight,
                    borderColor: COLORS.warningDark,
                    icon: 'warning',
                    iconColor: COLORS.warningDark,
                };
            default:
                return {
                    backgroundColor: COLORS.primaryMuted,
                    borderColor: COLORS.primary,
                    icon: 'info',
                    iconColor: COLORS.primary,
                };
        }
    };

    const config = getToastConfig();

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                    backgroundColor: config.backgroundColor,
                    borderColor: config.borderColor,
                },
            ]}
        >
            <View style={styles.content}>
                <View style={[styles.iconContainer, { backgroundColor: config.iconColor + '20' }]}>
                    <MaterialIcons name={config.icon} size={20} color={config.iconColor} />
                </View>
                <Text style={styles.message}>{message}</Text>
            </View>
        </Animated.View>
    );
};

// Toast Manager Component
export const ToastManager = () => {
    const [toasts, setToasts] = useState([]);

    useEffect(() => {
        const interval = setInterval(() => {
            if (toastQueue.length > 0 && toasts.length < 3) { // Max 3 toasts at once
                const nextToast = toastQueue.shift();
                setToasts(prev => [...prev, nextToast]);
            }
        }, 100);

        return () => clearInterval(interval);
    }, [toasts]);

    const removeToast = (id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    };

    return (
        <View style={styles.toastContainer}>
            {toasts.map((toast, index) => (
                <View key={toast.id} style={[styles.toastWrapper, { top: index * 80 }]}>
                    <Toast {...toast} onHide={removeToast} />
                </View>
            ))}
        </View>
    );
};

// Toast functions
export const showToast = (message, type = 'success', duration = 3000) => {
    const id = ++currentToastId;
    const toast = { id, message, type, duration };
    toastQueue.push(toast);
};

export const showSuccessToast = (message, duration) => showToast(message, 'success', duration);
export const showErrorToast = (message, duration) => showToast(message, 'error', duration);
export const showWarningToast = (message, duration) => showToast(message, 'warning', duration);

const styles = StyleSheet.create({
    toastContainer: {
        position: 'absolute',
        top: 50,
        left: 0,
        right: 0,
        zIndex: 1000,
        pointerEvents: 'none',
    },
    toastWrapper: {
        position: 'absolute',
        left: SPACING.xl,
        right: SPACING.xl,
    },
    container: {
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
        pointerEvents: 'auto',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
        gap: SPACING.md,
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: RADIUS.md,
        justifyContent: 'center',
        alignItems: 'center',
    },
    message: {
        flex: 1,
        ...TYPOGRAPHY.bodyRegular,
        fontFamily: FONTS.medium,
        color: COLORS.textPrimary,
        lineHeight: 20,
    },
});

export default Toast;