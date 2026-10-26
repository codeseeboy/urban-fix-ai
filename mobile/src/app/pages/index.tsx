import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { BadgeCheck, Building2, ChevronRight, Search } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { municipalApi } from '@/api';
import { Avatar, EmptyState, ErrorState, Header, PressableScale, Screen, Skeleton, Text, TextField } from '@/components/ui';
import { mediaUrl } from '@/lib/api';
import { compact } from '@/lib/format';
import { qk } from '@/lib/query';
import { colors, gutter, radius, spacing } from '@/theme/tokens';

export default function Pages() {
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const pages = useQuery({ queryKey: qk.pages(term), queryFn: () => municipalApi.search(term) });

  return (
    <Screen>
      <Header title="Municipal pages" subtitle="Official departments" />
      <FlatList
        data={pages.isPending ? [] : pages.data ?? []}
        keyExtractor={(p) => p._id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: spacing.huge, gap: spacing.md, flexGrow: 1 }}
        ListHeaderComponent={<TextField icon={Search} value={q} onChangeText={setQ} placeholder="Search departments" containerStyle={{ marginBottom: spacing.sm }} />}
        renderItem={({ item }) => (
          <PressableScale scaleTo={0.985} onPress={() => router.push(`/pages/${item._id}`)} style={styles.row}>
            <Avatar name={item.name} uri={mediaUrl(item.avatar)} size={48} />
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {item.name}
                </Text>
                {item.verified ? <BadgeCheck size={15} color={colors.primary} /> : null}
              </View>
              <Text variant="caption" tone="tertiary" numberOfLines={1}>
                @{item.handle} · {item.department || item.page_type || 'Municipal'}
              </Text>
              <Text variant="caption" tone="secondary">
                {compact(item.followers_count ?? 0)} followers
              </Text>
            </View>
            <ChevronRight size={18} color={colors.textTertiary} />
          </PressableScale>
        )}
        ListEmptyComponent={
          pages.isPending ? (
            <View style={{ gap: spacing.md }}>
              {[0, 1, 2].map((k) => (
                <Skeleton key={k} height={80} radius={radius.lg} />
              ))}
            </View>
          ) : pages.isError ? (
            <ErrorState error={pages.error} onRetry={() => void pages.refetch()} />
          ) : (
            <EmptyState icon={Building2} title="No pages found" message={term ? `Nothing matches “${term}”.` : 'No municipal pages have been set up yet.'} />
          )
        }
        refreshControl={<RefreshControl refreshing={pages.isRefetching} onRefresh={() => void pages.refetch()} tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.surfaceRaised} />}
      />
    </Screen>
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
});
