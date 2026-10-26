import { StyleSheet, View } from 'react-native';

import type { TimelineEntry } from '@/api';
import { Text } from '@/components/ui';
import { dateTime } from '@/lib/format';
import { statusMeta, statusOf } from '@/theme/domain';
import { colors, spacing } from '@/theme/tokens';

/** Vertical activity log, newest first. */
export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  const list = [...entries].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return (
    <View>
      {list.map((e, i) => {
        const m = e.status in statusMeta ? statusMeta[statusOf(e.status)] : { label: e.status, color: colors.textSecondary };
        const last = i === list.length - 1;
        const by = e.updatedByUser?.name || e.dept;
        return (
          <View key={`${e.timestamp}-${i}`} style={styles.item}>
            <View style={styles.rail}>
              <View style={[styles.dot, { backgroundColor: m.color }, i === 0 && styles.dotFirst]} />
              {!last ? <View style={styles.line} /> : null}
            </View>
            <View style={[styles.body, !last && { paddingBottom: spacing.lg }]}>
              <View style={styles.head}>
                <Text variant="bodyStrong" color={i === 0 ? m.color : colors.text}>
                  {m.label}
                </Text>
                <Text variant="caption" tone="tertiary">
                  {dateTime(e.timestamp)}
                </Text>
              </View>
              {e.comment ? (
                <Text variant="callout" tone="secondary">
                  {e.comment}
                </Text>
              ) : null}
              {by ? (
                <Text variant="caption" tone="tertiary">
                  by {by}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', gap: spacing.md },
  rail: { width: 14, alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  dotFirst: { width: 14, height: 14, borderRadius: 7, marginTop: 4, borderWidth: 3, borderColor: colors.surface },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginTop: 4 },
  body: { flex: 1, gap: 2 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.sm },
});
