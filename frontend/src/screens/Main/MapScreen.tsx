import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, ActivityIndicator, Alert, Dimensions, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Circle, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { issuesAPI } from '../../services/api';
import { colors, fonts, radius } from '../../theme/colors';

const { width } = Dimensions.get('window');

const SEVERITY_COLORS: Record<string, string> = {
    Critical: '#FF003C',
    High: '#FF6B35',
    Medium: '#FFD60A',
    Low: '#30D158',
    Resolved: '#30D158',
};

const CATEGORIES = [
    { id: 'all', icon: 'layers-outline', label: 'All' },
    { id: 'roads', icon: 'car-outline', label: 'Roads' },
    { id: 'lighting', icon: 'bulb-outline', label: 'Lights' },
    { id: 'trash', icon: 'trash-outline', label: 'Trash' },
    { id: 'water', icon: 'water-outline', label: 'Water' },
    { id: 'parks', icon: 'leaf-outline', label: 'Parks' },
];

const STATUS_FILTERS = [
    { id: 'all', label: 'All Status' },
    { id: 'Submitted', label: 'Submitted' },
    { id: 'InProgress', label: 'In Progress' },
    { id: 'Resolved', label: 'Resolved' },
];

// Helper: calculate distance between two coordinates in km (Haversine)
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const NEARBY_RADIUS_KM = 50; // Only show issues within 50km of user

