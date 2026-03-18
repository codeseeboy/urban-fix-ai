import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LogBox } from 'react-native';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_900Black } from '@expo-google-fonts/inter';
import { AuthProvider } from './src/context/AuthContext';
import { useAuth } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import SplashScreen from './src/screens/Auth/SplashScreen';
import ErrorBoundary from './src/components/ui/ErrorBoundary';

import * as Notifications from 'expo-notifications';
import * as ExpoSplashScreen from 'expo-splash-screen';

// Keep native splash visible until app is ready (prevents grey flash)
ExpoSplashScreen.preventAutoHideAsync().catch(() => {});

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

    const notificationListener = React.useRef<any>(null);
    const responseListener = React.useRef<any>(null);

    React.useEffect(() => {
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

    return (
        <ErrorBoundary>
            <AuthProvider>
                <SafeAreaProvider>
                    <StatusBar style="light" />
                    <AppBoot fontsLoaded={fontsLoaded} />
                </SafeAreaProvider>
            </AuthProvider>
        </ErrorBoundary>
    );
}

function AppBoot({ fontsLoaded }: { fontsLoaded: boolean }) {
    const { loading } = useAuth();
    const [ready, setReady] = React.useState(false);

    React.useEffect(() => {
        if (!fontsLoaded) return;
        if (loading) return;

        // Allow 1 frame for layout to mount before hiding native splash
        const t = setTimeout(() => {
            ExpoSplashScreen.hideAsync().catch(() => {});
            setReady(true);
        }, 120);
        return () => clearTimeout(t);
    }, [fontsLoaded, loading]);

    // Show the animated JS splash while bootstrapping (no grey flash)
    if (!ready) {
        return <SplashScreen />;
    }

    return <RootNavigator />;
}

