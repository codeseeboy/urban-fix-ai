import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, hitSlop, radius } from '@/theme/tokens';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

export type IconButtonProps = {
  icon: LucideIcon;
  onPress?: () => void;
  accessibilityLabel: string;
  variant?: 'plain' | 'filled' | 'glass';
  size?: number;
  color?: string;
  /** Small count bubble (e.g. unread). Hidden when 0 or undefined. */
  badge?: number;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
};

export function IconButton({ icon: Icon, onPress, accessibilityLabel, variant = 'filled', size = 42, color, badge, style, disabled }: IconButtonProps) {
  const bg = variant === 'filled' ? colors.surfaceRaised : variant === 'glass' ? colors.scrim : 'transparent';
  return (
    <PressableScale
      haptic
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: radius.pill,
          backgroundColor: bg,
          borderWidth: variant === 'filled' ? StyleSheet.hairlineWidth * 2 : 0,
        },
        style,
      ]}
    >
      <Icon size={Math.round(size * 0.46)} color={color ?? colors.text} strokeWidth={2} />
      {badge ? (
        <View style={styles.badge}>
          <Text variant="caption" tone="inverse" style={styles.badgeText}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderColor: colors.border },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  badgeText: { fontSize: 10, lineHeight: 12, fontWeight: '800' },
});
