import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    Image,
    ActivityIndicator,
    ScrollView,
    TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Platform } from 'react-native';

// Conditionally import Map components to prevent web crashes
let MapView, Marker, Callout, PROVIDER_GOOGLE;
if (Platform.OS !== 'web') {
    const MapModule = require('react-native-maps');
    MapView = MapModule.default;
    Marker = MapModule.Marker;
    Callout = MapModule.Callout;
    PROVIDER_GOOGLE = MapModule.PROVIDER_GOOGLE;
}
import { COLORS, FONTS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import { communityService } from '../services/communityService';
import { supabase } from '../services/supabaseConfig';

const { width, height } = Dimensions.get('window');

const CommunityMapScreen = ({ navigation }) => {
    const [listings, setListings] = useState([]);
    const [filteredListings, setFilteredListings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');
    const [region, setRegion] = useState({
        latitude: 10.795,
        longitude: 106.722,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
    });

    useEffect(() => {
        fetchMarketData();
    }, []);

    const fetchMarketData = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Get user's residence to center map
            const { data, error } = await supabase
                .from('users')
                .select(`
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
                console.error('fetchMarketData error:', error);
                setLoading(false);
                return;
            }

            if (data?.residences) {
                const residence = Array.isArray(data.residences) ? data.residences[0] : data.residences;
                if (!residence) {
                    setLoading(false);
                    return;
                }
                const coords = residence.coordinates;
                if (coords && coords.lat && coords.lng) {
                    const lat = parseFloat(coords.lat);
                    const lng = parseFloat(coords.lng);

                    if (!isNaN(lat) && !isNaN(lng)) {
                        setRegion(prev => ({
                            ...prev,
                            latitude: lat,
                            longitude: lng
                        }));
                    }
                }

                // Fetch both listings and stores
                const [listingRes, storeRes] = await Promise.all([
                    communityService.getListings(residence.id),
                    communityService.getStores()
                ]);

                let combined = [];
                if (listingRes.success) {
                    combined = [...combined, ...listingRes.data];
                }
                if (storeRes.success) {
                    // Normalize stores to look like items for markers
                    const normalizedStores = storeRes.data.map(s => ({
                        ...s,
                        category: 'supermarket',
                        title: s.name,
                        isStore: true
                    }));
                    combined = [...combined, ...normalizedStores];
                }

                setListings(combined);
                setFilteredListings(combined);
            }
        } catch (err) {
            console.error('fetchMarketData exception:', err);
        } finally {
            setLoading(false);
        }
    };

    // Filter logic
    useEffect(() => {
        let result = listings;

        // Filter by category
        if (activeCategory !== 'all') {
            result = result.filter(item => item.category === activeCategory);
        }

        // Filter by search query
        if (searchQuery.trim() !== '') {
            const query = searchQuery.toLowerCase();
            result = result.filter(item => {
                const title = (item.title || item.name || '').toLowerCase();
                const description = (item.description || '').toLowerCase();
                return title.includes(query) || description.includes(query);
            });
        }

        setFilteredListings(result);
    }, [searchQuery, activeCategory, listings]);

    const getMarkerIcon = (category) => {
        switch (category) {
            case 'neighborhood_food': return 'restaurant';
            case 'supermarket': return 'shopping-cart';
            case 'gift': return 'volunteer-activism';
            default: return 'location-on';
        }
    };

    const getMarkerColor = (category) => {
        switch (category) {
            case 'neighborhood_food': return COLORS.primary;
            case 'supermarket': return '#10B981';
            case 'gift': return '#F59E0B';
            default: return COLORS.primary;
        }
    };

    const renderMap = () => {
        if (Platform.OS === 'web') {
            return (
                <View style={[styles.map, styles.webPlaceholder]}>
                    <MaterialIcons name="map" size={64} color={COLORS.border} />
                    <Text style={styles.webPlaceholderText}>Bản đồ hiện chỉ hỗ trợ trên ứng dụng di động</Text>
                    <TouchableOpacity
                        style={styles.webBtn}
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={styles.webBtnText}>Quay lại</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (!MapView) {
            return (
                <View style={[styles.map, styles.webPlaceholder]}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.webPlaceholderText}>Đang tải bản đồ...</Text>
                </View>
            );
        }

        return (
            <MapView
                style={styles.map}
                initialRegion={region}
                region={region}
                showsUserLocation={true}
                showsMyLocationButton={true}
            >
                {/* User's Residence Marker */}
                {region && (
                    <Marker
                        coordinate={{ latitude: region.latitude, longitude: region.longitude }}
                        title="Vị trí của bạn"
                    >
                        <View style={styles.homeMarker}>
                            <MaterialIcons name="home" size={20} color={COLORS.white} />
                        </View>
                    </Marker>
                )}

                {filteredListings.map((item) => {
                    const lat = parseFloat(region.latitude);
                    const lng = parseFloat(region.longitude);
                    if (isNaN(lat) || isNaN(lng)) return null;

                    // Jitter around the center if no coordinates
                    const jitterLat = lat + (Math.random() - 0.5) * 0.005;
                    const jitterLng = lng + (Math.random() - 0.5) * 0.005;

                    return (
                        <Marker
                            key={item.id}
                            coordinate={{ latitude: jitterLat, longitude: jitterLng }}
                            pinColor={getMarkerColor(item.category)}
                        >
                            <View style={[styles.customMarker, { backgroundColor: getMarkerColor(item.category) }]}>
                                <MaterialIcons name={getMarkerIcon(item.category)} size={16} color={COLORS.white} />
                            </View>
                            <Callout onPress={() => navigation.navigate('ListingDetail', { listing: item })}>
                                <View style={styles.callout}>
                                    <Text style={styles.calloutTitle}>{item.title}</Text>
                                    {!item.isStore && item.price !== undefined && (
                                        <Text style={styles.calloutPrice}>
                                            {item.price === 0 ? 'Miễn phí' : `${item.price.toLocaleString()}đ`}
                                        </Text>
                                    )}
                                    <Text style={styles.calloutLink}>Xem chi tiết</Text>
                                </View>
                            </Callout>
                        </Marker>
                    );
                })}
            </MapView>
        );
    };

    return (
        <View style={styles.container}>
            {renderMap()}

            {/* Header Overlay */}
            <SafeAreaView style={styles.headerOverlay} pointerEvents="box-none">
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <MaterialIcons name="arrow-back" size={24} color={COLORS.textPrimary} />
                    </TouchableOpacity>
                    <View style={styles.searchBar}>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Tìm quanh đây..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                </View>

                {/* Filter Category Chips */}
                <View style={styles.filterBar}>
                    <TouchableOpacity
                        style={[styles.chip, activeCategory === 'neighborhood_food' && styles.activeChip]}
                        onPress={() => setActiveCategory(activeCategory === 'neighborhood_food' ? 'all' : 'neighborhood_food')}
                    >
                        <MaterialIcons name="restaurant" size={14} color={activeCategory === 'neighborhood_food' ? COLORS.white : COLORS.textSecondary} />
                        <Text style={[styles.chipText, activeCategory === 'neighborhood_food' && styles.activeChipText]}>Nhà hàng</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.chip, activeCategory === 'supermarket' && styles.activeChip]}
                        onPress={() => setActiveCategory(activeCategory === 'supermarket' ? 'all' : 'supermarket')}
                    >
                        <MaterialIcons name="store" size={14} color={activeCategory === 'supermarket' ? COLORS.white : COLORS.textSecondary} />
                        <Text style={[styles.chipText, activeCategory === 'supermarket' && styles.activeChipText]}>Siêu thị</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            {loading && (
                <View style={styles.loader}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    map: {
        flex: 1,
        width: width,
        height: height,
        backgroundColor: '#e5e5e5', // Light grey background if tiles fail
    },
    headerOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingHorizontal: SPACING.lg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.white,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    searchBar: {
        flex: 1,
        height: 44,
        backgroundColor: COLORS.white,
        borderRadius: RADIUS.full,
        justifyContent: 'center',
        paddingHorizontal: SPACING.lg,
        elevation: 4,
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    searchInput: {
        ...TYPOGRAPHY.bodyRegular,
        color: COLORS.textPrimary,
        height: '100%',
    },
    filterBar: {
        marginTop: SPACING.md,
        flexDirection: 'row',
        gap: 8,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: COLORS.white,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: RADIUS.pill,
        marginRight: 8,
        elevation: 2,
    },
    activeChip: {
        backgroundColor: COLORS.primary,
    },
    chipText: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.bold,
        color: COLORS.textSecondary,
    },
    activeChipText: {
        ...TYPOGRAPHY.caption,
        fontFamily: FONTS.bold,
        color: COLORS.white,
    },
    customMarker: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: COLORS.white,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    homeMarker: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.secondary,
        borderWidth: 3,
        borderColor: COLORS.white,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
    },
    callout: {
        width: 140,
        padding: SPACING.xs,
    },
    calloutTitle: {
        ...TYPOGRAPHY.bodyRegular,
        fontFamily: FONTS.bold,
        color: COLORS.textPrimary,
    },
    calloutPrice: {
        ...TYPOGRAPHY.caption,
        color: COLORS.primary,
        marginTop: 2,
    },
    calloutLink: {
        fontSize: 10,
        color: COLORS.textMuted,
        textDecorationLine: 'underline',
        marginTop: 4,
    },
    loader: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    webPlaceholder: {
        backgroundColor: COLORS.backgroundCard,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.xl,
    },
    webPlaceholderText: {
        ...TYPOGRAPHY.bodyLarge,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginTop: SPACING.lg,
        marginBottom: SPACING.xl,
    },
    webBtn: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.md,
        borderRadius: RADIUS.lg,
    },
    webBtnText: {
        ...TYPOGRAPHY.bodyRegular,
        fontFamily: FONTS.bold,
        color: COLORS.white,
    }
});

export default CommunityMapScreen;
