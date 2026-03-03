import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import { authService } from '../services/authService';
import { supabase } from '../services/supabaseConfig';
import { showSuccessToast } from '../components/Toast';

const UserInfoScreen = ({ navigation }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // User data
    const [userId, setUserId] = useState('');
    const [email, setEmail] = useState('');

    // Editable fields
    const [fullName, setFullName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');

    // Original data to compare for changes
    const [originalData, setOriginalData] = useState({});

    useEffect(() => {
        loadUserData();
    }, []);

    const loadUserData = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                setUserId(user.id);
                setEmail(user.email);

                // Load metadata
                const meta = user.user_metadata || {};
                const name = meta.full_name || '';
                const phone = meta.phone_number || '';

                setFullName(name);
                setPhoneNumber(phone);

                setOriginalData({
                    full_name: name,
                    phone_number: phone
                });
            } else {
                Alert.alert("Lỗi", "Không tìm thấy thông tin người dùng.");
                navigation.goBack();
            }
        } catch (error) {
            console.error('Error loading user info:', error);
            Alert.alert("Lỗi", "Không thể tải thông tin.");
        } finally {
            setLoading(false);
        }
    };

    const hasChanges = () => {
        return fullName !== originalData.full_name || phoneNumber !== originalData.phone_number;
    };

    const handleSave = async () => {
        if (!hasChanges()) return;

        try {
            setSaving(true);

            const updates = {
                full_name: fullName,
                phone_number: phoneNumber
            };

            const result = await authService.updateUserProfile(updates);

            if (result.success) {
                showSuccessToast("Cập nhật thành công!");
                setOriginalData({
                    full_name: fullName,
                    phone_number: phoneNumber
                });
            } else {
                Alert.alert("Lỗi", result.error || "Không thể cập nhật thông tin.");
            }
        } catch (error) {
            console.error('Error updating user info:', error);
            Alert.alert("Lỗi", "Đã có lỗi xảy ra.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialIcons name="arrow-back" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Thông tin cá nhân</Text>
                <TouchableOpacity
                    onPress={handleSave}
                    disabled={saving || !hasChanges()}
                    style={styles.saveBtn}
                >
                    {saving ? (
                        <ActivityIndicator color={COLORS.primary} size="small" />
                    ) : (
                        <Text style={[
                            styles.saveBtnText,
                            !hasChanges() && styles.saveBtnTextDisabled
                        ]}>Lưu</Text>
                    )}
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>

                    {/* Avatar Section (Currenty read-only logic visually) */}
                    <View style={styles.avatarSection}>
                        <View style={styles.avatarContainer}>
                            <MaterialIcons name="person" size={60} color={COLORS.primary} />
                        </View>
                        <Text style={styles.emailText}>{email}</Text>
                        <Text style={styles.idText}>ID: {userId.slice(0, 8)}...</Text>
                    </View>

                    <Text style={styles.sectionTitle}>Thông tin cơ bản</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Họ và tên</Text>
                        <TextInput
                            style={styles.input}
                            value={fullName}
                            onChangeText={setFullName}
                            placeholder="Nhập họ tên của bạn"
                            placeholderTextColor={COLORS.textMuted}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Số điện thoại</Text>
                        <TextInput
                            style={styles.input}
                            value={phoneNumber}
                            onChangeText={setPhoneNumber}
                            placeholder="Nhập số điện thoại"
                            keyboardType="phone-pad"
                            placeholderTextColor={COLORS.textMuted}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email (Không thể thay đổi)</Text>
                        <TextInput
                            style={[styles.input, styles.inputDisabled]}
                            value={email}
                            editable={false}
                        />
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderLight,
    },
    headerTitle: {
        ...TYPOGRAPHY.heading2,
        color: COLORS.textPrimary,
    },
    backBtn: {
        padding: 4,
    },
    saveBtn: {
        padding: 8,
    },
    saveBtnText: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: COLORS.primary,
    },
    saveBtnTextDisabled: {
        color: COLORS.textMuted,
    },
    scrollContent: {
        padding: SPACING.lg,
    },
    avatarSection: {
        alignItems: 'center',
        marginBottom: SPACING.xl,
    },
    avatarContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: COLORS.primaryMuted,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.md,
        borderWidth: 2,
        borderColor: COLORS.primary,
    },
    emailText: {
        ...TYPOGRAPHY.heading3,
        color: COLORS.textPrimary,
    },
    idText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
        marginTop: 4,
    },
    sectionTitle: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
        marginBottom: SPACING.md,
    },
    inputGroup: {
        marginBottom: SPACING.lg,
    },
    label: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textSecondary,
        marginBottom: SPACING.xs,
    },
    input: {
        backgroundColor: COLORS.backgroundCard,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: RADIUS.md,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textPrimary,
    },
    inputDisabled: {
        backgroundColor: COLORS.background,
        color: COLORS.textMuted,
    },
});

export default UserInfoScreen;
