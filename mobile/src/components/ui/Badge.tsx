import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { categoryMeta, categoryOf, severityMeta, severityOf, statusMeta, statusOf } from '@/theme/domain';
import { radius, spacing } from '@/theme/tokens';

import { Text } from './Text';

export type BadgeProps = {
  label: string;
  color: string;
  soft: string;
  icon?: LucideIcon;
  dot?: boolean;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
};

export function Badge({ label, color, soft, icon: Icon, dot, size = 'md', style }: BadgeProps) {
  const small = size === 'sm';
  return (
    <View style={[styles.base, { backgroundColor: soft, paddingVertical: small ? 3 : 5, paddingHorizontal: small ? 8 : 10 }, style]}>
      {dot ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
      {Icon ? <Icon size={small ? 12 : 14} color={color} strokeWidth={2.4} /> : null}
      <Text variant={small ? 'caption' : 'label'} color={color} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function StatusBadge({ status, size }: { status?: string | null; size?: 'sm' | 'md' }) {
  const m = statusMeta[statusOf(status)];
  return <Badge label={m.label} color={m.color} soft={m.soft} dot size={size} />;
}

export function SeverityBadge({ severity, size }: { severity?: string | null; size?: 'sm' | 'md' }) {
  const m = severityMeta[severityOf(severity)];
  return <Badge label={m.label} color={m.color} soft={m.soft} dot size={size} />;
}

export function CategoryBadge({ category, size }: { category?: string | null; size?: 'sm' | 'md' }) {
  const m = categoryMeta[categoryOf(category)];
  return <Badge label={m.label} color={m.color} soft={m.soft} icon={m.icon} size={size} />;
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, borderRadius: radius.pill, alignSelf: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
