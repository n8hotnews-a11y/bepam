import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Image,
    TextInput,
    Alert,
    ActivityIndicator,
    Platform,
    KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import { inventoryService } from '../services/inventoryService';
import { supabase } from '../services/supabaseConfig';

const OCRReviewScreen = ({ navigation, route }) => {
    const { image_uri, scannedItems = [] } = route.params || {};

    const [selectedIndices, setSelectedIndices] = useState([]);
    const [saving, setSaving] = useState(false);

    const toggleSelect = (index) => {
        if (selectedIndices.includes(index)) {
            setSelectedIndices(selectedIndices.filter(i => i !== index));
        } else if (selectedIndices.length < 50) {
            setSelectedIndices([...selectedIndices, index]);
        } else {
            Alert.alert('Thông báo', 'Bạn đã chọn quá nhiều mục.');
        }
    };

    const handleConfirmAdd = async () => {
        if (selectedIndices.length === 0) {
            Alert.alert('Thông báo', 'Vui lòng chọn ít nhất 1 thực phẩm để thêm.');
            return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        setSaving(true);
        let successCount = 0;

        try {
            for (const idx of selectedIndices) {
                const item = scannedItems[idx];
                const finalName = item.matchedItem?.name || item.originalLine;
                const finalUnit = item.matchedItem?.unit || item.unit || 'cái';

                const result = await inventoryService.addItem(user.id, {
                    item_name: finalName,
                    amount: item.quantity,
                    unit: finalUnit,
                    category_id: item.matchedItem?.category || 'others',
                });

                if (result.success) successCount++;
            }

            if (successCount > 0) {
                Alert.alert('Thành công', `Đã thêm ${successCount} nguyên liệu vào tủ lạnh!`);
                navigation.navigate('Fridge');
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Lỗi', 'Đã có lỗi xảy ra khi lưu thực phẩm.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <MaterialIcons name="close" size={28} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Xác nhận nguyên liệu</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.previewSection}>
                    {image_uri && (
                        <Image source={{ uri: image_uri }} style={styles.receiptPreview} resizeMode="contain" />
                    )}
                    <View style={styles.overlayText}>
                        <Text style={styles.overlayTitle}>Chúng tôi tìm thấy các món này</Text>
                        <Text style={styles.overlaySubtitle}>Chọn các mục bạn muốn thêm vào tủ lạnh</Text>
                    </View>
                </View>

                <View style={styles.selectionList}>
                    {scannedItems.length > 0 ? (
                        scannedItems.map((item, index) => {
                            const isSelected = selectedIndices.includes(index);
                            return (
                                <TouchableOpacity
                                    key={index}
                                    style={[styles.pollCard, isSelected && styles.pollCardActive]}
                                    onPress={() => toggleSelect(index)}
                                    activeOpacity={0.8}
                                >
                                    <View style={styles.pollCardContent}>
                                        <Text style={styles.originalLine} numberOfLines={1}>"{item.originalLine}"</Text>
                                        <View style={styles.suggestionRow}>
                                            <MaterialIcons
                                                name={item.confidence > 0.7 ? "verified" : "help-outline"}
                                                size={16}
                                                color={item.confidence > 0.7 ? COLORS.primary : COLORS.textMuted}
                                            />
                                            <Text style={styles.suggestedName}>
                                                {item.matchedItem?.name || 'Chưa rõ tên'}
                                            </Text>
                                            <View style={styles.qtyBadge}>
                                                <Text style={styles.qtyText}>{item.quantity} {item.unit}</Text>
                                            </View>
                                        </View>
                                    </View>
                                    <View style={[styles.checkCircle, isSelected && styles.checkCircleActive]}>
                                        {isSelected && <MaterialIcons name="check" size={20} color={COLORS.white} />}
                                    </View>
                                </TouchableOpacity>
                            );
                        })
                    ) : (
                        <View style={styles.emptyState}>
                            <MaterialIcons name="search-off" size={60} color={COLORS.border} />
                            <Text style={styles.emptyText}>Không tìm thấy mục nào khả thi</Text>
                        </View>
                    )}

                    <TouchableOpacity
                        style={styles.manualFallback}
                        onPress={() => navigation.navigate('ManualAdd')}
                    >
                        <Text style={styles.manualFallbackText}>Không tìm thấy? Thêm thủ công</Text>
                        <MaterialIcons name="chevron-right" size={20} color={COLORS.textMuted} />
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.confirmButton, (selectedIndices.length === 0 || saving) && styles.confirmButtonDisabled]}
                    onPress={handleConfirmAdd}
                    disabled={selectedIndices.length === 0 || saving}
                >
                    {saving ? (
                        <ActivityIndicator color={COLORS.white} />
                    ) : (
                        <>
                            <Text style={styles.confirmButtonText}>
                                {selectedIndices.length > 0
                                    ? `Thêm ${selectedIndices.length} món vào tủ lạnh`
                                    : 'Chọn món để tiếp tục'}
                            </Text>
                            <MaterialIcons name="arrow-forward" size={20} color={COLORS.white} />
                        </>
                    )}
                </TouchableOpacity>
            </View>
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
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
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
        color: COLORS.textPrimary,
    },
    scrollContent: {
        paddingBottom: 120,
    },
    previewSection: {
        height: 250,
        backgroundColor: '#f0f0f0',
        position: 'relative',
    },
    receiptPreview: {
        width: '100%',
        height: '100%',
        opacity: 0.6,
    },
    overlayText: {
        position: 'absolute',
        bottom: 20,
        left: SPACING.xl,
        right: SPACING.xl,
    },
    overlayTitle: {
        ...TYPOGRAPHY.heading1,
        color: COLORS.textPrimary,
        fontSize: 24,
    },
    overlaySubtitle: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textSecondary,
        marginTop: 4,
    },
    selectionList: {
        padding: SPACING.xl,
        gap: SPACING.md,
    },
    pollCard: {
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.lg,
        padding: SPACING.lg,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: COLORS.borderLight,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    pollCardActive: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.primaryMuted + '20', // Very light primary
    },
    pollCardContent: {
        flex: 1,
    },
    originalLine: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
        fontStyle: 'italic',
        marginBottom: 4,
    },
    suggestionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    suggestedName: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
        flex: 1,
    },
    qtyBadge: {
        backgroundColor: COLORS.background,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: RADIUS.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    qtyText: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.bold,
        color: COLORS.primary,
    },
    checkCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: COLORS.border,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: SPACING.md,
    },
    checkCircleActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    manualFallback: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: SPACING.md,
        marginTop: SPACING.sm,
    },
    manualFallbackText: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textSecondary,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: COLORS.background,
        padding: SPACING.xl,
        paddingBottom: Platform.OS === 'ios' ? 40 : SPACING.xl,
    },
    confirmButton: {
        backgroundColor: COLORS.primary,
        height: 56,
        borderRadius: RADIUS.pill,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    confirmButtonDisabled: {
        backgroundColor: COLORS.border,
    },
    confirmButtonText: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: COLORS.white,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textMuted,
        marginTop: 12,
    }
});

export default OCRReviewScreen;
