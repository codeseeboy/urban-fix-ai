import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FileText } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import { issuesApi } from '@/api';
import { IssueRow } from '@/components/IssueRow';
import { EmptyState, ErrorState, Header, Screen, Segmented, Skeleton } from '@/components/ui';
import { qk } from '@/lib/query';
import { useSession } from '@/store/session';
import { isOpenStatus, statusOf } from '@/theme/domain';
import { colors, gutter, radius, spacing } from '@/theme/tokens';

type Tab = 'all' | 'open' | 'resolved';

export default function MyReports() {
  const uid = useSession((s) => s.user?._id ?? '');
  const [tab, setTab] = useState<Tab>('all');
  const reports = useQuery({ queryKey: qk.myReports(uid), queryFn: () => issuesApi.feed({ filter: 'my_posts', userId: uid, limit: 100 }), enabled: !!uid });

  const all = useMemo(() => reports.data ?? [], [reports.data]);
  const list = useMemo(
    () => all.filter((i) => (tab === 'all' ? true : tab === 'open' ? isOpenStatus(statusOf(i.status)) : statusOf(i.status) === 'Resolved')),
    [all, tab],
  );
  const openCount = all.filter((i) => isOpenStatus(statusOf(i.status))).length;

  return (
    <Screen>
      <Header title="My reports" subtitle={reports.data ? `${all.length} total` : undefined} />
      <FlatList
        data={reports.isPending ? [] : list}
        keyExtractor={(i) => i._id}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: spacing.huge, gap: spacing.md, flexGrow: 1 }}
        ListHeaderComponent={
          <View style={{ paddingBottom: spacing.sm }}>
            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                { value: 'all', label: `All (${all.length})` },
                { value: 'open', label: `Open (${openCount})` },
                { value: 'resolved', label: `Resolved (${all.length - openCount})` },
              ]}
            />
          </View>
        }
        renderItem={({ item }) => <IssueRow issue={item} />}
        ListEmptyComponent={
          reports.isPending ? (
            <View style={{ gap: spacing.md }}>
              {[0, 1, 2].map((k) => (
                <Skeleton key={k} height={96} radius={radius.lg} />
              ))}
            </View>
          ) : reports.isError ? (
            <ErrorState error={reports.error} onRetry={() => void reports.refetch()} />
          ) : (
            <EmptyState
              icon={FileText}
              title={tab === 'all' ? 'No reports yet' : tab === 'open' ? 'Nothing open' : 'Nothing resolved yet'}
              message="Every report you file shows up here with its live status."
              actionLabel={tab === 'all' ? 'Report an issue' : undefined}
              onAction={() => router.push('/report')}
            />
          )
        }
        refreshControl={<RefreshControl refreshing={reports.isRefetching} onRefresh={() => void reports.refetch()} tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.surfaceRaised} />}
      />
    </Screen>
  );
}

