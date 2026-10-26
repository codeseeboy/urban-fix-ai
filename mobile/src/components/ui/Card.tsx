import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@/theme/tokens';

import { PressableScale } from './PressableScale';

export type CardProps = ViewProps & {
  padded?: boolean;
  onPress?: () => void;
  tone?: 'default' | 'raised' | 'outline';
  style?: StyleProp<ViewStyle>;
};

/** Surface container. Dark UIs separate layers with a hairline border, not shadows. */
export function Card({ padded = true, onPress, tone = 'default', style, children, ...rest }: CardProps) {
  const surface: ViewStyle = {
    backgroundColor: tone === 'raised' ? colors.surfaceRaised : tone === 'outline' ? 'transparent' : colors.surface,
    borderColor: tone === 'raised' ? colors.borderStrong : colors.border,
  };
  const content = [styles.base, surface, padded && styles.padded, style];

  if (onPress) {
    return (
      <PressableScale onPress={onPress} scaleTo={0.985} style={content} accessibilityRole="button" {...rest}>
        {children}
      </PressableScale>
    );
  }
  return (
    <View style={content} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, overflow: 'hidden' },
  padded: { padding: spacing.lg },
});
