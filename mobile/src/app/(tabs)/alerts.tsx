import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ArrowBigUp, Award, BellOff, BellRing, CheckCheck, ClipboardList, MessageCircle, RefreshCcw, type LucideIcon } from 'lucide-react-native';
import { useMemo } from 'react';
import { Alert, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { notificationsApi, type Notification } from '@/api';
import { Button, EmptyState, ErrorState, PressableScale, Skeleton, Text, toast } from '@/components/ui';
import { timeAgo } from '@/lib/format';
import { qk } from '@/lib/query';
import { alphaOf, colors, gutter, palette, radius, spacing } from '@/theme/tokens';

const TYPE_META: Record<string, { icon: LucideIcon; color: string }> = {
  status: { icon: RefreshCcw, color: palette.blue400 },
  upvote: { icon: ArrowBigUp, color: palette.orange400 },
  comment: { icon: MessageCircle, color: palette.cyan400 },
  assignment: { icon: ClipboardList, color: palette.violet400 },
  badge: { icon: Award, color: palette.amber400 },
};

function isToday(iso: string) {
  const d = new Date(iso);
  const n = new Date();
  return d.toDateString() === n.toDateString();
}

export default function Alerts() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: qk.notifications, queryFn: notificationsApi.list });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.notifications });
  };

  const readAll = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  });

  const open = async (n: Notification) => {
    if (!n.read) {
      qc.setQueryData(qk.notifications, (old: { notifications: Notification[]; unreadCount: number } | undefined) =>
        old ? { notifications: old.notifications.map((x) => (x._id === n._id ? { ...x, read: true } : x)), unreadCount: Math.max(0, old.unreadCount - 1) } : old,
      );
      notificationsApi.markRead(n._id).then(invalidate, () => {});
    }
    if (n.issueId) router.push(`/issue/${n.issueId}`);
  };

  const remove = (n: Notification) =>
    Alert.alert('Delete notification?', n.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          notificationsApi.remove(n._id).then(invalidate, (e: Error) => toast.error(e.message)),
      },
    ]);

  const sections = useMemo(() => {
    const items = list.data?.notifications ?? [];
    const today = items.filter((n) => isToday(n.createdAt));
    const earlier = items.filter((n) => !isToday(n.createdAt));
    return [
      { title: 'Today', data: today },
      { title: 'Earlier', data: earlier },
    ].filter((s) => s.data.length);
  }, [list.data]);

  const unread = list.data?.unreadCount ?? 0;

  return (
    <View style={styles.root}>
      <SectionList
        sections={sections}
        keyExtractor={(n) => n._id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: spacing.xxxl, flexGrow: 1 }}
        ListHeaderComponent={
          <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
            <View style={{ flex: 1 }}>
              <Text variant="display">Alerts</Text>
              <Text variant="callout" tone="tertiary">
                {unread ? `${unread} unread` : 'You’re all caught up'}
              </Text>
            </View>
            {unread ? <Button label="Mark all read" icon={CheckCheck} size="sm" variant="secondary" fullWidth={false} loading={readAll.isPending} onPress={() => readAll.mutate()} /> : null}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text variant="overline" tone="tertiary" style={styles.section}>
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => {
          const meta = TYPE_META[item.type] ?? { icon: BellRing, color: palette.ink300 };
          return (
            <PressableScale scaleTo={0.985} onPress={() => open(item)} onLongPress={() => remove(item)} style={[styles.item, !item.read && styles.unread]}>
              <View style={[styles.icon, { backgroundColor: alphaOf(meta.color, 0.14) }]}>
                <meta.icon size={18} color={meta.color} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant={item.read ? 'body' : 'bodyStrong'} numberOfLines={2}>
                  {item.title}
                </Text>
                {item.desc ? (
                  <Text variant="callout" tone="secondary" numberOfLines={2}>
                    {item.desc}
                  </Text>
                ) : null}
                <Text variant="caption" tone="tertiary">
                  {timeAgo(item.createdAt)}
                </Text>
              </View>
              {!item.read ? <View style={styles.dot} /> : null}
            </PressableScale>
          );
        }}
        ListEmptyComponent={
          list.isPending ? (
            <View style={{ paddingHorizontal: gutter, gap: spacing.md }}>
              {[0, 1, 2, 3].map((k) => (
                <Skeleton key={k} height={76} radius={radius.lg} />
              ))}
            </View>
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : (
            <EmptyState icon={BellOff} title="No notifications" message="Updates on your reports, comments and upvotes will show up here." />
          )
        }
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.surfaceRaised} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: gutter, paddingBottom: spacing.md },
  section: { paddingHorizontal: gutter, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginHorizontal: gutter,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  unread: { backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong },
  icon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6 },
});
