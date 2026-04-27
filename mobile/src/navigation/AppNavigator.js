import React, { useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { View, ActivityIndicator, Platform } from 'react-native';
import { useNavigationState } from '@react-navigation/native';

import HomeScreen from '../screens/HomeScreen';
import ShoppingListScreen from '../screens/ShoppingListScreen';
import RecipesScreen from '../screens/RecipesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ManualAddScreen from '../screens/ManualAddScreen';
import LoginScreen from '../screens/LoginScreen';
import RegistrationScreen from '../screens/RegistrationScreen';
import OTPVerificationScreen from '../screens/OTPVerificationScreen';
import OTPSuccessScreen from '../screens/OTPSuccessScreen';
import OCRScanScreen from '../screens/OCRScanScreen';
import SmartScanScreen from '../screens/SmartScanScreen';
import ScanAnalyzingScreen from '../screens/ScanAnalyzingScreen';
import OCRReviewScreen from '../screens/OCRReviewScreen';
import RecipeDetailScreen from '../screens/RecipeDetailScreen';
import MealPlanScreen from '../screens/MealPlanScreen';
import ChefChatScreen from '../screens/ChefChatScreen';
import FamilyMembersScreen from '../screens/FamilyMembersScreen';
import AddEditFamilyMemberScreen from '../screens/AddEditFamilyMemberScreen';
import FamilyScreen from '../screens/FamilyScreen';
import AIAutoScreen from '../screens/AIAutoScreen';
import AIIngredientScreen from '../screens/AIIngredientScreen';
import FilterScreen from '../screens/FilterScreen';


import MarketplaceScreen from '../screens/MarketplaceScreen';
import LocationSetupScreen from '../screens/LocationSetupScreen';
import CommunityMapScreen from '../screens/CommunityMapScreen';
import CreateListingScreen from '../screens/CreateListingScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import FavoriteRecipesScreen from '../screens/FavoriteRecipesScreen';
import CookingHistoryScreen from '../screens/CookingHistoryScreen';
import SupportScreen from '../screens/SupportScreen';
import UserInfoScreen from '../screens/UserInfoScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';
import CreateGroupScreen from '../screens/CreateGroupScreen';
import ExpiredItemsScreen from '../screens/ExpiredItemsScreen';
import CookingCompleteScreen from '../screens/CookingCompleteScreen';
import { COLORS, FONTS } from '../constants/theme';
import { ToastManager } from '../components/Toast';
import { ModalProvider, useModal } from '../contexts/ModalContext';
import { authService } from '../services/authService';
import { supabase } from '../services/supabaseConfig';

import CustomTabBar from './CustomTabBar';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Enhanced TabNavigator with 4+1 Design and Chef FAB
const TabNavigatorWithFAB = () => {
    const { isModalVisible } = useModal();
    const navigationState = useNavigationState(state => state);

    // Get current tab context
    const getCurrentTabContext = () => {
        if (!navigationState?.routes) return 'default';
        const currentRoute = navigationState.routes[navigationState.index];
        return currentRoute?.name?.toLowerCase() || 'default';
    };

    const currentTab = getCurrentTabContext();

    return (
        <View style={{ flex: 1 }}>
            <Tab.Navigator
                tabBar={props =>
                    !isModalVisible ? (
                        <CustomTabBar
                            {...props}
                            screenContext={currentTab}
                        />
                    ) : null
                }
                screenOptions={{
                    headerShown: false,
                }}
            >
                <Tab.Screen
                    name="Fridge"
                    component={HomeScreen}
                    options={{ title: 'Tủ lạnh' }}
                />
                <Tab.Screen
                    name="Shopping"
                    component={ShoppingListScreen}
                    options={{ title: 'Mua sắm' }}
                />
                <Tab.Screen
                    name="Recipes"
                    component={MealPlanScreen}
                    options={{ title: 'Khám phá' }}
                />
                <Tab.Screen
                    name="Profile"
                    component={ProfileScreen}
                    options={{ title: 'Cá nhân' }}
                />
            </Tab.Navigator>
        </View>
    );
};

const AppNavigator = () => {
    const [initializing, setInitializing] = useState(true);
    const [user, setUser] = useState(null);

    useEffect(() => {
        const initializeAuth = async () => {
            try {
                const { data: { user: currentUser } } = await supabase.auth.getUser();
                setUser(currentUser);
            } catch (error) {
                console.error('Auth initialization error:', error);
                setUser(null);
            } finally {
                setInitializing(false);
            }
        };

        initializeAuth();

        // Subscribe to auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setUser(session?.user || null);
        });

        return () => subscription.unsubscribe();
    }, []);

    if (initializing) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    return (
        <ModalProvider>
            <NavigationContainer>
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                    {!user ? (
                        <>
                            <Stack.Screen name="Login" component={LoginScreen} />
                            <Stack.Screen name="Registration" component={RegistrationScreen} />
                            <Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
                            <Stack.Screen name="OTPSuccess" component={OTPSuccessScreen} />
                        </>
                    ) : (
                        <>
                            <Stack.Screen name="Main" component={TabNavigatorWithFAB} />
                            <Stack.Screen name="ManualAdd" component={ManualAddScreen} />
                            <Stack.Screen name="OCRScan" component={OCRScanScreen} />
                            <Stack.Screen name="SmartScan" component={SmartScanScreen} />
                            <Stack.Screen name="ScanAnalyzing" component={ScanAnalyzingScreen} options={{ gestureEnabled: false }} />
                            <Stack.Screen name="OCRReview" component={OCRReviewScreen} />
                            <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} />
                            <Stack.Screen name="ChefChat" component={ChefChatScreen} />
                            <Stack.Screen name="Family" component={FamilyScreen} />
                            <Stack.Screen name="FamilyMembers" component={FamilyMembersScreen} />
                            <Stack.Screen name="AddEditFamilyMember" component={AddEditFamilyMemberScreen} />
                            <Stack.Screen name="AIAuto" component={AIAutoScreen} />
                            <Stack.Screen name="AIIngredient" component={AIIngredientScreen} />
                            <Stack.Screen name="Filter" component={FilterScreen} />


                            <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
                            <Stack.Screen name="FavoriteRecipes" component={FavoriteRecipesScreen} />
                            <Stack.Screen name="CookingHistory" component={CookingHistoryScreen} />
                            <Stack.Screen name="Support" component={SupportScreen} />
                            <Stack.Screen name="UserInfo" component={UserInfoScreen} />
                            <Stack.Screen name="ExpiredItems" component={ExpiredItemsScreen} />
                            <Stack.Screen name="CookingComplete" component={CookingCompleteScreen} />
                        </>
                    )}
                </Stack.Navigator>
            </NavigationContainer>
            <ToastManager />
        </ModalProvider>
    );
};

export default AppNavigator;
