/**
 * HomeFeed — Premium redesigned feed with Community/Municipal toggle,
 * Stories, Reels section, side filter drawer, and social-media-grade cards
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    View, StyleSheet, FlatList, Text, TouchableOpacity, Animated,
    RefreshControl, ActivityIndicator, Share, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { issuesAPI, gamificationAPI } from '../../services/api';
import api from '../../services/api';
import logger from '../../utils/logger';
import { colors, fonts, radius } from '../../theme/colors';

// New premium feed components
import FeedToggle from '../../components/feed/FeedToggle';
import StoriesRow from '../../components/feed/StoriesRow';
import ReelsTab from '../../components/feed/ReelsTab';
import FilterDrawer from '../../components/feed/FilterDrawer';
import FeedPost from '../../components/feed/FeedPost';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/* ─── Greeting based on device time ─── */
const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return { text: 'Good Morning', icon: 'sunny-outline' as const, emoji: '☀️' };
    if (h < 17) return { text: 'Good Afternoon', icon: 'partly-sunny-outline' as const, emoji: '🌤️' };
    if (h < 21) return { text: 'Good Evening', icon: 'moon-outline' as const, emoji: '🌙' };
    return { text: 'Good Night', icon: 'cloudy-night-outline' as const, emoji: '✨' };
};

/* ─── Filter categories for the side drawer ─── */
const FILTER_CATEGORIES = [
    { id: 'all', label: 'All Issues', icon: 'grid-outline' },
    { id: 'trending', label: 'Trending', icon: 'trending-up-outline' },
    { id: 'following', label: 'Following', icon: 'people-outline' },
    { id: 'high_priority', label: 'Critical', icon: 'alert-circle-outline' },
    { id: 'resolved', label: 'Resolved', icon: 'checkmark-circle-outline' },
    { id: 'my_posts', label: 'My Posts', icon: 'person-outline' },
    { id: 'nearby', label: 'Nearby', icon: 'location-outline' },
];

/* ─── Section tabs within feed ─── */
const SECTION_TABS = [
    { id: 'posts', label: 'Posts', icon: 'grid-outline' },
    { id: 'reels', label: 'Reels', icon: 'play-circle-outline' },
];

/* ─── Dummy municipal stories (Real IDs) ─── */
const MUNICIPAL_STORIES = [
    { id: '992a6c0b-1234-5678-90ab-cdef12345678', name: 'Boisar', hasUpdate: true, verified: true, avatar: null }, // Boisar
    { id: '881b5d1a-2345-6789-01bc-def012345679', name: 'Palghar', hasUpdate: true, verified: true, avatar: null }, // Palghar
    { id: '770c4e2b-3456-7890-12cd-ef0123456780', name: 'Roads', hasUpdate: false, verified: true, avatar: null }, // Roads
    { id: '669d3f3c-4567-8901-23de-f01234567881', name: 'Water', hasUpdate: true, verified: false, avatar: null }, // Water
];

