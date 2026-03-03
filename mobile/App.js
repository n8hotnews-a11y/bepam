import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  BeVietnamPro_400Regular,
  BeVietnamPro_500Medium,
  BeVietnamPro_600SemiBold,
  BeVietnamPro_700Bold
} from '@expo-google-fonts/be-vietnam-pro';
import { View, ActivityIndicator, LogBox } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import Constants from 'expo-constants';
import { COLORS } from './src/constants/theme';
import { hybridRecipeService } from './src/services/hybrid/HybridRecipeService';
import { notificationService } from './src/services/notificationService';

// Suppress some common RN warnings if needed
LogBox.ignoreLogs(['Setting a timer', 'InteractionManager has been deprecated']);

export default function App() {
  React.useEffect(() => {
    hybridRecipeService.initialize();
    notificationService.initialize();
  }, []);

  console.log('Constants.expoConfig:', Constants.expoConfig);

  const [fontsLoaded] = useFonts({
    'BeVietnamPro-Regular': BeVietnamPro_400Regular,
    'BeVietnamPro-Medium': BeVietnamPro_500Medium,
    'BeVietnamPro-SemiBold': BeVietnamPro_600SemiBold,
    'BeVietnamPro-Bold': BeVietnamPro_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}
