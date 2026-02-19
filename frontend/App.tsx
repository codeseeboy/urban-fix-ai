import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_900Black } from '@expo-google-fonts/inter';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import SplashScreen from './src/screens/Auth/SplashScreen';
import { colors } from './src/theme/colors';

import { registerForPushNotificationsAsync } from './src/services/notificationService';
import * as Notifications from 'expo-notifications';
import { useNavigation } from '@react-navigation/native';

export default function App() {
    const [fontsLoaded] = useFonts({
        Inter_400Regular,
        Inter_500Medium,
        Inter_600SemiBold,
        Inter_700Bold,
        Inter_900Black,
    });

    const [showSplash, setShowSplash] = React.useState(true);
    const notificationListener = React.useRef<any>(null);
    const responseListener = React.useRef<any>(null);

    React.useEffect(() => {
        // Register for push notifications
        registerForPushNotificationsAsync();

        // Listen for incoming notifications (foreground)
        notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
            console.log('🔔 Notification received:', notification);
        });

        // Listen for interaction (tap)
        responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
            console.log('🖱️ Notification tapped:', response);
            const data = response.notification.request.content.data;
            // Handle navigation based on data
            // Note: Navigation ref is needed for deep linking here, 
            // but for now we just log it. 
            // In a real app, we'd use a navigation service or pass the ref.
        });

        return () => {
            if (notificationListener.current) notificationListener.current.remove();
            if (responseListener.current) responseListener.current.remove();
        };
    }, []);

    React.useEffect(() => {
        if (fontsLoaded) {
            // After fonts load, wait 2.5 seconds then hide splash
            const timer = setTimeout(() => {
                setShowSplash(false);
            }, 2500);
            return () => clearTimeout(timer);
        }
    }, [fontsLoaded]);

    if (!fontsLoaded || showSplash) {
        return (
            <SafeAreaProvider>
                <SplashScreen />
            </SafeAreaProvider>
        );
    }

    return (
        <AuthProvider>
            <SafeAreaProvider>
                <StatusBar style="light" />
                <RootNavigator />
            </SafeAreaProvider>
        </AuthProvider>
    );
}

const styles = StyleSheet.create({
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
});
