import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, StyleSheet, LogBox } from 'react-native';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_900Black } from '@expo-google-fonts/inter';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import SplashScreen from './src/screens/Auth/SplashScreen';
import ErrorBoundary from './src/components/ui/ErrorBoundary';
import { colors } from './src/theme/colors';

import { registerForPushNotificationsAsync } from './src/services/notificationService';
import * as Notifications from 'expo-notifications';
import { useNavigation } from '@react-navigation/native';

// Suppress common non-critical warnings that can clutter logs
LogBox.ignoreLogs([
    'Non-serializable values were found in the navigation state',
    'VirtualizedLists should never be nested',
    'AsyncStorage has been extracted from react-native',
    'Setting a timer for a long period of time',
    'Possible Unhandled Promise Rejection',
]);

// Global handler for unhandled promise rejections (prevents crashes)
const originalHandler = ErrorUtils.getGlobalHandler();
ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.error('🚨 Global error caught:', error);
    console.error('Fatal:', isFatal);
    
    // For non-fatal errors, just log them
    // For fatal errors, show the error screen
    if (originalHandler) {
        // Don't call original handler for non-fatal errors to prevent crash
        if (isFatal) {
            originalHandler(error, isFatal);
        }
    }
});

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
        // Register for push notifications (wrapped in try-catch to prevent crashes)
        try {
            registerForPushNotificationsAsync().catch(e => {
                console.log('Push notification registration failed (non-critical):', e);
            });
        } catch (e) {
            console.log('Push notification setup error:', e);
        }

        // Listen for incoming notifications (foreground)
        try {
            notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
                console.log('🔔 Notification received:', notification);
            });

            // Listen for interaction (tap)
            responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
                console.log('🖱️ Notification tapped:', response);
                const data = response.notification.request.content.data;
                // Handle navigation based on data
            });
        } catch (e) {
            console.log('Notification listener setup error:', e);
        }

        return () => {
            try {
                if (notificationListener.current) notificationListener.current.remove();
                if (responseListener.current) responseListener.current.remove();
            } catch (e) {
                // Cleanup errors are non-critical
            }
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
        <ErrorBoundary>
            <AuthProvider>
                <SafeAreaProvider>
                    <StatusBar style="light" />
                    <RootNavigator />
                </SafeAreaProvider>
            </AuthProvider>
        </ErrorBoundary>
    );
}

const styles = StyleSheet.create({
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
});
