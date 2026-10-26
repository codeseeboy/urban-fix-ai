import { Building2, Sparkles } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { ImageAnalysis } from '@/api';
import { CategoryBadge, SeverityBadge, Text } from '@/components/ui';
import { alphaOf, colors, palette, radius, spacing } from '@/theme/tokens';

/** Summary of what the vision model concluded about the photo. */
export function AiVerdict({ analysis }: { analysis: ImageAnalysis }) {
  const pct = Math.round((analysis.confidence ?? 0) * 100);
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Sparkles size={16} color={palette.violet400} />
        <Text variant="label" style={{ flex: 1 }}>
          AI detected
        </Text>
        <Text variant="caption" tone="tertiary">
          {pct}% confident{analysis.latencyMs ? ` · ${(analysis.latencyMs / 1000).toFixed(1)}s` : ''}
        </Text>
      </View>
      <View style={styles.badges}>
        <CategoryBadge category={analysis.category} />
        <SeverityBadge severity={analysis.severity} />
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      <View style={styles.dept}>
        <Building2 size={14} color={colors.textTertiary} />
        <Text variant="callout" tone="secondary">
          Routes to <Text variant="callout">{analysis.departmentTag}</Text>
        </Text>
      </View>
      {analysis.observations?.length ? (
        <View style={{ gap: 4 }}>
          {analysis.observations.slice(0, 3).map((o) => (
            <View key={o} style={styles.obs}>
              <View style={styles.bullet} />
              <Text variant="callout" tone="secondary" style={{ flex: 1 }}>
                {o}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    gap: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: alphaOf(palette.violet400, 0.07),
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: alphaOf(palette.violet400, 0.25),
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badges: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  fill: { height: 4, backgroundColor: palette.violet400 },
  dept: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  obs: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  bullet: { width: 4, height: 4, borderRadius: 2, backgroundColor: palette.violet400, marginTop: 9 },
});
