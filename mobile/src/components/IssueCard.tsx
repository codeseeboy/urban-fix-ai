import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowBigUp, BadgeCheck, MapPin, MessageCircle, Siren } from 'lucide-react-native';
import { memo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { issuesApi, type Issue } from '@/api';
import { Avatar, CategoryBadge, PressableScale, Skeleton, StatusBadge, Text, toast } from '@/components/ui';
import { mediaUrl } from '@/lib/api';
import { compact, timeAgo } from '@/lib/format';
import { useSession } from '@/store/session';
import { categoryMeta, categoryOf, severityMeta, severityOf } from '@/theme/domain';
import { alphaOf, colors, palette, radius, spacing } from '@/theme/tokens';

function authorOf(issue: Issue) {
  if (issue.anonymous) return { name: 'Anonymous citizen', avatar: null, verified: false };
  return { name: issue.user?.name || 'Citizen', avatar: issue.user?.avatar ?? null, verified: !!issue.user?.verified || !!issue.user?.isPage };
}

/** Upvote toggle with optimistic count. */
export function useUpvote(issue: Issue) {
  const uid = useSession((s) => s.user?._id);
  const [up, setUp] = useState({ on: !!uid && issue.upvotes?.includes(uid), count: issue.upvotes?.length ?? 0 });
  const toggle = async () => {
    const prev = up;
    setUp({ on: !prev.on, count: prev.count + (prev.on ? -1 : 1) });
    try {
      const r = await issuesApi.upvote(issue._id);
      setUp({ on: r.upvoted, count: r.upvotes.length });
    } catch (e) {
      setUp(prev);
      toast.error(e instanceof Error ? e.message : 'Could not upvote');
    }
  };
  return { ...up, toggle };
}

export const IssueCard = memo(function IssueCard({ issue }: { issue: Issue }) {
  const author = authorOf(issue);
  const sev = severityMeta[severityOf(issue.aiSeverity)];
  const cat = categoryMeta[categoryOf(issue.category)];
  const image = mediaUrl(issue.image);
  const vote = useUpvote(issue);
  const official = issue.authorType === 'MunicipalPage';

  return (
    <PressableScale scaleTo={0.985} onPress={() => router.push(`/issue/${issue._id}`)} style={styles.card} accessibilityRole="button" accessibilityLabel={issue.title}>
      {image ? (
        <View>
          <Image source={{ uri: image }} style={styles.image} contentFit="cover" transition={200} recyclingKey={issue._id} />
          <View style={styles.overlay}>
            <StatusBadge status={issue.status} size="sm" />
            {issue.emergency ? (
              <View style={styles.emergency}>
                <Siren size={12} color={palette.white} strokeWidth={2.6} />
                <Text variant="caption" tone="inverse">
                  Emergency
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : (
        <View style={[styles.noImage, { backgroundColor: cat.soft }]}>
          <cat.icon size={30} color={cat.color} strokeWidth={1.8} />
        </View>
      )}

      <View style={styles.body}>
        <View style={styles.metaRow}>
          <CategoryBadge category={issue.category} size="sm" />
          {!official ? (
            <View style={styles.sev}>
              <View style={[styles.sevDot, { backgroundColor: sev.color }]} />
              <Text variant="caption" color={sev.color}>
                {sev.label}
              </Text>
            </View>
          ) : null}
          {!image ? <StatusBadge status={issue.status} size="sm" /> : null}
          <View style={{ flex: 1 }} />
          <Text variant="caption" tone="tertiary">
            {timeAgo(issue.createdAt)}
          </Text>
        </View>

        <Text variant="heading" numberOfLines={2}>
          {issue.title}
        </Text>

        {issue.location?.address ? (
          <View style={styles.addressRow}>
            <MapPin size={14} color={colors.textTertiary} strokeWidth={2} />
            <Text variant="callout" tone="tertiary" numberOfLines={1} style={{ flex: 1 }}>
              {issue.location.address}
            </Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Avatar name={author.name} uri={mediaUrl(author.avatar)} size={26} />
          <Text variant="label" tone="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
            {author.name}
          </Text>
          {author.verified ? <BadgeCheck size={14} color={colors.primary} strokeWidth={2.4} /> : null}
          <View style={{ flex: 1 }} />
          <PressableScale haptic onPress={vote.toggle} hitSlop={8} style={[styles.stat, vote.on && { backgroundColor: colors.primarySoft }]} accessibilityLabel="Upvote">
            <ArrowBigUp size={18} color={vote.on ? colors.primary : colors.textSecondary} fill={vote.on ? colors.primary : 'transparent'} strokeWidth={2} />
            <Text variant="label" color={vote.on ? colors.primary : colors.textSecondary}>
              {compact(vote.count)}
            </Text>
          </PressableScale>
          <View style={styles.stat}>
            <MessageCircle size={16} color={colors.textSecondary} strokeWidth={2} />
            <Text variant="label" tone="secondary">
              {compact(issue.commentCount)}
            </Text>
          </View>
        </View>
      </View>
    </PressableScale>
  );
});

export function IssueCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.image} />
      <View style={styles.body}>
        <Skeleton width={120} height={20} radius={radius.pill} />
        <Skeleton width="85%" height={20} />
        <Skeleton width="60%" height={14} />
        <View style={styles.footer}>
          <Skeleton width={26} height={26} radius={13} />
          <Skeleton width={90} height={12} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  image: { width: '100%', aspectRatio: 16 / 10, backgroundColor: colors.surfaceRaised },
  overlay: { position: 'absolute', top: spacing.md, left: spacing.md, right: spacing.md, flexDirection: 'row', gap: spacing.sm },
  emergency: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: alphaOf(palette.red400, 0.92),
  },
  noImage: { height: 96, alignItems: 'center', justifyContent: 'center' },
  body: { padding: spacing.lg, gap: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sev: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sevDot: { width: 6, height: 6, borderRadius: 3 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 30, borderRadius: radius.pill },
});
