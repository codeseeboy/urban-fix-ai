import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { gamificationAPI } from '../../services/api';
import { colors, fonts, radius } from '../../theme/colors';

const PODIUM_COLORS = ['#FFD60A', '#C0C0C0', '#CD7F32'];

export default function LeaderboardScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const [leaders, setLeaders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchLeaderboard(); }, []);

    const fetchLeaderboard = async () => {
        try {
            const { data } = await gamificationAPI.getLeaderboard();
            setLeaders(data);
        } catch (e) { console.log('Leaderboard error:', e); }
        setLoading(false);
    };

    const top3 = leaders.slice(0, 3);
    const rest = leaders.slice(3);

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <View style={styles.backBtn} />
                <Text style={styles.headerTitle}>Leaderboard</Text>
                <View style={{ width: 36 }} />
            </View>

            {loading ? (
                <View style={styles.loadWrap}><ActivityIndicator size="large" color={colors.primary} /></View>
            ) : (
                <FlatList
                    data={rest}
                    keyExtractor={i => i._id}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                    ListHeaderComponent={() => (
                        <>
                            {/* Podium */}
                            <View style={styles.podium}>
                                {[1, 0, 2].map((idx) => {
                                    const p = top3[idx];
                                    if (!p) return <View key={idx} style={styles.podiumSlot} />;
                                    return (
                                        <View key={p._id} style={[styles.podiumSlot, idx === 0 && styles.podiumFirst]}>
                                            <LinearGradient colors={[PODIUM_COLORS[idx], PODIUM_COLORS[idx] + '80']} style={styles.podiumAvatar}>
                                                <Text style={styles.podiumAvatarText}>{p.name[0]}</Text>
                                            </LinearGradient>
                                            <Text style={styles.podiumRank}>#{p.rank}</Text>
                                            <Text style={styles.podiumName} numberOfLines={1}>{p.name.split(' ')[0]}</Text>
                                            <Text style={styles.podiumPoints}>{p.points} pts</Text>
                                        </View>
                                    );
                                })}
                            </View>
                            <Text style={styles.listTitle}>Rankings</Text>
                        </>
                    )}
                    renderItem={({ item }) => (
                        <View style={styles.rankRow}>
                            <Text style={styles.rankNum}>#{item.rank}</Text>
                            <LinearGradient colors={[colors.primary, '#0055CC']} style={styles.rankAvatar}>
                                <Text style={styles.rankAvatarText}>{item.name[0]}</Text>
                            </LinearGradient>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.rankName}>{item.name}</Text>
                                <Text style={styles.rankReports}>{item.reportsCount} reports</Text>
                            </View>
                            <Text style={styles.rankPoints}>{item.points} pts</Text>
                        </View>
                    )}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
    backBtn: { width: 36 },
    headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, color: colors.text },
    loadWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    podium: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', paddingVertical: 24, paddingHorizontal: 20, gap: 12 },
    podiumSlot: { alignItems: 'center', flex: 1 },
    podiumFirst: { marginBottom: 16 },
    podiumAvatar: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    podiumAvatarText: { fontFamily: 'Inter_700Bold', color: '#000', fontSize: 22 },
    podiumRank: { fontFamily: 'Inter_700Bold', color: colors.text, fontSize: 14 },
    podiumName: { fontFamily: 'Inter_600SemiBold', color: colors.text, fontSize: 13, marginTop: 2, textAlign: 'center' },
    podiumPoints: { fontFamily: 'Inter_400Regular', color: colors.primary, fontSize: 12, marginTop: 2 },
    listTitle: { fontFamily: 'Inter_700Bold', color: colors.text, fontSize: 16, paddingHorizontal: 16, marginBottom: 8 },
    rankRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingVertical: 12, paddingHorizontal: 16, marginHorizontal: 16, marginBottom: 8,
        backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    },
    rankNum: { fontFamily: 'Inter_700Bold', color: colors.textMuted, fontSize: 14, width: 30 },
    rankAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    rankAvatarText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 15 },
    rankName: { fontFamily: 'Inter_600SemiBold', color: colors.text, fontSize: 14 },
    rankReports: { fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 11 },
    rankPoints: { fontFamily: 'Inter_700Bold', color: colors.primary, fontSize: 14 },
});
