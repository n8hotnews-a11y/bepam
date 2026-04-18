import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';

const FridgeHeader = ({
    selectionMode,
    selectedCount,
    expiredCount,
    onClearSelection,
    onBulkAction,
    onToggleSelection,
    onNavigateShopping,
    onNavigateExpired,
}) => {
    return (
        <LinearGradient
            colors={['#E67E22', '#F5A623', '#F7C948']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
        >
            <View style={styles.headerContent}>
                <View style={styles.headerLeft}>
                    <View style={styles.fridgeIconWrapper}>
                        <MaterialIcons name="kitchen" size={28} color={COLORS.white} />
                    </View>
                    <View>
                        <Text style={styles.headerTitle}>
                            {selectionMode ? `${selectedCount} đã chọn` : 'Tủ lạnh'}
                        </Text>
                        {!selectionMode && (
                            <Text style={styles.headerSubtitle}>Quản lý thực phẩm thông minh</Text>
                        )}
                    </View>
                </View>

                <View style={styles.headerActions}>
                    {selectionMode ? (
                        <>
                            <TouchableOpacity style={styles.headerBtn} onPress={onClearSelection}>
                                <MaterialIcons name="close" size={22} color={COLORS.white} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.headerBtn}
                                onPress={onBulkAction}
                                disabled={selectedCount === 0}
                            >
                                <MaterialIcons
                                    name="more-vert"
                                    size={22}
                                    color={selectedCount > 0 ? COLORS.white : 'rgba(255,255,255,0.4)'}
                                />
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <TouchableOpacity style={styles.headerBtn} onPress={onToggleSelection}>
                                <MaterialIcons name="checklist" size={22} color={COLORS.white} />
                            </TouchableOpacity>
                            {/* <TouchableOpacity style={styles.headerBtn} onPress={onNavigateShopping}>
                                <MaterialIcons name="shopping-cart" size={22} color={COLORS.white} />
                            </TouchableOpacity> */}
                            <TouchableOpacity style={styles.headerBtn} onPress={onNavigateExpired}>
                                <MaterialIcons
                                    name="notifications"
                                    size={22}
                                    color={expiredCount > 0 ? '#FFE0B2' : COLORS.white}
                                />
                                {expiredCount > 0 && (
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>
                                            {expiredCount > 9 ? '9+' : expiredCount}
                                        </Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    headerGradient: {
        paddingTop: SPACING.sm,
        paddingBottom: SPACING.lg,
        paddingHorizontal: SPACING.xl,
        borderBottomLeftRadius: RADIUS.xl,
        borderBottomRightRadius: RADIUS.xl,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
    },
    fridgeIconWrapper: {
        width: 48,
        height: 48,
        borderRadius: RADIUS.md,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        ...TYPOGRAPHY.heading1,
        color: COLORS.white,
    },
    headerSubtitle: {
        ...TYPOGRAPHY.caption,
        color: 'rgba(255,255,255,0.85)',
        marginTop: 2,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
    },
    headerBtn: {
        width: 40,
        height: 40,
        borderRadius: RADIUS.md,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    badge: {
        position: 'absolute',
        top: -2,
        right: -2,
        backgroundColor: COLORS.danger,
        borderRadius: 10,
        width: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#E67E22',
    },
    badgeText: {
        color: COLORS.white,
        fontSize: 9,
        fontWeight: 'bold',
    },
});

export default FridgeHeader;
