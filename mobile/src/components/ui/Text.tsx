import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { colors, type, type TypeVariant } from '@/theme/tokens';

export type TextTone = 'primary' | 'secondary' | 'tertiary' | 'disabled' | 'inverse' | 'brand' | 'accent' | 'success' | 'warning' | 'danger';

const toneColor: Record<TextTone, string> = {
  primary: colors.text,
  secondary: colors.textSecondary,
  tertiary: colors.textTertiary,
  disabled: colors.textDisabled,
  inverse: colors.textOnPrimary,
  brand: colors.primary,
  accent: colors.accent,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
};

export type TextProps = RNTextProps & {
  variant?: TypeVariant;
  tone?: TextTone;
  /** Overrides `tone` with an explicit colour (category/status colours). */
  color?: string;
  align?: TextStyle['textAlign'];
};

/** The only text component screens use — enforces the type scale and palette. */
export function Text({ variant = 'body', tone = 'primary', color, align, style, ...rest }: TextProps) {
  return (
    <RNText
      {...rest}
      style={[type[variant] as TextStyle, { color: color ?? toneColor[tone] }, align ? { textAlign: align } : null, style]}
    />
  );
}
