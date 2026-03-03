import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';

const OTPSuccessScreen = ({ navigation }) => {
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.mainContent}>
                <View style={styles.successVisual}>
                    <View style={styles.blurBg} />
                    <View style={styles.successCircle}>
                        <MaterialIcons
                            name="check"
                            size={64}
                            color={COLORS.textOnPrimary}
                        />
                    </View>
                </View>

                <View style={styles.textSection}>
                    <Text style={styles.title}>Xác thực thành công!</Text>
                    <Text style={styles.description}>
                        Chào mừng bạn đến với Cơm Nhà. Bạn đã sẵn sàng để quản lý tủ lạnh thông minh và giảm lãng phí thực phẩm chưa?
                    </Text>
                </View>

                <View style={styles.illustrationWrapper}>
                    <Image
                        source={{ uri: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=2070&auto=format&fit=crop' }}
                        style={styles.illustration}
                        resizeMode="contain"
                    />
                </View>
            </View>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.startButton}
                    onPress={() => navigation.navigate('Main')}
                >
                    <Text style={styles.startButtonText}>Bắt đầu ngay</Text>
                    <MaterialIcons name="arrow-forward" size={24} color={COLORS.textOnPrimary} />
                </TouchableOpacity>
                <View style={styles.bottomIndicator} />
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    mainContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: SPACING.xl,
    },
    successVisual: {
        marginBottom: SPACING.xxl,
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
    },
    blurBg: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: COLORS.primaryMuted,
    },
    successCircle: {
        width: 128,
        height: 128,
        borderRadius: 64,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
    },
    textSection: {
        alignItems: 'center',
        gap: SPACING.md,
    },
    title: {
        ...TYPOGRAPHY.display1,
        color: COLORS.textPrimary,
        textAlign: 'center',
    },
    description: {
        ...TYPOGRAPHY.bodyLarge,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
    },
    illustrationWrapper: {
        marginTop: SPACING.xxl,
        width: '100%',
        height: 200,
        opacity: 0.2,
    },
    illustration: {
        width: '100%',
        height: '100%',
    },
    footer: {
        padding: SPACING.xl,
        paddingBottom: Platform.OS === 'ios' ? 40 : SPACING.xl,
    },
    startButton: {
        backgroundColor: COLORS.primary,
        height: 60,
        borderRadius: RADIUS.lg,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: SPACING.sm,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    startButtonText: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: COLORS.textOnPrimary,
    },
    bottomIndicator: {
        width: 128,
        height: 6,
        backgroundColor: COLORS.borderLight,
        borderRadius: 3,
        alignSelf: 'center',
        marginTop: SPACING.xl,
    },
});

export default OTPSuccessScreen;
