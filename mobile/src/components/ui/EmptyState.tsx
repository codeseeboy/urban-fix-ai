import type { LucideIcon } from 'lucide-react-native';
import { CloudOff } from 'lucide-react-native';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { alphaOf, colors, palette, radius, spacing } from '@/theme/tokens';

import { Button } from './Button';
import { Text } from './Text';

export type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  tint?: string;
  style?: StyleProp<ViewStyle>;
};

export function EmptyState({ icon: Icon, title, message, actionLabel, onAction, tint = palette.blue400, style }: EmptyStateProps) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={[styles.halo, { backgroundColor: alphaOf(tint, 0.08) }]}>
        <View style={[styles.iconWrap, { backgroundColor: alphaOf(tint, 0.16) }]}>
          <Icon size={28} color={tint} strokeWidth={2} />
        </View>
      </View>
      <Text variant="heading" align="center">
        {title}
      </Text>
      {message ? (
        <Text variant="callout" tone="secondary" align="center" style={styles.message}>
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} variant="secondary" size="md" style={{ marginTop: spacing.sm }} /> : null}
    </View>
  );
}

/** Network / server failure with a retry. Shows the real error message. */
export function ErrorState({ error, onRetry, style }: { error?: unknown; onRetry?: () => void; style?: StyleProp<ViewStyle> }) {
  const msg = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Something went wrong.';
  return (
    <EmptyState
      icon={CloudOff}
      tint={colors.danger}
      title="Couldn’t load this"
      message={msg}
      actionLabel={onRetry ? 'Try again' : undefined}
      onAction={onRetry}
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxxl, paddingVertical: spacing.huge, gap: spacing.sm },
  halo: { width: 96, height: 96, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  iconWrap: { width: 64, height: 64, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  message: { maxWidth: 300 },
});
