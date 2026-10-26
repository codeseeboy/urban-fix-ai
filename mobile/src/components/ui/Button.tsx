import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@/theme/tokens';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'lg' | 'md' | 'sm';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

const heights: Record<Size, number> = { lg: 54, md: 46, sm: 36 };
const iconSizes: Record<Size, number> = { lg: 20, md: 18, sm: 16 };

const variantStyle: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, fg: colors.textOnPrimary },
  secondary: { bg: colors.surfaceRaised, fg: colors.text, border: colors.borderStrong },
  ghost: { bg: 'transparent', fg: colors.text },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  success: { bg: colors.success, fg: colors.textOnPrimary },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const v = variantStyle[variant];
  const inactive = disabled || loading;

  return (
    <PressableScale
      haptic
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={[
        styles.base,
        {
          height: heights[size],
          backgroundColor: v.bg,
          borderColor: v.border ?? 'transparent',
          borderWidth: v.border ? StyleSheet.hairlineWidth * 2 : 0,
          paddingHorizontal: size === 'sm' ? spacing.md : spacing.xl,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          borderRadius: size === 'sm' ? radius.md : radius.lg,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={styles.row}>
          {Icon ? <Icon size={iconSizes[size]} color={v.fg} strokeWidth={2.2} /> : null}
          <Text variant={size === 'sm' ? 'label' : 'bodyStrong'} color={v.fg}>
            {label}
          </Text>
          {IconRight ? <IconRight size={iconSizes[size]} color={v.fg} strokeWidth={2.2} /> : null}
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
