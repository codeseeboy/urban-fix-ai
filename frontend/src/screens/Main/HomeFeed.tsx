/**
 * HomeFeed — Premium redesigned feed with Community/Municipal toggle,
 * Stories, Reels section, side filter drawer, and social-media-grade cards
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
    View, StyleSheet, FlatList, Text, TouchableOpacity, Animated,
    RefreshControl, ActivityIndicator, Share, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { issuesAPI, gamificationAPI } from '../../services/api';
import logger from '../../utils/logger';
import { colors, fonts, radius } from '../../theme/colors';

// New premium feed components
import FeedToggle from '../../components/feed/FeedToggle';
import StoriesRow from '../../components/feed/StoriesRow';
import ReelsTab from '../../components/feed/ReelsTab';
import FilterDrawer from '../../components/feed/FilterDrawer';
import FeedPost from '../../components/feed/FeedPost';
import SuggestedFollows from '../../components/Municipal/SuggestedFollows';

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

/* ─── Dummy municipal posts for Boisar & Palghar ─── */
const DUMMY_MUNICIPAL_POSTS: any[] = [
    {
        _id: 'muni-boisar-notice-1',
        title: 'Water supply disruption — Maintenance scheduled',
        description: 'Due to pipeline maintenance, water supply in Ward 5 & 6 will be disrupted on 20th Feb from 10:00 AM to 4:00 PM. Please store water in advance.',
        authorType: 'MunicipalPage',
        user: { name: 'Boisar Municipal Council', avatar: null, _id: 'muni-boisar' },
        municipalPage: 'muni-boisar',
        officialUpdateType: 'NOTICE',
        timeAgo: '3h ago',
        image: null,
        upvotes: ['u1', 'u2', 'u3', 'u4', 'u5'],
        downvotes: [],
        commentCount: 12,
        status: 'Active',
        location: { address: 'Boisar, Palghar District' },
        aiSeverity: null,
        departmentTag: 'Water Dept',
        emergency: false,
    },
    {
        _id: 'muni-palghar-resolved-1',
        title: 'Pothole repair completed — Palghar-Boisar Road',
        description: 'The potholes reported by citizens on Palghar-Boisar main road have been repaired. Thank you for your patience and reports!',
        authorType: 'MunicipalPage',
        user: { name: 'Palghar Zilla Parishad', avatar: null, _id: 'muni-palghar' },
        municipalPage: 'muni-palghar',
        officialUpdateType: 'RESOLVED',
        timeAgo: '5h ago',
        image: 'http://192.168.0.102:5000/public/images/pothole.jpg',
        upvotes: ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8'],
        downvotes: [],
        commentCount: 24,
        status: 'Resolved',
        location: { address: 'Palghar-Boisar Road, NH-8' },
        aiSeverity: null,
        departmentTag: 'Roads Dept',
        emergency: false,
    },
    {
        _id: 'muni-boisar-notice-2',
        title: 'New garbage collection schedule — Starting Monday',
        description: 'Door-to-door garbage collection timings changed: 7:00 AM – 10:00 AM for wet waste, 10:00 AM – 12:00 PM for dry waste. Please segregate.',
        authorType: 'MunicipalPage',
        user: { name: 'Boisar Municipal Council', avatar: null, _id: 'muni-boisar' },
        municipalPage: 'muni-boisar',
        officialUpdateType: 'NOTICE',
        timeAgo: '8h ago',
        image: null,
        upvotes: ['u1', 'u2'],
        downvotes: [],
        commentCount: 6,
        status: 'Active',
        location: { address: 'All Wards, Boisar' },
        aiSeverity: null,
        departmentTag: 'Sanitation',
        emergency: false,
    },
    {
        _id: 'muni-palghar-notice-1',
        title: 'Street light installation — 45 new lights in Palghar East',
        description: 'As part of the Smart City initiative, 45 new LED street lights have been installed in Palghar East zone. Report any non-functional lights via this app.',
        authorType: 'MunicipalPage',
        user: { name: 'Palghar Zilla Parishad', avatar: null, _id: 'muni-palghar' },
        municipalPage: 'muni-palghar',
        officialUpdateType: 'UPDATE',
        timeAgo: '1d ago',
        image: 'http://192.168.0.102:5000/public/images/streetlight.webp',
        upvotes: ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9', 'u10', 'u11'],
        downvotes: [],
        commentCount: 18,
        status: 'Active',
        location: { address: 'Palghar East Zone' },
        aiSeverity: null,
        departmentTag: 'Electricity Dept',
        emergency: false,
    },
    {
        _id: 'muni-boisar-resolved-1',
        title: 'Drainage blockage cleared — Katkarpada Road',
        description: 'The blocked drainage near Katkarpada junction has been cleared by our team. Waterlogging issue is now resolved.',
        authorType: 'MunicipalPage',
        user: { name: 'Boisar Municipal Council', avatar: null, _id: 'muni-boisar' },
        municipalPage: 'muni-boisar',
        officialUpdateType: 'RESOLVED',
        timeAgo: '1d ago',
        image: null,
        upvotes: ['u1', 'u2', 'u3'],
        downvotes: [],
        commentCount: 9,
        status: 'Resolved',
        location: { address: 'Katkarpada, Boisar' },
        aiSeverity: null,
        departmentTag: 'Drainage Dept',
        emergency: false,
    },
];

