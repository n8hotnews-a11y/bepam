import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import { authService } from '../services/authService';
import { supabase } from '../services/supabaseConfig';
import { Alert } from 'react-native';

const OTPVerificationScreen = ({ navigation, route }) => {
    const { phoneNumber, verificationId } = route.params || { phoneNumber: '+84 123***789', verificationId: null };
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [timer, setTimer] = useState(119); // 01:59
    const [loading, setLoading] = useState(false);

    const inputRefs = [
        useRef(null),
        useRef(null),
        useRef(null),
        useRef(null),
        useRef(null),
        useRef(null),
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setTimer((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleOtpChange = (value, index) => {
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        // Auto-focus next input
        if (value !== '' && index < 5) {
            inputRefs[index + 1].current.focus();
        }
    };

    const handleKeyPress = (e, index) => {
        if (e.nativeEvent.key === 'Backspace' && otp[index] === '' && index > 0) {
            inputRefs[index - 1].current.focus();
        }
    };

    const handleConfirm = async () => {
        const verificationCode = otp.join('');
        if (verificationCode.length < 6) {
            Alert.alert('Lỗi', 'Vui lòng nhập đủ 6 chữ số');
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.verifyOtp({
                phone: phoneNumber,
                token: verificationCode,
                type: 'sms'
            });

            if (error) throw error;

            setLoading(false);
            navigation.navigate('OTPSuccess');
        } catch (error) {
            setLoading(false);
            Alert.alert('Lỗi', 'Mã OTP không chính xác hoặc đã hết hạn.');
            console.error(error);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <MaterialIcons name="chevron-left" size={32} color={COLORS.textPrimary} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.illustrationSection}>
                    <View style={styles.circleBg}>
                        <View style={styles.smsBadge}>
                            <MaterialIcons name="sms" size={24} color={COLORS.primary} />
                        </View>
                        <MaterialIcons name="smartphone" size={64} color={COLORS.primary} />
                    </View>
                </View>

                <View style={styles.textSection}>
                    <Text style={styles.title}>Xác thực mã OTP</Text>
                    <Text style={styles.description}>
                        Vui lòng nhập mã OTP gồm 6 chữ số đã được gửi đến số điện thoại <Text style={styles.boldText}>{phoneNumber}</Text>
                    </Text>
                </View>

                <View style={styles.otpContainer}>
                    {otp.map((digit, index) => (
                        <TextInput
                            key={index}
                            ref={inputRefs[index]}
                            style={styles.otpInput}
                            value={digit}
                            onChangeText={(text) => handleOtpChange(text, index)}
                            onKeyPress={(e) => handleKeyPress(e, index)}
                            keyboardType="number-pad"
                            maxLength={1}
                        />
                    ))}
                </View>

                <View style={styles.timerSection}>
                    <View style={styles.timerRow}>
                        <MaterialIcons name="timer" size={18} color={COLORS.textMuted} />
                        <Text style={styles.timerText}>{formatTime(timer)}</Text>
                    </View>
                    <TouchableOpacity
                        disabled={timer > 0}
                        onPress={() => setTimer(119)}
                    >
                        <Text style={[styles.resendText, timer > 0 && styles.resendDisabled]}>
                            Gửi lại mã
                        </Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.confirmButton, loading && { opacity: 0.7 }]}
                        onPress={handleConfirm}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={COLORS.white} />
                        ) : (
                            <Text style={styles.confirmButtonText}>Xác nhận</Text>
                        )}
                    </TouchableOpacity>
                    <View style={styles.bottomIndicator} />
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
    header: {
        paddingHorizontal: SPACING.md,
        paddingTop: SPACING.sm,
    },
    backButton: {
        width: 48,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: SPACING.xl,
    },
    illustrationSection: {
        alignItems: 'center',
        paddingVertical: SPACING.xxl,
    },
    circleBg: {
        width: 128,
        height: 128,
        borderRadius: 64,
        backgroundColor: COLORS.primaryMuted,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    smsBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: COLORS.backgroundCard,
        padding: 8,
        borderRadius: RADIUS.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    textSection: {
        alignItems: 'center',
        marginBottom: SPACING.xl,
    },
    title: {
        ...TYPOGRAPHY.heading1,
        color: COLORS.textPrimary,
        marginBottom: SPACING.sm,
    },
    description: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },
    boldText: {
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
    },
    otpContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: SPACING.sm,
        marginBottom: SPACING.lg,
    },
    otpInput: {
        width: 48,
        height: 56,
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.md,
        borderWidth: 2,
        borderColor: COLORS.border,
        textAlign: 'center',
        ...TYPOGRAPHY.heading1,
        color: COLORS.textPrimary,
    },
    timerSection: {
        alignItems: 'center',
        gap: SPACING.sm,
        marginBottom: SPACING.xxl,
    },
    timerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    timerText: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textSecondary,
    },
    resendText: {
        ...TYPOGRAPHY.bodyRegular,
        fontFamily: FONTS.bold,
        color: COLORS.primary,
    },
    resendDisabled: {
        color: COLORS.textMuted,
    },
    footer: {
        marginTop: 'auto',
        paddingBottom: SPACING.xl,
    },
    confirmButton: {
        backgroundColor: COLORS.primary,
        height: 60,
        borderRadius: RADIUS.lg,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    confirmButtonText: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: COLORS.textOnPrimary,
    },
    bottomIndicator: {
        width: 128,
        height: 6,
        backgroundColor: COLORS.borderLight,
        borderRadius: 3,
        alignSelf: 'center',
        marginTop: SPACING.xl,
    },
});

export default OTPVerificationScreen;
