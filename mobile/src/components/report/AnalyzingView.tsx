import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { Text } from '@/components/ui';
import { alphaOf, colors, palette, radius, spacing } from '@/theme/tokens';

const STEPS = ['Reading the photo', 'Identifying the problem', 'Estimating severity', 'Routing to a department'];

/** Photo with a sweeping scan line while the vision model runs. */
export function AnalyzingView({ uri }: { uri: string }) {
  const [h, setH] = useState(0);
  const [step, setStep] = useState(0);
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }), -1, true);
    const id = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 900);
    return () => clearInterval(id);
  }, [t]);

  const line = useAnimatedStyle(() => ({ transform: [{ translateY: t.value * Math.max(0, h - 80) }] }));

  return (
    <View style={styles.wrap}>
      <View style={styles.frame} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: alphaOf(palette.navy900, 0.25) }]} />
        <Animated.View style={[styles.scan, line]}>
          <LinearGradient colors={['transparent', alphaOf(palette.cyan400, 0.35), 'transparent']} style={StyleSheet.absoluteFill} />
          <View style={styles.scanLine} />
        </Animated.View>
        {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
          <View key={c} style={[styles.corner, styles[c]]} />
        ))}
      </View>
      <View style={styles.status}>
        <View style={styles.badge}>
          <Sparkles size={16} color={palette.violet400} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="subheading">Analyzing with AI…</Text>
          <Text variant="callout" tone="tertiary">
            {STEPS[step]}
          </Text>
        </View>
      </View>
    </View>
  );
}

const C = 26;

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: spacing.xl },
  frame: { flex: 1, borderRadius: radius.xxl, overflow: 'hidden', backgroundColor: colors.surface },
  scan: { position: 'absolute', left: 0, right: 0, height: 80, justifyContent: 'center' },
  scanLine: { height: 2, backgroundColor: palette.cyan400, shadowColor: palette.cyan400, elevation: 6 },
  corner: { position: 'absolute', width: C, height: C, borderColor: palette.white },
  tl: { top: 16, left: 16, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 10 },
  tr: { top: 16, right: 16, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 10 },
  bl: { bottom: 16, left: 16, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 10 },
  br: { bottom: 16, right: 16, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 10 },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badge: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: alphaOf(palette.violet400, 0.15), alignItems: 'center', justifyContent: 'center' },
});
