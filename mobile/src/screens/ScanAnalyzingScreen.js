import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    Animated,
    Easing,
    Dimensions,
    Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import { aiService } from '../services/aiService';
import * as FileSystem from 'expo-file-system/legacy';

const { width, height } = Dimensions.get('window');

const COOKING_STEPS = [
    { icon: 'camera-alt', text: 'Đang xử lý ảnh...' },
    { icon: 'auto-awesome', text: 'Bếp trưởng AI đang nhận diện...' },
    { icon: 'restaurant', text: 'Đang phân tích nguyên liệu...' },
    { icon: 'local-fire-department', text: 'Đang tìm công thức phù hợp...' },
];

const ScanAnalyzingScreen = ({ navigation, route }) => {
    const { imageUri } = route.params || {};

    const spinAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const progressAnim = useRef(new Animated.Value(0)).current;
    const [currentStep, setCurrentStep] = useState(0);
    const [statusText, setStatusText] = useState(COOKING_STEPS[0].text);

    // Spin animation
    useEffect(() => {
        Animated.loop(
            Animated.timing(spinAnim, {
                toValue: 1,
                duration: 2000,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        ).start();
    }, []);

    // Pulse animation
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.15,
                    duration: 800,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 800,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    // Fade in
    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
        }).start();
    }, []);

    // Step progression text
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentStep(prev => {
                const next = (prev + 1) % COOKING_STEPS.length;
                setStatusText(COOKING_STEPS[next].text);
                return next;
            });
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    // Progress bar
    useEffect(() => {
        Animated.timing(progressAnim, {
            toValue: 0.85,
            duration: 8000,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start();
    }, []);

    // Main AI call
    useEffect(() => {
        let mounted = true;

        const analyzeImage = async () => {
            try {
                const base64 = await FileSystem.readAsStringAsync(imageUri, {
                    encoding: 'base64',
                });

                const items = await aiService.extractFromImage(base64);

                if (!mounted) return;

                // Complete the progress bar
                Animated.timing(progressAnim, {
                    toValue: 1,
                    duration: 400,
                    useNativeDriver: false,
                }).start();

                if (items && items.length > 0) {
                    const allNames = items.map(i => i.name || i).join(', ');
                    const initialPrompt = `${allNames}`;
                    const systemPrompt = `Bạn là một chuyên gia ẩm thực chuyên lên thực đơn cho các gia đình Việt Nam.
Nhiệm vụ của bạn là gợi ý các món ăn ngon, thiết thực và bắt buộc phải sử dụng nguyên liệu đầu vào.

NGUYÊN LIỆU CHÍNH: "${allNames}"

RÀNG BUỘC TỐI THƯỢNG:
1. Bạn TUYỆT ĐỐI KHÔNG được gợi ý bất kỳ món ăn nào không có chứa nguyên liệu "${allNames}".
2. Nguyên liệu "${allNames}" phải đóng vai trò là thành phần chính hoặc linh hồn của món ăn, không phải gia vị trang trí.
3. Các món ăn phải thực tế, dễ nấu và phù hợp với khẩu vị bữa cơm gia đình Việt Nam.

ĐỊNH DẠNG ĐẦU RA BẮT BUỘC (JSON):
Trình bày danh sách các món ăn trong 1 đối tượng JSON duy nhất có dạng { "recipes": [ ... ] }.
Với mỗi món ăn, hãy trình bày theo cấu trúc JSON sau:
- "title": Tên món ăn
- "reason": Giải thích ngắn gọn 1 câu về cách "${allNames}" làm nên hương vị món ăn. Tại sao món này phù hợp.
- "ingredients": Mảng các chuỗi, bắt buộc liệt kê "${allNames}" đầu tiên.
- "instructions": Chuỗi mô tả các bước nấu, trong đó chỉ rõ bước chế biến "${allNames}".
- "image_search": Từ khóa tiếng Anh ngắn gọn để tìm ảnh thực tế của món ăn.`;

                    // Short delay for completion animation to be seen
                    setTimeout(() => {
                        if (mounted) {
                            navigation.replace('AIAuto', { initialPrompt, systemPrompt });
                        }
                    }, 600);
                } else {
                    Alert.alert(
                        "Không nhận diện được",
                        "Xin lỗi, Bếp trưởng không nhận ra thực phẩm này. Hãy thử lại gần hơn hoặc rõ nét hơn.",
                        [{ text: "Thử lại", onPress: () => navigation.goBack() }]
                    );
                }
            } catch (error) {
                console.error('Scan Analyze Error:', error);
                if (mounted) {
                    Alert.alert(
                        "Lỗi",
                        "Đã có lỗi xảy ra khi phân tích ảnh. Vui lòng thử lại.",
                        [{ text: "Quay lại", onPress: () => navigation.goBack() }]
                    );
                }
            }
        };

        analyzeImage();
        return () => { mounted = false; };
    }, [imageUri]);

    const spin = spinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const progressWidth = progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    return (
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
            {/* Background blurred image */}
            {imageUri && (
                <Image
                    source={{ uri: imageUri }}
                    style={styles.bgImage}
                    blurRadius={20}
                />
            )}
            <View style={styles.overlay} />

            <View style={styles.content}>
                {/* Captured image preview */}
                {imageUri && (
                    <View style={styles.imagePreviewContainer}>
                        <Image
                            source={{ uri: imageUri }}
                            style={styles.imagePreview}
                            resizeMode="cover"
                        />
                        <View style={styles.imageBorder} />
                    </View>
                )}

                {/* Spinning cooking icon */}
                <View style={styles.iconContainer}>
                    <Animated.View style={[styles.spinnerOuter, { transform: [{ rotate: spin }] }]}>
                        <View style={styles.spinnerDot} />
                        <View style={[styles.spinnerDot, styles.spinnerDot2]} />
                        <View style={[styles.spinnerDot, styles.spinnerDot3]} />
                    </Animated.View>
                    <Animated.View style={[styles.iconCircle, { transform: [{ scale: pulseAnim }] }]}>
                        <MaterialIcons
                            name={COOKING_STEPS[currentStep].icon}
                            size={36}
                            color={COLORS.white}
                        />
                    </Animated.View>
                </View>

                {/* Status text */}
                <Text style={styles.statusTitle}>🍳 Bếp trưởng đang phân tích</Text>
                <Text style={styles.statusText}>{statusText}</Text>

                {/* Progress bar */}
                <View style={styles.progressContainer}>
                    <View style={styles.progressTrack}>
                        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
                    </View>
                </View>

                <Text style={styles.hint}>Vui lòng đợi trong giây lát...</Text>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1A1A2E',
    },
    bgImage: {
        position: 'absolute',
        width: width,
        height: height,
        opacity: 0.3,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(26, 26, 46, 0.75)',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: SPACING.xl * 2,
    },
    imagePreviewContainer: {
        marginBottom: 40,
        position: 'relative',
    },
    imagePreview: {
        width: 160,
        height: 160,
        borderRadius: 24,
    },
    imageBorder: {
        position: 'absolute',
        top: -4,
        left: -4,
        right: -4,
        bottom: -4,
        borderRadius: 28,
        borderWidth: 2,
        borderColor: COLORS.primary,
        opacity: 0.6,
    },
    iconContainer: {
        width: 100,
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    spinnerOuter: {
        position: 'absolute',
        width: 100,
        height: 100,
    },
    spinnerDot: {
        position: 'absolute',
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: COLORS.primary,
        top: 0,
        left: 45,
    },
    spinnerDot2: {
        top: 78,
        left: 12,
        backgroundColor: '#FF6B6B',
    },
    spinnerDot3: {
        top: 78,
        left: 78,
        backgroundColor: '#FFD93D',
    },
    iconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    statusTitle: {
        fontSize: 22,
        fontFamily: FONTS.bold,
        color: COLORS.white,
        marginBottom: 8,
        textAlign: 'center',
    },
    statusText: {
        fontSize: 15,
        fontFamily: FONTS.medium,
        color: 'rgba(255,255,255,0.7)',
        marginBottom: 32,
        textAlign: 'center',
    },
    progressContainer: {
        width: '100%',
        marginBottom: 16,
    },
    progressTrack: {
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
        backgroundColor: COLORS.primary,
    },
    hint: {
        fontSize: 13,
        fontFamily: FONTS.regular,
        color: 'rgba(255,255,255,0.4)',
        textAlign: 'center',
    },
});

export default ScanAnalyzingScreen;
