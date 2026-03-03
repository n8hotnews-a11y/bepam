import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import * as ImagePicker from 'expo-image-picker';
import { readAsStringAsync } from 'expo-file-system/legacy';
import { BlurView } from 'expo-blur';
import { aiService } from '../services/aiService';

const OCRScanScreen = ({ navigation }) => {
    const [permission, requestPermission] = useCameraPermissions();
    const [flash, setFlash] = useState('off');
    const [processing, setProcessing] = useState(false);
    const cameraRef = useRef(null);

    if (!permission) {
        return <View />;
    }

    if (!permission.granted) {
        return (
            <View style={styles.permissionContainer}>
                <Text style={styles.message}>Chúng tôi cần quyền truy cập camera để quét nhãn thực phẩm</Text>
                <TouchableOpacity onPress={requestPermission} style={styles.permissionButton}>
                    <Text style={styles.permissionButtonText}>Cấp quyền</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const processImage = async (uri) => {
        try {
            setProcessing(true);
            console.log('📸 Processing photo:', uri);

            const base64 = await readAsStringAsync(uri, {
                encoding: 'base64',
            });

            // Call AI Service directly
            const items = await aiService.extractFromImage(base64);

            setProcessing(false);

            if (items && items.length > 0) {
                // Take the first detected item
                const item = items[0];
                navigation.replace('ManualAdd', {
                    scannedItem: item,
                    scannedImage: uri
                });
            } else {
                Alert.alert(
                    'Không tìm thấy thông tin',
                    'AI không thể đọc được nhãn. Vui lòng thử lại hoặc nhập thủ công.',
                    [
                        { text: 'Thử lại', style: 'cancel' },
                        { text: 'Nhập thủ công', onPress: () => navigation.replace('ManualAdd', { image: uri }) }
                    ]
                );
            }

        } catch (error) {
            console.error('❌ Processing error:', error);
            setProcessing(false);
            Alert.alert('Lỗi', 'Không thể xử lý ảnh: ' + error.message);
        }
    };

    const handleCapture = async () => {
        if (cameraRef.current) {
            try {
                const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
                await processImage(photo.uri);
            } catch (error) {
                console.error('❌ Capture error:', error);
                Alert.alert('Lỗi', 'Không thể chụp ảnh: ' + error.message);
            }
        }
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.8,
        });

        if (!result.canceled) {
            await processImage(result.assets[0].uri);
        }
    };

    return (
        <View style={styles.container}>
            <CameraView
                style={styles.camera}
                ref={cameraRef}
                flash={flash}
            />

            <View style={styles.overlayContainer} pointerEvents="box-none">
                <SafeAreaView style={styles.overlay}>
                    {/* Top Bar */}
                    <View style={styles.topBar}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
                            <MaterialIcons name="arrow-back-ios-new" size={24} color={COLORS.white} />
                        </TouchableOpacity>
                        <View style={styles.topActions}>
                            <TouchableOpacity
                                style={styles.iconButton}
                                onPress={() => setFlash(flash === 'off' ? 'on' : 'off')}
                            >
                                <MaterialIcons
                                    name={flash === 'on' ? "flash-on" : "flash-off"}
                                    size={24}
                                    color={COLORS.white}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Viewfinder Frame */}
                    <View style={styles.viewfinderContainer}>
                        <View style={styles.mask} />
                        <View style={styles.middleRow}>
                            <View style={styles.maskSide} />
                            <View style={styles.frame}>
                                <View style={[styles.corner, styles.topLeft]} />
                                <View style={[styles.corner, styles.topRight]} />
                                <View style={[styles.corner, styles.bottomLeft]} />
                                <View style={[styles.corner, styles.bottomRight]} />
                                <View style={styles.scanLine} />
                            </View>
                            <View style={styles.maskSide} />
                        </View>
                        <View style={styles.mask} />
                    </View>

                    {/* Instructions */}
                    <View style={styles.instructionContainer}>
                        <View style={styles.tipBox}>
                            <Text style={styles.tipText}>Chụp rõ nhãn sản phẩm (Tên, Hạn sử dụng)</Text>
                        </View>
                    </View>

                    {/* Bottom Controls */}
                    <View style={styles.bottomControls}>
                        <View style={styles.controlRow}>
                            <TouchableOpacity style={styles.sideControl} onPress={pickImage}>
                                <MaterialIcons name="image" size={28} color={COLORS.white} />
                                <Text style={styles.sideControlText}>THƯ VIỆN</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.captureButton}
                                onPress={handleCapture}
                                disabled={processing}
                            >
                                <View style={styles.captureButtonInner}>
                                    <MaterialIcons name="camera-alt" size={32} color={COLORS.textPrimary} />
                                </View>
                            </TouchableOpacity>

                            <View style={{ width: 40 }} />
                        </View>
                    </View>
                </SafeAreaView>
            </View>

            {/* Full screen Loading Overlay */}
            {processing && (
                <View style={styles.loadingOverlay}>
                    <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill}>
                        <View style={styles.loadingContent}>
                            <ActivityIndicator size="large" color={COLORS.primary} />
                            <Text style={styles.loadingText}>Đang quét thông tin...</Text>
                            <Text style={styles.loadingSubtext}>AI đang đọc nhãn sản phẩm</Text>

                            {/* Scanning Animation Effect */}
                            <View style={styles.scanLineContainer}>
                                <View style={styles.scanLineAnimated} />
                            </View>
                        </View>
                    </BlurView>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.black,
    },
    camera: {
        flex: 1,
    },
    overlayContainer: {
        ...StyleSheet.absoluteFillObject,
    },
    overlay: {
        flex: 1,
        justifyContent: 'space-between',
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.md,
        paddingTop: SPACING.sm,
    },
    topActions: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    iconButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    viewfinderContainer: {
        flex: 1,
    },
    mask: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    middleRow: {
        flexDirection: 'row',
        height: '60%',
    },
    maskSide: {
        width: 30,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    frame: {
        flex: 1,
        borderWidth: 1,
        borderColor: COLORS.primary,
        borderRadius: RADIUS.md,
        position: 'relative',
        overflow: 'hidden',
    },
    corner: {
        position: 'absolute',
        width: 24,
        height: 24,
        borderColor: COLORS.white,
    },
    topLeft: {
        top: 0,
        left: 0,
        borderTopWidth: 4,
        borderLeftWidth: 4,
        borderTopLeftRadius: RADIUS.md,
    },
    topRight: {
        top: 0,
        right: 0,
        borderTopWidth: 4,
        borderRightWidth: 4,
        borderTopRightRadius: RADIUS.md,
    },
    bottomLeft: {
        bottom: 0,
        left: 0,
        borderBottomWidth: 4,
        borderLeftWidth: 4,
        borderBottomLeftRadius: RADIUS.md,
    },
    bottomRight: {
        bottom: 0,
        right: 0,
        borderBottomWidth: 4,
        borderRightWidth: 4,
        borderBottomRightRadius: RADIUS.md,
    },
    scanLine: {
        height: 2,
        width: '100%',
        backgroundColor: COLORS.primary,
        position: 'absolute',
        top: '50%',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 10,
    },
    instructionContainer: {
        alignItems: 'center',
        marginTop: SPACING.md,
    },
    tipBox: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: SPACING.xl,
        paddingVertical: 10,
        borderRadius: RADIUS.pill,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    tipText: {
        color: COLORS.white,
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.medium,
    },
    bottomControls: {
        paddingBottom: 40,
        paddingTop: SPACING.lg,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    controlRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 40,
    },
    captureButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: COLORS.white,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
    },
    captureButtonInner: {
        width: 64,
        height: 64,
        borderRadius: 32,
        borderWidth: 4,
        borderColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.white,
    },
    sideControl: {
        alignItems: 'center',
        gap: 4,
        width: 60,
    },
    sideControlText: {
        color: 'rgba(255,255,255,0.9)',
        ...TYPOGRAPHY.caption,
        fontSize: 10,
        fontFamily: FONTS.bold,
        letterSpacing: 1,
    },
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        padding: SPACING.xl,
    },
    message: {
        textAlign: 'center',
        marginBottom: SPACING.lg,
        ...TYPOGRAPHY.bodyLarge,
        color: COLORS.textPrimary,
    },
    permissionButton: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: SPACING.xl,
        paddingVertical: 12,
        borderRadius: RADIUS.md,
    },
    permissionButtonText: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: COLORS.textOnPrimary,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 999,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: COLORS.white,
        ...TYPOGRAPHY.h3,
        marginTop: 20,
    },
    loadingSubtext: {
        color: 'rgba(255,255,255,0.8)',
        ...TYPOGRAPHY.bodyLarge,
        marginTop: 10,
    },
    scanLineContainer: {
        width: 200,
        height: 2,
        backgroundColor: 'rgba(255,255,255,0.2)',
        marginTop: 40,
        overflow: 'hidden',
    },
    scanLineAnimated: {
        width: '100%',
        height: '100%',
        backgroundColor: COLORS.primary,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 10,
    }
});

export default OCRScanScreen;
