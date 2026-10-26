import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ChevronRight, MapPin } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Issue } from '@/api';
import { PressableScale, StatusBadge, Text } from '@/components/ui';
import { mediaUrl } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { categoryMeta, categoryOf } from '@/theme/domain';
import { colors, radius, spacing } from '@/theme/tokens';

/** Dense list row: thumbnail, title, status and location. */
export function IssueRow({ issue, trailing, onPress }: { issue: Issue; trailing?: ReactNode; onPress?: () => void }) {
  const cat = categoryMeta[categoryOf(issue.category)];
  const image = mediaUrl(issue.image);
  return (
    <PressableScale scaleTo={0.985} onPress={onPress ?? (() => router.push(`/issue/${issue._id}`))} style={styles.row} accessibilityRole="button">
      {image ? (
        <Image source={{ uri: image }} style={styles.thumb} contentFit="cover" transition={150} recyclingKey={issue._id} />
      ) : (
        <View style={[styles.thumb, { backgroundColor: cat.soft, alignItems: 'center', justifyContent: 'center' }]}>
          <cat.icon size={22} color={cat.color} strokeWidth={2} />
        </View>
      )}
      <View style={styles.main}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {issue.title}
        </Text>
        <View style={styles.meta}>
          <StatusBadge status={issue.status} size="sm" />
          <Text variant="caption" tone="tertiary">
            {timeAgo(issue.createdAt)}
          </Text>
        </View>
        {issue.location?.address ? (
          <View style={styles.meta}>
            <MapPin size={12} color={colors.textTertiary} strokeWidth={2} />
            <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ flex: 1 }}>
              {issue.location.address}
            </Text>
          </View>
        ) : null}
      </View>
      {trailing ?? <ChevronRight size={18} color={colors.textTertiary} />}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
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
  thumb: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  main: { flex: 1, gap: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
