import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  Award,
  Building2,
  ChevronRight,
  Eye,
  FileText,
  Flag,
  LogOut,
  MessageCircle,
  Pencil,
  Server,
  Shield,
  Sparkles,
  Star,
  Trophy,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react-native';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { gamificationApi, usersApi, type Achievement } from '@/api';
import { Avatar, Card, ErrorState, IconButton, PressableScale, Skeleton, Text } from '@/components/ui';
import { mediaUrl } from '@/lib/api';
import { compact } from '@/lib/format';
import { qk } from '@/lib/query';
import { isWorker, useSession } from '@/store/session';
import { alphaOf, colors, gutter, palette, radius, spacing } from '@/theme/tokens';

const BADGE_ICONS: Record<string, LucideIcon> = {
  flag: Flag,
  eye: Eye,
  shield: Shield,
  check: CheckCircle2,
  sparkles: Sparkles,
  message: MessageCircle,
  star: Star,
  trophy: Trophy,
};

const ROLE_LABEL: Record<string, string> = {
  citizen: 'Citizen',
  field_worker: 'Field worker',
  admin: 'Municipal admin',
  super_admin: 'Super admin',
  department_admin: 'Department admin',
};

function AchievementTile({ a }: { a: Achievement }) {
  const Icon = BADGE_ICONS[a.icon] ?? Award;
  const tint = a.earned ? palette.amber400 : palette.ink500;
  return (
    <View style={[styles.badge, a.earned && styles.badgeEarned]}>
      <View style={[styles.badgeIcon, { backgroundColor: alphaOf(tint, a.earned ? 0.18 : 0.1) }]}>
        <Icon size={20} color={tint} strokeWidth={2.2} />
      </View>
      <Text variant="label" align="center" numberOfLines={1} tone={a.earned ? 'primary' : 'tertiary'}>
        {a.name}
      </Text>
      {a.earned ? (
        <Text variant="caption" tone="warning">
          Earned
        </Text>
      ) : (
        <View style={styles.badgeTrack}>
          <View style={[styles.badgeFill, { width: `${Math.round((a.progress / a.goal) * 100)}%` }]} />
        </View>
      )}
    </View>
  );
}

function Row({ icon: Icon, label, onPress, tint = colors.textSecondary, danger }: { icon: LucideIcon; label: string; onPress: () => void; tint?: string; danger?: boolean }) {
  return (
    <PressableScale scaleTo={0.99} onPress={onPress} style={styles.row} accessibilityRole="button">
      <View style={[styles.rowIcon, { backgroundColor: alphaOf(danger ? palette.red400 : tint, 0.12) }]}>
        <Icon size={18} color={danger ? colors.danger : tint} strokeWidth={2.2} />
      </View>
      <Text variant="body" style={{ flex: 1 }} tone={danger ? 'danger' : 'primary'}>
        {label}
      </Text>
      {!danger ? <ChevronRight size={18} color={colors.textTertiary} /> : null}
    </PressableScale>
  );
}

