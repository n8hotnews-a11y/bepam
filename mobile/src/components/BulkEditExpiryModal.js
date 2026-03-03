import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import { inventoryService } from '../services/inventoryService';
import { showSuccessToast } from './Toast';
import DraggableModal from './DraggableModal';

const { height: screenHeight } = Dimensions.get('window');

const BulkEditExpiryModal = ({ visible, onClose, selectedItems, items = [], onSuccess, onVisibilityChange }) => {
    const [newexpiry_date, setNewexpiry_date] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [saving, setSaving] = useState(false);

    const selectedItemDetails = items.filter(item => selectedItems.has(item.id));

    const handleSave = async () => {
        if (!newexpiry_date) {
            Alert.alert('Thiếu thông tin', 'Vui lòng chọn ngày hết hạn');
            return;
        }

        if (newexpiry_date < new Date()) {
            Alert.alert('Ngày không hợp lệ', 'Ngày hết hạn phải từ ngày mai trở đi');
            return;
        }

        setSaving(true);

        try {
            const formattedDate = newexpiry_date.toISOString().split('T')[0];

            // Update all selected items
            for (const itemId of selectedItems) {
                await inventoryService.updateItem(itemId, {
                    expiry_date: formattedDate
                });
            }

            showSuccessToast(`Đã cập nhật hạn sử dụng cho ${selectedItems.size} thực phẩm`);
            onSuccess && onSuccess();
            onClose();
        } catch (error) {
            Alert.alert('Lỗi', 'Không thể cập nhật hạn sử dụng');
        } finally {
            setSaving(false);
        }
    };

    const onDateChange = (event, selectedDate) => {
        const currentDate = selectedDate || newexpiry_date;
        setShowDatePicker(Platform.OS === 'ios');
        setNewexpiry_date(currentDate);
    };

    return (
        <DraggableModal
            visible={visible}
            onClose={onClose}
            onVisibilityChange={onVisibilityChange}
            minHeight={screenHeight * 0.5}
            maxHeight={screenHeight * 0.66}
        >
            <SafeAreaView style={styles.safeArea} edges={['bottom']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <MaterialIcons name="close" size={24} color={COLORS.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>
                        Cập nhật hạn sử dụng
                    </Text>
                    <View style={styles.placeholder} />
                </View>

                {/* Content */}
                <View style={styles.content}>
                    <Text style={styles.description}>
                        Chọn ngày hết hạn mới cho {selectedItems.size} thực phẩm đã chọn:
                    </Text>

                    {/* Selected Items List */}
                    <View style={styles.selectedItemsContainer}>
                        <Text style={styles.selectedItemsTitle}>Thực phẩm đã chọn:</Text>
                        {selectedItemDetails.slice(0, 5).map((item) => (
                            <View key={item.id} style={styles.selectedItem}>
                                <MaterialIcons name="check-circle" size={16} color={COLORS.primary} />
                                <Text style={styles.selectedItemText} numberOfLines={1}>{item.item_name}</Text>
                                <Text style={styles.selectedItemExpiry}>
                                    (HSD: {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('vi-VN') : 'Chưa có'})
                                </Text>
                            </View>
                        ))}
                        {selectedItemDetails.length > 5 && (
                            <Text style={styles.moreItemsText}>...và {selectedItemDetails.length - 5} thực phẩm khác</Text>
                        )}
                    </View>

                    {/* Date Picker */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Ngày hết hạn mới</Text>
                        <TouchableOpacity
                            style={styles.datePickerBtn}
                            onPress={() => setShowDatePicker(true)}
                        >
                            <MaterialIcons name="event" size={22} color={COLORS.primary} />
                            <Text style={styles.dateText}>
                                {newexpiry_date.toLocaleDateString('vi-VN')}
                            </Text>
                        </TouchableOpacity>
                        {showDatePicker && (
                            <DateTimePicker
                                value={newexpiry_date}
                                mode="date"
                                display="default"
                                onChange={onDateChange}
                                minimumDate={new Date()}
                            />
                        )}
                    </View>

                    {/* Preview */}
                    <View style={styles.previewContainer}>
                        <Text style={styles.previewTitle}>Xem trước:</Text>
                        <Text style={styles.previewText}>
                            Các thực phẩm sẽ có hạn sử dụng: {newexpiry_date.toLocaleDateString('vi-VN')}
                        </Text>
                    </View>
                </View>

                {/* Save Button */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.saveButton, saving && { opacity: 0.7 }]}
                        onPress={handleSave}
                        disabled={saving}
                    >
                        {saving ? (
                            <View style={styles.savingContainer}>
                                <Text style={styles.saveButtonText}>Đang cập nhật...</Text>
                            </View>
                        ) : (
                            <Text style={styles.saveButtonText}>
                                Cập nhật {selectedItems.size} thực phẩm
                            </Text>
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
    },
    headerTitle: {
        ...TYPOGRAPHY.heading1,
        fontFamily: FONTS.bold,
    },
    placeholder: {
        width: 40,
    },
    content: {
        flex: 1,
        padding: SPACING.xl,
    },
    description: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textPrimary,
        marginBottom: SPACING.lg,
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
    previewContainer: {
        backgroundColor: COLORS.background,
        borderRadius: RADIUS.md,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
    },
    previewTitle: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.bold,
        color: COLORS.textSecondary,
        marginBottom: SPACING.xs,
    },
    previewText: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textPrimary,
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
    selectedItemsContainer: {
        marginBottom: SPACING.lg,
    },
    selectedItemsTitle: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.bold,
        color: COLORS.textSecondary,
        marginBottom: SPACING.sm,
    },
    selectedItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.xs,
        gap: SPACING.sm,
    },
    selectedItemText: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textPrimary,
        flex: 1,
    },
    selectedItemExpiry: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
    },
    moreItemsText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
        fontStyle: 'italic',
        marginTop: 4,
    }
});

export default BulkEditExpiryModal;