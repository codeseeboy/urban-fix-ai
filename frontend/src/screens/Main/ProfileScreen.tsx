import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, RefreshControl, Modal, Animated, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { gamificationAPI } from '../../services/api';
import { colors, fonts, radius } from '../../theme/colors';

const { width } = Dimensions.get('window');

// ─── BADGE DEFINITIONS (Ionicons-based, no emojis) ─────────────────────────
const ALL_BADGES = [
    { id: 'first_report', name: 'First Report', icon: 'flag', color: '#007AFF', description: 'Filed your very first civic report' },
    { id: 'civic_hero', name: 'Civic Hero', icon: 'shield-checkmark', color: '#30D158', description: 'Resolved 10+ issues in your ward' },
    { id: 'night_watch', name: 'Night Watch', icon: 'moon', color: '#AF52DE', description: 'Reported an issue between 10PM–6AM' },
    { id: 'top_10', name: 'Top 10', icon: 'trophy', color: '#FFD60A', description: 'Ranked in the top 10 leaderboard' },
    { id: 'fifty_reports', name: '50 Reports', icon: 'camera', color: '#FF6B35', description: 'Submitted 50 civic reports' },
    { id: 'leader', name: 'Leader', icon: 'star', color: '#FF375F', description: 'Reached #1 on the civic leaderboard' },
    { id: 'road_guardian', name: 'Road Guardian', icon: 'car', color: '#5AC8FA', description: 'Reported 10+ road & pothole issues' },
    { id: 'drain_defender', name: 'Drain Defender', icon: 'water', color: '#00C7BE', description: 'Reported 10+ drainage issues' },
];

// Role config (no emojis)
const ROLE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
    admin: { label: 'Administrator', icon: 'shield', color: '#FF375F' },
    field_worker: { label: 'Field Worker', icon: 'construct', color: '#FF9F0A' },
    citizen: { label: 'Citizen Reporter', icon: 'people', color: colors.primary },
};

