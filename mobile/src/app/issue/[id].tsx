import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowBigUp,
  Bell,
  BellRing,
  Building2,
  CalendarClock,
  ChevronLeft,
  MapPin,
  Navigation,
  Send,
  Share2,
  Siren,
  UserCog,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Share, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, Extrapolation } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { issuesApi, type Comment, type Issue } from '@/api';
import { useUpvote } from '@/components/IssueCard';
import { AiInsight } from '@/components/issue/AiInsight';
import { Comments } from '@/components/issue/Comments';
import { StatusStepper } from '@/components/issue/StatusStepper';
import { Timeline } from '@/components/issue/Timeline';
import { WorkerPanel } from '@/components/issue/WorkerPanel';
import { LeafletMap } from '@/components/LeafletMap';
import { Avatar, CategoryBadge, ErrorState, IconButton, PressableScale, SeverityBadge, Skeleton, StatusBadge, Text, toast } from '@/components/ui';
import { mediaUrl } from '@/lib/api';
import { compact, dateTime, shortDate, timeAgo } from '@/lib/format';
import { qk } from '@/lib/query';
import { isWorker, useSession } from '@/store/session';
import { categoryMeta, categoryOf, severityMeta, severityOf } from '@/theme/domain';
import { alphaOf, colors, gutter, palette, radius, spacing, type } from '@/theme/tokens';

function SectionTitle({ children, right }: { children: string; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <Text variant="heading">{children}</Text>
      {right}
    </View>
  );
}

function ActionButton({ icon: Icon, label, active, color, onPress }: { icon: typeof Bell; label: string; active?: boolean; color?: string; onPress: () => void }) {
  const tint = active ? color ?? colors.primary : colors.textSecondary;
  return (
    <PressableScale haptic onPress={onPress} style={[styles.action, active && { backgroundColor: alphaOf(tint, 0.14), borderColor: alphaOf(tint, 0.4) }]} accessibilityRole="button" accessibilityLabel={label}>
      <Icon size={19} color={tint} fill={active && Icon === ArrowBigUp ? tint : 'transparent'} strokeWidth={2.1} />
      <Text variant="label" color={active ? tint : colors.textSecondary}>
        {label}
      </Text>
    </PressableScale>
  );
}

