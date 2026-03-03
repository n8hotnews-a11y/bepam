import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    Dimensions
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';

const { width } = Dimensions.get('window');

const CommunityListingCard = ({ listing, onChat, onAction }) => {
    const isFree = listing.price === 0;
    const images = Array.isArray(listing.images) ? listing.images : [];

    return (
        <View style={styles.card}>
            <View style={styles.imageContainer}>
                <Image
                    source={{ uri: images[0] || 'https://via.placeholder.com/400x225?text=Food' }}
                    style={styles.image}
                    resizeMode="cover"
                />
                <View style={styles.locationBadge}>
                    <MaterialIcons name="location-on" size={12} color={COLORS.primary} />
                    <Text style={styles.locationText}>{listing.building_name || 'Hàng xóm'} • 200m</Text>
                </View>
                {listing.type === 'giveaway' && (
                    <View style={styles.giveawayTag}>
                        <Text style={styles.giveawayText}>Đồ tặng</Text>
                    </View>
                )}
            </View>

            <View style={styles.content}>
                <View style={styles.userRow}>
                    <View style={styles.avatar}>
                        <MaterialIcons name="person" size={16} color={COLORS.primary} />
                    </View>
                    <View style={styles.userInfo}>
                        <Text style={styles.userName}>{listing.user?.email?.split('@')[0] || 'Cư dân'}</Text>
                        <Text style={styles.timeText}>Vừa cập nhật • Chia sẻ từ tâm</Text>
                    </View>
                </View>

                <Text style={styles.title} numberOfLines={1}>{listing.title}</Text>

                <View style={styles.footer}>
                    <Text style={[styles.price, isFree && { color: COLORS.success }]}>
                        {isFree ? 'Miễn phí' : `${(listing.price || 0).toLocaleString()}đ`}
                    </Text>
                    <TouchableOpacity
                        style={[styles.actionBtn, isFree && { backgroundColor: COLORS.success }]}
                        onPress={onChat}
                    >
                        <MaterialIcons
                            name={isFree ? "volunteer-activism" : "chat"}
                            size={16}
                            color={COLORS.white}
                        />
                        <Text style={styles.actionLabel}>{isFree ? 'Nhận ngay' : 'Nhắn tin'}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.xl,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: COLORS.borderLight,
        marginBottom: SPACING.lg,
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    imageContainer: {
        width: '100%',
        aspectRatio: 16 / 9,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    locationBadge: {
        position: 'absolute',
        top: 12,
        left: 12,
        backgroundColor: 'rgba(255,255,255,0.9)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: RADIUS.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    locationText: {
        fontSize: 10,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
    },
    giveawayTag: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: COLORS.success,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: RADIUS.sm,
    },
    giveawayText: {
        fontSize: 10,
        fontFamily: FONTS.bold,
        color: COLORS.white,
        textTransform: 'uppercase',
    },
    content: {
        padding: SPACING.md,
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.primaryMuted,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.sm,
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
    },
    timeText: {
        fontSize: 9,
        color: COLORS.textMuted,
    },
    title: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
        marginBottom: SPACING.sm,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    price: {
        ...TYPOGRAPHY.heading3,
        color: COLORS.primary,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        paddingHorizontal: SPACING.md,
        paddingVertical: 8,
        borderRadius: RADIUS.md,
        gap: 6,
    },
    actionLabel: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.bold,
        color: COLORS.white,
    }
});

export default CommunityListingCard;
