import { useQuery } from '@tanstack/react-query';
import { CalendarClock, ClipboardCheck } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { issuesApi } from '@/api';
import { IssueRow } from '@/components/IssueRow';
import { EmptyState, ErrorState, Segmented, Skeleton, Text } from '@/components/ui';
import { firstName, shortDate } from '@/lib/format';
import { qk } from '@/lib/query';
import { useSession } from '@/store/session';
import { isOpenStatus, statusOf } from '@/theme/domain';
import { colors, gutter, palette, radius, spacing } from '@/theme/tokens';

type Tab = 'active' | 'done';

export function WorkerHome() {
  const insets = useSafeAreaInsets();
  const user = useSession((s) => s.user);
  const [tab, setTab] = useState<Tab>('active');
  const [now] = useState(Date.now);
  const tasks = useQuery({
    queryKey: qk.tasks(user?._id ?? ''),
    queryFn: () => issuesApi.feed({ assignedTo: user!._id, limit: 100 }),
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const { active, done, overdue } = useMemo(() => {
    const all = tasks.data ?? [];
    const a = all.filter((i) => isOpenStatus(statusOf(i.status)));
    return {
      active: a.sort((x, y) => (x.deadline ?? '9').localeCompare(y.deadline ?? '9')),
      done: all.filter((i) => !isOpenStatus(statusOf(i.status))),
      overdue: a.filter((i) => i.deadline && new Date(i.deadline).getTime() < now).length,
    };
  }, [tasks.data, now]);

  const list = tab === 'active' ? active : done;
  const stats = [
    { label: 'Active', value: active.length, color: palette.blue400 },
    { label: 'Overdue', value: overdue, color: palette.red400 },
    { label: 'Completed', value: done.length, color: palette.green400 },
  ];

  return (
    <View style={styles.root}>
      <FlatList
        data={tasks.isPending ? [] : list}
        keyExtractor={(i) => i._id}
        contentContainerStyle={{ paddingBottom: spacing.xxxl }}
        ListHeaderComponent={
          <View style={{ paddingTop: insets.top + spacing.md, paddingHorizontal: gutter, gap: spacing.lg, paddingBottom: spacing.lg }}>
            <View>
              <Text variant="overline" tone="tertiary">
                Field operations
              </Text>
              <Text variant="display">Hi, {firstName(user?.name)}</Text>
            </View>
            <View style={styles.stats}>
              {stats.map((s) => (
                <View key={s.label} style={styles.stat}>
                  {tasks.isPending ? <Skeleton width={30} height={24} /> : <Text variant="numeric" color={s.value ? s.color : colors.text}>{s.value}</Text>}
                  <Text variant="caption" tone="secondary">
                    {s.label}
                  </Text>
                </View>
              ))}
            </View>
            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                { value: 'active', label: `Active (${active.length})` },
                { value: 'done', label: `Completed (${done.length})` },
              ]}
            />
          </View>
        }
        renderItem={({ item }) => {
          const late = item.deadline && isOpenStatus(statusOf(item.status)) && new Date(item.deadline).getTime() < now;
          return (
            <View style={{ paddingHorizontal: gutter, paddingBottom: spacing.md }}>
              <IssueRow
                issue={item}
                trailing={
                  item.deadline ? (
                    <View style={[styles.due, late && { backgroundColor: colors.dangerSoft }]}>
                      <CalendarClock size={12} color={late ? colors.danger : colors.textSecondary} />
                      <Text variant="caption" color={late ? colors.danger : colors.textSecondary}>
                        {shortDate(item.deadline)}
                      </Text>
                    </View>
                  ) : undefined
                }
              />
            </View>
          );
        }}
        ListEmptyComponent={
          tasks.isPending ? (
            <View style={{ paddingHorizontal: gutter, gap: spacing.md }}>
              {[0, 1, 2].map((k) => (
                <Skeleton key={k} height={96} radius={radius.lg} />
              ))}
            </View>
          ) : tasks.isError ? (
            <ErrorState error={tasks.error} onRetry={() => tasks.refetch()} />
          ) : (
            <EmptyState
              icon={ClipboardCheck}
              tint={palette.green400}
              title={tab === 'active' ? 'No active tasks' : 'Nothing completed yet'}
              message={tab === 'active' ? 'New assignments from the municipal office will show up here.' : 'Tasks you resolve will be listed here.'}
            />
          )
        }
        refreshControl={<RefreshControl refreshing={tasks.isRefetching} onRefresh={() => void tasks.refetch()} tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.surfaceRaised} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  stats: { flexDirection: 'row', padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.border },
  stat: { flex: 1, gap: 2 },
  due: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised },
});
