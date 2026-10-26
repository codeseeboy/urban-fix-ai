import { Image } from 'expo-image';
import { BadgeCheck } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { alphaOf, colors, palette } from '@/theme/tokens';

import { Text } from './Text';

const TONES = [palette.blue500, palette.violet400, palette.cyan400, palette.green400, palette.orange400, palette.amber400, palette.red400];

function toneFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

function initials(name?: string | null) {
  const parts = (name || '?').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return ((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export type AvatarProps = {
  name?: string | null;
  uri?: string | null;
  size?: number;
  verified?: boolean;
};

/** Photo avatar with a deterministic colour-initials fallback. */
export function Avatar({ name, uri, size = 40, verified }: AvatarProps) {
  const tone = toneFor(name || '?');
  return (
    <View style={{ width: size, height: size }}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" transition={150} />
      ) : (
        <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: alphaOf(tone, 0.2) }]}>
          <Text variant={size >= 56 ? 'heading' : 'label'} color={tone} style={size < 32 ? { fontSize: 11 } : null}>
            {initials(name)}
          </Text>
        </View>
      )}
      {verified ? (
        <View style={styles.verified}>
          <BadgeCheck size={Math.max(12, size * 0.32)} color={colors.primary} fill={colors.bg} strokeWidth={2.4} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  verified: { position: 'absolute', right: -3, bottom: -3 },
});
