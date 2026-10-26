import type { LucideIcon } from 'lucide-react-native';
import { forwardRef, useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type TextInputInstance, type TextInputProps, type ViewStyle } from 'react-native';

import { colors, radius, spacing, type } from '@/theme/tokens';

import { Text } from './Text';

export type TextFieldProps = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string | null;
  icon?: LucideIcon;
  right?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
};

/** Labelled input with focus ring, leading icon, trailing slot and inline error. */
export const TextField = forwardRef<TextInputInstance, TextFieldProps>(function TextField(
  { label, hint, error, icon: Icon, right, containerStyle, multiline, onFocus, onBlur, style, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;

  return (
    <View style={[styles.wrap, containerStyle]}>
      {label ? (
        <Text variant="label" tone="secondary">
          {label}
        </Text>
      ) : null}
      <View style={[styles.field, multiline && styles.multiline, { borderColor }]}>
        {Icon ? <Icon size={18} color={focused ? colors.primary : colors.textTertiary} strokeWidth={2} style={multiline ? styles.iconTop : null} /> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, multiline && styles.inputMultiline, style]}
          {...rest}
        />
        {right}
      </View>
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="tertiary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1.5,
    backgroundColor: colors.surfaceRaised,
  },
  multiline: { alignItems: 'flex-start', paddingVertical: spacing.md },
  iconTop: { marginTop: 2 },
  input: { ...type.body, flex: 1, color: colors.text, paddingVertical: 0 } as object,
  inputMultiline: { minHeight: 96 },
});