export default function HomeFeed({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const greeting = getGreeting();
    const firstName = user?.name?.split(' ')[0] || 'Citizen';

    // Core state
    const [feedMode, setFeedMode] = useState<'community' | 'municipal'>('community');
    const [activeSection, setActiveSection] = useState<'posts' | 'reels'>('posts');
    const [activeFilter, setActiveFilter] = useState('all');
    const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
    const [issues, setIssues] = useState<any[]>([]);
    const [stats, setStats] = useState({ totalIssues: 0, resolved: 0, critical: 0, inProgress: 0, pending: 0 });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const pendingUpvotesRef = useRef<Set<string>>(new Set());
    const pendingDownvotesRef = useRef<Set<string>>(new Set());
    const pendingFollowPagesRef = useRef<Set<string>>(new Set());

    // Scroll animation for header collapse
    const scrollY = useRef(new Animated.Value(0)).current;

    const sortMunicipalByPriority = useCallback((items: any[]) => {
        return [...items].sort((a, b) => {
            const bucketA = typeof a.feedBucket === 'number'
                ? a.feedBucket
                : ((a.isFollowingPage ? 0 : 2) + (a.isSeen ? 1 : 0));
            const bucketB = typeof b.feedBucket === 'number'
                ? b.feedBucket
                : ((b.isFollowingPage ? 0 : 2) + (b.isSeen ? 1 : 0));

            if (bucketA !== bucketB) return bucketA - bucketB;

            const ta = new Date(a?.createdAt || 0).getTime();
            const tb = new Date(b?.createdAt || 0).getTime();
            return tb - ta;
        });
    }, []);

    const sortByNewest = useCallback((items: any[]) => {
        return [...items].sort((a: any, b: any) => {
            const ta = new Date(a?.createdAt || 0).getTime();
            const tb = new Date(b?.createdAt || 0).getTime();
            return tb - ta;
        });
    }, []);

    const getFeedCacheKey = useCallback(() => {
        return `homefeed:${feedMode}:${activeFilter}:${user?._id || 'anon'}`;
    }, [feedMode, activeFilter, user?._id]);

    const hydrateIssuesFromCache = useCallback(async () => {
        try {
            const cacheKey = getFeedCacheKey();
            const cached = await AsyncStorage.getItem(cacheKey);
            if (!cached) return false;

            const parsed = JSON.parse(cached);
            if (!Array.isArray(parsed)) return false;

            setIssues(feedMode === 'municipal' ? sortMunicipalByPriority(parsed) : sortByNewest(parsed));
            return true;
        } catch {
            return false;
        }
    }, [feedMode, getFeedCacheKey, sortMunicipalByPriority, sortByNewest]);

    /* ─── Scroll-driven collapsing header animations ─── */
    const SCROLL_COLLAPSE = 140;
    const stickyBgOpacity = scrollY.interpolate({
        inputRange: [0, 80],
        outputRange: [0, 1],
        extrapolate: 'clamp',
    });
    const stickyBrandOpacity = scrollY.interpolate({
        inputRange: [60, SCROLL_COLLAPSE],
        outputRange: [0, 1],
        extrapolate: 'clamp',
    });
    const stickyBrandSlideX = scrollY.interpolate({
        inputRange: [60, SCROLL_COLLAPSE],
        outputRange: [30, 0],
        extrapolate: 'clamp',
    });
    const stickyBrandSlideY = scrollY.interpolate({
        inputRange: [60, SCROLL_COLLAPSE],
        outputRange: [8, 0],
        extrapolate: 'clamp',
    });
    const feedBrandOpacity = scrollY.interpolate({
        inputRange: [30, 100],
        outputRange: [1, 0],
        extrapolate: 'clamp',
    });
    const feedBrandSlideY = scrollY.interpolate({
        inputRange: [30, 100],
        outputRange: [0, -8],
        extrapolate: 'clamp',
    });
    const stickyBorderOpacity = scrollY.interpolate({
        inputRange: [0, SCROLL_COLLAPSE],
        outputRange: [0, 1],
        extrapolate: 'clamp',
    });

    // Reset scroll position when switching sections
    useEffect(() => { scrollY.setValue(0); }, [activeSection]);

    /* ─── Data fetching ─── */
    const fetchIssues = useCallback(async () => {
        logger.info('HomeFeed', `Fetching ${feedMode} feed, filter: ${activeFilter}`);
        try {
            const filter = activeFilter === 'all' ? undefined : activeFilter;
            const cacheKey = getFeedCacheKey();

            if (feedMode === 'municipal') {
                const { data } = await issuesAPI.getMunicipalFeed(filter, 100);
                const nextIssues = sortMunicipalByPriority(Array.isArray(data) ? data : []);
                setIssues(nextIssues);
                await AsyncStorage.setItem(cacheKey, JSON.stringify(nextIssues));
            } else {
                const { data } = await issuesAPI.getFeed(filter, user?._id, undefined, 'User');
                const sorted = sortByNewest(Array.isArray(data) ? data : []);
                setIssues(sorted);
                await AsyncStorage.setItem(cacheKey, JSON.stringify(sorted));
            }
        } catch (e) {
            console.log('Feed error:', e);
            setIssues([]);
        }
    }, [activeFilter, feedMode, user?._id, sortMunicipalByPriority, sortByNewest, getFeedCacheKey]);

    const fetchStats = async () => {
        try {
            const { data } = await gamificationAPI.getStats();
            setStats(data);
        } catch (e) { console.log('Stats error:', e); }
    };

    useEffect(() => {
        let isMounted = true;

        const loadFeed = async () => {
            setLoading(true);

            const hadCachedFeed = await hydrateIssuesFromCache();
            if (hadCachedFeed && isMounted) {
                setLoading(false);
            }

            await Promise.all([fetchIssues(), fetchStats()]);
            if (isMounted) {
                setLoading(false);
            }
        };

        loadFeed();

        return () => {
            isMounted = false;
        };
    }, [activeFilter, feedMode, fetchIssues, hydrateIssuesFromCache]);

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([fetchIssues(), fetchStats()]);
        setRefreshing(false);
    };

    /* ─── Actions ─── */
    const handleUpvote = async (issueId: string) => {
        logger.tap('HomeFeed', 'Upvote', { issueId });
        if (!user?._id || pendingUpvotesRef.current.has(issueId)) return;

        pendingUpvotesRef.current.add(issueId);
        let previousIssue: any = null;

        setIssues(prev => prev.map(i => {
            if (i._id !== issueId) return i;
            previousIssue = i;
            const currentUpvotes = Array.isArray(i.upvotes) ? i.upvotes : [];
            const isUpvoted = currentUpvotes.includes(user._id);
            const nextUpvotes = isUpvoted
                ? currentUpvotes.filter((u: string) => u !== user._id)
                : [...new Set([...currentUpvotes, user._id])];
            return { ...i, upvotes: nextUpvotes };
        }));

        try {
            await issuesAPI.upvote(issueId);
        } catch (e) {
            if (previousIssue) {
                setIssues(prev => prev.map(i => i._id === issueId ? previousIssue : i));
            }
            console.log('Upvote error:', e);
        } finally {
            pendingUpvotesRef.current.delete(issueId);
        }
    };

    const handleDownvote = async (issueId: string) => {
        logger.tap('HomeFeed', 'Downvote', { issueId });
        if (!user?._id || pendingDownvotesRef.current.has(issueId)) return;

        pendingDownvotesRef.current.add(issueId);
        let previousIssue: any = null;

        setIssues(prev => prev.map(i => {
            if (i._id !== issueId) return i;
            previousIssue = i;
            const currentDownvotes = Array.isArray(i.downvotes) ? i.downvotes : [];
            const isDownvoted = currentDownvotes.includes(user._id);
            const nextDownvotes = isDownvoted
                ? currentDownvotes.filter((u: string) => u !== user._id)
                : [...new Set([...currentDownvotes, user._id])];
            return { ...i, downvotes: nextDownvotes };
        }));

        try {
            await issuesAPI.downvote(issueId);
        } catch (e) {
            if (previousIssue) {
                setIssues(prev => prev.map(i => i._id === issueId ? previousIssue : i));
            }
            console.log('Downvote error:', e);
        } finally {
            pendingDownvotesRef.current.delete(issueId);
        }
    };

    const handleShare = async (item: any) => {
        logger.tap('HomeFeed', 'Share', { issueId: item._id });
        try {
            await Share.share({
                title: item.title,
                message: `🚨 ${item.title}\n📍 ${item.location?.address || 'Unknown'}\n\nReported on UrbanFix AI\n#UrbanFixAI #CivicEngagement`,
            });
        } catch (e) { console.log('Share error:', e); }
    };

    const handleFilterSelect = (filterId: string) => {
        setActiveFilter(filterId);
        setFilterDrawerOpen(false);
    };

    const markMunicipalSeenLocal = useCallback((issueId: string) => {
        setIssues(prev => {
            const updated = prev.map(item =>
                item._id === issueId ? { ...item, isSeen: true } : item
            );
            return sortMunicipalByPriority(updated);
        });
    }, [sortMunicipalByPriority]);

    const handleOpenPost = useCallback(async (item: any) => {
        if (item?.authorType === 'MunicipalPage') {
            // Optimistic: mark seen locally first, navigate instantly
            markMunicipalSeenLocal(item._id);
            issuesAPI.markMunicipalSeen(item._id).catch(e =>
                console.log('Mark municipal seen error:', e)
            );
        }
        navigation.navigate('IssueDetail', { issueId: item._id });
    }, [navigation, markMunicipalSeenLocal]);

    const handleFollowPress = useCallback(async (item: any) => {
        const pageId = item?.municipalPage;
        if (!pageId || pendingFollowPagesRef.current.has(pageId)) return;

        pendingFollowPagesRef.current.add(pageId);
        const nextFollowing = !item.isFollowingPage;

        setIssues(prev => {
            const updated = prev.map((feedItem) =>
                feedItem.municipalPage === pageId
                    ? { ...feedItem, isFollowingPage: nextFollowing }
                    : feedItem
            );
            return sortMunicipalByPriority(updated);
        });

        try {
            if (item.isFollowingPage) {
                await api.post(`/municipal/${pageId}/unfollow`);
            } else {
                await api.post(`/municipal/${pageId}/follow`);
            }
        } catch (e) {
            setIssues(prev => {
                const reverted = prev.map((feedItem) =>
                    feedItem.municipalPage === pageId
                        ? { ...feedItem, isFollowingPage: item.isFollowingPage }
                        : feedItem
                );
                return sortMunicipalByPriority(reverted);
            });
            console.log('Follow/unfollow page error:', e);
        } finally {
            pendingFollowPagesRef.current.delete(pageId);
        }
    }, [sortMunicipalByPriority]);

    /* ─── Get active filter label ─── */
    const activeFilterLabel = FILTER_CATEGORIES.find(f => f.id === activeFilter)?.label || 'All Issues';

    /* ─── Stylish UrbanFix AI branding ─── */
    const BrandTag = () => (
        <View style={styles.brandRow}>
            <LinearGradient
                colors={['transparent', colors.textMuted + '40', 'transparent']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.brandLine}
            />
            <View style={styles.brandTextWrap}>
                <Text style={styles.brandTextUrban}>Urban</Text>
                <Text style={styles.brandTextFix}>Fix</Text>
                <Text style={styles.brandTextAI}> AI</Text>
                <View style={styles.brandShineDot} />
            </View>
            <LinearGradient
                colors={['transparent', colors.textMuted + '40', 'transparent']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.brandLine}
            />
        </View>
    );

    /* ─── Section Tabs (always visible — shared between Posts & Reels) ─── */
    const SectionTabsBar = () => (
        <View style={styles.sectionTabsContainer}>
            <View style={styles.sectionTabs}>
                {SECTION_TABS.map(tab => (
                    <TouchableOpacity
                        key={tab.id}
                        style={[styles.sectionTab, activeSection === tab.id && styles.sectionTabActive]}
                        onPress={() => setActiveSection(tab.id as any)}
                        activeOpacity={0.7}
                    >
                        <Ionicons
                            name={tab.icon as any}
                            size={18}
                            color={activeSection === tab.id ? colors.text : colors.textMuted}
                        />
                        <Text style={[
                            styles.sectionTabText,
                            activeSection === tab.id && styles.sectionTabTextActive,
                        ]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Filter indicator */}
            {activeFilter !== 'all' && (
                <View style={styles.activeFilterIndicator}>
                    <View style={styles.filterDot} />
                    <Text style={styles.activeFilterText}>{activeFilterLabel}</Text>
                    <TouchableOpacity onPress={() => setActiveFilter('all')}>
                        <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );

    /* ─── Header (scrollable — greeting, toggle, tabs, brand, stories) ─── */
    const renderHeader = () => (
        <View style={{ marginHorizontal: -16 }}>
            {/* Greeting Row — scrolls with content */}
            <View style={styles.greetingRow}>
                <View>
                    <Text style={styles.greetingText}>
                        {greeting.text} {greeting.emoji}
                    </Text>
                    <Text style={styles.userName}>{firstName}</Text>
                </View>
                <View style={{ width: 90 }} />
            </View>

            {/* Feed Mode Toggle */}
            <FeedToggle activeTab={feedMode} onToggle={setFeedMode} />

            {/* Section Tabs */}
            <SectionTabsBar />

            {/* UrbanFix AI branding — fades/lifts out as sticky version appears */}
            <Animated.View style={{ opacity: feedBrandOpacity, transform: [{ translateY: feedBrandSlideY }] }}>
                <BrandTag />
            </Animated.View>

            {/* Stories Row (shows in municipal mode) */}
            {feedMode === 'municipal' && (
                <StoriesRow
                    stories={MUNICIPAL_STORIES}
                    showAddStory={false}
                    onStoryPress={(story) => navigation.navigate('MunicipalProfile', { pageId: story.id })}
                    onAddStory={() => navigation.navigate('ReportIssue')}
                />
            )}
        </View>
    );

    /* ─── Render feed item ─── */
    const renderItem = ({ item, index }: { item: any; index: number }) => {
        return (
            <FeedPost
                item={item}
                userId={user?._id}
                index={index}
                onPress={() => handleOpenPost(item)}
                onUpvote={handleUpvote}
                onDownvote={handleDownvote}
                onComment={() => handleOpenPost(item)}
                onShare={handleShare}
                onUserPress={(it) => {
                    if (it.authorType === 'MunicipalPage') {
                        navigation.navigate('MunicipalProfile', { pageId: it.municipalPage });
                    }
                }}
                onFollowPress={feedMode === 'municipal' ? handleFollowPress : undefined}
            />
        );
    };

    return (
        <View style={styles.container}>
            {/* ─── Main Content Area ─── */}
            <View style={{ flex: 1, paddingTop: insets.top }}>
                {activeSection === 'reels' ? (
                    <View style={{ flex: 1 }}>
                        {/* Greeting + buttons for reels (no scroll = shows normally) */}
                        <View style={styles.greetingRow}>
                            <View>
                                <Text style={styles.greetingText}>
                                    {greeting.text} {greeting.emoji}
                                </Text>
                                <Text style={styles.userName}>{firstName}</Text>
                            </View>
                            <View style={styles.topBarRight}>
                                <TouchableOpacity
                                    style={styles.topBarBtn}
                                    onPress={() => setFilterDrawerOpen(true)}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="options-outline" size={20} color={colors.text} />
                                    {activeFilter !== 'all' && <View style={styles.filterActiveDot} />}
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.topBarBtn}
                                    onPress={() => navigation.navigate('Settings')}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="search-outline" size={20} color={colors.text} />
                                </TouchableOpacity>
                            </View>
                        </View>
                        <FeedToggle activeTab={feedMode} onToggle={setFeedMode} />
                        <SectionTabsBar />
                        <ReelsTab
                            reels={[]}
                            loading={false}
                            userId={user?._id}
                            onLike={handleUpvote}
                            onComment={(id) => navigation.navigate('IssueDetail', { issueId: id })}
                            onShare={handleShare}
                            onUserPress={() => { }}
                            activeToggle={feedMode}
                        />
                    </View>
                ) : (
                    <FlatList
                        data={loading ? [] : issues}
                        renderItem={renderItem}
                        keyExtractor={i => i._id}
                        ListHeaderComponent={renderHeader}
                        contentContainerStyle={styles.feedContent}
                        showsVerticalScrollIndicator={false}
                        onScroll={Animated.event(
                            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                            { useNativeDriver: false },
                        )}
                        scrollEventThrottle={16}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                tintColor={colors.primary}
                                colors={[colors.primary]}
                                progressBackgroundColor={colors.surface}
                            />
                        }
                        ListEmptyComponent={
                            loading ? (
                                <View style={styles.loadWrap}>
                                    <ActivityIndicator size="large" color={colors.primary} />
                                    <Text style={styles.loadText}>Loading feed...</Text>
                                </View>
                            ) : (
                                <View style={styles.emptyWrap}>
                                    <View style={styles.emptyIcon}>
                                        <Ionicons name="telescope-outline" size={48} color={colors.textMuted} />
                                    </View>
                                    <Text style={styles.emptyTitle}>
                                        {feedMode === 'municipal' ? 'No municipal updates' : 'No issues found'}
                                    </Text>
                                    <Text style={styles.emptySubtitle}>
                                        {feedMode === 'municipal'
                                            ? 'Follow municipal pages to see updates here'
                                            : 'Pull down to refresh or try a different filter'}
                                    </Text>
                                </View>
                            )
                        }
                    />
                )}
            </View>

            {/* ─── STICKY OVERLAY — brand + buttons floating on top (Posts mode only) ─── */}
            {activeSection === 'posts' && (
                <View
                    style={[styles.stickyOverlay, { paddingTop: insets.top }]}
                    pointerEvents="box-none"
                >
                    {/* Background fades in on scroll to cover content */}
                    <Animated.View
                        style={[styles.stickyOverlayBg, { opacity: stickyBgOpacity }]}
                        pointerEvents="none"
                    />
                    {/* Row: brand slides in left + buttons always visible right */}
                    <View style={styles.stickyOverlayRow} pointerEvents="box-none">
                        <Animated.View
                            style={[styles.stickyBrandBlock, {
                                opacity: stickyBrandOpacity,
                                transform: [
                                    { translateX: stickyBrandSlideX },
                                    { translateY: stickyBrandSlideY },
                                ],
                            }]}
                            pointerEvents="none"
                        >
                            <Text style={styles.stickyBrandUrban}>Urban</Text>
                            <Text style={styles.stickyBrandFix}>Fix</Text>
                            <Text style={styles.stickyBrandAI}> AI</Text>
                            <View style={styles.stickyBrandShine} />
                        </Animated.View>

                        <View style={styles.topBarRight}>
                            <TouchableOpacity
                                style={styles.topBarBtn}
                                onPress={() => setFilterDrawerOpen(true)}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="options-outline" size={20} color={colors.text} />
                                {activeFilter !== 'all' && <View style={styles.filterActiveDot} />}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.topBarBtn}
                                onPress={() => navigation.navigate('Settings')}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="search-outline" size={20} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                    </View>
                    {/* Subtle border appears on scroll */}
                    <Animated.View style={[styles.stickyBorderLine, { opacity: stickyBorderOpacity }]} />
                </View>
            )}

            {/* ─── Filter Side Drawer ─── */}
            <FilterDrawer
                visible={filterDrawerOpen}
                onClose={() => setFilterDrawerOpen(false)}
                activeFilter={activeFilter}
                onSelectFilter={handleFilterSelect}
                filters={FILTER_CATEGORIES}
            />
        </View>
    );
}

/* ═══════════════════════ STYLES ═══════════════════════ */
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },

    /* ─── Sticky Overlay (floating brand + buttons) ─── */
    stickyOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
    },
    stickyOverlayBg: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: colors.background,
    },
    stickyOverlayRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 6,
        minHeight: 48,
    },
    stickyBrandBlock: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    stickyBrandUrban: {
        fontFamily: fonts.bold,
        fontSize: 16,
        color: '#FFFFFF',
        letterSpacing: 2,
        textTransform: 'uppercase',
    },
    stickyBrandFix: {
        fontFamily: fonts.black,
        fontSize: 16,
        color: colors.primary,
        letterSpacing: 2,
        textTransform: 'uppercase',
    },
    stickyBrandAI: {
        fontFamily: fonts.semibold,
        fontSize: 11,
        color: colors.primary,
        letterSpacing: 0.5,
        opacity: 0.85,
    },
    stickyBrandShine: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#FFFFFF',
        marginLeft: 5,
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 6,
        elevation: 8,
    },
    stickyBorderLine: {
        height: 1,
        backgroundColor: colors.border,
    },

    /* ─── Greeting Row (scrollable in FlatList header) ─── */
    greetingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 6,
    },
    greetingText: {
        fontFamily: fonts.medium,
        fontSize: 13,
        color: colors.textSecondary,
        letterSpacing: 0.2,
    },
    userName: {
        fontFamily: fonts.black,
        fontSize: 22,
        color: colors.text,
        letterSpacing: -0.5,
        marginTop: 1,
    },
    topBarRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    topBarBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: colors.surfaceLight,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    filterActiveDot: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: colors.primary,
        borderWidth: 1.5,
        borderColor: colors.surfaceLight,
    },

    /* ─── UrbanFix AI Brand Tag ─── */
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 20,
        marginTop: 2,
        marginBottom: 14,
        gap: 10,
    },
    brandLine: {
        flex: 1,
        height: 1,
    },
    brandTextWrap: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    brandTextUrban: {
        fontFamily: fonts.semibold,
        fontSize: 11,
        color: '#FFFFFF',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
    },
    brandTextFix: {
        fontFamily: fonts.bold,
        fontSize: 11,
        color: colors.primary,
        letterSpacing: 1.5,
        textTransform: 'uppercase',
    },
    brandTextAI: {
        fontFamily: fonts.medium,
        fontSize: 9,
        color: colors.primary,
        letterSpacing: 0.5,
        opacity: 0.8,
    },
    brandShineDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#FFFFFF',
        marginLeft: 4,
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 4,
        elevation: 6,
    },

    /* ─── Section Tabs (always visible) ─── */
    sectionTabsContainer: {
        marginHorizontal: 16,
        marginBottom: 10,
    },
    sectionTabs: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: 3,
        borderWidth: 1,
        borderColor: colors.border,
    },
    sectionTab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: radius.md - 2,
    },
    sectionTabActive: {
        backgroundColor: colors.surfaceLight,
    },
    sectionTabText: {
        fontFamily: fonts.semibold,
        fontSize: 13,
        color: colors.textMuted,
    },
    sectionTabTextActive: {
        color: colors.text,
    },

    /* ─── Active Filter Indicator ─── */
    activeFilterIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: colors.primary + '12',
        borderRadius: 10,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: colors.primary + '25',
    },
    filterDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.primary,
    },
    activeFilterText: {
        fontFamily: fonts.medium,
        color: colors.primary,
        fontSize: 12,
    },

    /* ─── Feed Content ─── */
    feedContent: {
        paddingHorizontal: 16,
        paddingBottom: 100,
    },

    /* ─── Loading ─── */
    loadWrap: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    loadText: {
        fontFamily: fonts.medium,
        color: colors.textMuted,
        fontSize: 13,
    },

    /* ─── Empty State ─── */
    emptyWrap: {
        alignItems: 'center',
        paddingTop: 60,
        paddingHorizontal: 40,
    },
    emptyIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.surfaceLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontFamily: fonts.semibold,
        color: colors.text,
        fontSize: 16,
        marginBottom: 6,
    },
    emptySubtitle: {
        fontFamily: fonts.regular,
        color: colors.textMuted,
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 19,
    },
});