function Detail({ issue }: { issue: Issue }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const qc = useQueryClient();
  const user = useSession((s) => s.user);
  const vote = useUpvote(issue);
  const [following, setFollowing] = useState(!!user && !!issue.followers?.includes(user._id));
  const [comment, setComment] = useState('');

  const heroH = Math.round(width * 0.85);
  const image = mediaUrl(issue.image);
  const cat = categoryMeta[categoryOf(issue.category)];
  const sev = severityMeta[severityOf(issue.aiSeverity)];
  const [lon, lat] = issue.location?.coordinates ?? [0, 0];
  const hasLocation = !!(lat || lon);
  const official = issue.authorType === 'MunicipalPage';
  const myTask = !!user && isWorker(user.role) && issue.assignedTo === user._id;
  const authorName = issue.anonymous ? 'Anonymous citizen' : issue.user?.name || 'Citizen';

  const reports = useQuery({ queryKey: qk.reports(issue._id), queryFn: () => issuesApi.reports(issue._id), enabled: !official });

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const heroStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [-heroH, 0, heroH], [-heroH / 2, 0, heroH * 0.45], Extrapolation.CLAMP) },
      { scale: interpolate(scrollY.value, [-heroH, 0], [2, 1], Extrapolation.CLAMP) },
    ],
  }));
  const barStyle = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [heroH - 140, heroH - 80], [0, 1], Extrapolation.CLAMP) }));

  const follow = async () => {
    const prev = following;
    setFollowing(!prev);
    try {
      const r = await issuesApi.follow(issue._id);
      setFollowing(r.following);
      toast.success(r.following ? 'You’ll get updates on this issue' : 'Stopped following');
    } catch (e) {
      setFollowing(prev);
      toast.error(e instanceof Error ? e.message : 'Could not follow');
    }
  };

  const send = useMutation({
    mutationFn: (text: string) => issuesApi.addComment(issue._id, text),
    onSuccess: (c) => {
      setComment('');
      qc.setQueryData(qk.comments(issue._id), (old: Comment[] | undefined) => [...(old ?? []), c]);
      toast.success('Comment posted · +2 points');
    },
    onError: (e) => toast.error(e.message),
  });

  const share = () =>
    Share.share({
      message: `${issue.title}\n${cat.label} · ${sev.label} severity · ${issue.status}\n${issue.location?.address ?? ''}${hasLocation ? `\nhttps://maps.google.com/?q=${lat},${lon}` : ''}\n— reported on UrbanFix`,
    }).catch(() => {});

  const directions = () => Linking.openURL(Platform.select({ ios: `maps:0,0?q=${lat},${lon}`, default: `geo:${lat},${lon}?q=${lat},${lon}` })).catch(() => Linking.openURL(`https://maps.google.com/?q=${lat},${lon}`));

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Animated.View style={[{ height: heroH }, heroStyle]}>
            {image ? (
              <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: cat.soft, alignItems: 'center', justifyContent: 'center' }]}>
                <cat.icon size={64} color={cat.color} strokeWidth={1.4} />
              </View>
            )}
            <LinearGradient colors={['rgba(11,16,33,0.55)', 'transparent', 'transparent', colors.bg]} locations={[0, 0.25, 0.6, 1]} style={StyleSheet.absoluteFill} />
          </Animated.View>

          <View style={[styles.sheet, { marginTop: -spacing.huge }]}>
            <View style={styles.badges}>
              <StatusBadge status={issue.status} />
              {!official ? <SeverityBadge severity={issue.aiSeverity} /> : null}
              <CategoryBadge category={issue.category} />
              {issue.emergency ? (
                <View style={styles.emergency}>
                  <Siren size={13} color={palette.white} strokeWidth={2.6} />
                  <Text variant="label" tone="inverse">
                    Emergency
                  </Text>
                </View>
              ) : null}
            </View>

            <Text variant="title" style={{ marginTop: spacing.md }}>
              {issue.title}
            </Text>

            <View style={styles.metaRow}>
              <MapPin size={15} color={colors.textTertiary} />
              <Text variant="callout" tone="secondary" style={{ flex: 1 }} numberOfLines={2}>
                {issue.location?.address || 'Location not available'}
              </Text>
            </View>

            <View style={styles.author}>
              <Avatar name={authorName} uri={issue.anonymous ? null : mediaUrl(issue.user?.avatar)} size={36} verified={!issue.anonymous && (issue.user?.verified || issue.user?.isPage)} />
              <View style={{ flex: 1 }}>
                <Text variant="label">{authorName}</Text>
                <Text variant="caption" tone="tertiary">
                  {official ? 'Official update' : 'Reported'} {timeAgo(issue.createdAt)} · {dateTime(issue.createdAt)}
                </Text>
              </View>
            </View>

            {!official ? (
              <View style={styles.actions}>
                <ActionButton icon={ArrowBigUp} label={compact(vote.count)} active={vote.on} onPress={vote.toggle} />
                <ActionButton icon={following ? BellRing : Bell} label={following ? 'Following' : 'Follow'} active={following} color={palette.cyan400} onPress={follow} />
                <ActionButton icon={Share2} label="Share" onPress={share} />
              </View>
            ) : null}

            {myTask ? (
              <View style={styles.block}>
                <WorkerPanel issue={issue} userId={user!._id} />
              </View>
            ) : null}

            {!official ? (
              <View style={styles.block}>
                <SectionTitle>Progress</SectionTitle>
                <View style={styles.card}>
                  <StatusStepper status={issue.status} />
                  {issue.departmentTag || issue.assignedToUser || issue.deadline ? (
                    <View style={styles.assign}>
                      {issue.departmentTag ? (
                        <View style={styles.assignItem}>
                          <Building2 size={15} color={colors.textTertiary} />
                          <Text variant="callout" tone="secondary">
                            {issue.departmentTag}
                          </Text>
                        </View>
                      ) : null}
                      {issue.assignedToUser ? (
                        <View style={styles.assignItem}>
                          <UserCog size={15} color={colors.textTertiary} />
                          <Text variant="callout" tone="secondary">
                            {issue.assignedToUser.name}
                          </Text>
                        </View>
                      ) : null}
                      {issue.deadline ? (
                        <View style={styles.assignItem}>
                          <CalendarClock size={15} color={colors.textTertiary} />
                          <Text variant="callout" tone="secondary">
                            Due {shortDate(issue.deadline)}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}

            {issue.description ? (
              <View style={styles.block}>
                <SectionTitle>Details</SectionTitle>
                <Text variant="body" tone="secondary">
                  {issue.description}
                </Text>
                {issue.aiTags?.length ? (
                  <View style={styles.tags}>
                    {issue.aiTags.slice(0, 6).map((t) => (
                      <View key={t} style={styles.tag}>
                        <Text variant="caption" tone="secondary">
                          #{t}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            {!official ? (
              <View style={styles.block}>
                <AiInsight issue={issue} />
              </View>
            ) : null}

            {issue.resolutionProof?.afterImage ? (
              <View style={styles.block}>
                <SectionTitle>Before & after</SectionTitle>
                <View style={styles.ba}>
                  {[
                    { label: 'Before', uri: image },
                    { label: 'After', uri: mediaUrl(issue.resolutionProof.afterImage) },
                  ].map((p) => (
                    <View key={p.label} style={{ flex: 1, gap: 6 }}>
                      {p.uri ? <Image source={{ uri: p.uri }} style={styles.baImg} contentFit="cover" /> : <View style={styles.baImg} />}
                      <Text variant="caption" tone={p.label === 'After' ? 'success' : 'tertiary'}>
                        {p.label}
                      </Text>
                    </View>
                  ))}
                </View>
                {issue.resolutionProof.workerRemarks ? (
                  <Text variant="callout" tone="secondary" style={{ marginTop: spacing.sm }}>
                    “{issue.resolutionProof.workerRemarks}”
                  </Text>
                ) : null}
              </View>
            ) : null}

            {reports.data && reports.data.length > 0 ? (
              <View style={styles.block}>
                <SectionTitle right={<Text variant="callout" tone="tertiary">{`${reports.data.length} more`}</Text>}>Also reported by</SectionTitle>
                <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }} style={{ marginHorizontal: -gutter }}>
                  <View style={{ width: gutter - spacing.md }} />
                  {reports.data.map((r) => (
                    <View key={r.id} style={styles.report}>
                      {r.image ? <Image source={{ uri: mediaUrl(r.image)! }} style={styles.reportImg} contentFit="cover" /> : <View style={styles.reportImg} />}
                      <Text variant="caption" tone="secondary" numberOfLines={1}>
                        {r.reporter_anonymous ? 'Anonymous' : r.reporter_username || 'Citizen'} · {timeAgo(r.created_at)}
                      </Text>
                    </View>
                  ))}
                  <View style={{ width: gutter - spacing.md }} />
                </Animated.ScrollView>
              </View>
            ) : null}

            {hasLocation ? (
              <View style={styles.block}>
                <SectionTitle
                  right={
                    <PressableScale onPress={directions} style={styles.link}>
                      <Navigation size={14} color={colors.info} />
                      <Text variant="label" color={colors.info}>
                        Directions
                      </Text>
                    </PressableScale>
                  }
                >
                  Location
                </SectionTitle>
                <LeafletMap
                  style={styles.map}
                  center={{ lat, lon }}
                  zoom={16}
                  interactive={false}
                  points={[{ id: issue._id, lat, lon, color: sev.color, selected: true, pulse: !!issue.emergency }]}
                />
              </View>
            ) : null}

            {issue.statusTimeline?.length ? (
              <View style={styles.block}>
                <SectionTitle>Activity</SectionTitle>
                <View style={styles.card}>
                  <Timeline entries={issue.statusTimeline} />
                </View>
              </View>
            ) : null}

            <View style={styles.block}>
              <SectionTitle>Comments</SectionTitle>
              <Comments issueId={issue._id} />
            </View>
            <View style={{ height: spacing.xxl }} />
          </View>
        </Animated.ScrollView>

        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <Avatar name={user?.name} uri={mediaUrl(user?.avatar)} size={34} />
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Add a comment…"
            placeholderTextColor={colors.textTertiary}
            selectionColor={colors.primary}
            style={styles.input}
            multiline
            maxLength={500}
          />
          <IconButton
            icon={Send}
            accessibilityLabel="Post comment"
            size={40}
            color={comment.trim() ? colors.primary : colors.textTertiary}
            disabled={!comment.trim() || send.isPending}
            onPress={() => send.mutate(comment.trim())}
          />
        </View>
      </KeyboardAvoidingView>

      <Animated.View style={[styles.bar, { paddingTop: insets.top, height: insets.top + 56 }, barStyle]} pointerEvents="none">
        <Text variant="subheading" numberOfLines={1} style={{ flex: 1, marginHorizontal: 64 }} align="center">
          {issue.title}
        </Text>
      </Animated.View>
      <View style={[styles.nav, { top: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} variant="glass" accessibilityLabel="Go back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))} />
        <IconButton icon={Share2} variant="glass" accessibilityLabel="Share" onPress={share} />
      </View>
    </View>
  );
}

export default function IssueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const issue = useQuery({ queryKey: qk.issue(id), queryFn: () => issuesApi.get(id), enabled: !!id });

  // The detail payload already carries comments — seed the comments query with them.
  const payload = issue.data as (Issue & { comments?: Comment[] }) | undefined;
  useEffect(() => {
    if (payload?.comments) qc.setQueryData(qk.comments(id), payload.comments);
  }, [payload, id, qc]);

  const content = useMemo(() => (payload ? <Detail key={payload._id + payload.status} issue={payload} /> : null), [payload]);

  if (issue.isPending) {
    return (
      <View style={styles.root}>
        <Skeleton height={340} radius={0} />
        <View style={{ padding: gutter, gap: spacing.md }}>
          <Skeleton width={180} height={24} radius={radius.pill} />
          <Skeleton width="90%" height={26} />
          <Skeleton width="60%" />
          <Skeleton height={120} radius={radius.xl} style={{ marginTop: spacing.lg }} />
        </View>
        <View style={[styles.nav, { top: insets.top + spacing.sm }]}>
          <IconButton icon={ChevronLeft} variant="glass" accessibilityLabel="Go back" onPress={() => router.back()} />
        </View>
      </View>
    );
  }
  if (issue.isError) {
    return (
      <View style={[styles.root, { justifyContent: 'center' }]}>
        <ErrorState error={issue.error} onRetry={() => issue.refetch()} />
        <View style={[styles.nav, { top: insets.top + spacing.sm }]}>
          <IconButton icon={ChevronLeft} accessibilityLabel="Go back" onPress={() => router.back()} />
        </View>
      </View>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  sheet: { paddingHorizontal: gutter, backgroundColor: 'transparent' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  emergency: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: palette.red400 },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: spacing.sm },
  author: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
  action: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  block: { marginTop: spacing.xxl },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  card: { padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.border },
  assign: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: colors.border },
  assignItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised },
  ba: { flexDirection: 'row', gap: spacing.md },
  baImg: { width: '100%', aspectRatio: 1, borderRadius: radius.lg, backgroundColor: colors.surfaceRaised },
  report: { width: 132, gap: 6 },
  reportImg: { width: 132, height: 132, borderRadius: radius.lg, backgroundColor: colors.surfaceRaised },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  map: { height: 180, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.border },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.bgDeep,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: colors.border,
  },
  input: {
    ...(type.callout as object),
    flex: 1,
    color: colors.text,
    minHeight: 40,
    maxHeight: 110,
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    paddingBottom: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
  },
  bar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgDeep, borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: colors.border },
  nav: { position: 'absolute', left: spacing.lg, right: spacing.lg, flexDirection: 'row', justifyContent: 'space-between' },
});
