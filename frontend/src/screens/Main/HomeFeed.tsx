import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, Text, TouchableOpacity, Animated, Image, RefreshControl, ActivityIndicator, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { issuesAPI, gamificationAPI } from '../../services/api';
import logger from '../../utils/logger';
import { colors, fonts, radius } from '../../theme/colors';
import SuggestedFollows from '../../components/Municipal/SuggestedFollows'; // New Import

const FILTERS = [
    { id: 'all', icon: 'grid-outline', label: 'All' },
    { id: 'trending', icon: 'trending-up-outline', label: 'Trending' },
    { id: 'following', icon: 'people-outline', label: 'Following' },
    { id: 'high_priority', icon: 'alert-circle-outline', label: 'Critical' },
    { id: 'resolved', icon: 'checkmark-circle-outline', label: 'Resolved' },
    { id: 'my_posts', icon: 'person-outline', label: 'My Posts' },
];

export default function HomeFeed({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const [activeFilter, setActiveFilter] = useState('all');
    const [issues, setIssues] = useState<any[]>([]);
    const [stats, setStats] = useState({ totalIssues: 0, resolved: 0, critical: 0 });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchIssues = useCallback(async () => {
        logger.info('HomeFeed', `Fetching issues with filter: ${activeFilter}`);
        try {
            const filter = activeFilter === 'all' ? undefined : activeFilter;
            const { data } = await issuesAPI.getFeed(filter, user?._id);
            setIssues(data);
        } catch (e) {
            console.log('Feed error:', e);
        }
    }, [activeFilter, user?._id]);

    const fetchStats = async () => {
        try {
            const { data } = await gamificationAPI.getStats();
            setStats(data);
        } catch (e) { console.log('Stats error:', e); }
    };

    useEffect(() => {
        setLoading(true);
        Promise.all([fetchIssues(), fetchStats()]).finally(() => setLoading(false));
    }, [activeFilter]);

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([fetchIssues(), fetchStats()]);
        setRefreshing(false);
    };

    const handleUpvote = async (issueId: string) => {
        logger.tap('HomeFeed', 'Upvote', { issueId });
        try {
            const { data } = await issuesAPI.upvote(issueId);
            setIssues(prev => prev.map(i => i._id === issueId ? {
                ...i, upvotes: data.upvoted ? [...i.upvotes, user?._id] : i.upvotes.filter((u: string) => u !== user?._id),
            } : i));
        } catch (e) { console.log('Upvote error:', e); }
    };

    const handleDownvote = async (issueId: string) => {
        logger.tap('HomeFeed', 'Downvote', { issueId });
        try {
            const { data } = await issuesAPI.downvote(issueId);
            setIssues(prev => prev.map(i => i._id === issueId ? {
                ...i, downvotes: data.downvoted ? [...(i.downvotes || []), user?._id] : (i.downvotes || []).filter((u: string) => u !== user?._id),
            } : i));
        } catch (e) { console.log('Downvote error:', e); }
    };

    const handleShare = async (item: any) => {
        logger.tap('HomeFeed', 'Share', { issueId: item._id });
        try {
            await Share.share({
                title: item.title,
                message: `🚨 ${item.title}\n📍 ${item.location?.address || 'Unknown'}\n🔴 Severity: ${item.aiSeverity}\n\nReported on UrbanFix AI — Help make our city better!\n#UrbanFixAI #CivicEngagement`,
            });
        } catch (e) { console.log('Share error:', e); }
    };

    const getSeverityColor = (s: string) => s === 'Critical' ? '#FF003C' : s === 'High' ? '#FF453A' : s === 'Medium' ? '#FFD60A' : '#30D158';

    const renderIssueCard = ({ item }: any) => {
        const isMunicipal = item.authorType === 'MunicipalPage';

        return (
            <TouchableOpacity style={[styles.card, isMunicipal && styles.municipalCard]} activeOpacity={0.9}
                onPress={() => isMunicipal ? navigation.navigate('MunicipalProfile', { pageId: item.municipalPage }) : navigation.navigate('IssueDetail', { issueId: item._id })}>

                {/* Severity glow line - Only for user issues */}
                {!isMunicipal && <View style={[styles.glowLine, { backgroundColor: getSeverityColor(item.aiSeverity) }]} />}
                {isMunicipal && <View style={[styles.glowLine, { backgroundColor: '#0055CC' }]} />}

                {/* Header */}
                <View style={styles.cardHeader}>
                    <View style={styles.cardUser}>
                        {isMunicipal ? (
                            <Image source={{ uri: item.user?.avatar || 'https://via.placeholder.com/40' }} style={styles.avatar} />
                        ) : (
                            <LinearGradient colors={[colors.primary, '#0055CC']} style={styles.avatar}>
                                <Text style={styles.avatarText}>{(item.user?.name || 'A')[0]}</Text>
                            </LinearGradient>
                        )}

                        <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Text style={styles.userName}>{item.user?.name || 'Anonymous'}</Text>
                                {isMunicipal && <Ionicons name="checkmark-circle" size={14} color={colors.primary} />}
                            </View>
                            <Text style={styles.timeText}>
                                {isMunicipal ? 'Official Update' : item.timeAgo} • {item.location?.address || 'Unknown'}
                            </Text>
                        </View>
                    </View>

                    {!isMunicipal ? (
                        <View style={[styles.sevBadge, { backgroundColor: getSeverityColor(item.aiSeverity) + '20' }]}>
                            <Text style={[styles.sevText, { color: getSeverityColor(item.aiSeverity) }]}>{item.aiSeverity}</Text>
                        </View>
                    ) : (
                        <View style={[styles.sevBadge, { backgroundColor: '#0055CC20' }]}>
                            <Text style={[styles.sevText, { color: '#0055CC' }]}>{item.officialUpdateType || 'UPDATE'}</Text>
                        </View>
                    )}
                </View>

                {/* Title */}
                <Text style={styles.cardTitle}>{item.title}</Text>
                {/* Description for Official Updates */}
                {isMunicipal && item.description && (
                    <Text style={styles.cardDesc} numberOfLines={3}>{item.description}</Text>
                )}

                {/* Image */}
                {item.image && (
                    <View style={styles.imageWrap}>
                        <Image source={{ uri: item.image }} style={styles.cardImage} />
                        {!isMunicipal && (
                            <View style={styles.imgOverlay}>
                                <View style={styles.deptTag}>
                                    <Text style={styles.deptText}>{item.departmentTag}</Text>
                                </View>
                            </View>
                        )}
                    </View>
                )}

                {/* Status + Emergency (User Only) */}
                {!isMunicipal && (
                    <View style={styles.statusRow}>
                        <View style={[styles.statusBadge, { backgroundColor: item.status === 'Resolved' ? colors.success + '15' : item.status === 'InProgress' ? colors.primary + '15' : colors.warning + '15' }]}>
                            <Ionicons name={item.status === 'Resolved' ? 'checkmark-circle' : item.status === 'InProgress' ? 'sync' : 'time'} size={12}
                                color={item.status === 'Resolved' ? colors.success : item.status === 'InProgress' ? colors.primary : colors.warning} />
                            <Text style={[styles.statusText, { color: item.status === 'Resolved' ? colors.success : item.status === 'InProgress' ? colors.primary : colors.warning }]}>
                                {item.status === 'InProgress' ? 'In Progress' : item.status}
                            </Text>
                        </View>
                        {item.emergency && (
                            <View style={styles.emergencyBadge}>
                                <Ionicons name="warning" size={11} color="#FF003C" />
                                <Text style={styles.emergencyText}>EMERGENCY</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Actions */}
                <View style={styles.actionsRow}>
                    {!isMunicipal ? (
                        <>
                            <TouchableOpacity style={styles.actionBtn} onPress={() => handleUpvote(item._id)}>
                                <Ionicons name={item.upvotes?.includes(user?._id) ? 'arrow-up-circle' : 'arrow-up-circle-outline'}
                                    size={20} color={item.upvotes?.includes(user?._id) ? colors.primary : colors.textSecondary} />
                                <Text style={[styles.actionText, item.upvotes?.includes(user?._id) && { color: colors.primary }]}>{item.upvotes?.length || 0}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionBtn} onPress={() => handleDownvote(item._id)}>
                                <Ionicons name={(item.downvotes || []).includes(user?._id) ? 'arrow-down-circle' : 'arrow-down-circle-outline'}
                                    size={20} color={(item.downvotes || []).includes(user?._id) ? '#FF453A' : colors.textSecondary} />
                                <Text style={[styles.actionText, (item.downvotes || []).includes(user?._id) && { color: '#FF453A' }]}>{(item.downvotes || []).length}</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <View style={styles.actionBtn}>
                            <Ionicons name="eye-outline" size={18} color={colors.textSecondary} />
                            <Text style={styles.actionText}>Official Post</Text>
                        </View>
                    )}

                    <TouchableOpacity style={styles.actionBtn} onPress={() => !isMunicipal && navigation.navigate('IssueDetail', { issueId: item._id })}>
                        <Ionicons name="chatbubble-outline" size={18} color={colors.textSecondary} />
                        <Text style={styles.actionText}>{item.commentCount || 0}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleShare(item)}>
                        <Ionicons name="share-social-outline" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    const dataWithSuggestions = React.useMemo(() => {
        if (loading || issues.length === 0) return issues;
        // Inject suggestions after the 2nd item
        const insertionIndex = Math.min(2, issues.length);
        const newDetails = [...issues];
        newDetails.splice(insertionIndex, 0, { _id: 'suggestion_injection', type: 'suggestion' });
        return newDetails;
    }, [issues, loading]);

    const renderItem = ({ item }: any) => {
        if (item.type === 'suggestion') {
            return <SuggestedFollows navigation={navigation} />;
        }
        return renderIssueCard({ item });
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>UrbanFix AI</Text>
                    <Text style={styles.headerSub}>Welcome, {user?.name?.split(' ')[0] || 'Citizen'}</Text>
                </View>
                <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('Settings')}>
                    <Ionicons name="search-outline" size={22} color={colors.text} />
                </TouchableOpacity>
            </View>

            {/* Filters */}
            <View style={styles.filterRow}>
                <FlatList
                    horizontal data={FILTERS} showsHorizontalScrollIndicator={false}
                    keyExtractor={i => i.id} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={[styles.filterChip, activeFilter === item.id && styles.filterActive]}
                            onPress={() => setActiveFilter(item.id)} activeOpacity={0.7}>
                            <Ionicons name={item.icon as any} size={14} color={activeFilter === item.id ? '#FFF' : colors.textSecondary} />
                            <Text style={[styles.filterText, activeFilter === item.id && styles.filterTextActive]}>{item.label}</Text>
                        </TouchableOpacity>
                    )}
                />
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
                <View style={styles.statItem}><Text style={styles.statNum}>{stats.totalIssues}</Text><Text style={styles.statLabel}>Issues</Text></View>
                <View style={[styles.statItem, styles.statBorder]}><Text style={styles.statNum}>{stats.resolved}</Text><Text style={styles.statLabel}>Resolved</Text></View>
                <View style={styles.statItem}><Text style={[styles.statNum, { color: colors.error }]}>{stats.critical}</Text><Text style={styles.statLabel}>Critical</Text></View>
            </View>

            {/* Feed */}
            {loading ? (
                <View style={styles.loadWrap}><ActivityIndicator size="large" color={colors.primary} /></View>
            ) : (
                <FlatList
                    data={dataWithSuggestions}
                    renderItem={renderItem}
                    keyExtractor={i => i._id}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
                    ListEmptyComponent={
                        <View style={styles.emptyWrap}>
                            <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
                            <Text style={styles.emptyText}>No issues found</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingVertical: 12,
    },
    headerTitle: { fontFamily: 'Inter_900Black', fontSize: 22, color: colors.text, letterSpacing: -0.5 },
    headerSub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    headerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
    filterRow: { marginBottom: 8 },
    filterChip: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
        backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    },
    filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterText: { fontFamily: 'Inter_600SemiBold', color: colors.textSecondary, fontSize: 12 },
    filterTextActive: { color: '#FFF' },
    statsRow: {
        flexDirection: 'row', marginHorizontal: 16, marginBottom: 12,
        backgroundColor: colors.surface, borderRadius: radius.lg, padding: 12,
        borderWidth: 1, borderColor: colors.border,
    },
    statItem: { flex: 1, alignItems: 'center' },
    statBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border },
    statNum: { fontFamily: 'Inter_700Bold', color: colors.text, fontSize: 18 },
    statLabel: { fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 10, marginTop: 2 },
    loadWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyWrap: { alignItems: 'center', paddingTop: 60 },
    emptyText: { fontFamily: 'Inter_500Medium', color: colors.textMuted, fontSize: 14, marginTop: 12 },
    card: {
        backgroundColor: colors.surface, borderRadius: radius.xl, marginBottom: 14,
        borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
    },
    glowLine: { height: 3, width: '100%' },
    cardHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 14, paddingBottom: 6,
    },
    cardUser: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    avatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 15 },
    userName: { fontFamily: 'Inter_600SemiBold', color: colors.text, fontSize: 14 },
    timeText: { fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 11, marginTop: 1 },
    sevBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
    sevText: { fontFamily: 'Inter_700Bold', fontSize: 10, textTransform: 'uppercase' },
    cardTitle: { fontFamily: 'Inter_600SemiBold', color: colors.text, fontSize: 15, paddingHorizontal: 14, paddingBottom: 10 },
    imageWrap: { position: 'relative' },
    cardImage: { width: '100%', height: 200 },
    imgOverlay: { position: 'absolute', bottom: 10, left: 10 },
    deptTag: { backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    deptText: { fontFamily: 'Inter_600SemiBold', color: '#FFF', fontSize: 11 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 10 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    statusText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
    emergencyBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: '#FF003C15' },
    emergencyText: { fontFamily: 'Inter_700Bold', fontSize: 9, color: '#FF003C', letterSpacing: 0.5 },
    actionsRow: {
        flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 12, gap: 20,
        borderTopWidth: 1, borderTopColor: colors.border, marginTop: 10,
    },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    actionText: { fontFamily: 'Inter_500Medium', color: colors.textSecondary, fontSize: 13 },
    municipalCard: { backgroundColor: colors.surface, borderColor: colors.primary + '40', borderWidth: 1 },
    cardDesc: { fontFamily: 'Inter_400Regular', color: colors.textSecondary, fontSize: 13, paddingHorizontal: 14, paddingBottom: 10, lineHeight: 18 },
});
