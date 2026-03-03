import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Platform,
    Dimensions
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, RADIUS, SPACING } from '../constants/theme';
import ChefFAB from '../components/ChefFAB';

const { width } = Dimensions.get('window');

const CustomTabBar = ({ state, descriptors, navigation, screenContext }) => {
    return (
        <View style={styles.tabBarContainer}>
            <View style={styles.tabBar}>
                {state.routes.map((route, index) => {
                    const { options } = descriptors[route.key];
                    const label =
                        options.tabBarLabel !== undefined
                            ? options.tabBarLabel
                            : options.title !== undefined
                                ? options.title
                                : route.name;

                    const isFocused = state.index === index;

                    const onPress = () => {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: route.key,
                            canPreventDefault: true,
                        });

                        if (!isFocused && !event.defaultPrevented) {
                            navigation.navigate(route.name);
                        }
                    };

                    const onLongPress = () => {
                        navigation.emit({
                            type: 'tabLongPress',
                            target: route.key,
                        });
                    };

                    // Insert the central button at index 2
                    if (index === 2) {
                        return (
                            <React.Fragment key="plus-fragment">
                                <View style={styles.plusButtonContainer}>
                                    <ChefFAB
                                        screenContext={screenContext}
                                        style={{
                                            position: 'relative',
                                            bottom: 0,
                                            right: 0,
                                            alignItems: 'center',
                                            // Reset any absolute positioning from ChefFAB default
                                        }}
                                    />
                                </View>

                                <TouchableOpacity
                                    key={route.key}
                                    accessibilityRole="button"
                                    accessibilityState={isFocused ? { selected: true } : {}}
                                    accessibilityLabel={options.tabBarAccessibilityLabel}
                                    testID={options.tabBarTestID}
                                    onPress={onPress}
                                    onLongPress={onLongPress}
                                    style={styles.tabItem}
                                >
                                    <MaterialIcons
                                        name={getIconName(route.name)}
                                        size={24}
                                        color={isFocused ? COLORS.primary : 'rgba(255, 255, 255, 0.6)'}
                                    />
                                    <Text style={[
                                        styles.tabLabel,
                                        { color: isFocused ? COLORS.primary : 'rgba(255, 255, 255, 0.6)' }
                                    ]}>
                                        {label}
                                    </Text>
                                </TouchableOpacity>
                            </React.Fragment>
                        );
                    }

                    return (
                        <TouchableOpacity
                            key={route.key}
                            accessibilityRole="button"
                            accessibilityState={isFocused ? { selected: true } : {}}
                            accessibilityLabel={options.tabBarAccessibilityLabel}
                            testID={options.tabBarTestID}
                            onPress={onPress}
                            onLongPress={onLongPress}
                            style={styles.tabItem}
                        >
                            <MaterialIcons
                                name={getIconName(route.name)}
                                size={24}
                                color={isFocused ? COLORS.primary : 'rgba(255, 255, 255, 0.6)'}
                            />
                            <Text style={[
                                styles.tabLabel,
                                { color: isFocused ? COLORS.primary : 'rgba(255, 255, 255, 0.6)' }
                            ]}>
                                {label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

const getIconName = (routeName) => {
    switch (routeName) {
        case 'Fridge': return 'kitchen';
        case 'Shopping': return 'shopping-cart';
        case 'Recipes': return 'menu-book';
        case 'Profile': return 'person';
        default: return 'help';
    }
};

const styles = StyleSheet.create({
    tabBarContainer: {
        position: 'absolute',
        bottom: 0,
        width: width,
        height: Platform.OS === 'ios' ? 90 : 70,
        backgroundColor: 'transparent',
        paddingHorizontal: SPACING.md,
        paddingBottom: Platform.OS === 'ios' ? 20 : 0,
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: COLORS.backgroundDark,
        height: 64,
        borderRadius: RADIUS.xl,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8,
        alignItems: 'center',
        paddingHorizontal: SPACING.sm,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
    },
    tabLabel: {
        fontSize: 11,
        fontFamily: FONTS.bold,
        marginTop: 4,
    },
    plusButtonContainer: {
        width: 70,
        height: 70,
        bottom: 25,
        alignItems: 'center',
        justifyContent: 'center',
    },
    plusButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: COLORS.primary, // Transparent terracotta
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 10,
        borderWidth: 4,
        borderColor: COLORS.white,
    }
});

export default CustomTabBar;
