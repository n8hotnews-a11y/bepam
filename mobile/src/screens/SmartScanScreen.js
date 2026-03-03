import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { Camera, CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, FONTS } from '../constants/theme';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { aiService } from '../services/aiService';

const SmartScanScreen = ({ navigation }) => {
    const [permission, requestPermission] = useCameraPermissions();
    const [flash, setFlash] = useState('off');
    const [analyzing, setAnalyzing] = useState(false);
    const cameraRef = useRef(null);

    // If permissions not granted/loaded yet
    if (!permission) return <View />;
    if (!permission.granted) {
        return (
            <View style={styles.permissionContainer}>
                <Text style={styles.message}>Cần cấp quyền camera để nhận diện thực phẩm</Text>
                <TouchableOpacity onPress={requestPermission} style={styles.permissionButton}>
                    <Text style={styles.permissionButtonText}>Cấp quyền</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const processImage = async (uri) => {
        setAnalyzing(true);
        try {
            console.log('Processing image:', uri);
            const base64 = await FileSystem.readAsStringAsync(uri, {
                encoding: 'base64',
            });

            // Call AI Service (unified logic)
            const items = await aiService.extractFromImage(base64);

            if (items && items.length > 0) {
                // items is array of objects {name, quantity...} from aiService
                navigateToSuggestions(items);
            } else {
                Alert.alert("Không nhận diện được", "Xin lỗi, tôi không nhận ra thực phẩm này. Hãy thử lại gần hơn hoặc rõ nét hơn.");
            }

        } catch (error) {
            console.error('Scan Error:', error);
            Alert.alert("Lỗi", "Đã có lỗi xảy ra khi phân tích ảnh: " + error.message);
        } finally {
            setAnalyzing(false);
        }
    };

    const navigateToSuggestions = (items) => {
        const mainItem = items[0];
        const itemName = mainItem.name || mainItem; // Handle object or string

        Alert.alert(
            "Đã thấy!",
            `Có vẻ đây là ${itemName}. Bạn có muốn xem thêm các món ngon từ nguyên liệu này không?`,
            [
                { text: "Thử lại", style: 'cancel' },
                {
                    text: "Xem công thức", onPress: () => {
                        navigation.navigate('Main', {
                            screen: 'Recipes',
                            params: {
                                searchQuery: itemName,
                                cuisine: 'vietnamese'
                            }
                        });
                    }
                }
            ]
        );
    };

    const handleCapture = async () => {
        if (cameraRef.current) {
            const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });
            processImage(photo.uri);
        }
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.5,
        });

        if (!result.canceled) {
            processImage(result.assets[0].uri);
        }
    };

    return (
        <View style={styles.container}>
            <CameraView
                style={styles.camera}
                ref={cameraRef}
                flash={flash}
            >
                <SafeAreaView style={styles.overlay}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
                            <MaterialIcons name="close" size={28} color={COLORS.white} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Quét thực phẩm</Text>
                        <View style={{ width: 40 }} />
                    </View>

                    <View style={styles.centerFocus}>
                        <View style={styles.focusFrame} />
                        <Text style={styles.hintText}>Chụp ảnh thực phẩm để nhận gợi ý món Việt</Text>
                    </View>

                    <View style={styles.controls}>
                        <TouchableOpacity onPress={pickImage} style={styles.galleryBtn}>
                            <MaterialIcons name="photo-library" size={28} color={COLORS.white} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.captureBtn}
                            onPress={handleCapture}
                            disabled={analyzing}
                        >
                            {analyzing ? (
                                <ActivityIndicator size="large" color={COLORS.primary} />
                            ) : (
                                <View style={styles.captureInner} />
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => setFlash(f => f === 'off' ? 'on' : 'off')} style={styles.flashBtn}>
                            <MaterialIcons name={flash === 'on' ? "flash-on" : "flash-off"} size={28} color={COLORS.white} />
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </CameraView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'black' },
    camera: { flex: 1 },
    overlay: { flex: 1, justifyContent: 'space-between' },
    permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    message: { marginBottom: 20, fontSize: 16 },
    permissionButton: { padding: 10, backgroundColor: COLORS.primary, borderRadius: 8 },
    permissionButtonText: { color: COLORS.white },

    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.md,
    },
    headerTitle: {
        color: COLORS.white,
        fontSize: 18,
        fontFamily: FONTS.bold,
    },
    centerFocus: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    focusFrame: {
        width: 280,
        height: 280,
        borderWidth: 2,
        borderColor: COLORS.primary,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginBottom: 20,
    },
    hintText: {
        color: COLORS.white,
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 8,
        borderRadius: 8,
    },
    controls: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingBottom: 40,
        backgroundColor: 'rgba(0,0,0,0.3)',
        paddingTop: 20,
    },
    captureBtn: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    captureInner: {
        width: 70,
        height: 70,
        borderRadius: 35,
        borderWidth: 2,
        borderColor: COLORS.black,
        backgroundColor: COLORS.white,
    }
});

export default SmartScanScreen;
