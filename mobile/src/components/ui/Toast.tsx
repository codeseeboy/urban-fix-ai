import { CheckCircle2, Info, XCircle } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { colors, radius, spacing } from '@/theme/tokens';

import { Text } from './Text';

type Tone = 'success' | 'error' | 'info';
type ToastState = { id: number; message: string; tone: Tone } | null;

const useToastStore = create<{ toast: ToastState; show: (message: string, tone?: Tone) => void; clear: () => void }>((set) => ({
  toast: null,
  show: (message, tone = 'info') => set({ toast: { id: Date.now(), message, tone } }),
  clear: () => set({ toast: null }),
}));

/** Fire-and-forget toast usable from anywhere, including mutation callbacks. */
export const toast = {
  success: (m: string) => useToastStore.getState().show(m, 'success'),
  error: (m: string) => useToastStore.getState().show(m, 'error'),
  info: (m: string) => useToastStore.getState().show(m, 'info'),
};

const toneIcon = { success: CheckCircle2, error: XCircle, info: Info };
const toneColor = { success: colors.success, error: colors.danger, info: colors.info };

/** Mounted once in the root layout. */
export function ToastHost() {
  const current = useToastStore((s) => s.toast);
  const clear = useToastStore((s) => s.clear);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!current) return;
    const t = setTimeout(clear, current.tone === 'error' ? 4200 : 2800);
    return () => clearTimeout(t);
  }, [current, clear]);

  if (!current) return null;
  const Icon = toneIcon[current.tone];
  return (
    <Animated.View
      key={current.id}
      entering={FadeInUp.springify().damping(18)}
      exiting={FadeOutUp.duration(160)}
      pointerEvents="none"
      style={[styles.toast, { top: insets.top + spacing.sm }]}
    >
      <Icon size={20} color={toneColor[current.tone]} strokeWidth={2.2} />
      <Text variant="callout" style={styles.text} numberOfLines={3}>
        {current.message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSheet,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.borderStrong,
    elevation: 12,
  },
  text: { flex: 1 },
});
