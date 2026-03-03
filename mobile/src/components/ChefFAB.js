import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';

// Context-aware greetings and suggestions for each screen
const SCREEN_CONTEXTS = {
    fridge: {
        greeting: 'Tủ lạnh còn nhiều món lắm, để tôi gợi ý món ngon từ nguyên liệu sẵn có cho bạn nhé! 🥬',
        suggestions: [
            'Gợi ý món từ nguyên liệu',
            'Kiểm tra đồ sắp hết hạn',
            'Mẹo bảo quản thực phẩm'
        ],
        systemPrompt: 'Người dùng đang xem tủ lạnh của họ. Hãy giúp họ tìm món ăn phù hợp với nguyên liệu có sẵn hoặc tư vấn về bảo quản thực phẩm.'
    },
    community: {
        greeting: 'Chợ cư dân hôm nay nhộn nhịp quá! Bạn có muốn tìm món gì hay tặng thực phẩm cho hàng xóm không? 🏘️',
        suggestions: [
            'Tìm thực phẩm quanh đây',
            'Cách đăng tin hiệu quả',
            'Mẹo chia sẻ thực phẩm'
        ],
        systemPrompt: 'Người dùng đang ở trang cộng đồng/chợ. Hãy giúp họ kết nối với hàng xóm và giao dịch thực phẩm an toàn.'
    },
    recipes: {
        greeting: 'Bạn đang tìm cảm hứng nấu nướng? Tôi có hàng ngàn công thức chuẩn vị Việt cho bạn đây! 🍳',
        suggestions: [
            'Tìm công thức mới',
            'Hỏi cách nấu món',
            'Gợi ý thực đơn tuần'
        ],
        systemPrompt: 'Người dùng đang tìm công thức nấu ăn. Hãy gợi ý các món ăn ngon, chia sẻ công thức và mẹo nấu ăn.'
    },
    profile: {
        greeting: 'Chào bạn! Tôi có thể giúp bạn cập nhật hồ sơ sức khỏe hoặc sở thích ăn uống của gia đình đấy. 👤',
        suggestions: [
            'Cập nhật sở thích',
            'Xem hồ sơ bệnh án',
            'Thêm thành viên mới'
        ],
        systemPrompt: 'Người dùng đang xem trang cá nhân. Hãy giúp họ quản lý thông tin thành viên và sở thích ăn uống.'
    },
    default: {
        greeting: 'Chào bạn! Tôi là Bếp Trưởng AI, luôn sẵn sàng đồng hành cùng bạn trong mọi bữa cơm gia đình! 👨‍🍳',
        suggestions: [
            'Hỏi về nấu ăn',
            'Tìm công thức',
            'Mẹo nhà bếp'
        ],
        systemPrompt: 'Hãy giúp người dùng với các câu hỏi về nấu ăn và ẩm thực.'
    }
};

const ChefFAB = ({ screenContext = 'default', extraData = null, style, onPress }) => {
    const navigation = useNavigation();
    const [showBubble, setShowBubble] = useState(false);
    const [bubbleAnim] = useState(new Animated.Value(0));
    const [bounceAnim] = useState(new Animated.Value(1));

    const context = SCREEN_CONTEXTS[screenContext] || SCREEN_CONTEXTS.default;

    useEffect(() => {
        // Start bounce animation immediately for FAB
        const bounce = Animated.loop(
            Animated.sequence([
                Animated.timing(bounceAnim, {
                    toValue: 1.1,
                    duration: 1500,
                    useNativeDriver: true,
                }),
                Animated.timing(bounceAnim, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                }),
            ])
        );
        bounce.start();

        return () => {
            bounce.stop();
        };
    }, []);

    const handlePress = () => {
        if (onPress) {
            onPress();
        } else {
            navigation.navigate('ChefChat', {
                screenContext,
                contextData: {
                    ...context,
                    extraData,
                }
            });
        }
    };

    const handleBubblePress = () => {
        setShowBubble(false);
        handlePress();
    };

    return (
        <View style={[styles.container, style]} pointerEvents="box-none">
            {/* FAB Button */}
            <Animated.View
                style={[
                    styles.fab,
                    { transform: [{ scale: bounceAnim }] }
                ]}
            >
                <TouchableOpacity
                    style={styles.fabTouchable}
                    onPress={handlePress}
                    activeOpacity={0.8}
                >
                    <Text style={styles.fabEmoji}>👨‍🍳</Text>
                </TouchableOpacity>
            </Animated.View>

            {/* Speech Bubble - Render after FAB so it appears on top */}
            {showBubble && (
                <Animated.View
                    style={[
                        styles.bubbleContainer,
                        {
                            opacity: bubbleAnim,
                            transform: [
                                { scale: bubbleAnim },
                                {
                                    translateY: bubbleAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [-20, 0] // Move up from below instead of down
                                    })
                                }
                            ]
                        }
                    ]}
                >
                    <TouchableOpacity style={styles.bubble} onPress={handleBubblePress}>
                        <Text style={styles.bubbleText}>{context.greeting}</Text>
                        <View style={styles.bubbleArrow} />
                    </TouchableOpacity>
                </Animated.View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 110,
        right: SPACING.md,
        alignItems: 'flex-end',
    },
    bubbleContainer: {
        position: 'absolute',
        bottom: 74, // Higher above FAB
        right: 0,
    },
    bubble: {
        backgroundColor: COLORS.backgroundCard,
        paddingHorizontal: SPACING.md,
        paddingVertical: 12,
        borderRadius: RADIUS.lg,
        borderBottomRightRadius: 4, // Arrow point side
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
        maxWidth: 280,
        minWidth: 150,
        borderWidth: 1,
        borderColor: COLORS.primaryMuted,
    },
    bubbleText: {
        ...TYPOGRAPHY.bodyRegular,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
        textAlign: 'right',
    },
    bubbleArrow: {
        position: 'absolute',
        bottom: -8, // Position at bottom of bubble
        right: 20, // Align with center of FAB
        width: 0,
        height: 0,
        borderLeftWidth: 8,
        borderRightWidth: 8,
        borderTopWidth: 8,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: COLORS.backgroundCard,
    },
    fab: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: COLORS.primaryMuted,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 8,
        borderWidth: 3,
        borderColor: COLORS.primary,
    },

    fabTouchable: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fabEmoji: {
        fontSize: 32,
    },
});

export default ChefFAB;
