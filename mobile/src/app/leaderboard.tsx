import { useQuery } from '@tanstack/react-query';
import { Crown, Trophy } from 'lucide-react-native';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { gamificationApi, type LeaderboardEntry } from '@/api';
import { Avatar, EmptyState, ErrorState, Header, Screen, Skeleton, Text } from '@/components/ui';
import { mediaUrl } from '@/lib/api';
import { compact } from '@/lib/format';
import { qk } from '@/lib/query';
import { useSession } from '@/store/session';
import { alphaOf, colors, gutter, palette, radius, spacing } from '@/theme/tokens';

const MEDALS = [palette.amber400, '#C9D1E3', '#D08C5B'];

function Podium({ top }: { top: LeaderboardEntry[] }) {
  // Visual order: 2nd, 1st, 3rd
  const order = [top[1], top[0], top[2]].filter(Boolean) as LeaderboardEntry[];
  return (
    <View style={styles.podium}>
      {order.map((u) => {
        const place = u.rank - 1;
        const first = u.rank === 1;
        const medal = MEDALS[place] ?? colors.textSecondary;
        return (
          <Animated.View key={u._id} entering={FadeInDown.delay(place * 120).springify().damping(16)} style={styles.podiumCol}>
            {first ? <Crown size={22} color={palette.amber400} fill={alphaOf(palette.amber400, 0.3)} style={{ marginBottom: 4 }} /> : null}
            <View style={[styles.ring, { borderColor: medal }]}>
              <Avatar name={u.name} uri={mediaUrl(u.avatar)} size={first ? 72 : 58} />
            </View>
            <Text variant="label" align="center" numberOfLines={1} style={{ marginTop: spacing.sm }}>
              {u.name}
            </Text>
            <Text variant="caption" tone="tertiary">
              {compact(u.points)} pts
            </Text>
            <View style={[styles.block, { height: first ? 92 : place === 1 ? 70 : 54, backgroundColor: alphaOf(medal, 0.14), borderColor: alphaOf(medal, 0.35) }]}>
              <Text variant="title" color={medal}>
                {u.rank}
              </Text>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

export default function Leaderboard() {
  const me = useSession((s) => s.user?._id);
  const board = useQuery({ queryKey: qk.leaderboard, queryFn: gamificationApi.leaderboard });
  const data = board.data ?? [];
  const mine = data.find((u) => u._id === me);
  const rest = data.slice(3);

  return (
    <Screen>
      <Header title="Leaderboard" subtitle="Top civic contributors" />
      <FlatList
        data={board.isPending || board.isError ? [] : rest}
        keyExtractor={(u) => u._id}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: spacing.huge, gap: spacing.sm, flexGrow: 1 }}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.lg }}>
            {board.isPending ? (
              <View style={styles.podium}>
                {[0, 1, 2].map((k) => (
                  <View key={k} style={styles.podiumCol}>
                    <Skeleton width={60} height={60} radius={30} />
                    <Skeleton width={70} height={12} style={{ marginTop: spacing.sm }} />
                    <Skeleton height={60 + k * 10} radius={radius.lg} style={{ marginTop: spacing.md }} />
                  </View>
                ))}
              </View>
            ) : data.length ? (
              <Podium top={data.slice(0, 3)} />
            ) : null}
            {mine ? (
              <View style={styles.mine}>
                <Text variant="numeric" tone="brand" style={{ width: 44 }}>
                  #{mine.rank}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">Your rank</Text>
                  <Text variant="caption" tone="tertiary">
                    {mine.reportsCount} reports · {compact(mine.points)} points
                  </Text>
                </View>
                <Trophy size={20} color={colors.primary} />
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const isMe = item._id === me;
          return (
            <View style={[styles.row, isMe && styles.rowMe]}>
              <Text variant="bodyStrong" tone="tertiary" style={{ width: 32 }}>
                {item.rank}
              </Text>
              <Avatar name={item.name} uri={mediaUrl(item.avatar)} size={40} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {item.name}
                  {isMe ? ' (you)' : ''}
                </Text>
                <Text variant="caption" tone="tertiary">
                  {item.reportsCount} reports
                </Text>
              </View>
              <Text variant="bodyStrong">{compact(item.points)}</Text>
              <Text variant="caption" tone="tertiary">
                pts
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={
          board.isError ? (
            <ErrorState error={board.error} onRetry={() => void board.refetch()} />
          ) : !board.isPending && !data.length ? (
            <EmptyState icon={Trophy} title="No rankings yet" message="Report issues to earn points and appear here." />
          ) : undefined
        }
        refreshControl={<RefreshControl refreshing={board.isRefetching} onRefresh={() => void board.refetch()} tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.surfaceRaised} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  podium: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, paddingTop: spacing.lg },
  podiumCol: { flex: 1, alignItems: 'center' },
  ring: { borderWidth: 3, borderRadius: 999, padding: 3 },
  block: { alignSelf: 'stretch', marginTop: spacing.md, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, borderBottomWidth: 0, alignItems: 'center', justifyContent: 'center' },
  mine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.primarySoft,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: alphaOf(palette.blue500, 0.4),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  rowMe: { borderColor: alphaOf(palette.blue500, 0.5) },
});
