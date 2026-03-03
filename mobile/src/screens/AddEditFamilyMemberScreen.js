import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, Dimensions, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import { familyMemberService } from '../services/familyMemberService';
import { supabase } from '../services/supabaseConfig';

const { width } = Dimensions.get('window');

// Pre-defined options
const RELATIONSHIPS = ['Bố', 'Mẹ', 'Con trai', 'Con gái', 'Ông', 'Bà', 'Ông bà', 'Anh chị', 'Cháu', 'Khác'];
const DIETARY_PREFERENCES = [
    'Ít dầu mỡ', 'Thích hải sản', 'Ăn chay', 'Thực phẩm hữu cơ',
    'Ít đường', 'Thấp calo', 'Không gluten', 'Không lactose',
    'Ít cay', 'Thích cay', 'Ăn kiêng'
];

const HEALTH_CONDITIONS_LIST = [
    'Tiểu đường', 'Huyết áp cao', 'Tim mạch', 'Béo phì',
    'Dị ứng hải sản', 'Dị ứng đậu phộng', 'Dị ứng trứng', 'Dị ứng sữa',
    'Gout', 'Suy thận', 'Dạ dày'
];

const AddEditFamilyMemberScreen = ({ navigation, route }) => {
    console.log('AddEditFamilyMemberScreen navigation:', navigation);
    console.log('AddEditFamilyMemberScreen route:', route);
    const member = route.params?.member;
    const isEditing = !!member;

    const [formData, setFormData] = useState({
        name: '',
        relationship: 'Con trai',
        age: '',
        gender: 'Nam',
        dietaryPreferences: [],
        healthConditions: {
            predefined: [],
            notes: ''
        },
        avatarUrl: null,
        medicalRecords: [] // Array of { uri, name, type, size }
    });

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isEditing && member) {
            setFormData({
                name: member.name || '',
                relationship: member.relationship || 'Con trai',
                age: member.age?.toString() || '',
                gender: member.gender || 'Nam',
                dietaryPreferences: member.dietaryPreferences || [],
                healthConditions: member.healthConditions || { predefined: [], notes: '' },
                avatarUrl: member.avatarUrl || null,
                medicalRecords: member.medicalRecords || []
            });
        }
    }, [member, isEditing]);

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Quyền truy cập', 'Chúng tôi cần quyền truy cập thư viện ảnh để chọn ảnh đại diện.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaType.IMAGE,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            setFormData(prev => ({ ...prev, avatarUrl: result.assets[0].uri }));
        }
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Quyền truy cập', 'Chúng tôi cần quyền sử dụng camera để chụp ảnh.');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            setFormData(prev => ({ ...prev, avatarUrl: result.assets[0].uri }));
        }
    };

    const pickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['image/*', 'application/pdf'],
                multiple: true
            });

            if (!result.canceled) {
                const newRecords = result.assets.map(asset => ({
                    uri: asset.uri,
                    name: asset.name,
                    size: asset.size,
                    mimeType: asset.mimeType
                }));
                setFormData(prev => ({
                    ...prev,
                    medicalRecords: [...prev.medicalRecords, ...newRecords]
                }));
            }
        } catch (err) {
            console.error('Pick document error:', err);
        }
    };

    const removeMedicalRecord = (index) => {
        setFormData(prev => ({
            ...prev,
            medicalRecords: prev.medicalRecords.filter((_, i) => i !== index)
        }));
    };

    const toggleDietaryPreference = (preference) => {
        setFormData(prev => ({
            ...prev,
            dietaryPreferences: prev.dietaryPreferences.includes(preference)
                ? prev.dietaryPreferences.filter(p => p !== preference)
                : [...prev.dietaryPreferences, preference]
        }));
    };

    const toggleHealthCondition = (condition) => {
        setFormData(prev => ({
            ...prev,
            healthConditions: {
                ...prev.healthConditions,
                predefined: prev.healthConditions.predefined.includes(condition)
                    ? prev.healthConditions.predefined.filter(c => c !== condition)
                    : [...prev.healthConditions.predefined, condition]
            }
        }));
    };

    const handleSave = async () => {
        if (!formData.name.trim()) {
            Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên thành viên');
            return;
        }

        if (!formData.age || isNaN(formData.age) || parseInt(formData.age) <= 0) {
            Alert.alert('Thiếu thông tin', 'Vui lòng nhập tuổi hợp lệ');
            return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        const user_id = user?.id;
        if (!user_id) return;

        setSaving(true);

        try {
            let avatarUrl = formData.avatarUrl;

            // 1. Upload new avatar if it's a local URI
            if (avatarUrl && avatarUrl.startsWith('file://')) {
                const fileName = `avatar_${Date.now()}.jpg`;
                const uploadResult = await familyMemberService.uploadAvatar(user_id, avatarUrl, fileName);
                if (uploadResult.success) {
                    avatarUrl = uploadResult.url;
                } else {
                    Alert.alert('Lỗi', 'Không thể tải lên ảnh đại diện');
                    setSaving(false);
                    return;
                }
            }

            // 2. Upload medical records
            const uploadedMedicalRecords = [];
            for (const record of formData.medicalRecords) {
                if (record.uri.startsWith('http')) {
                    uploadedMedicalRecords.push(record);
                } else {
                    const fileName = `medical_${Date.now()}_${record.name}`;
                    const uploadRes = await familyMemberService.uploadMedicalRecord(user_id, record.uri, fileName);
                    if (uploadRes.success) {
                        uploadedMedicalRecords.push({
                            ...record,
                            uri: uploadRes.url
                        });
                    }
                }
            }

            // Combine predefined preferences with "Other" preference
            let finalDietPreferences = [...formData.dietaryPreferences];
            if (formData.otherDietary && formData.otherDietary.trim()) {
                finalDietPreferences.push(formData.otherDietary.trim());
            }

            const memberData = {
                ...formData,
                dietaryPreferences: finalDietPreferences,
                age: parseInt(formData.age),
                avatarUrl,
                medicalRecords: uploadedMedicalRecords
            };

            let result;
            if (isEditing) {
                result = await familyMemberService.updateFamilyMember(member.id, memberData);
            } else {
                result = await familyMemberService.addFamilyMember(user_id, memberData);
            }

            if (result.success) {
                Alert.alert(
                    'Thành công',
                    isEditing ? 'Đã cập nhật thông tin thành viên' : 'Đã thêm thành viên mới',
                    [{ text: 'OK', onPress: () => navigation.goBack() }]
                );
            } else {
                Alert.alert('Lỗi', result.error || 'Không thể lưu thông tin');
            }
        } catch (error) {
            console.error('Save error:', error);
            Alert.alert('Lỗi', error.message || 'Có lỗi xảy ra');
        } finally {
            setSaving(false);
        }
    };

    const renderInput = (label, value, onChangeText, placeholder, keyboardType = 'default') => (
        <View style={styles.inputGroup}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
                style={styles.input}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={COLORS.textMuted}
                keyboardType={keyboardType}
            />
        </View>
    );

    const renderSelector = (label, value, options, onSelect) => (
        <View style={styles.inputGroup}>
            <Text style={styles.label}>{label}</Text>
            <View style={styles.selectorGrid}>
                {options.map(option => (
                    <TouchableOpacity
                        key={option}
                        style={[styles.selectorButton, value === option && styles.selectorButtonActive]}
                        onPress={() => onSelect(option)}
                    >
                        <Text style={[styles.selectorText, value === option && styles.selectorTextActive]}>
                            {option}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );

    const renderTagSelector = (label, selectedItems, allItems, onToggle, icon) => (
        <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
                {icon && <MaterialIcons name={icon} size={18} color={COLORS.primary} style={{ marginRight: 6 }} />}
                <Text style={styles.label}>{label}</Text>
            </View>
            <View style={styles.tagGrid}>
                {allItems.map(item => (
                    <TouchableOpacity
                        key={item}
                        style={[styles.tag, selectedItems.includes(item) && styles.tagActive]}
                        onPress={() => onToggle(item)}
                    >
                        <Text style={[styles.tagText, selectedItems.includes(item) && styles.tagTextActive]}>
                            {item}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );

    const renderFileUpload = () => (
        <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
                <MaterialIcons name="attachment" size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
                <Text style={styles.label}>Tải lên hồ sơ bệnh án (Ảnh/PDF)</Text>
            </View>
            <Text style={styles.sectionDesc}>Cung cấp hồ sơ để AI phân tích chế độ dinh dưỡng chuyên sâu cho thành viên này.</Text>

            <TouchableOpacity style={styles.uploadBtn} onPress={pickDocument}>
                <MaterialIcons name="cloud-upload" size={24} color={COLORS.primary} />
                <Text style={styles.uploadBtnText}>Chọn tệp hoặc chụp ảnh</Text>
            </TouchableOpacity>

            {formData.medicalRecords.length > 0 && (
                <View style={styles.fileList}>
                    {formData.medicalRecords.map((file, index) => (
                        <View key={index} style={styles.fileItem}>
                            <MaterialIcons name="insert-drive-file" size={20} color={COLORS.textSecondary} />
                            <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                            <TouchableOpacity onPress={() => removeMedicalRecord(index)}>
                                <MaterialIcons name="cancel" size={20} color={COLORS.danger} />
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );

    return (
        <SafeAreaProvider>
            <SafeAreaView style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialIcons name="chevron-left" size={32} color={COLORS.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>
                        {isEditing ? 'Chỉnh sửa thành viên' : 'Thêm thành viên'}
                    </Text>
                    <View style={styles.placeholder} />
                </View>

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                >
                    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        {/* Avatar Section */}
                        <View style={styles.section}>
                            <View style={styles.avatarSection}>
                                <TouchableOpacity
                                    style={styles.avatarContainer}
                                    onPress={() => {
                                        Alert.alert('Chọn ảnh', 'Chọn nguồn ảnh', [
                                            { text: 'Chụp ảnh', onPress: takePhoto },
                                            { text: 'Thư viện', onPress: pickImage },
                                            { text: 'Hủy', style: 'cancel' }
                                        ]);
                                    }}
                                >
                                    {formData.avatarUrl ? (
                                        <Image source={{ uri: formData.avatarUrl }} style={styles.avatar} />
                                    ) : (
                                        <View style={styles.avatarPlaceholder}>
                                            <MaterialIcons name="person" size={60} color={COLORS.primaryMuted} />
                                            <View style={styles.cameraBadge}>
                                                <MaterialIcons name="camera-alt" size={16} color={COLORS.white} />
                                            </View>
                                        </View>
                                    )}
                                </TouchableOpacity>
                                <Text style={styles.avatarHint}>Ảnh đại diện</Text>
                            </View>
                        </View>

                        {/* Basic Info */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Thông tin cơ bản</Text>
                            <View style={styles.card}>
                                {renderInput('Họ và tên', formData.name, (text) => setFormData(prev => ({ ...prev, name: text })), 'Nhập tên thành viên', 'default')}

                                <View style={{ flexDirection: 'row', gap: SPACING.lg }}>
                                    <View style={{ flex: 1 }}>
                                        {renderInput('Tuổi', formData.age, (text) => setFormData(prev => ({ ...prev, age: text })), 'VD: 25', 'numeric')}
                                    </View>
                                    <View style={{ flex: 1.5 }}>
                                        {renderSelector('Giới tính', formData.gender, ['Nam', 'Nữ', 'Khác'], (val) => setFormData(prev => ({ ...prev, gender: val })))}
                                    </View>
                                </View>

                                {renderSelector('Vai trò', formData.relationship, RELATIONSHIPS, (val) => setFormData(prev => ({ ...prev, relationship: val })))}
                            </View>
                        </View>

                        {/* Dietary Preferences */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Sở thích ăn uống</Text>
                            <Text style={styles.sectionDesc}>Gợi ý món ăn sẽ được cá nhân hóa dựa trên những thẻ này.</Text>
                            <View style={styles.card}>
                                {renderTagSelector('Lựa chọn sở thích', formData.dietaryPreferences, DIETARY_PREFERENCES, toggleDietaryPreference, 'restaurant')}

                                <View style={[styles.inputGroup, { marginTop: SPACING.sm }]}>
                                    <Text style={styles.label}>Sở thích khác (Tuỳ chọn)</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={formData.otherDietary}
                                        onChangeText={(text) => setFormData(prev => ({ ...prev, otherDietary: text }))}
                                        placeholder="Nhập sở thích ăn uống khác..."
                                        placeholderTextColor={COLORS.textMuted}
                                    />
                                </View>
                            </View>
                        </View>

                        {/* Health Profile */}
                        <View style={styles.section}>
                            <View style={styles.titleRow}>
                                <Text style={styles.sectionTitle}>Hồ sơ bệnh án & Lưu ý</Text>
                                <FontAwesome5 name="shield-alt" size={16} color={COLORS.primary} />
                            </View>
                            <Text style={styles.sectionDesc}>Thông tin quan trọng để hệ thống loại bỏ các nguyên liệu gây hại.</Text>
                            <View style={styles.card}>
                                {renderTagSelector('Tình trạng sức khỏe / Dị ứng', formData.healthConditions.predefined, HEALTH_CONDITIONS_LIST, toggleHealthCondition, 'health-and-safety')}

                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Ghi chú sức khỏe bổ sung</Text>
                                    <TextInput
                                        style={[styles.input, styles.textArea]}
                                        value={formData.healthConditions.notes}
                                        onChangeText={(text) => setFormData(prev => ({
                                            ...prev,
                                            healthConditions: { ...prev.healthConditions, notes: text }
                                        }))}
                                        placeholder="Nhập chi tiết về tình trạng bệnh, loại thuốc hoặc thực phẩm cần tránh..."
                                        placeholderTextColor={COLORS.textMuted}
                                        multiline
                                        numberOfLines={4}
                                    />
                                </View>

                                {renderFileUpload()}
                            </View>
                        </View>

                        <View style={{ height: 40 }} />
                    </ScrollView>

                    {/* Save Button */}
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.saveButton, saving && { opacity: 0.7 }]}
                            onPress={handleSave}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator color={COLORS.white} />
                            ) : (
                                <Text style={styles.saveButtonText}>
                                    {isEditing ? 'Cập nhật' : 'Thêm thành viên'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>

            </SafeAreaView>
        </SafeAreaProvider>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background, // Cream background
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
        backgroundColor: COLORS.background,
    },
    backButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        ...TYPOGRAPHY.heading2,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
    },
    placeholder: {
        width: 44,
    },
    content: {
        paddingBottom: 150,
    },
    section: {
        marginTop: SPACING.lg,
        paddingHorizontal: SPACING.md,
    },
    sectionTitle: {
        ...TYPOGRAPHY.heading3,
        color: COLORS.textPrimary,
        marginBottom: 8,
    },
    sectionDesc: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
        marginBottom: SPACING.md,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    card: {
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.xl,
        padding: SPACING.md,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
    },
    avatarSection: {
        alignItems: 'center',
        paddingVertical: SPACING.md,
    },
    avatarContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: COLORS.backgroundCard,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: 'hidden',
        position: 'relative',
    },
    avatar: {
        width: '100%',
        height: '100%',
    },
    avatarPlaceholder: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.primaryMuted + '20',
    },
    cameraBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: COLORS.primary,
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: COLORS.white,
    },
    avatarHint: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
        marginTop: SPACING.sm,
        fontFamily: FONTS.medium,
    },
    inputGroup: {
        marginBottom: SPACING.md,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    label: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
        marginBottom: 6,
    },
    input: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textPrimary,
        backgroundColor: COLORS.background,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        height: 48,
        paddingHorizontal: SPACING.md,
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
        paddingTop: SPACING.sm,
    },
    selectorGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    selectorButton: {
        paddingHorizontal: SPACING.md,
        paddingVertical: 8,
        backgroundColor: COLORS.background,
        borderRadius: RADIUS.pill,
        borderWidth: 1,
        borderColor: COLORS.border,
        minWidth: 70,
        alignItems: 'center',
    },
    selectorButtonActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    selectorText: {
        fontSize: 13,
        fontFamily: FONTS.medium,
        color: COLORS.textSecondary,
    },
    selectorTextActive: {
        color: COLORS.white,
        fontFamily: FONTS.bold,
    },
    tagGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tag: {
        paddingHorizontal: SPACING.md,
        paddingVertical: 8,
        backgroundColor: COLORS.background,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    tagActive: {
        backgroundColor: COLORS.primaryMuted,
        borderColor: COLORS.primary,
    },
    tagText: {
        fontSize: 13,
        fontFamily: FONTS.medium,
        color: COLORS.textSecondary,
    },
    tagTextActive: {
        color: COLORS.primary,
        fontFamily: FONTS.bold,
    },
    uploadBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.primaryMuted + '30',
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: COLORS.primary,
        borderRadius: RADIUS.md,
        padding: SPACING.md,
        gap: SPACING.sm,
        marginTop: SPACING.xs,
    },
    uploadBtnText: {
        ...TYPOGRAPHY.bodyRegular,
        fontFamily: FONTS.bold,
        color: COLORS.primary,
    },
    fileList: {
        marginTop: SPACING.md,
        gap: SPACING.xs,
    },
    fileItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        padding: SPACING.sm,
        borderRadius: RADIUS.sm,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
    },
    fileName: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textPrimary,
        flex: 1,
        marginHorizontal: SPACING.sm,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: SPACING.lg,
        paddingBottom: Platform.OS === 'ios' ? 40 : SPACING.lg,
        backgroundColor: 'transparent',
    },
    saveButton: {
        backgroundColor: COLORS.primary,
        height: 56,
        borderRadius: RADIUS.lg,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    saveButtonText: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: COLORS.white,
    },
});

export default AddEditFamilyMemberScreen;