export default function ProfileScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const { user, logout, refreshProfile } = useAuth();
    const [refreshing, setRefreshing] = useState(false);
    const [badges, setBadges] = useState<any[]>([]);
    const [selectedBadge, setSelectedBadge] = useState<any>(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        fetchBadges();
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
            Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
        ]).start();
    }, []);

    const fetchBadges = async () => {
        try {
            const { data } = await gamificationAPI.getBadges();
            setBadges(data);
        } catch (e) {
            setBadges(ALL_BADGES.map(b => ({ ...b, earned: user?.badges?.includes(b.id) || false })));
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await refreshProfile();
        await fetchBadges();
        setRefreshing(false);
    };

    const handleLogout = () => {
        Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: logout },
        ]);
    };

    const role = ROLE_CONFIG[user?.role || 'citizen'];
    const level = user?.levelInfo?.level || 1;
    const levelName = user?.levelInfo?.name || 'New Reporter';
    const xp = user?.points || 0;
    const nextXp = user?.levelInfo?.nextLevelXp || 500;
    const progress = user?.levelInfo?.progress || 0;

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            >
                {/* ─── HEADER ────────────────────────────────────────────────── */}
                <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
                    <Text style={styles.headerTitle} allowFontScaling={false}>Profile</Text>
                    <TouchableOpacity
                        style={styles.headerBtn}
                        onPress={() => navigation.navigate('Settings')}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="settings-outline" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                </Animated.View>

                {/* ─── PROFILE CARD ──────────────────────────────────────────── */}
                <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
                    <LinearGradient
                        colors={['#0D1B3E', '#162454', '#0D1B3E']}
                        style={styles.profileCard}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    >
                        {/* Accent circle decoration */}
                        <View style={styles.cardDecorCircle} />

                        {/* Avatar */}
                        <View style={styles.avatarRing}>
                            <LinearGradient colors={[colors.primary, '#4facfe']} style={styles.avatar}>
                                <Text style={styles.avatarText} allowFontScaling={false}>
                                    {(user?.name || 'U')[0].toUpperCase()}
                                </Text>
                            </LinearGradient>
                            <View style={[styles.levelPill, { backgroundColor: role.color }]}>
                                <Text style={styles.levelPillText} allowFontScaling={false}>Lvl {level}</Text>
                            </View>
                        </View>

                        {/* Name & Meta */}
                        <Text style={styles.profileName} allowFontScaling={false}>
                            {user?.name || 'User'}
                        </Text>
                        {user?.username && (
                            <Text style={styles.profileUsername} allowFontScaling={false}>@{user.username}</Text>
                        )}

                        {/* Level Name */}
                        <Text style={styles.levelTitle} allowFontScaling={false}>{levelName}</Text>

                        {/* Role badge */}
                        <View style={[styles.roleBadge, { backgroundColor: role.color + '18' }]}>
                            <Ionicons name={role.icon as any} size={13} color={role.color} />
                            <Text style={[styles.roleText, { color: role.color }]} allowFontScaling={false}>
                                {role.label}
                            </Text>
                        </View>

                        {/* Location */}
                        {(user?.city || user?.ward) && (
                            <View style={styles.locationRow}>
                                <Ionicons name="location" size={12} color={colors.textMuted} />
                                <Text style={styles.locationText} allowFontScaling={false}>
                                    {[user?.ward, user?.city].filter(Boolean).join(', ')}
                                </Text>
                            </View>
                        )}
                    </LinearGradient>
                </Animated.View>

                {/* ─── STATS ROW ─────────────────────────────────────────────── */}
                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber} allowFontScaling={false}>{user?.reportsCount || 0}</Text>
                        <Text style={styles.statLabel} allowFontScaling={false}>Reports</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber} allowFontScaling={false}>{user?.reportsResolved || 0}</Text>
                        <Text style={styles.statLabel} allowFontScaling={false}>Resolved</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={[styles.statNumber, { color: colors.accent }]} allowFontScaling={false}>{xp}</Text>
                        <Text style={styles.statLabel} allowFontScaling={false}>Points</Text>
                    </View>
                </View>

                {/* ─── XP PROGRESS ───────────────────────────────────────────── */}
                <View style={styles.xpCard}>
                    <View style={styles.xpHeader}>
                        <View style={styles.xpLabelRow}>
                            <Ionicons name="flash" size={16} color={colors.primary} />
                            <Text style={styles.xpLabel} allowFontScaling={false}>Level Progress</Text>
                        </View>
                        <Text style={styles.xpFraction} allowFontScaling={false}>{xp} / {nextXp} XP</Text>
                    </View>
                    <View style={styles.xpBarBg}>
                        <LinearGradient
                            colors={[colors.primary, '#4facfe']}
                            style={[styles.xpBarFill, { width: `${Math.min(progress * 100, 100)}%` as any }]}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        />
                    </View>
                    <Text style={styles.xpRemaining} allowFontScaling={false}>
                        {nextXp ? `${Math.max(nextXp - xp, 0)} XP to Level ${level + 1}` : 'Max Level Reached'}
                    </Text>
                </View>

                {/* ─── ACHIEVEMENTS ──────────────────────────────────────────── */}
                <View style={styles.sectionHeader}>
                    <Ionicons name="ribbon" size={18} color={colors.primary} />
                    <Text style={styles.sectionTitle} allowFontScaling={false}>Civic Achievements</Text>
                    <Text style={styles.badgeCount} allowFontScaling={false}>
                        {(badges.length > 0 ? badges : ALL_BADGES).filter(b => user?.badges?.includes(b.id)).length}/{ALL_BADGES.length}
                    </Text>
                </View>
                <View style={styles.badgesGrid}>
                    {(badges.length > 0 ? badges : ALL_BADGES).map((b) => {
                        const earned = user?.badges?.includes(b.id);
                        const badgeDef = ALL_BADGES.find(ab => ab.id === b.id) || b;
                        return (
                            <TouchableOpacity
                                key={b.id}
                                style={[styles.badgeCard, !earned && styles.badgeLocked]}
                                onPress={() => setSelectedBadge({ ...badgeDef, earned })}
                                activeOpacity={0.7}
                            >
                                <View style={[
                                    styles.badgeIconWrap,
                                    { backgroundColor: earned ? badgeDef.color + '18' : colors.surfaceLight }
                                ]}>
                                    <Ionicons
                                        name={(earned ? badgeDef.icon : 'lock-closed') as any}
                                        size={22}
                                        color={earned ? badgeDef.color : colors.textMuted}
                                    />
                                </View>
                                <Text style={[styles.badgeName, !earned && { color: colors.textMuted }]} numberOfLines={1} allowFontScaling={false}>
                                    {badgeDef.name}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* ─── QUICK ACTIONS ─────────────────────────────────────────── */}
                <View style={styles.actionsSection}>
                    <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('Leaderboard')} activeOpacity={0.7}>
                        <View style={[styles.actionIconWrap, { backgroundColor: '#FFD60A15' }]}>
                            <Ionicons name="trophy" size={18} color="#FFD60A" />
                        </View>
                        <Text style={styles.actionText} allowFontScaling={false}>Leaderboard</Text>
                        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('Settings')} activeOpacity={0.7}>
                        <View style={[styles.actionIconWrap, { backgroundColor: colors.primary + '15' }]}>
                            <Ionicons name="settings" size={18} color={colors.primary} />
                        </View>
                        <Text style={styles.actionText} allowFontScaling={false}>Settings</Text>
                        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionRow, styles.logoutRow]} onPress={handleLogout} activeOpacity={0.7}>
                        <View style={[styles.actionIconWrap, { backgroundColor: colors.error + '15' }]}>
                            <Ionicons name="log-out" size={18} color={colors.error} />
                        </View>
                        <Text style={[styles.actionText, { color: colors.error }]} allowFontScaling={false}>Sign Out</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* ─── BADGE DETAIL MODAL ────────────────────────────────────── */}
            <Modal visible={!!selectedBadge} transparent animationType="fade">
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelectedBadge(null)}>
                    <View style={styles.badgeModal}>
                        <View style={[
                            styles.badgeModalIcon,
                            { backgroundColor: selectedBadge?.earned ? (selectedBadge?.color || colors.primary) + '18' : colors.surfaceLight }
                        ]}>
                            <Ionicons
                                name={(selectedBadge?.earned ? selectedBadge?.icon : 'lock-closed') as any}
                                size={44}
                                color={selectedBadge?.earned ? (selectedBadge?.color || colors.primary) : colors.textMuted}
                            />
                        </View>
                        <Text style={styles.badgeModalName} allowFontScaling={false}>{selectedBadge?.name}</Text>
                        <View style={[styles.badgeStatusPill, {
                            backgroundColor: selectedBadge?.earned ? colors.success + '15' : colors.textMuted + '15'
                        }]}>
                            <Ionicons
                                name={selectedBadge?.earned ? 'checkmark-circle' : 'lock-closed'}
                                size={14}
                                color={selectedBadge?.earned ? colors.success : colors.textMuted}
                            />
                            <Text style={[styles.badgeStatusText, {
                                color: selectedBadge?.earned ? colors.success : colors.textMuted
                            }]} allowFontScaling={false}>
                                {selectedBadge?.earned ? 'EARNED' : 'LOCKED'}
                            </Text>
                        </View>
                        <Text style={styles.badgeModalDesc} allowFontScaling={false}>
                            {selectedBadge?.description || 'Keep contributing to earn this badge.'}
                        </Text>
                        <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSelectedBadge(null)} activeOpacity={0.7}>
                            <Text style={styles.modalCloseBtnText} allowFontScaling={false}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    // Header
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingVertical: 12,
    },
    headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 26, color: colors.text, includeFontPadding: false },
    headerBtn: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: colors.border,
    },

    // Profile card
    profileCard: {
        marginHorizontal: 16, borderRadius: radius.xl, padding: 28,
        alignItems: 'center', overflow: 'hidden',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    },
    cardDecorCircle: {
        position: 'absolute', top: -60, right: -60,
        width: 160, height: 160, borderRadius: 80,
        backgroundColor: 'rgba(0,122,255,0.05)',
    },
    avatarRing: { position: 'relative', marginBottom: 14 },
    avatar: {
        width: 84, height: 84, borderRadius: 42,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 3, borderColor: 'rgba(255,255,255,0.1)',
    },
    avatarText: { fontFamily: 'Inter_900Black', color: '#FFF', fontSize: 34, includeFontPadding: false },
    levelPill: {
        position: 'absolute', bottom: -6, alignSelf: 'center',
        paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10,
        borderWidth: 2, borderColor: '#0D1B3E',
    },
    levelPillText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 10, includeFontPadding: false },
    profileName: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 22, includeFontPadding: false },
    profileUsername: { fontFamily: 'Inter_500Medium', color: colors.textSecondary, fontSize: 14, marginTop: 2, includeFontPadding: false },
    levelTitle: { fontFamily: 'Inter_600SemiBold', color: colors.primary, fontSize: 13, marginTop: 6, textTransform: 'uppercase', letterSpacing: 1, includeFontPadding: false },
    roleBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginTop: 10,
    },
    roleText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, includeFontPadding: false },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
    locationText: { fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 12, includeFontPadding: false },

    // Stats row
    statsRow: {
        flexDirection: 'row', marginHorizontal: 16, marginTop: 16, gap: 8,
    },
    statCard: {
        flex: 1, alignItems: 'center', paddingVertical: 16,
        backgroundColor: colors.surface, borderRadius: radius.lg,
        borderWidth: 1, borderColor: colors.border,
    },
    statNumber: { fontFamily: 'Inter_700Bold', color: colors.text, fontSize: 22, includeFontPadding: false },
    statLabel: { fontFamily: 'Inter_500Medium', color: colors.textMuted, fontSize: 10, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5, includeFontPadding: false },

    // XP Card
    xpCard: {
        marginHorizontal: 16, marginTop: 12, padding: 16,
        backgroundColor: colors.surface, borderRadius: radius.lg,
        borderWidth: 1, borderColor: colors.border,
    },
    xpHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    xpLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    xpLabel: { fontFamily: 'Inter_600SemiBold', color: colors.text, fontSize: 14, includeFontPadding: false },
    xpFraction: { fontFamily: 'Inter_700Bold', color: colors.primary, fontSize: 13, includeFontPadding: false },
    xpBarBg: { height: 8, backgroundColor: colors.surfaceLight, borderRadius: 4, overflow: 'hidden' },
    xpBarFill: { height: '100%', borderRadius: 4 },
    xpRemaining: { fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 10, includeFontPadding: false },

    // Section header
    sectionHeader: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 16, marginTop: 24, marginBottom: 14,
    },
    sectionTitle: { fontFamily: 'Inter_700Bold', color: colors.text, fontSize: 16, flex: 1, includeFontPadding: false },
    badgeCount: { fontFamily: 'Inter_600SemiBold', color: colors.textMuted, fontSize: 13, includeFontPadding: false },

    // Badges grid
    badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8 },
    badgeCard: {
        width: (width - 24 - 24) / 4 - 2, alignItems: 'center', paddingVertical: 14,
        backgroundColor: colors.surface, borderRadius: radius.lg,
        borderWidth: 1, borderColor: colors.border,
    },
    badgeLocked: { opacity: 0.35 },
    badgeIconWrap: {
        width: 44, height: 44, borderRadius: 22,
        justifyContent: 'center', alignItems: 'center', marginBottom: 6,
    },
    badgeName: { fontFamily: 'Inter_500Medium', color: colors.text, fontSize: 10, textAlign: 'center', includeFontPadding: false },

    // Actions
    actionsSection: { marginHorizontal: 16, marginTop: 20, gap: 8 },
    actionRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingVertical: 14, paddingHorizontal: 14,
        backgroundColor: colors.surface, borderRadius: radius.lg,
        borderWidth: 1, borderColor: colors.border,
    },
    actionIconWrap: {
        width: 34, height: 34, borderRadius: 10,
        justifyContent: 'center', alignItems: 'center',
    },
    actionText: { fontFamily: 'Inter_600SemiBold', color: colors.text, fontSize: 14, flex: 1, includeFontPadding: false },
    logoutRow: { borderColor: colors.error + '20', backgroundColor: colors.error + '04' },

    // Badge modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 40 },
    badgeModal: {
        backgroundColor: colors.surface, borderRadius: radius.xl, padding: 28,
        alignItems: 'center', width: '100%', borderWidth: 1, borderColor: colors.border,
    },
    badgeModalIcon: {
        width: 88, height: 88, borderRadius: 44,
        justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    },
    badgeModalName: { fontFamily: 'Inter_700Bold', fontSize: 22, color: colors.text, textAlign: 'center', includeFontPadding: false },
    badgeStatusPill: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginTop: 10, marginBottom: 16,
    },
    badgeStatusText: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1, includeFontPadding: false },
    badgeModalDesc: { fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24, includeFontPadding: false },
    modalCloseBtn: { backgroundColor: colors.primary, paddingHorizontal: 30, paddingVertical: 12, borderRadius: radius.md },
    modalCloseBtnText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 14, includeFontPadding: false },
});
