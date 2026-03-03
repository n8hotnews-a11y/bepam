import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, Image, Platform, Dimensions, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { inventoryService } from '../services/inventoryService';
import { shoppingListService } from '../services/shoppingListService';
import { supabase } from '../services/supabaseConfig';

const { width } = Dimensions.get('window');

const CATEGORIES = [
    { id: 'vegetables', name: 'Rau củ', icon: 'eco' },
    { id: 'meat', name: 'Thịt', icon: 'kebab-dining' },
    { id: 'seafood', name: 'Hải sản', icon: 'set-meal' },
    { id: 'fruits', name: 'Trái cây', icon: 'apple' },
    { id: 'dairy', name: 'Sữa & Bơ', icon: 'egg' },
    { id: 'spices', name: 'Gia vị', icon: 'grain' },
    { id: 'others', name: 'Khác', icon: 'more-horiz' },
];

const ManualAddScreen = ({ navigation, route }) => {
    const { mode } = route.params || {};
    const isShoppingMode = mode === 'shopping_list';

    const [item_name, setItem_name] = useState('');
    const [category, setCategory] = useState('vegetables');
    const [amount, setAmount] = useState('1');
    const [unit, setUnit] = useState('Kg');
    const [expiry_date, setexpiry_date] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [image, setImage] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (route.params?.scannedItem) {
            const { name, quantity, unit, expiry_date, category_id } = route.params.scannedItem;
            if (name) setItem_name(name);
            if (quantity) setAmount(String(quantity));
            if (unit) setUnit(unit);

            if (expiry_date) {
                // Try to parse date
                const date = new Date(expiry_date);
                if (!isNaN(date.getTime())) {
                    setexpiry_date(date);
                }
            }

            if (category_id && CATEGORIES.some(c => c.id === category_id)) {
                setCategory(category_id);
            }
        }

        if (route.params?.scannedImage) {
            setImage(route.params.scannedImage);
        }
    }, [route.params]);

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Quyền truy cập', 'Chúng tôi cần quyền truy cập thư viện ảnh để thêm hình ảnh thực phẩm.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaType.IMAGE,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Quyền truy cập', 'Chúng tôi cần quyền sử dụng camera để chụp ảnh thực phẩm.');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    const onDateChange = (event, selectedDate) => {
        const currentDate = selectedDate || expiry_date;
        setShowDatePicker(Platform.OS === 'ios');
        setexpiry_date(currentDate);
    };

    const handleSave = async () => {
        if (!item_name) {
            Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên thực phẩm');
            return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        const user_id = user?.id;
        if (!user_id) return;

        setLoading(true);
        let result;

        if (isShoppingMode) {
            result = await shoppingListService.addItem(user_id, {
                item_name,
                category_id: category, // optional if shopping list supports it
                amount: parseFloat(amount),
                unit,
            });
        } else {
            result = await inventoryService.addItem(user_id, {
                item_name,
                category_id: category,
                amount: parseFloat(amount),
                unit,
                expiry_date: expiry_date.toISOString().split('T')[0],
                image_url: image
            });
        }

        setLoading(false);
        if (result.success) {
            Alert.alert('Thành công', isShoppingMode ? 'Đã thêm vào danh sách mua sắm!' : 'Đã thêm thực phẩm vào tủ lạnh!', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } else {
            Alert.alert('Lỗi', result.error || 'Không thể thêm thực phẩm');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <MaterialIcons name="chevron-left" size={32} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{isShoppingMode ? 'Thêm món cần mua' : 'Thêm thực phẩm'}</Text>
                <View style={styles.placeholder} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    {/* Photo Section */}
                    <View style={styles.photoSection}>
                        <TouchableOpacity
                            style={[styles.photoButton, image && styles.photoButtonActive]}
                            onPress={() => {
                                Alert.alert('Thêm hình ảnh', 'Chọn nguồn ảnh', [
                                    { text: 'Chụp ảnh', onPress: takePhoto },
                                    { text: 'Thư viện', onPress: pickImage },
                                    { text: 'Hủy', style: 'cancel' }
                                ]);
                            }}
                        >
                            {image ? (
                                <Image source={{ uri: image }} style={styles.selectedImage} />
                            ) : (
                                <>
                                    <View style={styles.cameraIconCircle}>
                                        <MaterialIcons name="camera-alt" size={32} color={COLORS.primary} />
                                    </View>
                                    <Text style={styles.photoText}>Chụp ảnh thực phẩm để AI nhận diện nhanh hơn</Text>
                                </>
                            )}
                            {image && (
                                <TouchableOpacity style={styles.removeImageBtn} onPress={() => setImage(null)}>
                                    <MaterialIcons name="close" size={20} color={COLORS.danger} />
                                </TouchableOpacity>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Input Section */}
                    <View style={styles.inputSection}>
                        <Text style={styles.sectionTitle}>Tên thực phẩm</Text>
                        <View style={styles.inputWrapper}>
                            <MaterialIcons name="shopping-basket" size={24} color={COLORS.primary} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Ví dụ: Thịt bò, Cà rốt..."
                                placeholderTextColor={COLORS.textMuted}
                                value={item_name}
                                onChangeText={setItem_name}
                            />
                        </View>
                    </View>

                    {/* Category Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Danh mục</Text>
                        <View style={styles.categoryGrid}>
                            {CATEGORIES.map((cat) => (
                                <TouchableOpacity
                                    key={cat.id}
                                    style={[styles.categoryButton, category === cat.id && styles.activeCategoryButton]}
                                    onPress={() => setCategory(cat.id)}
                                >
                                    <View style={[styles.categoryIconCircle, category === cat.id && styles.activeCategoryIconCircle]}>
                                        <MaterialIcons
                                            name={cat.icon}
                                            size={24}
                                            color={category === cat.id ? COLORS.white : COLORS.primary}
                                        />
                                    </View>
                                    <Text style={[styles.categoryLabel, category === cat.id && styles.activeCategoryLabel]}>
                                        {cat.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Date & Quantity Section */}
                    <View style={styles.section}>
                        <View style={styles.detailCard}>
                            {!isShoppingMode && (
                                <View style={styles.detailItem}>
                                    <Text style={styles.label}>Ngày hết hạn</Text>
                                    <TouchableOpacity
                                        style={styles.datePickerBtn}
                                        onPress={() => setShowDatePicker(true)}
                                    >
                                        <MaterialIcons name="event" size={22} color={COLORS.primary} />
                                        <Text style={styles.dateText}>
                                            {expiry_date.toLocaleDateString('vi-VN')}
                                        </Text>
                                    </TouchableOpacity>
                                    {showDatePicker && (
                                        <DateTimePicker
                                            value={expiry_date}
                                            mode="date"
                                            display="default"
                                            onChange={onDateChange}
                                            minimumDate={new Date()}
                                        />
                                    )}
                                </View>
                            )}

                            <View style={[styles.quantitySection, isShoppingMode && { borderTopWidth: 0, paddingTop: 0 }]}>
                                <View style={styles.quantityHeader}>
                                    <Text style={styles.label}>Số lượng</Text>
                                    <Text style={styles.quantityDisplay}>{amount} {unit || 'đơn vị'}</Text>
                                </View>

                                <View style={styles.quantityControls}>
                                    <View style={styles.stepper}>
                                        <TouchableOpacity
                                            style={styles.stepBtnActive}
                                            onPress={() => setAmount(Math.max(0, parseFloat(amount) - 0.5).toString())}
                                        >
                                            <MaterialIcons name="remove" size={24} color={COLORS.primary} />
                                        </TouchableOpacity>
                                        <TextInput
                                            style={styles.quantityInput}
                                            keyboardType="numeric"
                                            value={amount}
                                            onChangeText={setAmount}
                                        />
                                        <TouchableOpacity
                                            style={styles.stepBtnActive}
                                            onPress={() => setAmount((parseFloat(amount) + 0.5).toString())}
                                        >
                                            <MaterialIcons name="add" size={24} color={COLORS.primary} />
                                        </TouchableOpacity>
                                    </View>


                                </View>
                            </View>

                            {/* Unit Input inside detailCard */}
                            <View style={styles.detailItem}>
                                <Text style={styles.label}>Đơn vị</Text>
                                <View style={styles.inputWrapper}>
                                    <MaterialIcons name="scale" size={24} color={COLORS.primary} style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Ví dụ: Kg, Gr, Cái..."
                                        placeholderTextColor={COLORS.textMuted}
                                        value={unit}
                                        onChangeText={setUnit}
                                    />
                                </View>
                            </View>
                        </View>
                    </View>

                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.saveBtn, loading && { opacity: 0.7 }]}
                            onPress={handleSave}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color={COLORS.white} />
                            ) : (
                                <Text style={styles.saveBtnText}>{isShoppingMode ? 'Thêm vào danh sách' : 'Lưu vào tủ lạnh'}</Text>
                            )}
                        </TouchableOpacity>
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
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
        backgroundColor: COLORS.backgroundCard,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    backButton: {
        width: 40,
    },
    headerTitle: {
        ...TYPOGRAPHY.heading1,
    },
    placeholder: {
        width: 40,
    },

    photoSection: {
        alignItems: 'center',
        paddingVertical: SPACING.lg,
    },
    photoButton: {
        width: width - SPACING.xl * 2,
        height: 200,
        borderRadius: RADIUS.xxl,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: COLORS.primaryMuted,
        backgroundColor: COLORS.backgroundCard,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    photoButtonActive: {
        borderStyle: 'solid',
        borderColor: COLORS.primary,
    },
    cameraIconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: COLORS.primaryMuted,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    photoText: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textSecondary,
        textAlign: 'center',
        paddingHorizontal: SPACING.xl,
        lineHeight: 20,
    },
    selectedImage: {
        width: '100%',
        height: '100%',
    },
    removeImageBtn: {
        position: 'absolute',
        top: SPACING.md,
        right: SPACING.md,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: RADIUS.sm,
        padding: 4,
    },
    section: {
        marginTop: SPACING.lg,
        paddingHorizontal: SPACING.xl,
    },
    inputSection: {
        paddingHorizontal: SPACING.xl,
        marginTop: SPACING.sm,
    },
    sectionTitle: {
        ...TYPOGRAPHY.heading2,
        marginBottom: SPACING.sm,
        marginLeft: 4,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.backgroundCard,
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
    categoryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
    },
    categoryButton: {
        width: (width - SPACING.xl * 2 - SPACING.sm * 2) / 3,
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.xl,
        padding: SPACING.sm,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        gap: SPACING.sm,
    },
    activeCategoryButton: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.background,
    },
    categoryIconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    activeCategoryIconCircle: {
        backgroundColor: COLORS.primary,
    },
    categoryLabel: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.bold,
        color: COLORS.textSecondary,
    },
    activeCategoryLabel: {
        color: COLORS.primary,
    },
    detailCard: {
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.xl,
        padding: SPACING.lg,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    detailItem: {
        marginBottom: SPACING.lg,
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
    quantitySection: {
        paddingTop: SPACING.lg,
        borderTopWidth: 1,
        borderTopColor: COLORS.borderLight,
    },
    quantityHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    quantityDisplay: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: COLORS.primary,
    },
    quantityControls: {
        gap: SPACING.lg,
    },
    stepper: {
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
        backgroundColor: COLORS.backgroundCard,
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepBtnActive: {
        width: 52,
        height: 52,
        borderRadius: RADIUS.md,
        backgroundColor: COLORS.backgroundCard,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
        borderWidth: 1,
        borderColor: COLORS.primaryMuted,
    },
    quantityInput: {
        flex: 1,
        textAlign: 'center',
        ...TYPOGRAPHY.heading1,
        color: COLORS.textPrimary,
    },

    footer: {
        marginTop: SPACING.xl,
        paddingHorizontal: SPACING.xl,
        paddingBottom: Platform.OS === 'ios' ? 40 : SPACING.xl,
    },
    saveBtn: {
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
    saveBtnText: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: COLORS.textOnPrimary,
    },
});

export default ManualAddScreen;
