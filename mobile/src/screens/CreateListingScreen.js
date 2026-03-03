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
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import { communityService } from '../services/communityService';
import { supabase } from '../services/supabaseConfig';
import { showSuccessToast } from '../components/Toast';

const CATEGORIES = [
    { id: 'neighborhood_food', label: 'Món ăn hàng xóm', icon: 'restaurant' },
    { id: 'supermarket', label: 'Siêu thị/Cửa hàng', icon: 'store' },
    { id: 'gift', label: 'Đồ tặng/Dư thừa', icon: 'volunteer-activism' }
];

const CreateListingScreen = ({ route, navigation }) => {
    const { prefillItem = null } = route.params || {};

    const [title, setTitle] = useState(prefillItem?.item_name || '');
    const [description, setDescription] = useState('');
    const [type, setType] = useState('sale'); // 'sale' or 'giveaway'
    const [category, setCategory] = useState('neighborhood_food');
    const [price, setPrice] = useState('');
    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [userResidenceId, setUserResidenceId] = useState(null);

    useEffect(() => {
        if (prefillItem) {
            setDescription(`Mình có dư một ít ${prefillItem.item_name}, vẫn còn rất tươi. Ai cần nhắn mình nhé!`);
        }
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
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.8,
        });

        if (!result.canceled) {
            setImages([...images, result.assets[0].uri]);
        }
    };

    const handleSubmit = async () => {
        if (!title || !description || (type === 'sale' && !price)) {
            Alert.alert('Thiếu thông tin', 'Vui lòng điền đầy đủ các thông tin bắt buộc.');
            return;
        }

        if (!userResidenceId) {
            Alert.alert('Chưa chọn khu vực', 'Bạn cần chọn khu cư dân trước khi đăng tin.', [
                { text: 'Chọn ngay', onPress: () => navigation.navigate('LocationSetup') }
            ]);
            return;
        }

        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();

        const listingData = {
            user_id: user.id,
            residence_id: userResidenceId,
            type: type,
            category: category,
            title: title,
            description: description,
            price: type === 'giveaway' ? 0 : parseInt(price),
            images: images,
            status: 'active'
        };

        const result = await communityService.createListing(listingData);
        if (result.success) {
            showSuccessToast('Đã đăng tin thành công!');
            navigation.goBack();
        } else {
            Alert.alert('Lỗi', 'Không thể đăng tin lúc này. Vui lòng thử lại.');
        }
        setLoading(false);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialIcons name="close" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Đăng tin mới</Text>
                <TouchableOpacity onPress={handleSubmit} disabled={loading}>
                    <Text style={[styles.submitText, loading && { opacity: 0.5 }]}>Đăng</Text>
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {/* Images */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
                        {images.map((uri, index) => (
                            <View key={index} style={styles.imagePreview}>
                                <Image source={{ uri }} style={styles.image} />
                                <TouchableOpacity
                                    style={styles.removeImage}
                                    onPress={() => setImages(images.filter((_, i) => i !== index))}
                                >
                                    <MaterialIcons name="cancel" size={20} color={COLORS.white} />
                                </TouchableOpacity>
                            </View>
                        ))}
                        <TouchableOpacity style={styles.addImageBtn} onPress={pickImage}>
                            <MaterialIcons name="add-a-photo" size={32} color={COLORS.textMuted} />
                            <Text style={styles.addImageLabel}>Thêm ảnh</Text>
                        </TouchableOpacity>
                    </ScrollView>

                    {/* Form Fields */}
                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Loại hình</Text>
                            <View style={styles.typeToggle}>
                                <TouchableOpacity
                                    style={[styles.typeBtn, type === 'sale' && styles.typeBtnActive]}
                                    onPress={() => setType('sale')}
                                >
                                    <Text style={[styles.typeBtnText, type === 'sale' && styles.typeBtnTextActive]}>Bán đồ</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.typeBtn, type === 'giveaway' && styles.typeBtnActive]}
                                    onPress={() => { setType('giveaway'); setPrice(''); }}
                                >
                                    <Text style={[styles.typeBtnText, type === 'giveaway' && styles.typeBtnTextActive]}>Tặng miễn phí</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Danh mục</Text>
                            <View style={styles.categoryList}>
                                {CATEGORIES.map(cat => (
                                    <TouchableOpacity
                                        key={cat.id}
                                        style={[styles.catItem, category === cat.id && styles.catItemActive]}
                                        onPress={() => setCategory(cat.id)}
                                    >
                                        <MaterialIcons name={cat.icon} size={20} color={category === cat.id ? COLORS.white : COLORS.textSecondary} />
                                        <Text style={[styles.catLabel, category === cat.id && styles.catLabelActive]}>{cat.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Tiêu đề bài đăng</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Ví dụ: Sườn xào chua ngọt mẹ nấu..."
                                value={title}
                                onChangeText={setTitle}
                            />
                        </View>

                        {type === 'sale' && (
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Giá (VND)</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Ví dụ: 50.000"
                                    keyboardType="numeric"
                                    value={price}
                                    onChangeText={setPrice}
                                />
                            </View>
                        )}

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Mô tả chi tiết</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                placeholder="Chia sẻ thêm về món ăn hoặc đồ dùng bạn muốn đăng..."
                                multiline
                                numberOfLines={4}
                                value={description}
                                onChangeText={setDescription}
                            />
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
    imageScroll: {
        marginBottom: SPACING.xl,
    },
    imagePreview: {
        width: 120,
        height: 80,
        borderRadius: RADIUS.md,
        marginRight: SPACING.sm,
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    removeImage: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 10,
    },
    addImageBtn: {
        width: 120,
        height: 80,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderStyle: 'dashed',
        backgroundColor: COLORS.backgroundCard,
        justifyContent: 'center',
        alignItems: 'center',
    },
    addImageLabel: {
        fontSize: 10,
        color: COLORS.textMuted,
        marginTop: 4,
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
    typeToggle: {
        flexDirection: 'row',
        backgroundColor: COLORS.backgroundCard,
        padding: 4,
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    typeBtn: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: RADIUS.md,
    },
    typeBtnActive: {
        backgroundColor: COLORS.primary,
    },
    typeBtnText: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textSecondary,
    },
    typeBtnTextActive: {
        fontFamily: FONTS.bold,
        color: COLORS.white,
    },
    categoryList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
    },
    catItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: RADIUS.pill,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    catItemActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    catLabel: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    catLabelActive: {
        fontFamily: FONTS.bold,
        color: COLORS.white,
    }
});

export default CreateListingScreen;
