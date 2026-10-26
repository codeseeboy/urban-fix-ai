import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Camera, MapPinned, Sparkles } from 'lucide-react-native';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ServerPill } from '@/components/ServerPill';
import { Button, Text } from '@/components/ui';
import { alphaOf, colors, gutter, palette, radius, spacing } from '@/theme/tokens';

const POINTS = [
  { icon: Camera, color: palette.cyan400, title: 'Snap it', body: 'One photo is enough — AI fills in the details.' },
  { icon: MapPinned, color: palette.blue400, title: 'Pin it', body: 'Exact GPS location goes to the right department.' },
  { icon: Sparkles, color: palette.green400, title: 'Track it', body: 'Follow every step until it’s fixed.' },
];

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const heroH = Math.min(420, height * 0.46);

  return (
    <View style={styles.root}>
      <View style={{ height: heroH }}>
        <Image source={require('../../../assets/hero-city.jpg')} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient
          colors={[alphaOf(palette.navy900, 0.35), alphaOf(palette.navy900, 0.55), palette.navy900]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.brand, { paddingTop: insets.top + spacing.lg }]}>
          <Image source={require('../../../assets/logo-mark.png')} style={styles.logo} contentFit="contain" />
          <Text variant="subheading">UrbanFix</Text>
        </View>
      </View>

      <View style={[styles.body, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Animated.View entering={FadeInDown.duration(500)}>
          <Text variant="display">Fix your city,{'\n'}one photo at a time.</Text>
          <Text variant="body" tone="secondary" style={{ marginTop: spacing.sm }}>
            Report civic issues in seconds and see them through to resolution.
          </Text>
        </Animated.View>

        <View style={styles.points}>
          {POINTS.map((p, i) => (
            <Animated.View key={p.title} entering={FadeInDown.delay(120 + i * 90).duration(450)} style={styles.point}>
              <View style={[styles.pointIcon, { backgroundColor: alphaOf(p.color, 0.14) }]}>
                <p.icon size={18} color={p.color} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{p.title}</Text>
                <Text variant="callout" tone="tertiary">
                  {p.body}
                </Text>
              </View>
            </Animated.View>
          ))}
        </View>

        <View style={{ flex: 1 }} />
        <View style={{ gap: spacing.md }}>
          <Button label="Create account" onPress={() => router.push('/sign-up')} />
          <Button label="I already have an account" variant="secondary" onPress={() => router.push('/sign-in')} />
          <ServerPill />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: gutter },
  logo: { width: 34, height: 34, borderRadius: radius.sm },
  body: { flex: 1, paddingHorizontal: gutter, marginTop: -spacing.huge },
  points: { gap: spacing.lg, marginTop: spacing.xxl },
  point: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pointIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
