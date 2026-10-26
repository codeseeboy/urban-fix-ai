import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, gutter, spacing } from '@/theme/tokens';

import { IconButton } from './IconButton';
import { Text } from './Text';

export type ScreenProps = {
  children: ReactNode;
  /** Apply the top safe-area inset (off when a Header handles it). */
  edgeTop?: boolean;
  edgeBottom?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Screen({ children, edgeTop = false, edgeBottom = false, style }: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: edgeTop ? insets.top : 0, paddingBottom: edgeBottom ? insets.bottom : 0 }, style]}>
      {children}
    </View>
  );
}

export type HeaderProps = {
  title?: string;
  subtitle?: string;
  /** Show a back chevron. Defaults to true when the router can go back. */
  back?: boolean;
  onBack?: () => void;
  right?: ReactNode;
  /** Large left-aligned title used on tab roots. */
  large?: boolean;
};

export function Header({ title, subtitle, back, onBack, right, large = false }: HeaderProps) {
  const insets = useSafeAreaInsets();
  const showBack = back ?? router.canGoBack();

  if (large) {
    return (
      <View style={[styles.large, { paddingTop: insets.top + spacing.md }]}>
        <View style={{ flex: 1 }}>
          {subtitle ? (
            <Text variant="overline" tone="tertiary">
              {subtitle}
            </Text>
          ) : null}
          {title ? <Text variant="display">{title}</Text> : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    );
  }

  return (
    <View style={[styles.bar, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.side}>
        {showBack ? <IconButton icon={ChevronLeft} accessibilityLabel="Go back" onPress={onBack ?? (() => router.back())} /> : null}
      </View>
      <View style={styles.center}>
        {title ? (
          <Text variant="subheading" numberOfLines={1} align="center">
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text variant="caption" tone="tertiary" numberOfLines={1} align="center">
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={[styles.side, styles.sideRight]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  large: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: gutter, paddingBottom: spacing.lg, gap: spacing.md },
  right: { flexDirection: 'row', gap: spacing.sm, paddingBottom: 2 },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
  side: { minWidth: 42, flexDirection: 'row', gap: spacing.sm },
  sideRight: { justifyContent: 'flex-end' },
  center: { flex: 1, alignItems: 'center' },
});
