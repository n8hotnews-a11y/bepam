import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Dimensions, Platform, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import { inventoryService } from '../services/inventoryService';
import { supabase } from '../services/supabaseConfig';
import DraggableModal from './DraggableModal';

const { height: screenHeight } = Dimensions.get('window');

const EditItemModal = ({ visible, onClose, item, onSuccess, onVisibilityChange }) => {
    const [formData, setFormData] = useState({
        item_name: '',
        amount: '',
        unit: 'Kg',
        expiry_date: new Date(),
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
        };

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

    return (
        <DraggableModal
            visible={visible}
            onClose={onClose}
            onVisibilityChange={onVisibilityChange}
            minHeight={screenHeight * 0.6}
            maxHeight={screenHeight * 0.9}
        >
            <SafeAreaView style={styles.safeArea} edges={['bottom']}>
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
                >
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
                                <Text style={styles.saveButtonText}>Đang lưu...</Text>
                            </View>
                        ) : (
                            <Text style={styles.saveButtonText}>Lưu thay đổi</Text>
                        )}
                    </TouchableOpacity>
                </View>
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
});

export default EditItemModal;