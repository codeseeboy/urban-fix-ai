import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius } from '../../theme/colors';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function MunicipalProfileScreen({ route, navigation }: any) {
    const { pageId } = route.params;
    const insets = useSafeAreaInsets();
    const { user } = useAuth();

    const [page, setPage] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [posts, setPosts] = useState<any[]>([]);
    const [following, setFollowing] = useState(false);
    const [activeTab, setActiveTab] = useState('updates'); // updates | about

    const getFollowersCount = (pageData: any) => {
        if (typeof pageData?.followersCount === 'number') return pageData.followersCount;
        if (typeof pageData?.followers_count === 'number') return pageData.followers_count;
        return 0;
    };

    const normalizePage = (raw: any) => {
        if (!raw) return raw;
        return {
            ...raw,
            _id: raw._id || raw.id,
            coverImage: raw.coverImage || raw.cover_image || null,
            contactEmail: raw.contactEmail || raw.contact_email || '',
            pageType: raw.pageType || raw.page_type || '',
            followersCount: getFollowersCount(raw),
        };
    };

    useEffect(() => {
        fetchPageDetails();
    }, [pageId]);

    const fetchPageDetails = async (showLoader = true) => {
        if (showLoader) setLoading(true);
        try {
            const { data } = await api.get(`/municipal/${pageId}`);
            const normalizedPage = normalizePage(data);
            setFollowing(data.isFollowing);

            try {
                const followersRes = await api.get(`/municipal/${pageId}/followers`);
                if (Array.isArray(followersRes.data)) {
                    normalizedPage.followersCount = followersRes.data.length;
                }
            } catch (err) {
                console.log('Error fetching followers count:', err);
            }

            setPage(normalizedPage);

            // Fetch posts by this municipal page
            try {
                const postsRes = await api.get('/issues', { params: { municipalPageId: pageId } });
                setPosts(Array.isArray(postsRes.data) ? postsRes.data : []);
            } catch (err) {
                console.log('Error fetching page posts:', err);
            }
        } catch (e) {
            console.log(e);
            Alert.alert('Error', 'Failed to load page details');
            navigation.goBack();
        } finally {
            if (showLoader) setLoading(false);
        }
    };

    const handleFollow = async () => {
        try {
            if (following) {
                await api.post(`/municipal/${pageId}/unfollow`);
                setFollowing(false);
                setPage((prev: any) => {
                    const next = Math.max(0, getFollowersCount(prev) - 1);
                    return { ...prev, followersCount: next, followers_count: next };
                });
            } else {
                await api.post(`/municipal/${pageId}/follow`);
                setFollowing(true);
                setPage((prev: any) => {
                    const next = getFollowersCount(prev) + 1;
                    return { ...prev, followersCount: next, followers_count: next };
                });
            }
            fetchPageDetails(false);
        } catch (e) {
            Alert.alert('Error', 'Failed to update follow status');
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Cover Image */}
                <View style={styles.coverContainer}>
                    {page?.coverImage ? (
                        <Image source={{ uri: page.coverImage }} style={styles.coverImage} />
                    ) : (
                        <LinearGradient colors={[colors.primary, '#0055CC']} style={styles.coverPlaceholder} />
                    )}

                    <TouchableOpacity style={[styles.backBtn, { top: insets.top + 10 }]} onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color="#FFF" />
                    </TouchableOpacity>
                </View>

                {/* Profile Header */}
                <View style={styles.header}>
                    <View style={styles.avatarContainer}>
                        {page?.avatar ? (
                            <Image source={{ uri: page.avatar }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                <Text style={styles.avatarText}>{(page?.name || 'M')[0]}</Text>
                            </View>
                        )}
                        {page?.verified && (
                            <View style={styles.verifiedBadge}>
                                <Ionicons name="checkmark" size={12} color="#FFF" />
                            </View>
                        )}
                    </View>

                    <View style={styles.headerInfo}>
                        <Text style={styles.name}>{page?.name}</Text>
                        {!!page?.handle && <Text style={styles.handle}>@{page?.handle}</Text>}
                        <View style={styles.metaRow}>
                            {!!page?.pageType && (
                                <View style={styles.tag}>
                                    <Text style={styles.tagText}>{page.pageType}</Text>
                                </View>
                            )}
                            {!!page?.region?.city && <Text style={styles.metaText}>{page.region.city}</Text>}
                        </View>
                    </View>
                </View>

                {/* Stats & Actions */}
                <View style={styles.statsBar}>
                    <View>
                        <Text style={styles.statNum}>{getFollowersCount(page)}</Text>
                        <Text style={styles.statLabel}>Followers</Text>
                    </View>

                    <TouchableOpacity
                        style={[styles.followBtn, following ? styles.followingBtn : null]}
                        onPress={handleFollow}
                    >
                        <Text style={[styles.followBtnText, following ? styles.followingBtnText : null]}>
                            {following ? 'Following' : 'Follow'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Description */}
                {page?.description && (
                    <Text style={styles.description}>{page.description}</Text>
                )}

                {/* Tabs */}
                <View style={styles.tabs}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'updates' && styles.activeTab]}
                        onPress={() => setActiveTab('updates')}
                    >
                        <Text style={[styles.tabText, activeTab === 'updates' && styles.activeTabText]}>Updates</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'about' && styles.activeTab]}
                        onPress={() => setActiveTab('about')}
                    >
                        <Text style={[styles.tabText, activeTab === 'about' && styles.activeTabText]}>About</Text>
                    </TouchableOpacity>
                </View>

                {/* Content */}
                {activeTab === 'updates' ? (
                    <View style={styles.contentArea}>
                        {posts.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Ionicons name="newspaper-outline" size={48} color={colors.textMuted} />
                                <Text style={styles.emptyText}>No updates posted yet.</Text>
                            </View>
                        ) : (
                            <View style={styles.galleryGrid}>
                                {posts.map((post) => (
                                    <TouchableOpacity
                                        key={post._id}
                                        style={styles.galleryCard}
                                        activeOpacity={0.85}
                                        onPress={() => navigation.navigate('IssueDetail', { issueId: post._id })}
                                    >
                                        {post.image ? (
                                            <Image source={{ uri: post.image }} style={styles.galleryImage} />
                                        ) : (
                                            <LinearGradient colors={[colors.surfaceLight, colors.surface]} style={styles.galleryImage}>
                                                <Ionicons name="newspaper-outline" size={24} color={colors.textSecondary} />
                                            </LinearGradient>
                                        )}
                                        <View style={styles.galleryContent}>
                                            <Text style={styles.galleryTitle} numberOfLines={2}>{post.title}</Text>
                                            <Text style={styles.galleryMeta} numberOfLines={1}>{post.timeAgo || 'Recent update'}</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>
                ) : (
                    <View style={styles.contentArea}>
                        <View style={styles.infoRow}>
                            <Ionicons name="mail-outline" size={20} color={colors.textMuted} />
                            <Text style={styles.infoText}>{page?.contactEmail || 'No email provided'}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Ionicons name="location-outline" size={20} color={colors.textMuted} />
                            <Text style={styles.infoText}>{[page?.region?.ward, page?.region?.city].filter(Boolean).join(', ') || 'Location not specified'}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Ionicons name="business-outline" size={20} color={colors.textMuted} />
                            <Text style={styles.infoText}>Department: {page?.department || 'Not specified'}</Text>
                        </View>
                    </View>
                )}

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { justifyContent: 'center', alignItems: 'center' },
    coverContainer: { height: 160, position: 'relative' },
    coverImage: { width: '100%', height: '100%' },
    coverPlaceholder: { width: '100%', height: '100%' },
    backBtn: { position: 'absolute', left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },

    header: { paddingHorizontal: 20, marginTop: -36, flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
    avatarContainer: { position: 'relative' },
    avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: colors.background },
    avatarPlaceholder: { backgroundColor: colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontFamily: 'Inter_700Bold', fontSize: 32, color: colors.textMuted },
    verifiedBadge: { position: 'absolute', bottom: 4, right: 0, backgroundColor: colors.primary, width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.background },

    headerInfo: { marginLeft: 16, marginTop: 8, flex: 1 },
    name: { fontFamily: 'Inter_700Bold', fontSize: 18, color: colors.text },
    handle: { fontFamily: 'Inter_500Medium', fontSize: 14, color: colors.textSecondary },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
    tag: { backgroundColor: colors.primary + '15', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    tagText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: colors.primary, textTransform: 'uppercase' },
    metaText: { fontSize: 12, color: colors.textSecondary },

    statsBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 16 },
    statNum: { fontFamily: 'Inter_700Bold', fontSize: 18, color: colors.text },
    statLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textMuted },
    followBtn: { backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 8, borderRadius: 20 },
    followingBtn: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    followBtnText: { fontFamily: 'Inter_600SemiBold', color: '#FFF', fontSize: 14 },
    followingBtnText: { color: colors.text },

    description: { paddingHorizontal: 20, fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.text, lineHeight: 20, marginBottom: 20 },

    tabs: { flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.border },
    tab: { flex: 1, alignItems: 'center', paddingVertical: 14 },
    activeTab: { borderBottomWidth: 2, borderColor: colors.primary },
    tabText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.textMuted },
    activeTabText: { color: colors.primary },

    contentArea: { padding: 20 },
    galleryGrid: { gap: 12 },
    galleryCard: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.lg,
        overflow: 'hidden',
    },
    galleryImage: {
        width: '100%',
        height: 150,
        justifyContent: 'center',
        alignItems: 'center',
    },
    galleryContent: { padding: 12 },
    galleryTitle: { fontFamily: 'Inter_600SemiBold', color: colors.text, fontSize: 14, lineHeight: 20 },
    galleryMeta: { marginTop: 4, fontFamily: 'Inter_400Regular', color: colors.textSecondary, fontSize: 12 },
    emptyState: { alignItems: 'center', paddingVertical: 40, opacity: 0.6 },
    emptyText: { marginTop: 12, fontFamily: 'Inter_500Medium', color: colors.textMuted },

    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
    infoText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.text },
});
