import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Dimensions, Platform, Alert, ScrollView, KeyboardAvoidingView, Image, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import { inventoryService } from '../services/inventoryService';
import { supabase } from '../services/supabaseConfig';
import { familyMemberService } from '../services/familyMemberService';
import DraggableModal from './DraggableModal';

const { height: screenHeight } = Dimensions.get('window');

const CATEGORIES = ['Rau củ', 'Thịt cá', 'Trái cây', 'Gia vị', 'Đồ khô', 'Sữa & Trứng', 'Khác'];

const EditItemModal = ({ visible, onClose, item, onSuccess, onVisibilityChange }) => {
    const [formData, setFormData] = useState({
        item_name: '',
        amount: '',
        unit: 'Kg',
        expiry_date: new Date(),
        category: 'Khác',
        image_url: '',
    });
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (item && visible) {
            setFormData({
                item_name: item.item_name || '',
                amount: item.amount?.toString() || '',
                unit: item.unit || 'Kg',
                expiry_date: item.expiry_date ? new Date(item.expiry_date) : new Date(),
                category: item.category || 'Khác',
                image_url: item.image_url || '',
            });
        }
    }, [item, visible]);

    const handleSave = async () => {
        if (!formData.item_name.trim()) {
            Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên thực phẩm');
            return;
        }

        if (!formData.amount || isNaN(formData.amount) || parseFloat(formData.amount) <= 0) {
            Alert.alert('Thiếu thông tin', 'Vui lòng nhập số lượng hợp lệ');
            return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        const user_id = user?.id;
        if (!user_id || !item) return;

        setSaving(true);

        const updated_ata = {
            item_name: formData.item_name.trim(),
            amount: parseFloat(formData.amount),
            unit: formData.unit,
            expiry_date: formData.expiry_date.toISOString().split('T')[0],
            image_url: formData.image_url?.trim() || null,
        };

        // TODO: Mở comment dòng này khi Supabase đã có cột "category" (Kiểu Text)
        updated_ata.category = formData.category;

        const result = await inventoryService.updateItem(item.id, updated_ata);

        setSaving(false);

        if (result.success) {
            onSuccess && onSuccess();
            onClose();
        } else {
            Alert.alert('Lỗi', result.error || 'Không thể cập nhật thông tin');
        }
    };

    const onDateChange = (event, selectedDate) => {
        const currentDate = selectedDate || formData.expiry_date;
        setShowDatePicker(Platform.OS === 'ios');
        setFormData(prev => ({ ...prev, expiry_date: currentDate }));
    };

    const pickImage = async (useCamera = false) => {
        let result;
        if (useCamera) {
            const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
            if (permissionResult.granted === false) {
                Alert.alert('Lỗi', 'Ứng dụng cần quyền truy cập camera!');
                return;
            }
            result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.5,
            });
        } else {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (permissionResult.granted === false) {
                Alert.alert('Lỗi', 'Ứng dụng cần quyền truy cập thư viện ảnh!');
                return;
            }
            result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.5,
            });
        }

        if (!result.canceled && result.assets && result.assets.length > 0) {
            const uri = result.assets[0].uri;
            uploadImage(uri);
        }
    };

    const uploadImage = async (uri) => {
        setSaving(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setSaving(false);
            return;
        }

        const fileName = `item_${Date.now()}.jpg`;
        const uploadResult = await familyMemberService.uploadFile('avatars', user.id, uri, fileName);

        setSaving(false);
        if (uploadResult.success) {
            setFormData(prev => ({ ...prev, image_url: uploadResult.url }));
        } else {
            Alert.alert('Lỗi', 'Không thể tải ảnh. Vui lòng thử lại!');
        }
    };

    const KeyboardWrapper = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
    const keyboardProps = Platform.OS === 'ios' ? { behavior: 'padding', style: { flex: 1 }, keyboardVerticalOffset: 40 } : { style: { flex: 1 } };

    return (
        <DraggableModal
            visible={visible}
            onClose={onClose}
            onVisibilityChange={onVisibilityChange}
            minHeight={screenHeight * 0.75}
            maxHeight={screenHeight * 0.95}
            initialSnap="max"
        >
            <SafeAreaView style={styles.safeArea} edges={['bottom']}>
                <KeyboardWrapper {...keyboardProps}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <MaterialIcons name="close" size={24} color={COLORS.textPrimary} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Chỉnh sửa thực phẩm</Text>
                        <View style={styles.placeholder} />
                    </View>

                    {/* Form */}
                    <ScrollView
                        style={styles.form}
                        contentContainerStyle={styles.formContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Current Image Demo if any */}
                        {formData.image_url ? (
                            <View style={styles.imagePreviewContainer}>
                                <Image source={{ uri: formData.image_url }} style={styles.imagePreview} />
                            </View>
                        ) : null}

                        {/* Image Selection Actions */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Hình ảnh thực phẩm</Text>
                            <View style={styles.imageActions}>
                                <TouchableOpacity style={styles.imageActionBtn} onPress={() => pickImage(true)}>
                                    <MaterialIcons name="photo-camera" size={24} color={COLORS.primary} />
                                    <Text style={styles.imageActionText}>Chụp ảnh</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.imageActionBtn} onPress={() => pickImage(false)}>
                                    <MaterialIcons name="photo-library" size={24} color={COLORS.primary} />
                                    <Text style={styles.imageActionText}>Thư viện</Text>
                                </TouchableOpacity>

                                {formData.image_url ? (
                                    <TouchableOpacity style={styles.imageRemoveBtn} onPress={() => setFormData(prev => ({ ...prev, image_url: '' }))}>
                                        <MaterialIcons name="delete-outline" size={24} color={COLORS.error || '#E53935'} />
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                        </View>

                        {/* Item Name */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Tên thực phẩm</Text>
                            <View style={styles.inputWrapper}>
                                <MaterialIcons name="shopping-basket" size={24} color={COLORS.primary} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    value={formData.item_name}
                                    onChangeText={(text) => setFormData(prev => ({ ...prev, item_name: text }))}
                                    placeholder="Ví dụ: Thịt gà, Cà rốt..."
                                    placeholderTextColor={COLORS.textMuted}
                                />
                            </View>
                        </View>

                        {/* Category */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Danh mục</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
                                {CATEGORIES.map(cat => (
                                    <TouchableOpacity
                                        key={cat}
                                        style={[styles.categoryChip, formData.category === cat && styles.categoryChipActive]}
                                        onPress={() => setFormData(prev => ({ ...prev, category: cat }))}
                                    >
                                        <Text style={[styles.categoryChipText, formData.category === cat && styles.categoryChipTextActive]}>{cat}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        {/* Expiry Date */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Ngày hết hạn</Text>
                            <TouchableOpacity
                                style={styles.datePickerBtn}
                                onPress={() => setShowDatePicker(true)}
                            >
                                <MaterialIcons name="event" size={22} color={COLORS.primary} />
                                <Text style={styles.dateText}>
                                    {formData.expiry_date.toLocaleDateString('vi-VN')}
                                </Text>
                            </TouchableOpacity>
                            {showDatePicker && (
                                <DateTimePicker
                                    value={formData.expiry_date}
                                    mode="date"
                                    display="default"
                                    onChange={onDateChange}
                                    minimumDate={new Date()}
                                />
                            )}
                        </View>

                        {/* Quantity */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Số lượng</Text>
                            <View style={styles.quantitySection}>
                                <View style={styles.quantityControls}>
                                    <TouchableOpacity
                                        style={styles.stepBtn}
                                        onPress={() => {
                                            const newAmount = Math.max(0, parseFloat(formData.amount || 0) - 0.5).toFixed(1);
                                            setFormData(prev => ({ ...prev, amount: newAmount }));
                                        }}
                                    >
                                        <MaterialIcons name="remove" size={24} color={COLORS.primary} />
                                    </TouchableOpacity>

                                    <TextInput
                                        style={styles.quantityInput}
                                        keyboardType="numeric"
                                        value={formData.amount}
                                        onChangeText={(text) => setFormData(prev => ({ ...prev, amount: text }))}
                                        selectTextOnFocus
                                    />

                                    <TouchableOpacity
                                        style={styles.stepBtn}
                                        onPress={() => {
                                            const newAmount = (parseFloat(formData.amount || 0) + 0.5).toFixed(1);
                                            setFormData(prev => ({ ...prev, amount: newAmount }));
                                        }}
                                    >
                                        <MaterialIcons name="add" size={24} color={COLORS.primary} />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.unitSelector}>
                                    {['Kg', 'Gr', 'Cái', 'Bó', 'Hộp'].map((u) => (
                                        <TouchableOpacity
                                            key={u}
                                            style={[styles.unitChip, formData.unit === u && styles.unitChipActive]}
                                            onPress={() => setFormData(prev => ({ ...prev, unit: u }))}
                                        >
                                            <Text style={[styles.unitText, formData.unit === u && styles.unitTextActive]}>{u}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </View>
                    </ScrollView>

                    {/* Save Button */}
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.saveButton, saving && { opacity: 0.7 }]}
                            onPress={handleSave}
                            disabled={saving}
                        >
                            {saving ? (
                                <View style={styles.savingContainer}>
                                    <ActivityIndicator size="small" color={COLORS.white} />
                                    <Text style={styles.saveButtonText}>Đang lưu...</Text>
                                </View>
                            ) : (
                                <Text style={styles.saveButtonText}>Lưu thay đổi</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardWrapper>
            </SafeAreaView>
        </DraggableModal>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderLight,
    },
    closeButton: {
        width: 40,
        alignItems: 'center',
    },
    headerTitle: {
        ...TYPOGRAPHY.heading1,
        fontFamily: FONTS.bold,
    },
    placeholder: {
        width: 40,
    },
    form: {
        flex: 1,
    },
    formContent: {
        padding: SPACING.xl,
    },
    imagePreviewContainer: {
        alignItems: 'center',
        marginBottom: SPACING.lg,
    },
    imagePreview: {
        width: 100,
        height: 100,
        borderRadius: RADIUS.lg,
        backgroundColor: COLORS.borderLight,
    },
    inputGroup: {
        marginBottom: SPACING.xl,
    },
    label: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.bold,
        color: COLORS.textSecondary,
        marginBottom: SPACING.sm,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.border,
        height: 56,
        paddingHorizontal: SPACING.md,
    },
    inputIcon: {
        marginRight: SPACING.sm,
    },
    input: {
        flex: 1,
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
    },
    categoryScroll: {
        gap: SPACING.sm,
        paddingBottom: SPACING.xs,
    },
    categoryChip: {
        paddingHorizontal: SPACING.md,
        paddingVertical: 8,
        borderRadius: RADIUS.full,
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    categoryChipActive: {
        backgroundColor: COLORS.primaryFade,
        borderColor: COLORS.primary,
    },
    categoryChipText: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.medium,
        color: COLORS.textSecondary,
    },
    categoryChipTextActive: {
        color: COLORS.primary,
        fontFamily: FONTS.bold,
    },
    datePickerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        borderRadius: RADIUS.md,
        height: 52,
        paddingHorizontal: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        gap: SPACING.sm,
    },
    dateText: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
    },
    quantitySection: {
        gap: SPACING.md,
    },
    quantityControls: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        borderRadius: RADIUS.lg,
        padding: 4,
        height: 60,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    stepBtn: {
        width: 52,
        height: 52,
        borderRadius: RADIUS.md,
        backgroundColor: COLORS.primaryMuted,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    quantityInput: {
        flex: 1,
        textAlign: 'center',
        ...TYPOGRAPHY.heading1,
        color: COLORS.textPrimary,
        fontFamily: FONTS.bold,
    },
    unitSelector: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
    },
    unitChip: {
        paddingHorizontal: SPACING.md,
        paddingVertical: 10,
        backgroundColor: COLORS.background,
        borderRadius: RADIUS.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    unitChipActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    unitText: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.bold,
        color: COLORS.textSecondary,
    },
    unitTextActive: {
        color: COLORS.white,
    },
    footer: {
        padding: SPACING.xl,
        paddingBottom: Platform.OS === 'ios' ? 40 : SPACING.xl,
        borderTopWidth: 1,
        borderTopColor: COLORS.borderLight,
        backgroundColor: COLORS.backgroundCard,
    },
    saveButton: {
        backgroundColor: COLORS.primary,
        height: 60,
        borderRadius: RADIUS.lg,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
    },
    saveButtonText: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: COLORS.textOnPrimary,
    },
    savingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    imageActions: {
        flexDirection: 'row',
        gap: SPACING.md,
        alignItems: 'center',
    },
    imageActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: RADIUS.lg,
        height: 52,
        gap: SPACING.sm,
    },
    imageActionText: {
        ...TYPOGRAPHY.bodyRegular,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
    },
    imageRemoveBtn: {
        width: 52,
        height: 52,
        borderRadius: RADIUS.lg,
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.danger || COLORS.error || '#E53935',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default EditItemModal;