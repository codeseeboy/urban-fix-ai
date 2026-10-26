import { Check } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { STATUS_FLOW, statusMeta, statusOf } from '@/theme/domain';
import { colors, palette, spacing } from '@/theme/tokens';

/** Four-step progress tracker: Submitted → Acknowledged → In progress → Resolved. */
export function StatusStepper({ status }: { status: string }) {
  const s = statusOf(status);
  if (s === 'Rejected') {
    return (
      <View style={styles.rejected}>
        <Text variant="bodyStrong" tone="secondary">
          Closed without action
        </Text>
        <Text variant="callout" tone="tertiary">
          {statusMeta.Rejected.description}
        </Text>
      </View>
    );
  }
  const current = STATUS_FLOW.indexOf(s);
  return (
    <View>
      <View style={styles.row}>
        {STATUS_FLOW.map((step, i) => {
          const done = i < current || s === 'Resolved';
          const active = i === current;
          const color = s === 'Resolved' ? palette.green400 : statusMeta[step].color;
          return (
            <View key={step} style={styles.step}>
              {i > 0 ? <View style={[styles.line, styles.lineLeft, { backgroundColor: i <= current ? color : colors.border }]} /> : null}
              {i < STATUS_FLOW.length - 1 ? <View style={[styles.line, styles.lineRight, { backgroundColor: i < current ? (s === 'Resolved' ? color : statusMeta[STATUS_FLOW[i + 1]].color) : colors.border }]} /> : null}
              <View
                style={[
                  styles.node,
                  done || active ? { backgroundColor: color, borderColor: color } : null,
                  active && s !== 'Resolved' ? { shadowColor: color, elevation: 6, borderWidth: 4, borderColor: colors.surface } : null,
                ]}
              >
                {done ? <Check size={13} color={colors.bg} strokeWidth={3.2} /> : null}
              </View>
              <Text variant="caption" align="center" tone={active ? 'primary' : done ? 'secondary' : 'tertiary'} style={styles.label} numberOfLines={1}>
                {statusMeta[step].label}
              </Text>
            </View>
          );
        })}
      </View>
      <Text variant="callout" tone="secondary" style={{ marginTop: spacing.md }}>
        {statusMeta[s].description}
      </Text>
    </View>
  );
}

const NODE = 24;

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  step: { flex: 1, alignItems: 'center' },
  line: { position: 'absolute', top: NODE / 2 - 1.5, height: 3, borderRadius: 2 },
  lineLeft: { left: 0, right: '50%' },
  lineRight: { left: '50%', right: 0 },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { marginTop: spacing.sm, fontSize: 11 },
  rejected: { gap: 4 },
});
