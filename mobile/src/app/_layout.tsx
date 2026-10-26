import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, SplashScreen, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastHost } from '@/components/ui';
import { queryClient } from '@/lib/query';
import { discoverServer } from '@/lib/server';
import { useSession } from '@/store/session';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});
SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, border: colors.border, primary: colors.primary, text: colors.text },
};

export default function RootLayout() {
  const hydrated = useSession((s) => s.hydrated);
  const signedIn = useSession((s) => !!s.token);

  useEffect(() => {
    useSession.getState().hydrate();
    discoverServer().catch(() => {});
  }, []);

  useEffect(() => {
    if (hydrated) SplashScreen.hideAsync().catch(() => {});
  }, [hydrated]);

  if (!hydrated) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider style={{ backgroundColor: colors.bg }}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider value={theme}>
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
              <Stack.Screen name="index" options={{ animation: 'none' }} />
              <Stack.Protected guard={!signedIn}>
                <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
              </Stack.Protected>
              <Stack.Protected guard={signedIn}>
                <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
                <Stack.Screen name="issue/[id]" />
                <Stack.Screen name="report" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
                <Stack.Screen name="assistant" options={{ animation: 'slide_from_bottom' }} />
                <Stack.Screen name="leaderboard" />
                <Stack.Screen name="pages/index" />
                <Stack.Screen name="pages/[id]" />
                <Stack.Screen name="my-reports" />
                <Stack.Screen name="edit-profile" />
              </Stack.Protected>
              <Stack.Screen name="settings" />
            </Stack>
            <ToastHost />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
