import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { colors, radius, spacing } from '@/theme/tokens';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: LucideIcon;
  /** Accent colour when selected (defaults to brand blue). */
  color?: string;
};

/** Selectable filter chip. */
export function Chip({ label, selected = false, onPress, icon: Icon, color = colors.primary }: ChipProps) {
  const fg = selected ? color : colors.textSecondary;
  return (
    <PressableScale
      haptic
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.base,
        {
          backgroundColor: selected ? `${color}22` : colors.surface,
          borderColor: selected ? `${color}88` : colors.border,
        },
      ]}
    >
      {Icon ? <Icon size={15} color={fg} strokeWidth={2.2} /> : null}
      <Text variant="label" color={selected ? color : colors.textSecondary}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    height: 36,
    paddingHorizontal: spacing.md + 2,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});
