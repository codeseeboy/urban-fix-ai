import { useQuery } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { issuesApi } from '@/api';
import { Avatar, Skeleton, Text } from '@/components/ui';
import { timeAgo } from '@/lib/format';
import { qk } from '@/lib/query';
import { colors, radius, spacing } from '@/theme/tokens';

const STAFF = new Set(['admin', 'super_admin', 'department_admin', 'field_worker']);

export function Comments({ issueId }: { issueId: string }) {
  const comments = useQuery({ queryKey: qk.comments(issueId), queryFn: () => issuesApi.comments(issueId) });

  if (comments.isPending) {
    return (
      <View style={{ gap: spacing.md }}>
        {[0, 1].map((k) => (
          <View key={k} style={styles.row}>
            <Skeleton width={32} height={32} radius={16} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width={110} height={12} />
              <Skeleton width="80%" height={14} />
            </View>
          </View>
        ))}
      </View>
    );
  }
  if (comments.isError) {
    return (
      <Text variant="callout" tone="tertiary">
        {comments.error.message}
      </Text>
    );
  }
  if (!comments.data.length) {
    return (
      <View style={styles.empty}>
        <MessageCircle size={18} color={colors.textTertiary} />
        <Text variant="callout" tone="tertiary">
          No comments yet. Add details or say you’ve seen it too.
        </Text>
      </View>
    );
  }
  return (
    <View style={{ gap: spacing.lg }}>
      {comments.data.map((c) => {
        const staff = STAFF.has(c.user?.role ?? '');
        return (
          <View key={c._id} style={styles.row}>
            <Avatar name={c.user?.name} size={32} />
            <View style={{ flex: 1, gap: 2 }}>
              <View style={styles.head}>
                <Text variant="label">{c.user?.name ?? 'Citizen'}</Text>
                {staff ? (
                  <View style={styles.staff}>
                    <Text variant="caption" tone="brand" style={{ fontSize: 10 }}>
                      OFFICIAL
                    </Text>
                  </View>
                ) : null}
                <Text variant="caption" tone="tertiary">
                  {timeAgo(c.createdAt)}
                </Text>
              </View>
              <Text variant="callout" tone="secondary">
                {c.text}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  staff: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.xs, backgroundColor: colors.primarySoft },
  empty: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
});
