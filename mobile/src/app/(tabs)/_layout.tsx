import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { Bell, ClipboardList, House, Map, Plus, UserRound, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { notificationsApi } from '@/api';
import { PressableScale, Text } from '@/components/ui';
import { usePush } from '@/hooks/usePush';
import { qk } from '@/lib/query';
import { isWorker, useSession } from '@/store/session';
import { colors, radius, spacing } from '@/theme/tokens';

const ICONS: Record<string, LucideIcon> = { home: House, map: Map, alerts: Bell, profile: UserRound };

function TabBar({ state, descriptors, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const worker = isWorker(useSession((s) => s.user?.role));
  const unread = useQuery({ queryKey: qk.unread, queryFn: notificationsApi.unreadCount, refetchInterval: 60_000 });

  const items = state.routes.map((route, index) => {
    const focused = state.index === index;
    const Icon = route.name === 'home' && worker ? ClipboardList : ICONS[route.name] ?? House;
    const label = (descriptors[route.key].options.title as string) ?? route.name;
    const badge = route.name === 'alerts' ? unread.data ?? 0 : 0;
    return (
      <PressableScale
        key={route.key}
        haptic
        scaleTo={0.9}
        style={styles.item}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={label}
        onPress={() => {
          if (!focused) navigateToTab(route.key);
        }}
      >
        <View>
          <Icon size={23} color={focused ? colors.text : colors.textTertiary} strokeWidth={focused ? 2.3 : 1.9} />
          {badge > 0 ? (
            <View style={styles.badge}>
              <Text variant="caption" tone="inverse" style={styles.badgeText}>
                {badge > 9 ? '9+' : badge}
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="caption" color={focused ? colors.text : colors.textTertiary} style={{ fontSize: 10.5 }}>
          {label}
        </Text>
      </PressableScale>
    );
  });

  if (!worker) {
    items.splice(
      2,
      0,
      <View key="report" style={styles.item}>
        <PressableScale haptic scaleTo={0.9} onPress={() => router.push('/report')} style={styles.fab} accessibilityRole="button" accessibilityLabel="Report an issue">
          <Plus size={26} color={colors.textOnPrimary} strokeWidth={2.6} />
        </PressableScale>
      </View>,
    );
  }

  return <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>{items}</View>;
}

export default function TabsLayout() {
  const user = useSession((s) => s.user);
  const worker = isWorker(user?.role);
  usePush(user?._id);
  return (
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg }, animation: 'fade' }}>
      <Tabs.Screen name="home" options={{ title: worker ? 'Tasks' : 'Home' }} />
      <Tabs.Screen name="map" options={{ title: 'Map' }} />
      <Tabs.Screen name="alerts" options={{ title: 'Alerts' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.sm,
    backgroundColor: colors.bgDeep,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: colors.border,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 48 },
  fab: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -spacing.lg,
    borderWidth: 4,
    borderColor: colors.bgDeep,
    elevation: 8,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -9,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bgDeep,
  },
  badgeText: { fontSize: 9.5, lineHeight: 11, fontWeight: '800' },
});
