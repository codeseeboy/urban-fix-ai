import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, ActivityIndicator,
    RefreshControl, TouchableOpacity, Animated, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { gamificationAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { colors, fonts, radius } from '../../theme/colors';

const { width } = Dimensions.get('window');

const MEDAL_COLORS = [
    { bg: ['#FFD700', '#FFA500'], text: '#000' },  // Gold
    { bg: ['#C0C0C0', '#A0A0A0'], text: '#000' },  // Silver
    { bg: ['#CD7F32', '#A0612B'], text: '#FFF' },  // Bronze
];

export default function LeaderboardScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const [leaders, setLeaders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Podium animations
    const podiumAnims = [
        useRef(new Animated.Value(0)).current,
        useRef(new Animated.Value(0)).current,
        useRef(new Animated.Value(0)).current,
    ];
    const listFade = useRef(new Animated.Value(0)).current;

    useEffect(() => { fetchLeaderboard(); }, []);

    const fetchLeaderboard = async () => {
        try {
            const { data } = await gamificationAPI.getLeaderboard();
            setLeaders(data);

            // Staggered podium entrance
            Animated.stagger(150, [
                Animated.spring(podiumAnims[1], { toValue: 1, friction: 6, useNativeDriver: true }),
                Animated.spring(podiumAnims[0], { toValue: 1, friction: 6, useNativeDriver: true }),
                Animated.spring(podiumAnims[2], { toValue: 1, friction: 6, useNativeDriver: true }),
            ]).start();

            Animated.timing(listFade, { toValue: 1, duration: 500, delay: 400, useNativeDriver: true }).start();
        } catch (e) { console.log('Leaderboard error:', e); }
        setLoading(false);
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchLeaderboard();
        setRefreshing(false);
    };

    const top3 = leaders.slice(0, 3);
    const rest = leaders.slice(3);

    // Podium order: 2nd, 1st, 3rd (middle is tallest)
    const podiumOrder = [1, 0, 2];
    const podiumHeights = [100, 130, 80];

    const renderPodium = () => (
        <View style={styles.podiumSection}>
            {/* Crown icon for #1 */}
            <View style={styles.crownWrap}>
                <Ionicons name="diamond" size={24} color="#FFD700" />
            </View>

            <View style={styles.podiumRow}>
                {podiumOrder.map((idx, i) => {
                    const p = top3[idx];
                    if (!p) return <View key={idx} style={styles.podiumSlot} />;

                    const anim = podiumAnims[idx];
                    const animScale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
                    const animTransY = anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });

                    const isMe = p._id === user?._id;

                    return (
                        <Animated.View
                            key={p._id}
                            style={[
                                styles.podiumSlot,
                                { transform: [{ scale: animScale }, { translateY: animTransY }], opacity: anim }
                            ]}
                        >
                            {/* Avatar */}
                            <View style={styles.podiumAvatarWrap}>
                                <LinearGradient
                                    colors={MEDAL_COLORS[idx].bg as any}
                                    style={[styles.podiumAvatar, idx === 0 && styles.podiumAvatarFirst]}
                                >
                                    <Text style={[styles.podiumAvatarText, { color: MEDAL_COLORS[idx].text }]}
                                        allowFontScaling={false}>
                                        {p.name[0].toUpperCase()}
                                    </Text>
                                </LinearGradient>
                                <View style={[styles.rankCircle, { backgroundColor: MEDAL_COLORS[idx].bg[0] }]}>
                                    <Text style={styles.rankCircleText} allowFontScaling={false}>{idx + 1}</Text>
                                </View>
                            </View>

                            <Text style={[styles.podiumName, isMe && { color: colors.primary }]}
                                numberOfLines={1} allowFontScaling={false}>
                                {p.name.split(' ')[0]}
                            </Text>
                            <Text style={styles.podiumPoints} allowFontScaling={false}>{p.points} pts</Text>

                            {/* Pedestal */}
                            <LinearGradient
                                colors={[MEDAL_COLORS[idx].bg[0] + '30', MEDAL_COLORS[idx].bg[0] + '08']}
                                style={[styles.pedestal, { height: podiumHeights[i] }]}
                            />
                        </Animated.View>
                    );
                })}
            </View>
        </View>
    );

    const renderRow = ({ item, index }: { item: any; index: number }) => {
        const rank = index + 4;
        const isMe = item._id === user?._id;

        return (
            <Animated.View style={[
                styles.rankRow,
                isMe && styles.rankRowMe,
                { opacity: listFade }
            ]}>
                <Text style={[styles.rankNum, isMe && { color: colors.primary }]} allowFontScaling={false}>
                    {rank}
                </Text>
                <LinearGradient
                    colors={isMe ? [colors.primary, '#4facfe'] : [colors.surfaceLight, colors.surface]}
                    style={styles.rankAvatar}
                >
                    <Text style={styles.rankAvatarText} allowFontScaling={false}>
                        {item.name[0].toUpperCase()}
                    </Text>
                </LinearGradient>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.rankName, isMe && { color: colors.primary }]} allowFontScaling={false}>
                        {item.name} {isMe && '(You)'}
                    </Text>
                    <Text style={styles.rankMeta} allowFontScaling={false}>
                        {item.reportsCount || 0} reports
                    </Text>
                </View>
                <View style={styles.rankPointsWrap}>
                    <Text style={styles.rankPoints} allowFontScaling={false}>{item.points}</Text>
                    <Text style={styles.rankPtsLabel} allowFontScaling={false}>pts</Text>
                </View>
            </Animated.View>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={20} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} allowFontScaling={false}>Leaderboard</Text>
                <View style={{ width: 38 }} />
            </View>

            {loading ? (
                <View style={styles.loadWrap}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={rest}
                    keyExtractor={(i) => i._id}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                    }
                    ListHeaderComponent={() => (
                        <>
                            {renderPodium()}

                            {/* Rankings title */}
                            <View style={styles.rankingsHeader}>
                                <Ionicons name="list" size={16} color={colors.textMuted} />
                                <Text style={styles.rankingsTitle} allowFontScaling={false}>Rankings</Text>
                            </View>
                        </>
                    )}
                    renderItem={renderRow}
                    ListEmptyComponent={
                        <Text style={styles.emptyText} allowFontScaling={false}>No rankings available yet.</Text>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    // Header
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backBtn: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: colors.border,
    },
    headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, color: colors.text, includeFontPadding: false },
    loadWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // Podium
    podiumSection: { paddingTop: 24, paddingBottom: 8, alignItems: 'center' },
    crownWrap: { marginBottom: 8 },
    podiumRow: {
        flexDirection: 'row', justifyContent: 'center',
        alignItems: 'flex-end', paddingHorizontal: 16, gap: 8,
    },
    podiumSlot: { alignItems: 'center', flex: 1 },
    podiumAvatarWrap: { position: 'relative', marginBottom: 8 },
    podiumAvatar: {
        width: 54, height: 54, borderRadius: 27,
        justifyContent: 'center', alignItems: 'center',
    },
    podiumAvatarFirst: { width: 64, height: 64, borderRadius: 32 },
    podiumAvatarText: { fontFamily: 'Inter_700Bold', fontSize: 22, includeFontPadding: false },
    rankCircle: {
        position: 'absolute', bottom: -4, alignSelf: 'center',
        width: 20, height: 20, borderRadius: 10,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 2, borderColor: colors.background,
    },
    rankCircleText: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#000', includeFontPadding: false },
    podiumName: {
        fontFamily: 'Inter_600SemiBold', color: colors.text, fontSize: 13,
        textAlign: 'center', includeFontPadding: false,
    },
    podiumPoints: {
        fontFamily: 'Inter_500Medium', color: colors.textMuted, fontSize: 11,
        marginTop: 2, includeFontPadding: false,
    },
    pedestal: {
        width: '80%', borderTopLeftRadius: 8, borderTopRightRadius: 8,
        marginTop: 8,
    },

    // Rankings
    rankingsHeader: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12,
    },
    rankingsTitle: { fontFamily: 'Inter_700Bold', color: colors.text, fontSize: 16, includeFontPadding: false },

    // Rank rows
    rankRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingVertical: 12, paddingHorizontal: 16, marginHorizontal: 16, marginBottom: 6,
        backgroundColor: colors.surface, borderRadius: radius.lg,
        borderWidth: 1, borderColor: colors.border,
    },
    rankRowMe: { borderColor: colors.primary + '40', backgroundColor: colors.primary + '08' },
    rankNum: { fontFamily: 'Inter_700Bold', color: colors.textMuted, fontSize: 14, width: 24, textAlign: 'center', includeFontPadding: false },
    rankAvatar: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
    rankAvatarText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 15, includeFontPadding: false },
    rankName: { fontFamily: 'Inter_600SemiBold', color: colors.text, fontSize: 14, includeFontPadding: false },
    rankMeta: { fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 11, marginTop: 1, includeFontPadding: false },
    rankPointsWrap: { alignItems: 'flex-end' },
    rankPoints: { fontFamily: 'Inter_700Bold', color: colors.primary, fontSize: 16, includeFontPadding: false },
    rankPtsLabel: { fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 9, includeFontPadding: false },

    emptyText: { fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: 40, includeFontPadding: false },
});
