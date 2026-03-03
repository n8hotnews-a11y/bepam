import React, { useState } from 'react';
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
import { feedbackService } from '../services/feedbackService';
import { supabase } from '../services/supabaseConfig';
import { showSuccessToast } from '../components/Toast';

const SupportScreen = ({ navigation }) => {
    const [content, setContent] = useState('');
    const [type, setType] = useState('suggestion'); // 'suggestion', 'bug', 'other'
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!content.trim()) {
            Alert.alert("Thiếu thông tin", "Vui lòng nhập nội dung góp ý của bạn.");
            return;
        }

        try {
            setSubmitting(true);
            const { data: { user } } = await supabase.auth.getUser();

            const result = await feedbackService.submitFeedback(
                user ? user.id : null,
                content,
                type
            );

            if (result.success) {
                showSuccessToast("Cảm ơn góp ý của bạn!");
                setContent('');
                Alert.alert(
                    "Đã gửi thành công",
                    "Cảm ơn bạn đã đóng góp ý kiến giúp Bếp Ấm ngày càng hoàn thiện hơn.",
                    [{ text: "OK", onPress: () => navigation.goBack() }]
                );
            } else {
                Alert.alert("Lỗi", "Không thể gửi góp ý. Vui lòng thử lại sau.");
            }
        } catch (error) {
            console.error(error);
            Alert.alert("Lỗi", "Đã có lỗi xảy ra.");
        } finally {
            setSubmitting(false);
        }
    };

    const RadioOption = ({ value, label, icon, color }) => (
        <TouchableOpacity
            style={[
                styles.radioOption,
                type === value && styles.radioOptionSelected,
                { borderColor: type === value ? COLORS.primary : COLORS.border }
            ]}
            onPress={() => setType(value)}
        >
            <View style={[styles.iconBox, { backgroundColor: type === value ? COLORS.primaryMuted : COLORS.background }]}>
                <MaterialIcons name={icon} size={24} color={type === value ? COLORS.primary : COLORS.textSecondary} />
            </View>
            <Text style={[
                styles.radioLabel,
                type === value && { color: COLORS.primary, fontFamily: FONTS.bold }
            ]}>
                {label}
            </Text>
            {type === value && (
                <View style={styles.checkIcon}>
                    <MaterialIcons name="check-circle" size={20} color={COLORS.primary} />
                </View>
            )}
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialIcons name="arrow-back" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Hỗ trợ & Góp ý</Text>
                <View style={{ width: 40 }} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.introSection}>
                        <Text style={styles.introTitle}>Chào bạn!</Text>
                        <Text style={styles.introText}>
                            Bếp Ấm luôn lắng nghe ý kiến của bạn để cải thiện trải nghiệm tốt hơn.
                            Hãy cho chúng tôi biết bạn đang nghĩ gì nhé.
                        </Text>
                    </View>

                    <Text style={styles.sectionTitle}>Loại phản hồi</Text>
                    <View style={styles.radioGroup}>
                        <RadioOption value="suggestion" label="Góp ý tính năng" icon="lightbulb" />
                        <RadioOption value="bug" label="Báo lỗi ứng dụng" icon="bug-report" />
                        <RadioOption value="other" label="Khác" icon="chat" />
                    </View>

                    <Text style={styles.sectionTitle}>Nội dung</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Nhập nội dung góp ý của bạn tại đây..."
                        value={content}
                        onChangeText={setContent}
                        multiline
                        textAlignVertical="top"
                        placeholderTextColor={COLORS.textMuted}
                    />

                    <TouchableOpacity
                        style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                        onPress={handleSubmit}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator color={COLORS.textOnPrimary} />
                        ) : (
                            <>
                                <MaterialIcons name="send" size={20} color={COLORS.textOnPrimary} />
                                <Text style={styles.submitBtnText}>Gửi phản hồi</Text>
                            </>
                        )}
                    </TouchableOpacity>
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
    scrollContent: {
        padding: SPACING.lg,
    },
    introSection: {
        marginBottom: SPACING.xl,
    },
    introTitle: {
        ...TYPOGRAPHY.heading2,
        color: COLORS.primary,
        marginBottom: SPACING.sm,
    },
    introText: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textSecondary,
        lineHeight: 22,
    },
    sectionTitle: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
        marginBottom: SPACING.md,
    },
    radioGroup: {
        marginBottom: SPACING.xl,
        gap: SPACING.md,
    },
    radioOption: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.backgroundCard,
        padding: SPACING.md,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    radioOptionSelected: {
        backgroundColor: COLORS.background,
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: RADIUS.sm,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.md,
    },
    radioLabel: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textPrimary,
        flex: 1,
    },
    checkIcon: {
        marginLeft: SPACING.sm,
    },
    input: {
        backgroundColor: COLORS.backgroundCard,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: RADIUS.md,
        padding: SPACING.md,
        minHeight: 150,
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textPrimary,
        marginBottom: SPACING.xl,
    },
    submitBtn: {
        backgroundColor: COLORS.primary,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: SPACING.md,
        borderRadius: RADIUS.lg,
        gap: SPACING.sm,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    submitBtnDisabled: {
        opacity: 0.7,
    },
    submitBtnText: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: COLORS.textOnPrimary,
    },
});

export default SupportScreen;
