import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, RefreshControl, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { gamificationAPI } from '../../services/api';
import { colors, fonts, radius } from '../../theme/colors';

const ALL_BADGES = [
    { id: 'first_report', name: 'First Report', icon: '🏅' },
    { id: 'civic_hero', name: 'Civic Hero', icon: '🦸' },
    { id: 'night_watch', name: 'Night Watch', icon: '🌙' },
    { id: 'top_10', name: 'Top 10', icon: '🏆' },
    { id: 'fifty_reports', name: '50 Reports', icon: '📸' },
    { id: 'leader', name: 'Leader', icon: '⭐' },
    { id: 'road_guardian', name: 'Road Guardian', icon: '🛣️' },
    { id: 'drain_defender', name: 'Drain Defender', icon: '💧' },
];

export default function ProfileScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const { user, logout, refreshProfile } = useAuth();
    const [refreshing, setRefreshing] = useState(false);
    const [badges, setBadges] = useState<any[]>([]);
    const [selectedBadge, setSelectedBadge] = useState<any>(null);

    useEffect(() => {
        fetchBadges();
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

    const impactScore = user?.impactScore || Math.min(100, Math.floor((user?.points || 0) / 50));

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <ScrollView showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Profile</Text>
                    <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('Settings')}>
                        <Ionicons name="settings-outline" size={22} color={colors.text} />
                    </TouchableOpacity>
                </View>

                {/* Avatar + Level */}
                <View style={styles.profileTop}>
                    <View style={styles.avatarContainer}>
                        <LinearGradient colors={[colors.primary, '#0055CC']} style={styles.avatar}>
                            <Text style={styles.avatarText}>{(user?.name || 'U')[0]}</Text>
                        </LinearGradient>
                        <View style={styles.levelBadge}>
                            <Text style={styles.levelBadgeText}>Lvl {user?.levelInfo?.level || 1}</Text>
                        </View>
                    </View>
                    <Text style={styles.name}>{user?.name || 'User'}</Text>
                    <Text style={styles.levelName}>{user?.levelInfo?.name || 'New Reporter'}</Text>
                    <View style={styles.roleBadge}>
                        <Text style={styles.roleText}>{user?.role === 'admin' ? '🏛️ Admin' : user?.role === 'field_worker' ? '👷 Field Worker' : '🏅 Citizen'}</Text>
                    </View>
                </View>

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    <View style={styles.statItem}>
                        <Text style={styles.statNum}>{user?.reportsCount || 0}</Text>
                        <Text style={styles.statLabel}>Reports</Text>
                    </View>
                    <View style={[styles.statItem, styles.statBorder]}>
                        <Text style={styles.statNum}>{user?.reportsResolved || 0}</Text>
                        <Text style={styles.statLabel}>Resolved</Text>
                    </View>
                    <View style={[styles.statItem, styles.statBorder]}>
                        <Text style={styles.statNum}>{user?.followingCount || 0}</Text>
                        <Text style={styles.statLabel}>Following</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statNum}>{user?.points || 0}</Text>
                        <Text style={styles.statLabel}>Points</Text>
                    </View>
                </View>

                {/* Leveling XP Progress */}
                <View style={styles.impactCard}>
                    <View style={styles.impactHeader}>
                        <Text style={styles.impactLabel}>Civic Level Progress</Text>
                        <Text style={styles.xpText}>{user?.points || 0} / {user?.levelInfo?.nextLevelXp || 500} XP</Text>
                    </View>
                    <View style={styles.levelBarContainer}>
                        <View style={styles.impactBar}>
                            <LinearGradient colors={[colors.primary, '#00E0FF']}
                                style={[styles.impactFill, { width: `${(user?.levelInfo?.progress || 0) * 100}%` }]}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
                        </View>
                    </View>
                    <Text style={styles.xpToNext}>{user?.levelInfo?.nextLevelXp ? `${user.levelInfo.nextLevelXp - user.points} XP until next level` : 'Max Level Reached'}</Text>
                </View>

                {/* Badges */}
                <Text style={styles.sectionTitle}>Civic Achievements</Text>
                <View style={styles.badgesGrid}>
                    {(badges.length > 0 ? badges : ALL_BADGES).map((b) => {
                        const earned = user?.badges?.includes(b.id);
                        return (
                            <TouchableOpacity key={b.id} style={[styles.badgeItem, !earned && styles.badgeLocked]} onPress={() => setSelectedBadge({ ...b, earned })}>
                                <Text style={styles.badgeIcon}>{b.icon}</Text>
                                <Text style={[styles.badgeName, !earned && { color: colors.textMuted }]}>{b.name}</Text>
                                {!earned && <Ionicons name="lock-closed" size={10} color={colors.textMuted} />}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Badge Details Modal */}
                <Modal visible={!!selectedBadge} transparent animationType="fade">
                    <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setSelectedBadge(null)}>
                        <View style={styles.badgeInfoCard}>
                            <Text style={styles.badgeInfoIcon}>{selectedBadge?.icon}</Text>
                            <Text style={styles.badgeInfoTitle}>{selectedBadge?.name}</Text>
                            <Text style={styles.badgeInfoStatus}>{selectedBadge?.earned ? '✅ EARNED' : '🔒 LOCKED'}</Text>
                            <Text style={styles.badgeInfoDesc}>{selectedBadge?.description || 'Earned by contributing to the city infrastructure improvements.'}</Text>
                            <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedBadge(null)}>
                                <Text style={styles.closeBtnText}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </Modal>

                {/* Actions */}
                <View style={styles.actionsSection}>
                    <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('Leaderboard')}>
                        <Ionicons name="trophy-outline" size={20} color={colors.primary} />
                        <Text style={styles.actionText}>Leaderboard</Text>
                        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('Settings')}>
                        <Ionicons name="settings-outline" size={20} color={colors.primary} />
                        <Text style={styles.actionText}>Settings</Text>
                        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionRow, styles.logoutRow]} onPress={handleLogout}>
                        <Ionicons name="log-out-outline" size={20} color={colors.error} />
                        <Text style={[styles.actionText, { color: colors.error }]}>Sign Out</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingVertical: 14,
    },
    headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 24, color: colors.text },
    headerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
    profileTop: { alignItems: 'center', paddingBottom: 20 },
    avatarContainer: { position: 'relative', marginBottom: 12 },
    avatar: { width: 88, height: 88, borderRadius: 44, justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontFamily: 'Inter_900Black', color: '#FFF', fontSize: 36 },
    levelBadge: { position: 'absolute', bottom: -4, right: -4, backgroundColor: '#FFD60A', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 2, borderColor: colors.background },
    levelBadgeText: { fontFamily: 'Inter_800ExtraBold', color: '#000', fontSize: 10 },
    name: { fontFamily: 'Inter_700Bold', color: colors.text, fontSize: 24, marginBottom: 2 },
    levelName: { fontFamily: 'Inter_600SemiBold', color: colors.primary, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 },
    roleBadge: { backgroundColor: colors.primary + '15', paddingHorizontal: 14, paddingVertical: 4, borderRadius: 12, marginTop: 10 },
    roleText: { fontFamily: 'Inter_700Bold', color: colors.primary, fontSize: 11 },
    statsGrid: {
        flexDirection: 'row', marginHorizontal: 16, backgroundColor: colors.surface,
        borderRadius: radius.xl, padding: 18, borderWidth: 1, borderColor: colors.border,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2
    },
    statItem: { flex: 1, alignItems: 'center' },
    statBorder: { borderLeftWidth: 1, borderColor: colors.border },
    statNum: { fontFamily: 'Inter_800ExtraBold', color: colors.text, fontSize: 24 },
    statLabel: { fontFamily: 'Inter_500Medium', color: colors.textMuted, fontSize: 10, marginTop: 2, textTransform: 'uppercase' },
    impactCard: { marginHorizontal: 16, marginTop: 16, backgroundColor: colors.surface, borderRadius: radius.xl, padding: 16, borderWidth: 1, borderColor: colors.border },
    impactHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    impactLabel: { fontFamily: 'Inter_700Bold', color: colors.text, fontSize: 15 },
    xpText: { fontFamily: 'Inter_700Bold', color: colors.primary, fontSize: 14 },
    levelBarContainer: { height: 12, backgroundColor: colors.surfaceLight, borderRadius: 6, overflow: 'hidden' },
    impactBar: { flex: 1 },
    impactFill: { height: '100%', borderRadius: 6 },
    xpToNext: { fontFamily: 'Inter_500Medium', color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 10, fontStyle: 'italic' },
    sectionTitle: { fontFamily: 'Inter_800ExtraBold', color: colors.text, fontSize: 14, paddingHorizontal: 16, marginTop: 24, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
    badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 8 },
    badgeItem: {
        width: '22%', alignItems: 'center', paddingVertical: 12, backgroundColor: colors.surface,
        borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    },
    badgeLocked: { opacity: 0.4 },
    badgeIcon: { fontSize: 24, marginBottom: 4 },
    badgeName: { fontFamily: 'Inter_500Medium', color: colors.text, fontSize: 9, textAlign: 'center' },
    actionsSection: { marginHorizontal: 16, marginTop: 20 },
    actionRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingVertical: 14, paddingHorizontal: 14,
        backgroundColor: colors.surface, borderRadius: radius.lg, marginBottom: 8,
        borderWidth: 1, borderColor: colors.border,
    },
    actionText: { fontFamily: 'Inter_600SemiBold', color: colors.text, fontSize: 14, flex: 1 },
    logoutRow: { borderColor: colors.error + '30', backgroundColor: colors.error + '05' },

    // Modal
    modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 40 },
    badgeInfoCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 24, alignItems: 'center', width: '100%', elevation: 10 },
    badgeInfoIcon: { fontSize: 60, marginBottom: 16 },
    badgeInfoTitle: { fontFamily: 'Inter_800ExtraBold', fontSize: 22, color: colors.text, textAlign: 'center' },
    badgeInfoStatus: { fontFamily: 'Inter_700Bold', fontSize: 12, color: colors.primary, marginTop: 4, marginBottom: 16, letterSpacing: 1 },
    badgeInfoDesc: { fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
    closeBtn: { backgroundColor: colors.primary, paddingHorizontal: 30, paddingVertical: 12, borderRadius: radius.md },
    closeBtnText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 14 },
});
