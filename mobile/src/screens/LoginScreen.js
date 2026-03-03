import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Image,
    ScrollView,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import { authService } from '../services/authService';

const LoginScreen = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ email và mật khẩu');
            return;
        }

        setLoading(true);
        const result = await authService.login(email, password);
        setLoading(false);

        if (result.success) {
            // Navigation will be handled by the listener in AppNavigator
        } else {
            Alert.alert('Lỗi đăng ký', result.error);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {/* Top Illustration Wrapper */}
                    <View style={styles.topSection}>
                        <Image
                            source={{ uri: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?q=80&w=2070&auto=format&fit=crop' }}
                            style={styles.bgImage}
                            resizeMode="cover"
                        />
                        <View style={styles.bgOverlay} />
                    </View>

                    <View style={styles.formContainer}>
                        {/* Header */}
                        <View style={styles.header}>
                            <View style={styles.logoContainer}>
                                <Image
                                    source={require('../../assets/icon.png')}
                                    style={{ width: '100%', height: '100%', borderRadius: RADIUS.md }}
                                    resizeMode="contain"
                                />
                            </View>
                            <Text style={styles.title}>Mừng bạn trở lại</Text>
                            <Text style={styles.subtitle}>Quản lý thực phẩm thông minh & bền vững</Text>
                        </View>

                        {/* Inputs */}
                        <View style={styles.inputSection}>
                            <View style={styles.inputWrapper}>
                                <Text style={styles.inputLabel}>Email hoặc Số điện thoại</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="name@example.com"
                                    placeholderTextColor={COLORS.textMuted}
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                />
                            </View>

                            <View style={styles.inputWrapper}>
                                <Text style={styles.inputLabel}>Mật khẩu</Text>
                                <View style={styles.passwordContainer}>
                                    <TextInput
                                        style={[styles.input, { flex: 1, borderBottomWidth: 0, borderWidth: 0 }]}
                                        placeholder="••••••••"
                                        placeholderTextColor={COLORS.textMuted}
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry={!showPassword}
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

                            <TouchableOpacity style={styles.forgotPassword}>
                                <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Login Button */}
                        <TouchableOpacity
                            style={[styles.loginButton, loading && { opacity: 0.8 }]}
                            onPress={handleLogin}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color={COLORS.white} />
                            ) : (
                                <Text style={styles.loginButtonText}>Đăng nhập</Text>
                            )}
                        </TouchableOpacity>


                        {/* Register Link */}
                        <View style={styles.footer}>
                            <Text style={styles.footerText}>Chưa có tài khoản? </Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Registration')}>
                                <Text style={styles.registerLink}>Đăng ký ngay</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        flexGrow: 1,
    },
    topSection: {
        height: 220,
        width: '100%',
        position: 'relative',
    },
    bgImage: {
        width: '100%',
        height: '100%',
        opacity: 0.3,
    },
    bgOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 100,
        backgroundColor: 'transparent',
    },
    formContainer: {
        flex: 1,
        paddingHorizontal: SPACING.xl,
        marginTop: -60,
    },
    header: {
        alignItems: 'center',
        marginBottom: SPACING.xl,
    },
    logoContainer: {
        width: 64,
        height: 64,
        borderRadius: RADIUS.md,
        backgroundColor: COLORS.primaryMuted,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    title: {
        ...TYPOGRAPHY.heading1,
        color: COLORS.textPrimary,
    },
    subtitle: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textSecondary,
        marginTop: SPACING.xs,
        textAlign: 'center',
    },
    inputSection: {
        gap: SPACING.md,
        marginBottom: SPACING.xs,
    },
    inputWrapper: {
        gap: SPACING.xs,
    },
    inputLabel: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.bold,
        color: COLORS.textSecondary,
        marginLeft: 4,
    },
    input: {
        height: 56,
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: SPACING.md,
        ...TYPOGRAPHY.bodyLarge,
        color: COLORS.textPrimary,
    },
    passwordContainer: {
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
    forgotPassword: {
        alignSelf: 'flex-end',
    },
    forgotPasswordText: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.bold,
        color: COLORS.textMuted,
    },
    loginButton: {
        backgroundColor: COLORS.primary,
        height: 60,
        borderRadius: RADIUS.lg,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: SPACING.xl,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 4,
    },
    loginButtonText: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: COLORS.textOnPrimary,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        paddingVertical: SPACING.xl,
    },
    footerText: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textSecondary,
    },
    registerLink: {
        ...TYPOGRAPHY.bodyRegular,
        fontFamily: FONTS.bold,
        color: COLORS.primary,
    },
});

export default LoginScreen;
