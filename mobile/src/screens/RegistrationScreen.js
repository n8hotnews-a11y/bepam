import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import { authService } from '../services/authService';
import { supabase } from '../services/supabaseConfig';

const RegistrationScreen = ({ navigation }) => {
    const [fullName, setFullName] = useState('');
    const [emailOrPhone, setEmailOrPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [agreed, setAgreed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const recaptchaVerifier = React.useRef(null);

    React.useEffect(() => {
        let timer;
        if (cooldown > 0) {
            timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [cooldown]);

    const handleRegister = async () => {
        console.log('handleRegister called');
        console.log('fullName:', fullName, 'emailOrPhone:', emailOrPhone, 'password:', password ? 'set' : 'empty', 'confirmPassword:', confirmPassword ? 'set' : 'empty', 'agreed:', agreed);

        if (!fullName || !emailOrPhone || !password || !confirmPassword) {
            console.log('Validation failed: missing fields');
            Alert.alert('Lỗi', 'Vui lòng điền đầy đủ thông tin');
            return;
        }

        if (password !== confirmPassword) {
            console.log('Validation failed: passwords do not match');
            Alert.alert('Lỗi', 'Mật khẩu xác nhận không khớp');
            return;
        }

        if (!agreed) {
            console.log('Validation failed: not agreed');
            Alert.alert('Lỗi', 'Bạn cần đồng ý với Điều khoản & Chính sách');
            return;
        }

        setLoading(true);
        console.log('Validations passed');
        const isEmail = emailOrPhone.includes('@');
        console.log('isEmail:', isEmail);

        if (isEmail) {
            const result = await authService.register(emailOrPhone, password, fullName);
            console.log('Registration result:', result);
            setLoading(false);
            if (result.success) {
                Alert.alert('Thành công', 'Vui lòng kiểm tra email để xác nhận tài khoản.');
            } else {
                Alert.alert('Lỗi đăng ký', result.error);
            }
        } else {
            console.log('Phone registration');
            // Phone registration logic
            try {
                let formattedPhone = emailOrPhone.trim();
                console.log('Original phone:', formattedPhone);
                // Basic VN phone fixed: 090... -> +8490...
                if (formattedPhone.startsWith('0')) {
                    formattedPhone = '+84' + formattedPhone.substring(1);
                }
                console.log('Formatted phone:', formattedPhone);

                const { error } = await supabase.auth.signInWithOtp({
                    phone: formattedPhone
                });
                console.log('OTP result error:', error);

                if (error) throw error;

                setLoading(false);
                Alert.alert('Thành công', 'Mã OTP đã được gửi đến số điện thoại của bạn.');
                navigation.navigate('OTPVerification', {
                    phoneNumber: formattedPhone
                });
            } catch (error) {
                console.log('OTP error:', error);
                setLoading(false);
                if (error.message.includes('only request this after')) {
                    setCooldown(60);
                    Alert.alert('Lỗi', 'Vui lòng chờ một chút trước khi thử lại.');
                } else {
                    Alert.alert('Lỗi', 'Không thể gửi mã OTP: ' + error.message);
                }
            }
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >

                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialIcons name="chevron-left" size={32} color={COLORS.black} />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    <View style={styles.titleSection}>
                        <Text style={styles.titleThin}>Bắt đầu</Text>
                        <Text style={styles.titleBold}>hành trình xanh</Text>
                        <Text style={styles.subtitle}>
                            Quản lý tủ lạnh thông minh, giảm lãng phí thực phẩm cùng cộng đồng.
                        </Text>
                    </View>

                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Họ và tên</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Nguyễn Văn A"
                                placeholderTextColor={COLORS.textMuted}
                                value={fullName}
                                onChangeText={setFullName}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Email hoặc Số điện thoại</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="example@email.com"
                                placeholderTextColor={COLORS.textMuted}
                                value={emailOrPhone}
                                onChangeText={setEmailOrPhone}
                                autoCapitalize="none"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Mật khẩu</Text>
                            <View style={styles.passwordWrapper}>
                                <TextInput
                                    style={[styles.input, { flex: 1, backgroundColor: 'transparent' }]}
                                    placeholder="••••••••"
                                    placeholderTextColor={COLORS.textMuted}
                                    secureTextEntry={!showPassword}
                                    value={password}
                                    onChangeText={setPassword}
                                />
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                                    <MaterialIcons
                                        name={showPassword ? "visibility" : "visibility-off"}
                                        size={20}
                                        color={COLORS.textMuted}
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Xác nhận mật khẩu</Text>
                            <View style={styles.passwordWrapper}>
                                <TextInput
                                    style={[styles.input, { flex: 1, backgroundColor: 'transparent' }]}
                                    placeholder="••••••••"
                                    placeholderTextColor={COLORS.textMuted}
                                    secureTextEntry={!showConfirmPassword}
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                />
                                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeIcon}>
                                    <MaterialIcons
                                        name={showConfirmPassword ? "visibility" : "visibility-off"}
                                        size={20}
                                        color={COLORS.textMuted}
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.termsContainer}>
                            <TouchableOpacity
                                style={[styles.checkbox, agreed && styles.checkboxActive]}
                                onPress={() => setAgreed(!agreed)}
                            >
                                {agreed && <MaterialIcons name="check" size={16} color={COLORS.white} />}
                            </TouchableOpacity>
                            <Text style={styles.termsText}>
                                Tôi đồng ý với <Text style={styles.link}>Điều khoản</Text> & <Text style={styles.link}>Chính sách bảo mật</Text> của ứng dụng.
                            </Text>
                        </View>
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.registerButton, loading && { opacity: 0.7 }]}
                            onPress={handleRegister}
                            disabled={loading}
                        >
                            <Text style={styles.registerButtonText}>
                                {loading ? 'Đang xử lý...' : 'Đăng ký'}
                            </Text>
                        </TouchableOpacity>

                    <View style={styles.loginLinkContainer}>
                        <Text style={styles.footerInfoText}>Đã có tài khoản?</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                            <Text style={styles.loginLinkText}>Đăng nhập</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.indicator} />
                </View>
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
        paddingBottom: SPACING.xl,
    },
    titleSection: {
        marginTop: SPACING.md,
        marginBottom: SPACING.xl,
    },
    titleThin: {
        ...TYPOGRAPHY.display1,
        fontFamily: FONTS.regular,
        color: COLORS.textPrimary,
        lineHeight: 36,
    },
    titleBold: {
        ...TYPOGRAPHY.display1,
        color: COLORS.textPrimary,
        lineHeight: 36,
    },
    subtitle: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textSecondary,
        marginTop: SPACING.md,
        lineHeight: 22,
        maxWidth: 280,
    },
    form: {
        gap: SPACING.md,
    },
    inputGroup: {
        gap: SPACING.sm,
    },
    label: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.bold,
        color: COLORS.textSecondary,
        marginLeft: 4,
    },
    input: {
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.md,
        height: 56,
        paddingHorizontal: SPACING.md,
        ...TYPOGRAPHY.bodyLarge,
        color: COLORS.textPrimary,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    passwordWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    eyeIcon: {
        padding: SPACING.md,
    },
    termsContainer: {
        flexDirection: 'row',
        gap: SPACING.md,
        marginTop: SPACING.md,
        paddingRight: SPACING.md,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 2,
    },
    checkboxActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    termsText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
        lineHeight: 18,
        flex: 1,
    },
    link: {
        color: COLORS.primary,
        fontFamily: FONTS.bold,
    },
    footer: {
        marginTop: SPACING.xl,
    },
    registerButton: {
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
    registerButtonText: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: COLORS.white,
    },
    loginLinkContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 4,
        marginTop: SPACING.lg,
    },
    footerInfoText: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textSecondary,
    },
    loginLinkText: {
        ...TYPOGRAPHY.bodyRegular,
        fontFamily: FONTS.bold,
        color: COLORS.primary,
    },
    indicator: {
        width: 128,
        height: 6,
        backgroundColor: COLORS.borderLight,
        borderRadius: 3,
        alignSelf: 'center',
        marginTop: SPACING.xl,
    },
});

export default RegistrationScreen;
