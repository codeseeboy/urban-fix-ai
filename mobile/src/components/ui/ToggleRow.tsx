import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, Switch, View } from 'react-native';

import { alphaOf, colors, radius, spacing } from '@/theme/tokens';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

export type ToggleRowProps = {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  tint?: string;
};

export function ToggleRow({ icon: Icon, title, subtitle, value, onChange, tint = colors.primary }: ToggleRowProps) {
  return (
    <PressableScale scaleTo={0.99} onPress={() => onChange(!value)} style={styles.row} accessibilityRole="switch" accessibilityState={{ checked: value }}>
      <View style={[styles.icon, { backgroundColor: alphaOf(tint, value ? 0.18 : 0.08) }]}>
        <Icon size={18} color={value ? tint : colors.textTertiary} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{title}</Text>
        {subtitle ? (
          <Text variant="caption" tone="tertiary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: colors.surfaceSheet, true: alphaOf(tint, 0.55) }} thumbColor={value ? tint : colors.textSecondary} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  icon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
