import { useEffect } from 'react';
import { type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { colors, radius as r } from '@/theme/tokens';

export type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/** Breathing placeholder block. Kept to a single opacity pulse — cheap and calm. */
export function Skeleton({ width = '100%', height = 14, radius = r.sm, style }: SkeletonProps) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [t]);
  const animated = useAnimatedStyle(() => ({ opacity: 0.45 + t.value * 0.4 }));
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: colors.skeletonHighlight }, animated, style]} />;
}
