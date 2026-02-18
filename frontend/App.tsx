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

export default function App() {
    const [fontsLoaded] = useFonts({
        Inter_400Regular,
        Inter_500Medium,
        Inter_600SemiBold,
        Inter_700Bold,
        Inter_900Black,
    });

    const [showSplash, setShowSplash] = React.useState(true);

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
        return <SplashScreen />;
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