/* ─── Dummy stories for municipal pages ─── */
const MUNICIPAL_STORIES = [
    { id: 'story-boisar', name: 'Boisar MC', hasUpdate: true, verified: true },
    { id: 'story-palghar', name: 'Palghar ZP', hasUpdate: true, verified: true },
    { id: 'story-roads', name: 'Roads Dept', hasUpdate: false, verified: true },
    { id: 'story-water', name: 'Water Dept', hasUpdate: true, verified: false },
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

    // Scroll animation for header collapse
    const scrollY = useRef(new Animated.Value(0)).current;

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
            const { data } = await issuesAPI.getFeed(filter, user?._id);
            if (feedMode === 'municipal') {
                // Use real municipal posts if any, otherwise fall back to dummy
                const realMunicipal = data.filter((i: any) => i.authorType === 'MunicipalPage');
                setIssues(realMunicipal.length > 0 ? realMunicipal : DUMMY_MUNICIPAL_POSTS);
            } else {
                setIssues(data.filter((i: any) => i.authorType !== 'MunicipalPage'));
            }
        } catch (e) {
            console.log('Feed error:', e);
            // Show dummy municipal posts even on error
            if (feedMode === 'municipal') setIssues(DUMMY_MUNICIPAL_POSTS);
        }
    }, [activeFilter, feedMode, user?._id]);

    const fetchStats = async () => {
        try {
            const { data } = await gamificationAPI.getStats();
            setStats(data);
        } catch (e) { console.log('Stats error:', e); }
    };

    useEffect(() => {
        setLoading(true);
        Promise.all([fetchIssues(), fetchStats()]).finally(() => setLoading(false));
    }, [activeFilter, feedMode]);

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([fetchIssues(), fetchStats()]);
        setRefreshing(false);
    };

    /* ─── Actions ─── */
    const handleUpvote = async (issueId: string) => {
        // Skip for dummy municipal posts
        if (issueId.startsWith('muni-')) return;
        logger.tap('HomeFeed', 'Upvote', { issueId });
        try {
            const { data } = await issuesAPI.upvote(issueId);
            setIssues(prev => prev.map(i => i._id === issueId ? {
                ...i, upvotes: data.upvoted
                    ? [...i.upvotes, user?._id]
                    : i.upvotes.filter((u: string) => u !== user?._id),
            } : i));
        } catch (e) { console.log('Upvote error:', e); }
    };

    const handleDownvote = async (issueId: string) => {
        if (issueId.startsWith('muni-')) return;
        logger.tap('HomeFeed', 'Downvote', { issueId });
        try {
            const { data } = await issuesAPI.downvote(issueId);
            setIssues(prev => prev.map(i => i._id === issueId ? {
                ...i, downvotes: data.downvoted
                    ? [...(i.downvotes || []), user?._id]
                    : (i.downvotes || []).filter((u: string) => u !== user?._id),
            } : i));
        } catch (e) { console.log('Downvote error:', e); }
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

    /* ─── Feed data with injections ─── */
    const feedData = useMemo(() => {
        if (loading || issues.length === 0) return issues;
        const items = [...issues];
        if (feedMode === 'municipal' && items.length >= 2) {
            items.splice(2, 0, { _id: 'suggestion_injection', type: 'suggestion' });
        }
        if (feedMode === 'community' && items.length >= 3) {
            items.splice(3, 0, { _id: 'suggestion_injection', type: 'suggestion' });
        }
        return items;
    }, [issues, loading, feedMode]);

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
                    onStoryPress={() => {}}
                    onAddStory={() => navigation.navigate('ReportIssue')}
                />
            )}
        </View>
    );

    /* ─── Render feed item ─── */
    const renderItem = ({ item, index }: { item: any; index: number }) => {
        if (item.type === 'suggestion') {
            return <SuggestedFollows navigation={navigation} />;
        }
        return (
            <FeedPost
                item={item}
                userId={user?._id}
                index={index}
                onPress={() =>
                    item.authorType === 'MunicipalPage'
                        ? navigation.navigate('MunicipalProfile', { pageId: item.municipalPage })
                        : navigation.navigate('IssueDetail', { issueId: item._id })
                }
                onUpvote={handleUpvote}
                onDownvote={handleDownvote}
                onComment={(id) => navigation.navigate('IssueDetail', { issueId: id })}
                onShare={handleShare}
                onUserPress={(it) => {
                    if (it.authorType === 'MunicipalPage') {
                        navigation.navigate('MunicipalProfile', { pageId: it.municipalPage });
                    }
                }}
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
                            onUserPress={() => {}}
                            activeToggle={feedMode}
                        />
                    </View>
                ) : (
                    <FlatList
                        data={loading ? [] : feedData}
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
