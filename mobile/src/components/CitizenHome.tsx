import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Flame, Inbox, Search, Sparkles, Trophy, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { gamificationApi, issuesApi, type FeedFilter, type Issue } from '@/api';
import { IssueCard, IssueCardSkeleton } from '@/components/IssueCard';
import { Chip, EmptyState, ErrorState, IconButton, PressableScale, Skeleton, Text } from '@/components/ui';
import { compact, firstName } from '@/lib/format';
import { qk } from '@/lib/query';
import { useSession } from '@/store/session';
import { colors, gutter, palette, radius, spacing, type } from '@/theme/tokens';

const PAGE = 12;

const FILTERS: { value: FeedFilter; label: string }[] = [
  { value: 'all', label: 'Latest' },
  { value: 'trending', label: 'Trending' },
  { value: 'high_priority', label: 'Urgent' },
  { value: 'following', label: 'Following' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'my_posts', label: 'Mine' },
];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function CityPulse() {
  const stats = useQuery({ queryKey: qk.stats, queryFn: gamificationApi.stats, staleTime: 60_000 });
  const s = stats.data;
  const items = [
    { label: 'Open', value: s ? s.pending : null, color: palette.amber400 },
    { label: 'In progress', value: s ? s.inProgress : null, color: palette.blue400 },
    { label: 'Resolved', value: s ? s.resolved : null, color: palette.green400 },
  ];
  const rate = s && s.totalIssues ? Math.round((s.resolved / s.totalIssues) * 100) : null;
  return (
    <View style={styles.pulse}>
      <View style={styles.pulseHead}>
        <Text variant="overline" tone="tertiary">
          City pulse
        </Text>
        {rate !== null ? (
          <Text variant="caption" tone="success">
            {rate}% resolved
          </Text>
        ) : null}
      </View>
      <View style={styles.pulseRow}>
        {items.map((it) => (
          <View key={it.label} style={styles.pulseItem}>
            {it.value === null ? <Skeleton width={40} height={24} /> : <Text variant="numeric">{compact(it.value)}</Text>}
            <View style={styles.pulseLabel}>
              <View style={[styles.dot, { backgroundColor: it.color }]} />
              <Text variant="caption" tone="secondary">
                {it.label}
              </Text>
            </View>
          </View>
        ))}
      </View>
      {rate !== null ? (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${rate}%` }]} />
        </View>
      ) : null}
    </View>
  );
}

export function CitizenHome() {
  const insets = useSafeAreaInsets();
  const user = useSession((s) => s.user);
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  const feed = useInfiniteQuery({
    queryKey: qk.feed(filter, search),
    queryFn: ({ pageParam }) => issuesApi.feed({ filter, userId: user?._id, search: search || undefined, limit: PAGE, offset: pageParam, authorType: filter === 'following' ? undefined : 'User' }),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length < PAGE ? undefined : all.length * PAGE),
  });

  const issues = useMemo(() => {
    const seen = new Set<string>();
    return (feed.data?.pages.flat() ?? []).filter((i) => (seen.has(i._id) ? false : (seen.add(i._id), true)));
  }, [feed.data]);

  const header = (
    <View>
      <View style={[styles.top, { paddingTop: insets.top + spacing.md }]}>
        <View style={{ flex: 1 }}>
          <Text variant="callout" tone="tertiary">
            {greeting()},
          </Text>
          <Text variant="title" numberOfLines={1}>
            {firstName(user?.name)}
          </Text>
        </View>
        <IconButton icon={Trophy} accessibilityLabel="Leaderboard" onPress={() => router.push('/leaderboard')} color={palette.amber400} />
      </View>

      <View style={styles.section}>
        <CityPulse />
      </View>

      <PressableScale onPress={() => router.push('/assistant')} style={styles.assistant} accessibilityRole="button" accessibilityLabel="Ask UrbanFix AI">
        <View style={styles.assistantIcon}>
          <Sparkles size={18} color={palette.violet400} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">Ask UrbanFix AI</Text>
          <Text variant="caption" tone="tertiary" numberOfLines={1}>
            “What’s broken near me?” · “Status of my reports?”
          </Text>
        </View>
      </PressableScale>

      <View style={styles.searchWrap}>
        <Search size={18} color={colors.textTertiary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search issues, streets, areas"
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.primary}
          style={styles.searchInput}
          returnKeyType="search"
        />
        {query ? <IconButton icon={X} variant="plain" size={30} accessibilityLabel="Clear search" onPress={() => setQuery('')} /> : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map((f) => (
          <Chip key={f.value} label={f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} icon={f.value === 'trending' ? Flame : undefined} />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.root}>
      <FlashList
        data={issues}
        keyExtractor={(i: Issue) => i._id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <IssueCard issue={item} />
          </View>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          feed.isPending ? (
            <View style={{ gap: spacing.lg, paddingHorizontal: gutter }}>
              <IssueCardSkeleton />
              <IssueCardSkeleton />
            </View>
          ) : feed.isError ? (
            <ErrorState error={feed.error} onRetry={() => feed.refetch()} />
          ) : (
            <EmptyState
              icon={Inbox}
              title={search ? 'No matches' : filter === 'my_posts' ? 'No reports yet' : 'Nothing here yet'}
              message={search ? `Nothing matches “${search}”.` : filter === 'my_posts' ? 'Spot something broken? Report it in a few seconds.' : 'Issues reported in your city will appear here.'}
              actionLabel={filter === 'my_posts' ? 'Report an issue' : undefined}
              onAction={() => router.push('/report')}
            />
          )
        }
        ListFooterComponent={feed.isFetchingNextPage ? <View style={styles.item}><IssueCardSkeleton /></View> : <View style={{ height: spacing.xxl }} />}
        onEndReached={() => feed.hasNextPage && !feed.isFetchingNextPage && feed.fetchNextPage()}
        onEndReachedThreshold={0.6}
        refreshControl={<RefreshControl refreshing={feed.isRefetching && !feed.isFetchingNextPage} onRefresh={() => void feed.refetch()} tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.surfaceRaised} />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: gutter, paddingBottom: spacing.lg },
  section: { paddingHorizontal: gutter },
  pulse: { padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.border, gap: spacing.md },
  pulseHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pulseRow: { flexDirection: 'row' },
  pulseItem: { flex: 1, gap: 4 },
  pulseLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: palette.green400 },
  assistant: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: gutter,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(139, 124, 246, 0.08)',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(139, 124, 246, 0.28)',
  },
  assistantIcon: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: 'rgba(139, 124, 246, 0.16)', alignItems: 'center', justifyContent: 'center' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: gutter,
    marginTop: spacing.xl,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  searchInput: { ...(type.body as object), flex: 1, color: colors.text, paddingVertical: 0 },
  filters: { gap: spacing.sm, paddingHorizontal: gutter, paddingVertical: spacing.lg },
  item: { paddingHorizontal: gutter, paddingBottom: spacing.lg },
});
