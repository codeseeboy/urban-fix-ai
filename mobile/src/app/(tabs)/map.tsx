import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ChevronRight, LocateFixed, MapPin, RotateCw } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { issuesApi, type MapIssue } from '@/api';
import { LeafletMap, type LeafletMapHandle, type MapPoint } from '@/components/LeafletMap';
import { Chip, ErrorState, IconButton, PressableScale, SeverityBadge, StatusBadge, Text } from '@/components/ui';
import { mediaUrl } from '@/lib/api';
import { distance, haversine } from '@/lib/format';
import { ensureLocationPermission, quickPosition } from '@/lib/location';
import { qk } from '@/lib/query';
import { categoryMeta, categoryOf, isOpenStatus, severityMeta, severityOf, statusOf } from '@/theme/domain';
import { colors, gutter, palette, radius, spacing } from '@/theme/tokens';
import * as Location from 'expo-location';

type Filter = 'open' | 'critical' | 'resolved' | 'all';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'critical', label: 'Critical' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All' },
];

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const map = useRef<LeafletMapHandle>(null);
  const [filter, setFilter] = useState<Filter>('open');
  const [selected, setSelected] = useState<string | null>(null);
  const [me, setMe] = useState<{ lat: number; lon: number } | null>(null);
  const [center, setCenter] = useState<{ lat: number; lon: number } | null>(null);
  const [locating, setLocating] = useState(false);

  const data = useQuery({ queryKey: qk.map, queryFn: issuesApi.geojson, staleTime: 60_000 });

  const all = useMemo(
    () =>
      (data.data?.features ?? [])
        .filter((f) => f.geometry.coordinates[0] || f.geometry.coordinates[1])
        .map((f) => ({ ...f.properties, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] })),
    [data.data],
  );

  const visible = useMemo(
    () =>
      all.filter((i) => {
        const s = statusOf(i.status);
        if (filter === 'open') return isOpenStatus(s);
        if (filter === 'resolved') return s === 'Resolved';
        if (filter === 'critical') return isOpenStatus(s) && severityOf(i.severity) === 'Critical';
        return true;
      }),
    [all, filter],
  );

  const points: MapPoint[] = useMemo(
    () =>
      visible.map((i) => ({
        id: i.id,
        lat: i.lat,
        lon: i.lon,
        color: statusOf(i.status) === 'Resolved' ? palette.green400 : severityMeta[severityOf(i.severity)].color,
        pulse: i.emergency && isOpenStatus(statusOf(i.status)),
        selected: i.id === selected,
      })),
    [visible, selected],
  );

  // Initial centre: last known position, else the newest issue, else Palghar.
  useEffect(() => {
    if (center) return;
    quickPosition().then((p) => {
      if (p) {
        setMe({ lat: p.latitude, lon: p.longitude });
        setCenter({ lat: p.latitude, lon: p.longitude });
      } else if (data.isFetched) {
        const first = all[0];
        setCenter(first ? { lat: first.lat, lon: first.lon } : { lat: 19.6967, lon: 72.7699 });
      }
    });
  }, [center, data.isFetched, all]);

  const locate = async () => {
    setLocating(true);
    try {
      if (!(await ensureLocationPermission())) return;
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const next = { lat: p.coords.latitude, lon: p.coords.longitude };
      setMe(next);
      map.current?.flyTo(next.lat, next.lon, 15);
    } finally {
      setLocating(false);
    }
  };

  const sel: (MapIssue & { lat: number; lon: number }) | undefined = all.find((i) => i.id === selected);
  const selCat = sel ? categoryMeta[categoryOf(sel.category)] : null;
  const selImage = mediaUrl(sel?.image);

  return (
    <View style={styles.root}>
      {center ? (
        <LeafletMap ref={map} style={StyleSheet.absoluteFill} center={center} zoom={14} points={points} user={me} onSelect={setSelected} onMapPress={() => setSelected(null)} />
      ) : (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        <View style={styles.titleRow} pointerEvents="box-none">
          <View style={styles.titlePill}>
            <Text variant="subheading">Issue map</Text>
            <Text variant="caption" tone="tertiary">
              {data.isPending ? 'Loading…' : `${visible.length} shown`}
            </Text>
          </View>
          <IconButton icon={RotateCw} variant="glass" accessibilityLabel="Refresh" onPress={() => data.refetch()} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map((f) => (
            <Chip key={f.value} label={f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} />
          ))}
        </ScrollView>
      </View>

      {data.isError ? (
        <View style={styles.errorBox}>
          <ErrorState error={data.error} onRetry={() => data.refetch()} />
        </View>
      ) : null}

      <View style={[styles.bottom, { paddingBottom: spacing.lg }]} pointerEvents="box-none">
        <View style={styles.fabRow} pointerEvents="box-none">
          <IconButton icon={locating ? RotateCw : LocateFixed} variant="filled" size={48} accessibilityLabel="My location" onPress={locate} color={colors.primary} />
        </View>
        {sel && selCat ? (
          <Animated.View entering={FadeInDown.springify().damping(18)} exiting={FadeOutDown.duration(150)}>
            <PressableScale scaleTo={0.98} onPress={() => router.push(`/issue/${sel.id}`)} style={styles.preview}>
              {selImage ? (
                <Image source={{ uri: selImage }} style={styles.previewImg} contentFit="cover" />
              ) : (
                <View style={[styles.previewImg, { backgroundColor: selCat.soft, alignItems: 'center', justifyContent: 'center' }]}>
                  <selCat.icon size={26} color={selCat.color} />
                </View>
              )}
              <View style={{ flex: 1, gap: 6 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <StatusBadge status={sel.status} size="sm" />
                  <SeverityBadge severity={sel.severity} size="sm" />
                </View>
                <Text variant="bodyStrong" numberOfLines={2}>
                  {sel.title}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <MapPin size={12} color={colors.textTertiary} />
                  <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ flex: 1 }}>
                    {me ? `${distance(haversine(me.lat, me.lon, sel.lat, sel.lon))} · ` : ''}
                    {sel.address || selCat.label}
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} color={colors.textTertiary} />
            </PressableScale>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  top: { position: 'absolute', top: 0, left: 0, right: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: gutter },
  titlePill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.overlay,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  chips: { gap: spacing.sm, paddingHorizontal: gutter, paddingTop: spacing.md },
  errorBox: { position: 'absolute', top: 160, left: gutter, right: gutter, borderRadius: radius.xl, backgroundColor: colors.overlay },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: gutter, gap: spacing.md },
  fabRow: { alignItems: 'flex-end' },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceSheet,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.borderStrong,
  },
  previewImg: { width: 76, height: 76, borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
});