export default function ProfileTab() {
  const insets = useSafeAreaInsets();
  const user = useSession((s) => s.user);
  const signOut = useSession((s) => s.signOut);
  const worker = isWorker(user?.role);
  const profile = useQuery({ queryKey: qk.profile, queryFn: usersApi.profile });
  const achievements = useQuery({ queryKey: qk.achievements, queryFn: gamificationApi.achievements, enabled: !worker });

  const p = profile.data;
  const level = p?.levelInfo;
  const earned = achievements.data?.filter((a) => a.earned).length ?? 0;

  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'You can sign back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing.huge }}
      refreshControl={
        <RefreshControl
          refreshing={profile.isRefetching}
          onRefresh={() => {
            profile.refetch();
            achievements.refetch();
          }}
          tintColor={colors.primary}
          colors={[colors.primary]}
          progressBackgroundColor={colors.surfaceRaised}
        />
      }
    >
      <View style={styles.head}>
        <Avatar name={p?.name ?? user?.name} uri={mediaUrl(p?.avatar ?? user?.avatar)} size={76} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title" numberOfLines={1}>
            {p?.name ?? user?.name}
          </Text>
          <Text variant="callout" tone="tertiary" numberOfLines={1}>
            {p?.username ? `@${p.username}` : user?.email}
          </Text>
          <View style={styles.rolePill}>
            <Text variant="caption" tone="brand">
              {ROLE_LABEL[user?.role ?? 'citizen'] ?? user?.role}
              {p?.city ? ` · ${p.city}` : ''}
            </Text>
          </View>
        </View>
        <IconButton icon={Pencil} accessibilityLabel="Edit profile" onPress={() => router.push('/edit-profile')} />
      </View>

      {profile.isError ? (
        <ErrorState error={profile.error} onRetry={() => profile.refetch()} />
      ) : (
        <>
          <View style={styles.stats}>
            {[
              { label: 'Points', value: p?.points },
              { label: 'Reports', value: p?.reportsCount },
              { label: 'Resolved', value: p?.reportsResolved },
            ].map((s, i) => (
              <View key={s.label} style={[styles.stat, i > 0 && styles.statDivider]}>
                {p ? <Text variant="numeric">{compact(s.value ?? 0)}</Text> : <Skeleton width={36} height={24} />}
                <Text variant="caption" tone="tertiary">
                  {s.label}
                </Text>
              </View>
            ))}
          </View>

          {!worker ? (
            <Card style={styles.level}>
              <View style={styles.levelHead}>
                <View style={styles.levelBadge}>
                  <Text variant="label" tone="inverse">
                    L{level?.level ?? 1}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{level?.name ?? '—'}</Text>
                  <Text variant="caption" tone="tertiary">
                    {level && level.progress < 1 ? `${level.nextLevelXp - level.currentXp} pts to next level` : 'Top level reached'}
                  </Text>
                </View>
                <Text variant="label" tone="secondary">
                  {level ? `${level.currentXp} / ${level.nextLevelXp}` : ''}
                </Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.round((level?.progress ?? 0) * 100)}%` }]} />
              </View>
            </Card>
          ) : null}

          {!worker ? (
            <View style={styles.block}>
              <View style={styles.blockHead}>
                <Text variant="heading">Achievements</Text>
                <Text variant="callout" tone="tertiary">
                  {achievements.data ? `${earned}/${achievements.data.length}` : ''}
                </Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingHorizontal: gutter }}>
                {achievements.data
                  ? [...achievements.data].sort((a, b) => Number(b.earned) - Number(a.earned)).map((a) => <AchievementTile key={a.id} a={a} />)
                  : [0, 1, 2, 3].map((k) => <Skeleton key={k} width={112} height={118} radius={radius.lg} />)}
              </ScrollView>
            </View>
          ) : null}
        </>
      )}

      <View style={[styles.block, { paddingHorizontal: gutter, gap: spacing.sm }]}>
        {!worker ? <Row icon={FileText} label="My reports" tint={palette.blue400} onPress={() => router.push('/my-reports')} /> : null}
        <Row icon={Trophy} label="Leaderboard" tint={palette.amber400} onPress={() => router.push('/leaderboard')} />
        <Row icon={Building2} label="Municipal pages" tint={palette.cyan400} onPress={() => router.push('/pages')} />
        <Row icon={Sparkles} label="UrbanFix AI assistant" tint={palette.violet400} onPress={() => router.push('/assistant')} />
        <Row icon={Server} label="Server & app settings" onPress={() => router.push('/settings')} />
        <Row icon={LogOut} label="Sign out" danger onPress={confirmSignOut} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingHorizontal: gutter },
  rolePill: { alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  stats: {
    flexDirection: 'row',
    marginHorizontal: gutter,
    marginTop: spacing.xl,
    paddingVertical: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { borderLeftWidth: StyleSheet.hairlineWidth * 2, borderLeftColor: colors.border },
  level: { marginHorizontal: gutter, marginTop: spacing.md, gap: spacing.md },
  levelHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  levelBadge: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  block: { marginTop: spacing.xxl },
  blockHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: gutter, marginBottom: spacing.md },
  badge: {
    width: 112,
    padding: spacing.md,
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  badgeEarned: { borderColor: alphaOf(palette.amber400, 0.35) },
  badgeIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  badgeTrack: { width: '80%', height: 4, borderRadius: 2, backgroundColor: colors.surfaceRaised, overflow: 'hidden', marginTop: 4 },
  badgeFill: { height: 4, backgroundColor: palette.ink500 },
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
  rowIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
