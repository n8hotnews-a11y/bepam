import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    ScrollView,
    RefreshControl,
    Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import { communityService } from '../services/communityService';
import { supabase } from '../services/supabaseConfig';
import CommunityListingCard from '../components/CommunityListingCard';

const TABS = [
    { id: 'groups', label: 'Hội nhóm', category: 'groups' },
    { id: 'neighbor', label: 'Món ăn hàng xóm', category: 'neighborhood_food' },
    { id: 'supermarket', label: 'Siêu thị gần đây', category: 'supermarket' },
    { id: 'gift', label: 'Đồ tặng', category: 'gift' }
];

const MarketplaceScreen = ({ navigation }) => {
    const [activeTab, setActiveTab] = useState('neighbor');
    const [listings, setListings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [userResidence, setUserResidence] = useState(null);

    useFocusEffect(
        useCallback(() => {
            checkUserResidence();
        }, [])
    );

    useEffect(() => {
        if (userResidence) {
            fetchListings();
        }
    }, [activeTab, userResidence]);

    const checkUserResidence = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return;
            }

            // Fetch user profile with residence join
            const { data, error } = await supabase
                .from('users')
                .select(`
                    residence_id,
                    residences:residence_id (
                        id,
                        name,
                        address,
                        coordinates
                    )
                `)
                .eq('id', user.id)
                .maybeSingle();

            if (error) {
                console.error('checkUserResidence query error:', error);
                setLoading(false);
                return;
            }

            // If we have the join data, use it
            if (data?.residences) {
                setUserResidence(data.residences);
            }
            // Fallback: if we have the ID but join failed for some reason, fetch separately
            else if (data?.residence_id) {
                const resResult = await communityService.getResidences();
                if (resResult.success) {
                    const found = resResult.data.find(r => r.id === data.residence_id);
                    if (found) {
                        setUserResidence(found);
                    } else {
                        setLoading(false);
                        navigation.navigate('LocationSetup');
                    }
                } else {
                    setLoading(false);
                }
            }
            // Truly no residence set
            else {
                setLoading(false);
                navigation.navigate('LocationSetup');
            }
        } catch (err) {
            console.error('checkUserResidence exception:', err);
            setLoading(false);
        }
    };

    const fetchListings = async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);

        try {
            let result;
            if (activeTab === 'groups') {
                result = await communityService.getGroups(userResidence.id);
            } else if (activeTab === 'supermarket') {
                // For MVP we don't pass lat/lng yet, just get all stores
                result = await communityService.getStores();
            } else {
                const tabItem = TABS.find(t => t.id === activeTab);
                if (tabItem) {
                    result = await communityService.getListings(userResidence.id, tabItem.category);
                }
            }

            if (result && result.success) {
                setListings(result.data);
            } else {
                setListings([]);
            }
        } catch (err) {
            console.error('fetchListings error:', err);
            setListings([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchListings(true);
    };

    const renderHeader = () => (
        <View style={styles.header}>
            <View style={styles.headerTop}>
                <View style={styles.locationGroup}>
                    <MaterialIcons name="local-mall" size={24} color={COLORS.primary} />
                    <Text style={styles.headerTitle}>Chợ Cư Dân</Text>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity style={styles.iconBtn}>
                        <MaterialIcons name="search" size={24} color={COLORS.textPrimary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn}>
                        <MaterialIcons name="map" size={24} color={COLORS.textPrimary} onPress={() => navigation.navigate('CommunityMap')} />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.tabContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabList}>
                    {TABS.map(tab => (
                        <TouchableOpacity
                            key={tab.id}
                            style={[styles.tab, activeTab === tab.id && styles.activeTab]}
                            onPress={() => setActiveTab(tab.id)}
                        >
                            <Text style={[styles.tabLabel, activeTab === tab.id && styles.activeTabLabel]}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        </View>
    );

    const handleJoinGroup = async (groupId) => {
        const { data: { user } } = await supabase.auth.getUser();
        const result = await communityService.joinGroup(groupId, user.id);
        if (result.success) {
            Alert.alert('Thành công', 'Chào mừng bạn đến với nhóm cư dân!');
            fetchListings();
        } else {
            Alert.alert('Thông báo', 'Bạn đã là thành viên của nhóm này.');
        }
    };

    const handleFabPress = () => {
        if (activeTab === 'groups') {
            navigation.navigate('CreateGroup');
        } else {
            navigation.navigate('CreateListing', { category: TABS.find(t => t.id === activeTab)?.category });
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {renderHeader()}

            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator color={COLORS.primary} size="large" />
                </View>
            ) : (
                <FlatList
                    data={listings}
                    renderItem={({ item }) => {
                        if (activeTab === 'groups') {
                            return (
                                <TouchableOpacity
                                    style={styles.groupCard}
                                    onPress={() => navigation.navigate('GroupDetail', { group: item })}
                                >
                                    <View style={styles.groupIcon}>
                                        <MaterialIcons name="groups" size={32} color={COLORS.primary} />
                                    </View>
                                    <View style={styles.groupInfo}>
                                        <Text style={styles.groupName}>{item.name}</Text>
                                        <Text style={styles.groupDesc}>{item.description || 'Tham gia để chia sẻ cùng cư dân.'}</Text>
                                        <Text style={styles.groupMeta}>{item.type === 'official' ? 'Nhóm chính thức' : 'Nhóm sở thích'}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.joinBtn}
                                        onPress={() => handleJoinGroup(item.id)}
                                    >
                                        <Text style={styles.joinText}>Tham gia</Text>
                                    </TouchableOpacity>
                                </TouchableOpacity>
                            );
                        }
                        if (activeTab === 'supermarket') {
                            return (
                                <View style={styles.groupCard}>
                                    <View style={[styles.groupIcon, { backgroundColor: '#ECFDF5' }]}>
                                        <MaterialIcons name="store" size={32} color="#059669" />
                                    </View>
                                    <View style={styles.groupInfo}>
                                        <Text style={styles.groupName}>{item.name}</Text>
                                        <Text style={styles.groupDesc}>{item.address}</Text>
                                        <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
                                            <MaterialIcons name="schedule" size={14} color={COLORS.textSecondary} />
                                            <Text style={styles.groupMeta}>{item.opening_hours?.open || '8:00'} - {item.opening_hours?.close || '22:00'}</Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity style={[styles.joinBtn, { backgroundColor: '#059669' }]}>
                                        <Text style={styles.joinText}>Xem</Text>
                                    </TouchableOpacity>
                                </View>
                            );
                        }
                        return (
                            <CommunityListingCard
                                listing={item}
                                onChat={() => navigation.navigate('ChefChat', { context: 'marketplace', item: item })}
                            />
                        );
                    }}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
                    }
                    ListHeaderComponent={
                        <View style={styles.residenceInfo}>
                            <MaterialIcons name="location-on" size={16} color={COLORS.primary} />
                            <Text style={styles.residenceText}>{userResidence?.name || 'Đang xác định...'}</Text>
                            <TouchableOpacity onPress={() => navigation.navigate('LocationSetup')}>
                                <Text style={styles.changeBtn}>Thay đổi</Text>
                            </TouchableOpacity>
                        </View>
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <MaterialIcons
                                name={activeTab === 'groups' ? 'group-work' : activeTab === 'supermarket' ? 'storefront' : 'shopping-basket'}
                                size={64}
                                color={COLORS.border}
                            />
                            <Text style={styles.emptyTitle}>
                                {activeTab === 'groups' ? 'Chưa có hội nhóm nào' : activeTab === 'supermarket' ? 'Chưa có siêu thị nào' : 'Chưa có món nào ở đây'}
                            </Text>
                            <Text style={styles.emptySub}>
                                {activeTab === 'groups' ? 'Hãy là người đầu tiên tạo nhóm nhé!' : 'Dữ liệu đang được cập nhật.'}
                            </Text>
                        </View>
                    }
                />
            )}

            {activeTab !== 'supermarket' && (
                <TouchableOpacity
                    style={styles.fab}
                    onPress={handleFabPress}
                >
                    <MaterialIcons
                        name={activeTab === 'groups' ? 'group-add' : 'add-shopping-cart'}
                        size={24}
                        color={COLORS.white}
                    />
                    <Text style={styles.fabText}>
                        {activeTab === 'groups' ? 'Tạo nhóm' : 'Đăng bài'}
                    </Text>
                </TouchableOpacity>
            )}

        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        backgroundColor: COLORS.backgroundCard,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderLight,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
    },
    locationGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    headerTitle: {
        ...TYPOGRAPHY.heading2,
        color: COLORS.textPrimary,
    },
    headerActions: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    iconBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabContainer: {
        paddingHorizontal: SPACING.md,
    },
    tabList: {
        paddingBottom: 0,
    },
    tab: {
        paddingHorizontal: SPACING.md,
        paddingBottom: 12,
        paddingTop: 8,
        borderBottomWidth: 3,
        borderBottomColor: 'transparent',
    },
    activeTab: {
        borderBottomColor: COLORS.primary,
    },
    tabLabel: {
        ...TYPOGRAPHY.bodyRegular,
        fontFamily: FONTS.bold,
        color: COLORS.textMuted,
    },
    activeTabLabel: {
        color: COLORS.primary,
    },
    listContent: {
        padding: SPACING.lg,
        paddingBottom: 100,
    },
    residenceInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primaryMuted,
        padding: SPACING.sm,
        borderRadius: RADIUS.md,
        marginBottom: SPACING.lg,
        gap: 4,
    },
    residenceText: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.bold,
        color: COLORS.primary,
        flex: 1,
    },
    changeBtn: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
        textDecorationLine: 'underline',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 60,
    },
    emptyTitle: {
        ...TYPOGRAPHY.heading3,
        color: COLORS.textPrimary,
        marginTop: SPACING.md,
    },
    emptySub: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textMuted,
        marginTop: 4,
    },
    fab: {
        position: 'absolute',
        bottom: 24,
        right: 20,
        backgroundColor: COLORS.primary,
        height: 56,
        paddingHorizontal: 20,
        borderRadius: 28,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 5,
    },
    fabText: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: COLORS.white,
    },
    groupCard: {
        flexDirection: 'row',
        backgroundColor: COLORS.backgroundCard,
        padding: SPACING.md,
        borderRadius: RADIUS.md,
        marginBottom: SPACING.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.borderLight,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    groupIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: COLORS.primaryFade,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.md,
    },
    groupInfo: {
        flex: 1,
    },
    groupName: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
        marginBottom: 2,
    },
    groupDesc: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
        marginBottom: 4,
    },
    groupMeta: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
        backgroundColor: COLORS.background,
        alignSelf: 'flex-start',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        fontSize: 10,
        overflow: 'hidden',
    },
    joinBtn: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: SPACING.md,
        paddingVertical: 8,
        borderRadius: RADIUS.full,
    },
    joinText: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.bold,
        color: COLORS.white,
    }
});

export default MarketplaceScreen;
