import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Image,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import { communityService } from '../services/communityService';
import { supabase } from '../services/supabaseConfig';
import { showSuccessToast } from '../components/Toast';

const GROUP_TYPES = [
    { id: 'interest', label: 'Sở thích / Giao lưu', icon: 'favorite' },
    { id: 'buy_sell', label: 'Mua bán / Trao đổi', icon: 'shopping-cart' },
    { id: 'official', label: 'Chính thức / BQT', icon: 'verified' }
];

const CreateGroupScreen = ({ navigation }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState('interest');
    const [image, setImage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [userResidenceId, setUserResidenceId] = useState(null);

    useEffect(() => {
        fetchUserResidence();
    }, []);

    const fetchUserResidence = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from('users').select('residence_id').eq('id', user.id).single();
        setUserResidenceId(data?.residence_id);
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    const handleSubmit = async () => {
        if (!name || !description) {
            Alert.alert('Thiếu thông tin', 'Vui lòng điền tên nhóm và mô tả.');
            return;
        }

        if (!userResidenceId) {
            Alert.alert('Chưa chọn khu vực', 'Bạn cần chọn khu cư dân trước khi tạo nhóm.', [
                { text: 'Chọn ngay', onPress: () => navigation.navigate('LocationSetup') }
            ]);
            return;
        }

        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();

        try {
            // 1. Create the group
            const { data, error } = await supabase
                .from('groups')
                .insert([{
                    name,
                    description,
                    type,
                    residence_id: userResidenceId,
                    created_by: user.id,
                    image_url: image // In production, upload to Storage first
                }])
                .select()
                .single();

            if (error) throw error;

            // 2. Automatically join the creator to the group
            await communityService.joinGroup(data.id, user.id);

            showSuccessToast('Đã tạo nhóm thành công!');
            navigation.goBack();
        } catch (error) {
            console.error('Create group error:', error);
            Alert.alert('Lỗi', 'Không thể tạo nhóm lúc này. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialIcons name="close" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Tạo Hội Nhóm</Text>
                <TouchableOpacity onPress={handleSubmit} disabled={loading}>
                    {loading ? (
                        <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : (
                        <Text style={styles.submitText}>Tạo</Text>
                    )}
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {/* Image Picker */}
                    <View style={styles.imageSection}>
                        <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                            {image ? (
                                <Image source={{ uri: image }} style={styles.previewImage} />
                            ) : (
                                <View style={styles.placeholder}>
                                    <MaterialIcons name="add-a-photo" size={40} color={COLORS.textMuted} />
                                    <Text style={styles.placeholderText}>Ảnh đại diện nhóm</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Form */}
                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Tên nhóm</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Ví dụ: Hội yêu cây cảnh, Chợ đồ cũ..."
                                value={name}
                                onChangeText={setName}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Mô tả mục đích nhóm</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                placeholder="Hãy viết vài dòng giới thiệu về nhóm của bạn..."
                                multiline
                                numberOfLines={4}
                                value={description}
                                onChangeText={setDescription}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Loại hình nhóm</Text>
                            <View style={styles.typeList}>
                                {GROUP_TYPES.map(gt => (
                                    <TouchableOpacity
                                        key={gt.id}
                                        style={[styles.typeItem, type === gt.id && styles.typeItemActive]}
                                        onPress={() => setType(gt.id)}
                                    >
                                        <MaterialIcons name={gt.icon} size={20} color={type === gt.id ? COLORS.white : COLORS.textSecondary} />
                                        <Text style={[styles.typeLabel, type === gt.id && styles.typeLabelActive]}>{gt.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
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
    submitText: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: COLORS.primary,
    },
    scrollContent: {
        padding: SPACING.lg,
    },
    imageSection: {
        alignItems: 'center',
        marginVertical: SPACING.xl,
    },
    imagePicker: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: COLORS.backgroundCard,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderStyle: 'dashed',
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    previewImage: {
        width: '100%',
        height: '100%',
    },
    placeholder: {
        alignItems: 'center',
    },
    placeholderText: {
        fontSize: 10,
        color: COLORS.textMuted,
        marginTop: 4,
        textAlign: 'center',
    },
    form: {
        gap: SPACING.xl,
    },
    inputGroup: {
        gap: SPACING.sm,
    },
    label: {
        ...TYPOGRAPHY.bodyRegular,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
    },
    input: {
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.md,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textPrimary,
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    typeList: {
        gap: SPACING.sm,
    },
    typeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: SPACING.md,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.backgroundCard,
    },
    typeItemActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    typeLabel: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textSecondary,
    },
    typeLabelActive: {
        fontFamily: FONTS.bold,
        color: COLORS.white,
    }
});

export default CreateGroupScreen;
