import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import { communityService } from '../services/communityService';
import { supabase } from '../services/supabaseConfig';

// Helper to calculate distance in KM
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
};

const deg2rad = (deg) => deg * (Math.PI / 180);

const LocationSetupScreen = ({ navigation }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [buildings, setBuildings] = useState([]);
    const [filteredBuildings, setFilteredBuildings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [detecting, setDetecting] = useState(false);
    const [userCoords, setUserCoords] = useState(null);

    useEffect(() => {
        fetchBuildings();
    }, []);

    const fetchBuildings = async () => {
        setLoading(true);
        const result = await communityService.getResidences();
        if (result.success) {
            setBuildings(result.data);
            setFilteredBuildings(result.data);
        } else {
            console.error("Fetch buildings error:", result.error);
            Alert.alert("Lỗi", "Không thể tải danh sách khu dân cư. Vui lòng kiểm tra kết nối mạng.");
        }
        setLoading(false);
    };

    const handleSearch = (text) => {
        setSearchQuery(text);
        if (text.trim() === '') {
            // Apply current location sorting if available
            sortAndSetBuildings(buildings, userCoords);
        } else {
            const filtered = buildings.filter(b =>
                b.name.toLowerCase().includes(text.toLowerCase()) ||
                b.address.toLowerCase().includes(text.toLowerCase())
            );
            sortAndSetBuildings(filtered, userCoords);
        }
    };

    const sortAndSetBuildings = (list, coords) => {
        if (!coords) {
            setFilteredBuildings(list);
            return;
        }

        const listWithDist = list.map(b => ({
            ...b,
            distance: calculateDistance(coords.latitude, coords.longitude, b.coordinates.lat, b.coordinates.lng)
        }));

        const sorted = listWithDist.sort((a, b) => a.distance - b.distance);
        setFilteredBuildings(sorted);
    };

    const detectLocation = async () => {
        setDetecting(true);
        try {
            // 1. Check permissions
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Quyền truy cập', 'Vui lòng cho phép truy cập vị trí để tự động tìm tòa nhà.');
                setDetecting(false);
                return;
            }

            // 2. Check if services are enabled
            const enabled = await Location.hasServicesEnabledAsync();
            if (!enabled) {
                Alert.alert('Vị trí tắt', 'Vui lòng bật dịch vụ định vị (Location Services) trên điện thoại bạn.');
                setDetecting(false);
                return;
            }

            // 3. Get Location with fallback
            let location = null;
            try {
                // Try last known first for speed
                location = await Location.getLastKnownPositionAsync({});
            } catch (e) {
                // Ignore error, proceed to fetch current
            }

            if (!location) {
                // Fetch current with balanced accuracy (faster, works indoors better)
                location = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                    timeout: 5000
                });
            }

            if (!location) {
                throw new Error("Location unavailable");
            }

            const { latitude, longitude } = location.coords;
            setUserCoords({ latitude, longitude });

            // Calculate distance to all buildings
            const buildingsWithinRange = buildings.map(b => ({
                ...b,
                distance: calculateDistance(latitude, longitude, b.coordinates.lat, b.coordinates.lng)
            })).filter(b => b.distance <= 10); // Expanded range to 10km just in case

            if (buildingsWithinRange.length > 0) {
                // Sort by nearest
                buildingsWithinRange.sort((a, b) => a.distance - b.distance);
                const nearest = buildingsWithinRange[0];

                Alert.alert(
                    'Đã tìm thấy cư dân',
                    `Bạn có phải cư dân tại ${nearest.name} (cách ${(nearest.distance * 1000).toFixed(0)}m)?`,
                    [
                        { text: 'Không phải', style: 'cancel' },
                        { text: 'Đúng, là tôi', onPress: () => handleSelect(nearest) }
                    ]
                );

                setFilteredBuildings(buildingsWithinRange);
            } else {
                Alert.alert('Vị trí', 'Không tìm thấy khu dân cư nào của ứng dụng trong phạm vi 10km quanh bạn. Hãy thử tìm kiếm thủ công nhé!');
                // Fallback to showing all if none found nearby, sorted by distance
                const allSorted = buildings.map(b => ({
                    ...b,
                    distance: calculateDistance(latitude, longitude, b.coordinates.lat, b.coordinates.lng)
                })).sort((a, b) => a.distance - b.distance);
                setFilteredBuildings(allSorted);
            }

        } catch (error) {
            console.error(error);
            Alert.alert(
                'Lỗi vị trí',
                'Không thể xác định vị trí hiện tại. Vui lòng kiểm tra lại GPS hoặc tìm kiếm thủ công.'
            );
        } finally {
            setDetecting(false);
        }
    };

    const handleSelect = async (building) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const result = await communityService.updateUserResidence(user.id, building.id);
        if (result.success) {
            Alert.alert('Thành công', `Bạn đã tham gia cộng đồng ${building.name}.`, [
                { text: 'Bắt đầu ngay', onPress: () => navigation.navigate('Main', { screen: 'Community' }) }
            ]);
        } else {
            Alert.alert('Lỗi', 'Không thể cập nhật khu dân cư của bạn.');
        }
    };

    const renderBuilding = ({ item }) => (
        <TouchableOpacity style={styles.buildingCard} onPress={() => handleSelect(item)}>
            <View style={styles.iconContainer}>
                <MaterialIcons name="apartment" size={24} color={COLORS.primary} />
            </View>
            <View style={styles.buildingInfo}>
                <Text style={styles.buildingName}>{item.name}</Text>
                <Text style={styles.buildingAddress} numberOfLines={1}>{item.address}</Text>
                {item.distance && (
                    <Text style={[styles.distanceTag, item.distance <= 5 ? { color: COLORS.success } : { color: COLORS.textMuted }]}>
                        Cách bạn {item.distance < 1 ? `${(item.distance * 1000).toFixed(0)}m` : `${item.distance.toFixed(1)}km`}
                    </Text>
                )}
            </View>
            <MaterialIcons name="chevron-right" size={24} color={COLORS.textMuted} />
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialIcons name="arrow-back" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Chọn nơi bạn sống</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.content}>
                <Text style={styles.description}>
                    Để kết nối với hàng xóm và nhận được các ưu đãi địa phương, vui lòng chọn khu dân cư của bạn.
                </Text>

                <TouchableOpacity style={styles.detectBtn} onPress={detectLocation} disabled={detecting}>
                    {detecting ? (
                        <ActivityIndicator color={COLORS.primary} size="small" />
                    ) : (
                        <>
                            <MaterialIcons name="my-location" size={20} color={COLORS.primary} />
                            <Text style={styles.detectLabel}>Tự động tìm kiếm gần đây</Text>
                        </>
                    )}
                </TouchableOpacity>

                <View style={styles.searchBar}>
                    <MaterialIcons name="search" size={20} color={COLORS.textMuted} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Tìm tên tòa nhà, chung cư..."
                        value={searchQuery}
                        onChangeText={handleSearch}
                    />
                </View>

                {loading ? (
                    <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
                ) : (
                    <FlatList
                        data={filteredBuildings}
                        renderItem={renderBuilding}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.list}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <MaterialIcons name="search-off" size={48} color={COLORS.textMuted} />
                                <Text style={styles.emptyText}>Không tìm thấy tòa nhà nào</Text>
                            </View>
                        }
                    />
                )}
            </View>
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
    content: {
        flex: 1,
        paddingHorizontal: SPACING.xl,
    },
    description: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textSecondary,
        marginTop: SPACING.lg,
        lineHeight: 22,
    },
    detectBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.md,
        gap: SPACING.sm,
        marginTop: SPACING.md,
    },
    detectLabel: {
        ...TYPOGRAPHY.bodyRegular,
        fontFamily: FONTS.bold,
        color: COLORS.primary,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.backgroundCard,
        borderRadius: RADIUS.md,
        paddingHorizontal: SPACING.md,
        height: 50,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginTop: SPACING.sm,
    },
    searchInput: {
        flex: 1,
        marginLeft: SPACING.sm,
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textPrimary,
    },
    list: {
        paddingTop: SPACING.md,
        paddingBottom: SPACING.xl,
    },
    buildingCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.backgroundCard,
        padding: SPACING.md,
        borderRadius: RADIUS.lg,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: RADIUS.md,
        backgroundColor: COLORS.primaryMuted,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.md,
    },
    buildingInfo: {
        flex: 1,
    },
    buildingName: {
        ...TYPOGRAPHY.bodyLarge,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
    },
    buildingAddress: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
        marginTop: 2,
    },
    distanceTag: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.bold,
        marginTop: 2,
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 60,
    },
    emptyText: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textMuted,
        marginTop: SPACING.md,
    }
});

export default LocationSetupScreen;
