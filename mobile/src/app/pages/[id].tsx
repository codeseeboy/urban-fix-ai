import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { BadgeCheck, Check, Mail, Megaphone, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, Linking, RefreshControl, StyleSheet, View } from 'react-native';

import { issuesApi, municipalApi } from '@/api';
import { IssueCard } from '@/components/IssueCard';
import { Avatar, Button, EmptyState, ErrorState, Header, PressableScale, Screen, Skeleton, Text, toast } from '@/components/ui';
import { mediaUrl } from '@/lib/api';
import { compact } from '@/lib/format';
import { qk } from '@/lib/query';
import { colors, gutter, radius, spacing } from '@/theme/tokens';

export default function PageDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const page = useQuery({ queryKey: qk.page(id), queryFn: () => municipalApi.get(id) });
  const posts = useQuery({ queryKey: qk.pagePosts(id), queryFn: () => issuesApi.feed({ authorType: 'MunicipalPage', municipalPageId: id, limit: 30 }) });
  const [busy, setBusy] = useState(false);

  const p = page.data;
  const toggleFollow = async () => {
    if (!p) return;
    setBusy(true);
    try {
      if (p.isFollowing) await municipalApi.unfollow(p._id);
      else await municipalApi.follow(p._id);
      await qc.invalidateQueries({ queryKey: qk.page(id) });
      toast.success(p.isFollowing ? `Unfollowed ${p.name}` : `Following ${p.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update');
    } finally {
      setBusy(false);
    }
  };

  if (page.isError) {
    return (
      <Screen>
        <Header />
        <ErrorState error={page.error} onRetry={() => void page.refetch()} />
      </Screen>
    );
  }

  const cover = mediaUrl(p?.cover_image);

  return (
    <Screen>
      <Header title={p?.name} />
      <FlatList
        data={posts.data ?? []}
        keyExtractor={(i) => i._id}
        contentContainerStyle={{ paddingBottom: spacing.huge, flexGrow: 1 }}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: gutter, paddingBottom: spacing.xl }}>
            <View style={styles.cover}>
              {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              <LinearGradient colors={['rgba(45,124,246,0.35)', 'rgba(34,199,232,0.15)', colors.surface]} style={StyleSheet.absoluteFill} />
            </View>
            <View style={styles.identity}>
              <View style={styles.avatarRing}>
                {p ? <Avatar name={p.name} uri={mediaUrl(p.avatar)} size={72} /> : <Skeleton width={72} height={72} radius={36} />}
              </View>
              <View style={{ flex: 1 }} />
              {p ? (
                <Button
                  label={p.isFollowing ? 'Following' : 'Follow'}
                  icon={p.isFollowing ? Check : Plus}
                  variant={p.isFollowing ? 'secondary' : 'primary'}
                  size="sm"
                  fullWidth={false}
                  loading={busy}
                  onPress={toggleFollow}
                />
              ) : null}
            </View>
            {p ? (
              <View style={{ gap: spacing.xs, marginTop: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text variant="title">{p.name}</Text>
                  {p.verified ? <BadgeCheck size={20} color={colors.primary} /> : null}
                </View>
                <Text variant="callout" tone="tertiary">
                  @{p.handle} · {p.department || p.page_type || 'Municipal'} · {compact(p.followers_count ?? 0)} followers
                </Text>
                {p.description ? (
                  <Text variant="body" tone="secondary" style={{ marginTop: spacing.sm }}>
                    {p.description}
                  </Text>
                ) : null}
                {p.contact_email ? (
                  <PressableScale onPress={() => Linking.openURL(`mailto:${p.contact_email}`)} style={styles.contact}>
                    <Mail size={14} color={colors.info} />
                    <Text variant="label" color={colors.info}>
                      {p.contact_email}
                    </Text>
                  </PressableScale>
                ) : null}
              </View>
            ) : (
              <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                <Skeleton width={200} height={24} />
                <Skeleton width={160} />
              </View>
            )}
            <Text variant="heading" style={{ marginTop: spacing.xxl }}>
              Official updates
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: gutter, paddingBottom: spacing.lg }}>
            <IssueCard issue={item} />
          </View>
        )}
        ListEmptyComponent={
          posts.isPending ? (
            <View style={{ paddingHorizontal: gutter }}>
              <Skeleton height={200} radius={radius.xl} />
            </View>
          ) : posts.isError ? (
            <ErrorState error={posts.error} onRetry={() => void posts.refetch()} />
          ) : (
            <EmptyState icon={Megaphone} title="No updates yet" message="Announcements and work updates from this department will appear here." />
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={page.isRefetching || posts.isRefetching}
            onRefresh={() => {
              void page.refetch();
              void posts.refetch();
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surfaceRaised}
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cover: { height: 120, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.border },
  identity: { flexDirection: 'row', alignItems: 'flex-end', marginTop: -36, paddingHorizontal: spacing.md },
  avatarRing: { padding: 4, borderRadius: 999, backgroundColor: colors.bg },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm, alignSelf: 'flex-start' },
});