export default function MapScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const mapRef = useRef<MapView>(null);
    const [issues, setIssues] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState('all');
    const [activeStatus, setActiveStatus] = useState('all');
    const [showStatusFilter, setShowStatusFilter] = useState(false);
    const [selectedIssue, setSelectedIssue] = useState<any>(null);
    const [showHeatmap, setShowHeatmap] = useState(false);
    const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const hasCacheRef = useRef(false);

    // ── Phase 1: Instant render from cache + saved location ──
    useEffect(() => {
        (async () => {
            try {
                const [cachedIssues, cachedLoc] = await Promise.all([
                    AsyncStorage.getItem('mapscreen:issues'),
                    AsyncStorage.getItem('mapscreen:userLocation'),
                ]);

                if (cachedLoc) {
                    try {
                        const loc = JSON.parse(cachedLoc);
                        if (loc?.latitude && loc?.longitude) setUserLocation(loc);
                    } catch {}
                }

                if (cachedIssues) {
                    const parsed = JSON.parse(cachedIssues);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setIssues(parsed);
                        hasCacheRef.current = true;
                        setLoading(false); // map renders NOW with cached pins
                    }
                }
            } catch {}

            // Phase 2 runs in background regardless
            initMap();
        })();
    }, []);

    // ── Phase 2: Background refresh (GPS + feed) — doesn't block UI ──
    const initMap = async () => {
        // Only show spinner if we have NO cached data
        if (!hasCacheRef.current) {
            setLoading(true);
        }
        setError(null);

        // Step 1 + 2: GPS + seed run in parallel-safe way
        let coords: { latitude: number; longitude: number } | null = null;
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const loc = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });
                coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
                setUserLocation(coords);
                // Cache location for instant next-launch
                AsyncStorage.setItem('mapscreen:userLocation', JSON.stringify(coords)).catch(() => {});
            }
        } catch (e) {
            console.log('Location detection failed (non-critical):', e);
        }

        // Seed nearby (fire-and-forget — don't block issue fetch)
        if (coords) {
            issuesAPI.seedNearby(coords.latitude, coords.longitude).catch(e =>
                console.log('Seed nearby skipped:', e)
            );
        }

        // Step 3: Fetch fresh issues (background refresh if cache was shown)
        try {
            const { data } = await issuesAPI.getFeed();
            const nextIssues = Array.isArray(data) ? data : [];
            setIssues(nextIssues);
            AsyncStorage.setItem('mapscreen:issues', JSON.stringify(nextIssues)).catch(() => {});
        } catch (e) {
            console.log('Issue fetch failed:', e);
            if (!hasCacheRef.current && issues.length === 0) {
                setError('Could not load issues. Please check your connection.');
            }
        }

        // Step 4: Animate map to user's GPS
        if (coords && mapRef.current) {
            setTimeout(() => {
                mapRef.current?.animateToRegion({
                    ...coords!,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                }, 800);
            }, 300);
        }

        setLoading(false);
    };

    // Filter issues: only show those NEAR the user's GPS (within 50km)
    const filteredIssues = issues.filter((i) => {
        if (!i?.location?.coordinates) return false;
        const catMatch = activeCategory === 'all' || i.category === activeCategory;
        const statusMatch = activeStatus === 'all' || i.status === activeStatus;
        if (!catMatch || !statusMatch) return false;

        // If we have user location, only show nearby issues
        if (userLocation) {
            const issueLat = i.location.coordinates[1];
            const issueLon = i.location.coordinates[0];
            const dist = getDistanceKm(userLocation.latitude, userLocation.longitude, issueLat, issueLon);
            return dist <= NEARBY_RADIUS_KM;
        }
        return true; // No GPS, show all
    });

    const handleLocateMe = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Location access is needed.');
                return;
            }
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
            setUserLocation(coords);
            mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 800);
        } catch (e) {
            Alert.alert('Error', 'Could not detect your location.');
        }
    };

    const getSeverityColor = (severity: string) => SEVERITY_COLORS[severity] || '#888';

    const getCategoryIcon = (cat: string) => {
        switch (cat) {
            case 'roads': return 'car';
            case 'lighting': return 'bulb';
            case 'trash': return 'trash';
            case 'water': return 'water';
            case 'parks': return 'leaf';
            default: return 'alert';
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>🗺️ Civic Map</Text>
                    <Text style={styles.headerSub}>
                        {loading ? 'Loading...' : `${filteredIssues.length} issues pinned`}
                    </Text>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={[styles.headerBtn, showHeatmap && styles.headerBtnActive]}
                        onPress={() => setShowHeatmap(!showHeatmap)}
                    >
                        <Ionicons name="flame-outline" size={16} color={showHeatmap ? '#FFF' : colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.headerBtn, showStatusFilter && styles.headerBtnActive]}
                        onPress={() => setShowStatusFilter(!showStatusFilter)}
                    >
                        <Ionicons name="funnel-outline" size={16} color={showStatusFilter ? '#FFF' : colors.textSecondary} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Category Filter Bar */}
            <View style={styles.filterBar}>
                <FlatList
                    horizontal
                    data={CATEGORIES}
                    keyExtractor={(c) => c.id}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 12, gap: 6 }}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={[styles.filterChip, activeCategory === item.id && styles.filterChipActive]}
                            onPress={() => setActiveCategory(item.id)}
                            activeOpacity={0.7}
                        >
                            <Ionicons name={item.icon as any} size={14} color={activeCategory === item.id ? '#FFF' : colors.textSecondary} />
                            <Text style={[styles.filterText, activeCategory === item.id && styles.filterTextActive]}>{item.label}</Text>
                        </TouchableOpacity>
                    )}
                />
            </View>

            {/* Status Filter Dropdown */}
            {showStatusFilter && (
                <View style={styles.statusDropdown}>
                    {STATUS_FILTERS.map((s) => (
                        <TouchableOpacity
                            key={s.id}
                            style={[styles.statusItem, activeStatus === s.id && styles.statusItemActive]}
                            onPress={() => { setActiveStatus(s.id); setShowStatusFilter(false); }}
                        >
                            <Text style={[styles.statusItemText, activeStatus === s.id && { color: '#FFF' }]}>{s.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* Map */}
            <View style={styles.mapContainer}>
                {error && issues.length === 0 ? (
                    <View style={styles.loadingOverlay}>
                        <Ionicons name="cloud-offline-outline" size={48} color={colors.textMuted} />
                        <Text style={styles.errorText}>{error}</Text>
                        <TouchableOpacity style={styles.retryBtn} onPress={initMap}>
                            <Text style={styles.retryText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                ) : loading && issues.length === 0 ? (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.loadingText}>Loading civic data...</Text>
                    </View>
                ) : (
                    <>
                    <MapView
                        ref={mapRef}
                        style={styles.map}
                        initialRegion={userLocation ? { ...userLocation, latitudeDelta: 0.02, longitudeDelta: 0.02 } : { latitude: 28.6139, longitude: 77.209, latitudeDelta: 0.04, longitudeDelta: 0.04 }}
                        showsUserLocation={true}
                        showsMyLocationButton={false}
                        showsCompass={false}
                        userInterfaceStyle="dark"
                        onPress={() => setSelectedIssue(null)}
                    >
                        {/* Heatmap Density Circles */}
                        {showHeatmap && filteredIssues.map((issue) => (
                            <Circle
                                key={`heat-${issue._id}`}
                                center={{
                                    latitude: issue.location.coordinates[1],
                                    longitude: issue.location.coordinates[0],
                                }}
                                radius={
                                    issue.aiSeverity === 'Critical' ? 600 :
                                        issue.aiSeverity === 'High' ? 450 :
                                            issue.aiSeverity === 'Medium' ? 300 : 200
                                }
                                fillColor={
                                    issue.aiSeverity === 'Critical' ? 'rgba(255,0,60,0.20)' :
                                        issue.aiSeverity === 'High' ? 'rgba(255,107,53,0.18)' :
                                            issue.aiSeverity === 'Medium' ? 'rgba(255,214,10,0.15)' :
                                                'rgba(48,209,88,0.12)'
                                }
                                strokeColor={
                                    issue.aiSeverity === 'Critical' ? 'rgba(255,0,60,0.35)' :
                                        issue.aiSeverity === 'High' ? 'rgba(255,107,53,0.30)' :
                                            issue.aiSeverity === 'Medium' ? 'rgba(255,214,10,0.25)' :
                                                'rgba(48,209,88,0.20)'
                                }
                                strokeWidth={1}
                            />
                        ))}

                        {/* Issue Markers */}
                        {filteredIssues.map((issue) => (
                            <Marker
                                key={issue._id}
                                coordinate={{
                                    latitude: issue.location.coordinates[1],
                                    longitude: issue.location.coordinates[0],
                                }}
                                onPress={() => setSelectedIssue(issue)}
                            >
                                <View style={[styles.markerOuter, { borderColor: getSeverityColor(issue.aiSeverity) }]}>
                                    <View style={[styles.markerInner, { backgroundColor: getSeverityColor(issue.aiSeverity) }]}>
                                        <Ionicons name={getCategoryIcon(issue.category) as any} size={14} color="#FFF" />
                                    </View>
                                    {issue.emergency && <View style={styles.emergencyDot} />}
                                </View>
                            </Marker>
                        ))}
                    </MapView>
                )}

                {/* GPS Locate Button */}
                {!error && (
                    <TouchableOpacity style={styles.locateBtn} onPress={handleLocateMe} activeOpacity={0.8}>
                        <LinearGradient colors={[colors.primary, '#0055CC']} style={styles.locateBtnGrad}>
                            <Ionicons name="navigate" size={20} color="#FFF" />
                        </LinearGradient>
                    </TouchableOpacity>
                )}

                {/* Refresh Button */}
                <TouchableOpacity style={styles.refreshBtn} onPress={initMap} activeOpacity={0.8}>
                    <View style={styles.refreshBtnInner}>
                        {loading ? (
                            <ActivityIndicator size={16} color={colors.primary} />
                        ) : (
                            <Ionicons name="refresh" size={18} color={colors.text} />
                        )}
                    </View>
                </TouchableOpacity>

                {/* Legend */}
                {!error && (
                    <View style={styles.legend}>
                        {Object.entries(SEVERITY_COLORS).filter(([k]) => k !== 'Resolved').map(([label, color]) => (
                            <View key={label} style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: color }]} />
                                <Text style={styles.legendText}>{label}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Issue Count Badge */}
                {!error && (
                    <View style={styles.countBadge}>
                        <Text style={styles.countText}>{filteredIssues.length}</Text>
                        <Text style={styles.countLabel}>Issues</Text>
                    </View>
                )}

                {/* Subtle refreshing indicator on top of already-visible map */}
                {loading && issues.length > 0 && (
                    <View style={styles.refreshingBanner}>
                        <ActivityIndicator size={12} color={colors.primary} />
                        <Text style={styles.refreshingText}>Refreshing...</Text>
                    </View>
                )}
                </>
                )}
            </View>

            {/* Selected Issue Card */}
            {selectedIssue && (
                <View style={styles.issueCardContainer}>
                    <TouchableOpacity
                        style={styles.issueCard}
                        activeOpacity={0.95}
                        onPress={() => navigation.navigate('IssueDetail', { issueId: selectedIssue._id })}
                    >
                        <View style={[styles.cardGlow, { backgroundColor: getSeverityColor(selectedIssue.aiSeverity) }]} />
                        <View style={styles.cardContent}>
                            {selectedIssue.image ? (
                                <Image
                                    source={{ uri: selectedIssue.image }}
                                    style={styles.cardImage}
                                    defaultSource={require('../../../assets/logo.png')}
                                />
                            ) : null}
                            <View style={styles.cardInfo}>
                                <View style={styles.cardRow}>
                                    <View style={[styles.sevChip, { backgroundColor: getSeverityColor(selectedIssue.aiSeverity) + '20' }]}>
                                        <Text style={[styles.sevChipText, { color: getSeverityColor(selectedIssue.aiSeverity) }]}>
                                            {selectedIssue.aiSeverity}
                                        </Text>
                                    </View>
                                    <View style={styles.statusChip}>
                                        <Text style={styles.statusChipText}>{selectedIssue.status}</Text>
                                    </View>
                                    {selectedIssue.emergency && (
                                        <View style={styles.emergencyTag}>
                                            <Ionicons name="warning" size={10} color="#FF003C" />
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.cardTitle} numberOfLines={2}>{selectedIssue.title}</Text>
                                <View style={styles.cardMeta}>
                                    <Ionicons name="location-outline" size={11} color={colors.textMuted} />
                                    <Text style={styles.cardAddr} numberOfLines={1}>
                                        {selectedIssue.location?.address || 'Unknown'}
                                    </Text>
                                </View>
                                <View style={styles.cardStats}>
                                    <View style={styles.cardStat}>
                                        <Ionicons name="arrow-up-circle" size={13} color={colors.primary} />
                                        <Text style={styles.cardStatText}>{selectedIssue.upvotes?.length || 0}</Text>
                                    </View>
                                    <View style={styles.cardStat}>
                                        <Ionicons name="chatbubble-outline" size={11} color={colors.textMuted} />
                                        <Text style={styles.cardStatText}>{selectedIssue.commentCount || 0}</Text>
                                    </View>
                                    <Text style={styles.cardCtaArrow}>View Details →</Text>
                                </View>
                            </View>
                            <TouchableOpacity style={styles.cardClose} onPress={() => setSelectedIssue(null)}>
                                <Ionicons name="close" size={16} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 8,
        borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, color: colors.text },
    headerSub: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textSecondary, marginTop: 1 },
    headerActions: { flexDirection: 'row', gap: 8 },
    headerBtn: {
        width: 36, height: 36, borderRadius: 18,
        justifyContent: 'center', alignItems: 'center',
        backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    },
    headerBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterBar: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
    filterChip: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14,
        backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    },
    filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterText: { fontFamily: 'Inter_500Medium', color: colors.textSecondary, fontSize: 11 },
    filterTextActive: { color: '#FFF' },
    statusDropdown: {
        position: 'absolute', top: 110, right: 16, zIndex: 100,
        backgroundColor: colors.surface, borderRadius: radius.lg,
        borderWidth: 1, borderColor: colors.border, padding: 4,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
    },
    statusItem: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.md },
    statusItemActive: { backgroundColor: colors.primary },
    statusItemText: { fontFamily: 'Inter_500Medium', color: colors.text, fontSize: 13 },
    mapContainer: { flex: 1, position: 'relative' },
    map: { flex: 1 },
    loadingOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    loadingText: { fontFamily: 'Inter_500Medium', color: colors.textMuted, fontSize: 13, marginTop: 12 },
    errorText: { fontFamily: 'Inter_500Medium', color: colors.textSecondary, fontSize: 14, marginTop: 12, textAlign: 'center', paddingHorizontal: 30 },
    retryBtn: { marginTop: 16, backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: radius.md },
    retryText: { fontFamily: 'Inter_600SemiBold', color: '#FFF', fontSize: 14 },
    markerOuter: {
        width: 34, height: 34, borderRadius: 17, borderWidth: 2.5,
        justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)',
    },
    markerInner: {
        width: 24, height: 24, borderRadius: 12,
        justifyContent: 'center', alignItems: 'center',
    },
    emergencyDot: {
        position: 'absolute', top: -3, right: -3,
        width: 10, height: 10, borderRadius: 5,
        backgroundColor: '#FF003C', borderWidth: 2, borderColor: '#000',
    },
    locateBtn: { position: 'absolute', bottom: 80, right: 16 },
    locateBtnGrad: {
        width: 46, height: 46, borderRadius: 23,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
    },
    refreshBtn: { position: 'absolute', bottom: 80, left: 16 },
    refreshBtnInner: {
        width: 42, height: 42, borderRadius: 21,
        backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
    },
    legend: {
        position: 'absolute', bottom: 12, left: 12, right: 12,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
        backgroundColor: 'rgba(10,10,15,0.88)',
        borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 8,
        borderWidth: 1, borderColor: colors.border,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontFamily: 'Inter_500Medium', color: '#CCC', fontSize: 10 },
    countBadge: {
        position: 'absolute', top: 12, right: 12,
        backgroundColor: 'rgba(10,10,15,0.88)', borderRadius: radius.md,
        paddingHorizontal: 10, paddingVertical: 4, alignItems: 'center',
        borderWidth: 1, borderColor: colors.border,
    },
    countText: { fontFamily: 'Inter_800ExtraBold', color: colors.primary, fontSize: 16 },
    countLabel: { fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 9 },
    refreshingBanner: {
        position: 'absolute', top: 10, alignSelf: 'center',
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: 'rgba(10,10,15,0.85)', borderRadius: 16,
        paddingHorizontal: 12, paddingVertical: 6,
        borderWidth: 1, borderColor: colors.border,
    },
    refreshingText: { fontFamily: 'Inter_500Medium', color: colors.textSecondary, fontSize: 11 },
    issueCardContainer: {
        position: 'absolute', bottom: 70, left: 0, right: 0,
        paddingHorizontal: 12, zIndex: 200,
    },
    issueCard: {
        backgroundColor: colors.surface, borderRadius: radius.xl,
        borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
        shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 10,
    },
    cardGlow: { height: 3, width: '100%' },
    cardContent: { flexDirection: 'row', padding: 12, gap: 10 },
    cardImage: { width: 64, height: 64, borderRadius: radius.md },
    cardInfo: { flex: 1 },
    cardRow: { flexDirection: 'row', gap: 5, marginBottom: 3 },
    sevChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
    sevChipText: { fontFamily: 'Inter_700Bold', fontSize: 9, textTransform: 'uppercase' },
    statusChip: {
        paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
        backgroundColor: colors.primary + '15',
    },
    statusChipText: { fontFamily: 'Inter_500Medium', fontSize: 9, color: colors.primary },
    emergencyTag: {
        paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6,
        backgroundColor: '#FF003C15',
    },
    cardTitle: { fontFamily: 'Inter_600SemiBold', color: colors.text, fontSize: 13, lineHeight: 17 },
    cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
    cardAddr: { fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 10, flex: 1 },
    cardStats: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
    cardStat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    cardStatText: { fontFamily: 'Inter_500Medium', color: colors.textSecondary, fontSize: 11 },
    cardCtaArrow: { fontFamily: 'Inter_600SemiBold', color: colors.primary, fontSize: 11, marginLeft: 'auto' },
    cardClose: {
        position: 'absolute', top: 6, right: 6,
        width: 24, height: 24, borderRadius: 12,
        backgroundColor: colors.surfaceLight, justifyContent: 'center', alignItems: 'center',
    },
});
