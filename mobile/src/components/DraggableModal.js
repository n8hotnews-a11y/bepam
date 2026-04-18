import React, { useRef, useEffect, useState } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Animated,
    Dimensions,
    PanResponder,
    Platform
} from 'react-native';
import { COLORS, RADIUS } from '../constants/theme';

const { height: screenHeight } = Dimensions.get('window');

const DraggableModal = ({
    visible,
    onClose,
    children,
    minHeight = screenHeight * 0.4,
    maxHeight = screenHeight * 0.66,
    initialSnap = 'min', // 'min' or 'max' — cho phép caller chọn trạng thái mở đầu
    onVisibilityChange
}) => {
    const baseTranslateY = maxHeight - minHeight;
    const translateY = useRef(new Animated.Value(screenHeight)).current;
    const [state, setState] = useState('min');
    // Track if we're scrolling content (not dragging the sheet)
    const isScrolling = useRef(false);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (evt, gestureState) => {
                // Take over when dragging vertically with enough movement
                // But only if dragging DOWN or we're at the top of scroll
                return Math.abs(gestureState.dy) > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
            },
            onPanResponderGrant: () => {
                translateY.stopAnimation();
                translateY.extractOffset();
            },
            onPanResponderMove: (evt, gestureState) => {
                // Only allow dragging DOWN (to collapse/close), prevent dragging UP past maxHeight
                const currentOffset = translateY._offset || 0;
                const newY = currentOffset + gestureState.dy;
                
                // Clamp: don't allow dragging above maxHeight (translateY = 0)
                if (newY < 0) {
                    translateY.setValue(0 - currentOffset);
                } else {
                    translateY.setValue(gestureState.dy);
                }
            },
            onPanResponderRelease: (evt, gestureState) => {
                translateY.flattenOffset();

                const currentY = translateY._value;
                const gestureVelocity = gestureState.vy;

                if (gestureVelocity > 0.5 || (state === 'min' && currentY > baseTranslateY + 80)) {
                    handleClose();
                } else if (currentY < baseTranslateY / 2 || gestureVelocity < -0.5) {
                    snapTo('max');
                } else if (currentY > baseTranslateY + 50) {
                    handleClose();
                } else {
                    snapTo('min');
                }
            },
        })
    ).current;

    useEffect(() => {
        if (visible) {
            snapTo(initialSnap);
            onVisibilityChange && onVisibilityChange(true);
        } else {
            handleClose();
            onVisibilityChange && onVisibilityChange(false);
        }
    }, [visible]);

    const snapTo = (point) => {
        const toValue = point === 'max' ? 0 : baseTranslateY;
        Animated.spring(translateY, {
            toValue,
            useNativeDriver: true,
            friction: 8,
            tension: 40,
        }).start(() => setState(point));
    };

    const handleClose = () => {
        Animated.timing(translateY, {
            toValue: screenHeight,
            duration: 250,
            useNativeDriver: true,
        }).start(() => {
            onClose();
        });
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={handleClose}
        >
            <View style={styles.overlay}>
                <TouchableOpacity
                    style={styles.backdrop}
                    onPress={handleClose}
                    activeOpacity={1}
                />

                <Animated.View
                    style={[
                        styles.sheet,
                        {
                            transform: [{ translateY }],
                            height: maxHeight,
                        }
                    ]}
                    {...panResponder.panHandlers}
                >
                    {/* Grab Handle */}
                    <View style={styles.grabArea}>
                        <View style={styles.handle} />
                    </View>

                    <View style={styles.content}>
                        {children}
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    sheet: {
        backgroundColor: COLORS.backgroundCard,
        borderTopLeftRadius: RADIUS.xl,
        borderTopRightRadius: RADIUS.xl,
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 10,
        overflow: 'hidden',
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    grabArea: {
        width: '100%',
        height: 28,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.backgroundCard,
    },
    handle: {
        width: 40,
        height: 5,
        backgroundColor: COLORS.border,
        borderRadius: 3,
    },
    content: {
        flex: 1,
    }
});

export default DraggableModal;
