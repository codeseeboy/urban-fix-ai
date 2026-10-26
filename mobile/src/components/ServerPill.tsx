import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PressableScale, Text } from '@/components/ui';
import { useServer } from '@/hooks/useServer';
import { colors, radius, spacing } from '@/theme/tokens';

/** Compact connection indicator; tapping opens server settings. */
export function ServerPill() {
  const { url } = useServer();
  const ok = !!url;
  return (
    <PressableScale onPress={() => router.push('/settings')} style={styles.pill} accessibilityRole="button" accessibilityLabel="Server settings">
      <View style={[styles.dot, { backgroundColor: ok ? colors.success : colors.danger }]} />
      <Text variant="caption" tone="secondary" numberOfLines={1}>
        {ok ? `Connected · ${url!.replace(/^https?:\/\//, '')}` : 'Server not reachable · tap to set up'}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
