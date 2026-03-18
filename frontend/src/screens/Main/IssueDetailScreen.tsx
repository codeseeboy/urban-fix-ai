import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Share, Modal, Animated, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { issuesAPI } from '../../services/api';
import logger from '../../utils/logger';
import { colors, fonts, radius } from '../../theme/colors';

const ISSUE_ACTION_QUEUE_KEY = 'issueDetail:actionQueue:v1';
const ISSUE_DETAIL_CACHE_PREFIX = 'issueDetail:cache:v1';

type QueuedIssueAction = {
    id: string;
    type: 'upvote' | 'downvote' | 'comment';
    issueId: string;
    text?: string;
    tempId?: string;
    retries: number;
    createdAt: number;
};

export default function IssueDetailScreen({ route, navigation }: any) {
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const { issueId } = route.params;
    const openCommunityReports = !!route.params?.openCommunityReports;
    const isFocused = useIsFocused();
    const [issue, setIssue] = useState<any>(null);
    const [comments, setComments] = useState<any[]>([]);
    const [reports, setReports] = useState<any[]>([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [posting, setPosting] = useState(false);
    const [following, setFollowing] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [voteListOpen, setVoteListOpen] = useState(false);
    const [voteListType, setVoteListType] = useState<'upvoters' | 'downvoters' | null>(null);
    const [voteListLoading, setVoteListLoading] = useState(false);
    const [voteUsernames, setVoteUsernames] = useState<string[]>([]);

    // Community + municipal right-side updates panel
    const [updatesPanelOpen, setUpdatesPanelOpen] = useState(false);
    const [updatesTab, setUpdatesTab] = useState<'community' | 'municipal'>('community');
    const [selectedReporter, setSelectedReporter] = useState<any | null>(null);
    const [showAllReports, setShowAllReports] = useState(false);
    const [showFullDescription, setShowFullDescription] = useState(false);
    const [showAllComments, setShowAllComments] = useState(false);
    const [communityGalleryIndex, setCommunityGalleryIndex] = useState(0);
    const [expandedTimelineIndex, setExpandedTimelineIndex] = useState<number | null>(0);
    const [timelineSectionY, setTimelineSectionY] = useState<number | null>(null);
    const [commentsSectionY, setCommentsSectionY] = useState<number | null>(null);
    const [activeQuickTab, setActiveQuickTab] = useState<'overview' | 'community' | 'timeline' | 'comments'>('overview');
    // "Community" UI should appear only when there is a real merged/gallery group.
    // For gallery-photo logic, we gate using `communityImages.length > 1` in render.
    const hasCommunityGroup = Array.isArray(reports) && reports.length > 0;

    // Scroll positioning: when user joins/rejects a duplicate, jump to community section.
    const scrollRef = useRef<ScrollView | null>(null);
    const [communitySectionY, setCommunitySectionY] = useState<number | null>(null);

    const windowWidth = Dimensions.get('window').width;
    const updatesPanelWidth = Math.min(380, Math.max(280, windowWidth * 0.86));
    const communityCardWidth = Math.min(260, Math.max(180, windowWidth * 0.64));
    const updatesPanelAnim = useRef(new Animated.Value(1)).current; // 1 -> offscreen, 0 -> visible
    const updatesTabFade = useRef(new Animated.Value(1)).current;
    const pageEntranceAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(updatesPanelAnim, {
            toValue: updatesPanelOpen ? 0 : 1,
            duration: 240,
            useNativeDriver: true,
        }).start();
    }, [updatesPanelOpen]);

    useEffect(() => {
        if (!updatesPanelOpen) return;
        updatesTabFade.setValue(0);
        Animated.timing(updatesTabFade, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
        }).start();
    }, [updatesTab, updatesPanelOpen]);

    useEffect(() => {
        pageEntranceAnim.setValue(0);
        Animated.spring(pageEntranceAnim, {
            toValue: 1,
            stiffness: 120,
            damping: 16,
            mass: 0.9,
            useNativeDriver: true,
        }).start();
    }, [issueId, pageEntranceAnim]);
    const pendingRef = useRef({ upvote: false, downvote: false, follow: false, comment: false });
    const queueProcessingRef = useRef(false);

    const issueCacheKey = `${ISSUE_DETAIL_CACHE_PREFIX}:${issueId}`;

    // Load cached issue quickly (offline-first feel), then refresh from network.
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const raw = await AsyncStorage.getItem(issueCacheKey);
                if (!raw) return;
                const parsed = JSON.parse(raw);
                const cachedIssue = parsed?.issue;
                const cachedComments = parsed?.comments;
                if (!cachedIssue || !mounted) return;

                setIssue(cachedIssue);
                setComments(Array.isArray(cachedComments) ? cachedComments : (cachedIssue.comments || []));
                setFollowing((cachedIssue.followers || []).includes(user?._id));
                setLoading(false);
            } catch {
                // Ignore cache failures
            }
        })();
        return () => { mounted = false; };
    }, [issueCacheKey, user?._id]);

    const isTransientNetworkError = useCallback((error: any) => {
        return !error?.response || error?.code === 'ECONNABORTED' || error?.message?.includes('Network Error');
    }, []);

    const readActionQueue = useCallback(async (): Promise<QueuedIssueAction[]> => {
        try {
            const raw = await AsyncStorage.getItem(ISSUE_ACTION_QUEUE_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }, []);

    const writeActionQueue = useCallback(async (queue: QueuedIssueAction[]) => {
        try {
            await AsyncStorage.setItem(ISSUE_ACTION_QUEUE_KEY, JSON.stringify(queue));
        } catch {}
    }, []);

    const enqueueAction = useCallback(async (action: Omit<QueuedIssueAction, 'id' | 'retries' | 'createdAt'>) => {
        const queue = await readActionQueue();
        queue.push({
            ...action,
            id: `${action.type}:${action.issueId}:${Date.now()}`,
            retries: 0,
            createdAt: Date.now(),
        });
        await writeActionQueue(queue);
    }, [readActionQueue, writeActionQueue]);

    const fetchIssue = useCallback(async () => {
        try {
            const { data } = await issuesAPI.getById(issueId);
            setIssue(data);
            setComments(data.comments || []);
            setFollowing((data.followers || []).includes(user?._id));

            // Community group gallery (multi-reporter)
            try {
                const { data: reportsData } = await issuesAPI.getReports(issueId);
                setReports(Array.isArray(reportsData?.reports) ? reportsData.reports : []);
            } catch {
                setReports([]);
            }
            // Cache for offline-first + instant reopen
            try {
                await AsyncStorage.setItem(
                    issueCacheKey,
                    JSON.stringify({
                        issue: data,
                        comments: data.comments || [],
                        cachedAt: Date.now(),
                    })
                );
            } catch {
                // Non-critical
            }
        } catch (e) { Alert.alert('Error', 'Failed to load issue'); }
        setLoading(false);
    }, [issueId, user?._id, issueCacheKey]);

    const processActionQueue = useCallback(async () => {
        if (queueProcessingRef.current) return;

        queueProcessingRef.current = true;
        try {
            const queue = await readActionQueue();
            if (!queue.length) return;

            const remaining: QueuedIssueAction[] = [];
            let anyProcessed = false;

            for (const action of queue) {
                try {
                    if (action.type === 'upvote') {
                        await issuesAPI.upvote(action.issueId);
                        anyProcessed = true;
                    } else if (action.type === 'downvote') {
                        await issuesAPI.downvote(action.issueId);
                        anyProcessed = true;
                    } else if (action.type === 'comment' && action.text) {
                        const { data } = await issuesAPI.addComment(action.issueId, action.text);
                        if (action.issueId === issueId && action.tempId) {
                            setComments(prev => prev.map(c => c._id === action.tempId ? data : c));
                        }
                        anyProcessed = true;
                    }
                } catch (error) {
                    if (isTransientNetworkError(error) && action.retries < 5) {
                        remaining.push({ ...action, retries: action.retries + 1 });
                    }
                }
            }

            await writeActionQueue(remaining);
            // Sync counts and heart state after queued vote actions.
            if (anyProcessed) {
                await fetchIssue();
            }
        } finally {
            queueProcessingRef.current = false;
        }
    }, [issueId, readActionQueue, writeActionQueue, isTransientNetworkError, fetchIssue]);

    useEffect(() => {
        fetchIssue();
        processActionQueue();
    }, [fetchIssue, processActionQueue]);

    useEffect(() => {
        if (!openCommunityReports) return;
        if (!issue) return;
        if (!hasCommunityGroup) return;
        if (communitySectionY == null) return;
        // Jump to the community gallery so duplicate merges are immediately visible.
        setTimeout(() => {
            scrollRef.current?.scrollTo({ y: Math.max(0, communitySectionY - 140), animated: true });
        }, 350);
    }, [openCommunityReports, issue, communitySectionY, hasCommunityGroup]);

    useEffect(() => {
        if (!isFocused) return;
        processActionQueue();
    }, [isFocused, processActionQueue]);

    useEffect(() => {
        setCommunityGalleryIndex(0);
    }, [reports, issueId]);

    useEffect(() => {
        if (hasCommunityGroup) return;
        if (activeQuickTab === 'community') {
            setActiveQuickTab('overview');
        }
    }, [activeQuickTab, hasCommunityGroup]);

    const scrollToSection = useCallback((tab: 'overview' | 'community' | 'timeline' | 'comments') => {
        if (tab === 'community' && !hasCommunityGroup) {
            setActiveQuickTab('overview');
            scrollRef.current?.scrollTo({ y: 0, animated: true });
            return;
        }
        setActiveQuickTab(tab);
        if (tab === 'overview') {
            scrollRef.current?.scrollTo({ y: 0, animated: true });
            return;
        }
        if (tab === 'community' && communitySectionY != null) {
            scrollRef.current?.scrollTo({ y: Math.max(0, communitySectionY - 110), animated: true });
            return;
        }
        if (tab === 'timeline' && timelineSectionY != null) {
            scrollRef.current?.scrollTo({ y: Math.max(0, timelineSectionY - 110), animated: true });
            return;
        }
        if (tab === 'comments' && commentsSectionY != null) {
            scrollRef.current?.scrollTo({ y: Math.max(0, commentsSectionY - 110), animated: true });
        }
    }, [commentsSectionY, communitySectionY, timelineSectionY, hasCommunityGroup]);

    const handleDeleteIssue = useCallback(() => {
        Alert.alert(
            'Delete Issue',
            'Delete action is available for admin/owner only. Backend hard-delete is not enabled in this build yet.',
            [{ text: 'OK' }]
        );
    }, []);

    const handleUpvote = async () => {
        logger.tap('IssueDetail', 'Upvote');
        if (!issue || !user?._id || pendingRef.current.upvote) return;

        pendingRef.current.upvote = true;
        const previousIssue = issue;
        const currentUpvotes = Array.isArray(issue.upvotes) ? issue.upvotes : [];
        const isUpvoted = currentUpvotes.includes(user._id);
        const nextUpvotes = isUpvoted
            ? currentUpvotes.filter((u: string) => u !== user._id)
            : [...new Set([...currentUpvotes, user._id])];

        const currentDownvotes = Array.isArray(issue.downvotes) ? issue.downvotes : [];
        const isDownvoted = currentDownvotes.includes(user._id);
        const shouldRemoveDownvote = !isUpvoted && isDownvoted;
        const nextDownvotes = shouldRemoveDownvote
            ? currentDownvotes.filter((u: string) => u !== user._id)
            : currentDownvotes;

        setIssue((prev: any) => ({ ...prev, upvotes: nextUpvotes, downvotes: nextDownvotes }));

        try {
            if (shouldRemoveDownvote) {
                await issuesAPI.downvote(issueId);
            }
            const { data } = await issuesAPI.upvote(issueId);
            // Reconcile with server state so counts + filled state never drift.
            setIssue((prev: any) => ({
                ...prev,
                upvotes: Array.isArray(data?.upvotes) ? data.upvotes : [],
                downvotes: (() => {
                    const currentDownvotes = Array.isArray(prev?.downvotes) ? prev.downvotes : [];
                    return data?.upvoted
                        ? currentDownvotes.filter((u: string) => u !== user._id)
                        : currentDownvotes;
                })(),
                priorityScore:
                    typeof data?.priorityScore === 'number' ? data.priorityScore : prev?.priorityScore,
            }));
        } catch (e) {
            if (isTransientNetworkError(e)) {
                await enqueueAction({ type: 'upvote', issueId });
            } else {
                setIssue(previousIssue);
            }
            console.log('Upvote error');
        } finally {
            pendingRef.current.upvote = false;
        }
    };

    const handleDownvote = async () => {
        logger.tap('IssueDetail', 'Downvote');
        if (!issue || !user?._id || pendingRef.current.downvote) return;

        pendingRef.current.downvote = true;
        const previousIssue = issue;
        const currentDownvotes = Array.isArray(issue.downvotes) ? issue.downvotes : [];
        const isDownvoted = currentDownvotes.includes(user._id);
        const nextDownvotes = isDownvoted
            ? currentDownvotes.filter((u: string) => u !== user._id)
            : [...new Set([...currentDownvotes, user._id])];

        const currentUpvotes = Array.isArray(issue.upvotes) ? issue.upvotes : [];
        const isUpvoted = currentUpvotes.includes(user._id);
        const shouldRemoveUpvote = !isDownvoted && isUpvoted;
        const nextUpvotes = shouldRemoveUpvote
            ? currentUpvotes.filter((u: string) => u !== user._id)
            : currentUpvotes;

        setIssue((prev: any) => ({ ...prev, downvotes: nextDownvotes, upvotes: nextUpvotes }));

        try {
            if (shouldRemoveUpvote) {
                await issuesAPI.upvote(issueId);
            }
            const { data } = await issuesAPI.downvote(issueId);
            // Reconcile with server state so counts + filled state never drift.
            setIssue((prev: any) => ({
                ...prev,
                downvotes: Array.isArray(data?.downvotes) ? data.downvotes : [],
                upvotes: (() => {
                    const currentUpvotes = Array.isArray(prev?.upvotes) ? prev.upvotes : [];
                    return data?.downvoted
                        ? currentUpvotes.filter((u: string) => u !== user._id)
                        : currentUpvotes;
                })(),
                priorityScore:
                    typeof data?.priorityScore === 'number' ? data.priorityScore : prev?.priorityScore,
            }));
        } catch (e) {
            if (isTransientNetworkError(e)) {
                await enqueueAction({ type: 'downvote', issueId });
            } else {
                setIssue(previousIssue);
            }
            console.log('Downvote error');
        } finally {
            pendingRef.current.downvote = false;
        }
    };

    const openVoteList = useCallback(async (type: 'upvoters' | 'downvoters') => {
        if (!user?._id || !issueId || voteListLoading) return;

        setVoteListType(type);
        setVoteListOpen(true);
        setVoteListLoading(true);
        setVoteUsernames([]);

        try {
            const res =
                type === 'upvoters'
                    ? await issuesAPI.getUpvoters(issueId)
                    : await issuesAPI.getDownvoters(issueId);

            const usernames = res?.data?.usernames;
            setVoteUsernames(Array.isArray(usernames) ? usernames : []);
        } catch (e) {
            console.log('Vote list error:', e);
        } finally {
            setVoteListLoading(false);
        }
    }, [issueId, voteListLoading, user?._id]);

    const closeVoteList = useCallback(() => {
        setVoteListOpen(false);
        setVoteListType(null);
        setVoteUsernames([]);
    }, []);

    const handleFollow = async () => {
        logger.tap('IssueDetail', 'Follow Issue');
        if (pendingRef.current.follow) return;

        pendingRef.current.follow = true;
        const previousFollowing = following;
        const nextFollowing = !following;
        setFollowing(nextFollowing);

        try {
            const { data } = await issuesAPI.followIssue(issueId);
            setFollowing(data.following);
            if (data.following) Alert.alert('Following', 'You will receive updates for this issue.');
        } catch (e) {
            setFollowing(previousFollowing);
            console.log('Follow error');
        } finally {
            pendingRef.current.follow = false;
        }
    };

    const handleShare = async () => {
        logger.tap('IssueDetail', 'Share Issue');
        try {
            await Share.share({
                title: issue.title,
                message: `🚨 ${issue.title}\n📍 ${issue.location?.address || 'Unknown'}\n🔴 Severity: ${issue.aiSeverity}\nStatus: ${issue.status}\n\nReported on UrbanFix — help make our city better!`,
            });
        } catch (e) { console.log('Share error'); }
    };

    const handleComment = async () => {
        if (!newComment.trim() || !user?._id || !user?.name || pendingRef.current.comment) return;

        pendingRef.current.comment = true;
        setPosting(true);
        const text = newComment.trim();
        const tempId = `temp-${Date.now()}`;
        const optimisticComment = {
            _id: tempId,
            text,
            timeAgo: 'Just now',
            pending: false,
            user: {
                _id: user._id,
                name: user.name,
                role: user.role,
            },
        };

        setComments(prev => [...prev, optimisticComment]);
        setNewComment('');

        try {
            const { data } = await issuesAPI.addComment(issueId, text);
            setComments(prev => prev.map(c => c._id === tempId ? data : c));
        } catch (e) {
            if (isTransientNetworkError(e)) {
                setComments(prev => prev.map(c => c._id === tempId ? { ...c, pending: true, timeAgo: 'Pending sync' } : c));
                await enqueueAction({ type: 'comment', issueId, text, tempId });
            } else {
                setComments(prev => prev.filter(c => c._id !== tempId));
                setNewComment(text);
                Alert.alert('Error', 'Failed to post comment');
            }
        } finally {
            setPosting(false);
            pendingRef.current.comment = false;
        }
    };

    const normalized = React.useMemo(() => {
        if (!issue) return null;
        return {
            ...issue,
            _id: issue._id || issue.id,
            // Support both camelCase and snake_case payloads
            aiSeverity: issue.aiSeverity || issue.ai_severity || 'Low',
            aiTags: issue.aiTags || issue.ai_tags || [],
            priorityScore: typeof issue.priorityScore === 'number' ? issue.priorityScore : (issue.priority_score ?? 0),
            timeAgo: issue.timeAgo || issue.time_ago || issue.createdAt || issue.created_at,
            location: issue.location || { address: issue.location_address || issue.locationAddress || '' },
        };
    }, [issue]);

    const getSevColor = (s: string) => s === 'Critical' ? '#FF003C' : s === 'High' ? '#FF453A' : s === 'Medium' ? '#FFD60A' : '#30D158';
    const getStatusColor = (s: string) => s === 'Resolved' ? colors.success : s === 'InProgress' ? colors.primary : s === 'Acknowledged' ? colors.secondary : colors.warning;
    const getTimeAgoText = (dateStr: string) => {
        const d = new Date(dateStr);
        const diffMs = Date.now() - d.getTime();
        if (!Number.isFinite(diffMs) || diffMs < 0) return '';
        const mins = Math.floor(diffMs / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        return `${days}d ago`;
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                    <View style={styles.issueSkeletonCard}>
                        <View style={styles.skTopRow}>
                            <View style={styles.skAvatar} />
                            <View style={{ flex: 1 }}>
                                <View style={styles.skLineWide} />
                                <View style={styles.skLineShort} />
                            </View>
                        </View>
                        <View style={styles.skLine} />
                        <View style={styles.skLine} />
                        <View style={styles.skMedia} />
                        <View style={styles.skPriority} />
                        <View style={styles.skTimeline} />
                    </View>
                </ScrollView>
            </View>
        );
    }
    if (!issue) return <View style={styles.container}><Text style={styles.errorText}>Issue not found</Text></View>;
    const viewIssue = normalized || issue;
    const canManageIssue = !!(
        user?._id &&
        (
            String(user?.role || '').toLowerCase() === 'admin' ||
            String(user?.role || '').toLowerCase() === 'super_admin' ||
            String(viewIssue?.user?._id || '') === String(user._id)
        )
    );
    const communityImages = Array.from(new Set([
        viewIssue?.image,
        ...(Array.isArray(reports) ? reports.map((r: any) => r.image) : []),
    ].filter(Boolean)));
    const hasCommunityPhotos = communityImages.length > 1;
    const communityReports = Array.isArray(reports) ? reports : [];
    const COMMUNITY_REPORT_PREVIEW_LIMIT = 4;
    const visibleCommunityReports = showAllReports
        ? communityReports
        : communityReports.slice(0, COMMUNITY_REPORT_PREVIEW_LIMIT);
    const extraCommunityReportsCount = Math.max(0, communityReports.length - COMMUNITY_REPORT_PREVIEW_LIMIT);
    const hasLongDescription = String(viewIssue?.description || '').length > 190;
    const descriptionText = hasLongDescription && !showFullDescription
        ? `${String(viewIssue?.description || '').slice(0, 190).trim()}...`
        : (viewIssue?.description || '');
    const COMMENTS_PREVIEW_LIMIT = 3;
    const visibleComments = showAllComments ? comments : comments.slice(0, COMMENTS_PREVIEW_LIMIT);
    const hiddenCommentsCount = Math.max(0, comments.length - COMMENTS_PREVIEW_LIMIT);

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
                {/* Line 1: back arrow + Issue Details */}
                <View style={styles.headerTopRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={22} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        Issue Details
                    </Text>
                </View>

                {/* Line 2: Updates (left) + Bookmark/Delete (right) */}
                <View style={styles.headerBottomRow}>
                    <View style={styles.headerBottomLeft}>
                        <TouchableOpacity
                            onPress={() => {
                                setUpdatesTab('community');
                                setUpdatesPanelOpen(true);
                            }}
                            style={styles.updatesBtnFlat}
                            activeOpacity={0.9}
                        >
                            <Ionicons name="layers-outline" size={18} color={colors.secondary} />
                            <Text style={styles.updatesBtnFlatText} allowFontScaling={false}>
                                Latest Updates
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.headerBottomRight}>
                        {canManageIssue ? (
                            <TouchableOpacity onPress={handleDeleteIssue} style={styles.deleteBtn} activeOpacity={0.9}>
                                <Ionicons name="trash-outline" size={17} color="#FFD4D4" />
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                onPress={handleFollow}
                                style={[styles.followBtn, following && styles.followBtnActive]}
                            >
                                <Ionicons
                                    name={following ? 'bookmark' : 'bookmark-outline'}
                                    size={18}
                                    color={following ? '#FFF' : '#DDE7FF'}
                                />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>

            <View style={styles.quickTabsWrap}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickTabsRow}>
                    {[
                        { id: 'overview', label: 'Overview' },
                        ...(hasCommunityPhotos ? [{ id: 'community', label: 'Community' }] : []),
                        { id: 'timeline', label: 'Timeline' },
                        { id: 'comments', label: 'Comments' },
                    ].map((tab) => {
                        const active = activeQuickTab === tab.id;
                        return (
                            <TouchableOpacity
                                key={tab.id}
                                style={[styles.quickTabBtn, active && styles.quickTabBtnActive]}
                                activeOpacity={0.85}
                                onPress={() => scrollToSection(tab.id as any)}
                            >
                                <Text style={[styles.quickTabText, active && styles.quickTabTextActive]}>
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            <Animated.View
                style={[
                    styles.contentSheet,
                    {
                        opacity: pageEntranceAnim,
                        transform: [
                            {
                                translateY: pageEntranceAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [14, 0],
                                }),
                            },
                        ],
                    },
                ]}
            >
            <ScrollView
                ref={scrollRef}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                scrollEventThrottle={16}
                onScroll={(e) => {
                    const y = e.nativeEvent.contentOffset.y;
                    const near = y + 130;
                    if (commentsSectionY != null && near >= commentsSectionY) {
                        setActiveQuickTab('comments');
                    } else if (timelineSectionY != null && near >= timelineSectionY) {
                        setActiveQuickTab('timeline');
                    } else if (hasCommunityPhotos && communitySectionY != null && near >= communitySectionY) {
                        setActiveQuickTab('community');
                    } else {
                        setActiveQuickTab('overview');
                    }
                }}
            >
                <View style={styles.issueDetailCard}>
                {/* Image */}
                {viewIssue.image && (
                    <View style={styles.imageWrap}>
                        <Image source={{ uri: viewIssue.image }} style={styles.image} />
                        {viewIssue.emergency && (
                            <View style={styles.emergencyOverlay}>
                                <Ionicons name="warning" size={14} color="#FFF" />
                                <Text style={styles.emergencyText}>EMERGENCY</Text>
                            </View>
                        )}
                    </View>
                )}

                <View style={styles.content}>
                    {/* Title + meta */}
                    <Text style={styles.title}>{viewIssue.title}</Text>
                    <View style={styles.metaRow}>
                        <View style={styles.metaLocationWrap}>
                            <Ionicons name="location-outline" size={13} color={colors.textMuted} />
                            <Text style={styles.metaText} numberOfLines={1}>
                                {viewIssue.location?.address || 'Unknown'}
                            </Text>
                        </View>
                        <Text style={styles.metaDot}>•</Text>
                        <Text style={styles.metaText}>{viewIssue.timeAgo || ''}</Text>
                    </View>

                    <View style={styles.infoChipsRow}>
                        <View style={[styles.infoChip, { borderColor: getSevColor(viewIssue.aiSeverity) + '66' }]}>
                            <View style={[styles.infoChipDot, { backgroundColor: getSevColor(viewIssue.aiSeverity) }]} />
                            <Text style={styles.infoChipText}>{viewIssue.aiSeverity}</Text>
                        </View>
                        <View style={styles.infoChip}>
                            <Ionicons name="flag-outline" size={12} color={colors.textMuted} />
                            <Text style={styles.infoChipText}>{viewIssue.status || 'Submitted'}</Text>
                        </View>
                        <View style={styles.infoChip}>
                            <Ionicons name="pricetag-outline" size={12} color={colors.textMuted} />
                            <Text style={styles.infoChipText}>{viewIssue.category || 'other'}</Text>
                        </View>
                    </View>

                    {/* Tags */}
                    <View style={styles.tagsRow}>
                        {(viewIssue.aiTags || [])?.map((t: string, i: number) => (
                            <View key={i} style={styles.tagChip}>
                                <Text style={styles.tagText}>{t}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Description */}
                    <View style={styles.descriptionCard}>
                        <Text style={styles.description}>{descriptionText}</Text>
                        {hasLongDescription && (
                            <TouchableOpacity
                                onPress={() => setShowFullDescription((prev) => !prev)}
                                activeOpacity={0.8}
                                style={styles.inlineViewMoreBtn}
                            >
                                <Text style={styles.inlineViewMoreBtnText}>
                                    {showFullDescription ? 'Show less' : 'View more'}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Community gallery (multi-reporter reports) */}
                    {viewIssue.authorType === 'User' && hasCommunityPhotos && (
                        <View
                            style={styles.communitySection}
                            onLayout={(e) => setCommunitySectionY(e.nativeEvent.layout.y)}
                        >
                            <View style={styles.communityHeaderRow}>
                                <Text style={styles.communityTitle}>Community Reports</Text>
                                <Text style={styles.communityCount}>{communityReports.length}</Text>
                            </View>

                            {communityImages.length > 0 ? (
                                <>
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={styles.communityGalleryRow}
                                        snapToInterval={communityCardWidth + 10}
                                        decelerationRate="fast"
                                        snapToAlignment="start"
                                        onMomentumScrollEnd={(e) => {
                                            const x = e.nativeEvent.contentOffset.x;
                                            const idx = Math.max(0, Math.min(communityImages.length - 1, Math.round(x / (communityCardWidth + 10))));
                                            setCommunityGalleryIndex(idx);
                                        }}
                                    >
                                        {communityImages.map((img: string, i: number) => (
                                            <TouchableOpacity
                                                key={`${img}-${i}`}
                                                onPress={() => setPreviewImage(img)}
                                                activeOpacity={0.9}
                                                style={[styles.communityImgItem, { width: communityCardWidth }]}
                                            >
                                                <Image source={{ uri: img }} style={styles.communityImg} resizeMode="cover" />
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>

                                    {communityImages.length > 1 && (
                                        <View style={styles.galleryDotsRow}>
                                            {communityImages.map((_: any, i: number) => (
                                                <View
                                                    key={`dot-${i}`}
                                                    style={[styles.galleryDot, i === communityGalleryIndex && styles.galleryDotActive]}
                                                />
                                            ))}
                                        </View>
                                    )}
                                </>
                            ) : (
                                <Text style={styles.emptyText}>No gallery images yet.</Text>
                            )}

                            <View style={styles.communityReporterList}>
                                {communityReports.length === 0 ? (
                                    <Text style={styles.emptyText}>No reports yet.</Text>
                                ) : (
                                    <>
                                        {visibleCommunityReports.map((r: any, idx: number) => {
                                            const handle = r.reporter_anonymous
                                                ? '@anonymous'
                                                : (r.reporter_username || r.reporter_name || 'user').startsWith('@')
                                                    ? r.reporter_username
                                                    : `@${r.reporter_username || r.reporter_name || 'user'}`;

                                            const t = r.created_at || r.createdAt || '';
                                            const initials = (handle || '?').replace('@', '').slice(0, 1).toUpperCase();
                                            return (
                                                <TouchableOpacity
                                                    key={`${handle}-${idx}`}
                                                    style={styles.communityReporterRow}
                                                    activeOpacity={0.85}
                                                    onPress={() => setSelectedReporter(r)}
                                                >
                                                    <View style={styles.communityReporterAvatar}>
                                                        <Text style={styles.communityReporterAvatarText}>
                                                            {initials}
                                                        </Text>
                                                    </View>
                                                    <View style={styles.communityReporterMain}>
                                                        <View style={styles.communityReporterMetaRow}>
                                                            <Text style={styles.communityReporterName} numberOfLines={1}>{handle}</Text>
                                                            <Text style={styles.communityReporterTime}>{t ? getTimeAgoText(t) : ''}</Text>
                                                        </View>
                                                        {(typeof r.reporter_impact_score === 'number') ? (
                                                            <Text style={styles.communityReporterProbity} allowFontScaling={false}>
                                                                Probity: {r.reporter_impact_score}
                                                            </Text>
                                                        ) : null}
                                                    </View>
                                                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                                                </TouchableOpacity>
                                            );
                                        })}

                                        {!showAllReports && extraCommunityReportsCount > 0 && (
                                            <TouchableOpacity
                                                style={styles.communityViewAllBtn}
                                                activeOpacity={0.85}
                                                onPress={() => setShowAllReports(true)}
                                            >
                                                <Text style={styles.communityViewAllBtnText} allowFontScaling={false}>
                                                    View all {communityReports.length} reports
                                                </Text>
                                            </TouchableOpacity>
                                        )}

                                        {showAllReports && communityReports.length > COMMUNITY_REPORT_PREVIEW_LIMIT && (
                                            <TouchableOpacity
                                                style={styles.communityViewAllBtn}
                                                activeOpacity={0.85}
                                                onPress={() => setShowAllReports(false)}
                                            >
                                                <Text style={styles.communityViewAllBtnText} allowFontScaling={false}>
                                                    Show less
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                    </>
                                )}
                            </View>
                        </View>
                    )}

                    {/* Priority Bar */}
                    <View style={styles.priorityCard}>
                        <View style={styles.priorityHeader}>
                            <Text style={styles.priorityLabel}>Priority Score</Text>
                            <Text style={styles.priorityValue}>{viewIssue.priorityScore}/100</Text>
                        </View>
                        <View style={styles.priorityBar}>
                            <LinearGradient colors={['#30D158', '#FFD60A', '#FF453A']}
                                style={[styles.priorityFill, { width: `${Math.min(100, viewIssue.priorityScore)}%` }]}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
                        </View>
                    </View>

                    {/* Resolution Proof (Before/After) */}
                    {viewIssue.status === 'Resolved' && viewIssue.resolutionProof && (
                        <View style={styles.resolutionCard}>
                            <View style={styles.resolutionHeader}>
                                <Ionicons name="checkmark-seal" size={20} color={colors.success} />
                                <Text style={styles.resolutionTitle}>Issue Resolved</Text>
                            </View>

                            <View style={styles.comparisonRow}>
                                <TouchableOpacity style={styles.compareItem} onPress={() => setPreviewImage(viewIssue.image)}>
                                    <Image source={{ uri: viewIssue.image }} style={styles.compareImg} />
                                    <View style={styles.compareLabel}><Text style={styles.compareLabelText}>BEFORE</Text></View>
                                </TouchableOpacity>
                                <Ionicons name="arrow-forward" size={20} color={colors.textMuted} />
                                <TouchableOpacity style={styles.compareItem} onPress={() => setPreviewImage(viewIssue.resolutionProof.afterImage)}>
                                    <Image source={{ uri: viewIssue.resolutionProof.afterImage }} style={styles.compareImg} />
                                    <View style={[styles.compareLabel, { backgroundColor: colors.success }]}><Text style={styles.compareLabelText}>AFTER</Text></View>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.officialRemarkBox}>
                                <View style={styles.remarkHeader}>
                                    <Text style={styles.remarkDept}>Municipal {viewIssue.departmentTag} Team</Text>
                                    <Text style={styles.remarkTime}>{new Date(viewIssue.resolutionProof.resolvedAt).toLocaleDateString()}</Text>
                                </View>
                                <Text style={styles.remarkText}>{viewIssue.resolutionProof.workerRemarks}</Text>
                            </View>
                        </View>
                    )}

                    {/* Status Timeline */}
                    <View onLayout={(e) => setTimelineSectionY(e.nativeEvent.layout.y)}>
                        <Text style={styles.sectionTitle}>Status Timeline</Text>
                        {viewIssue.statusTimeline?.map((s: any, i: number) => {
                            const expanded = expandedTimelineIndex === i;
                            return (
                                <View key={i} style={styles.timelineItem}>
                                    <View style={[styles.timelineDot, { backgroundColor: getStatusColor(s.status) }]} />
                                    {i < viewIssue.statusTimeline.length - 1 && <View style={styles.timelineLine} />}
                                    <TouchableOpacity
                                        style={[styles.timelineContent, s.dept && styles.officialTimeline]}
                                        activeOpacity={0.85}
                                        onPress={() => setExpandedTimelineIndex((prev) => (prev === i ? null : i))}
                                    >
                                        <View style={styles.timelineHeaderRow}>
                                            <View style={styles.timelineHeaderLeft}>
                                                <Text style={styles.timelineStatus}>{s.status}</Text>
                                                {s.dept && (
                                                    <View style={styles.deptTimelineBadge}>
                                                        <Text style={styles.deptTimelineText}>{s.dept}</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Ionicons
                                                name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                                                size={16}
                                                color={colors.textMuted}
                                            />
                                        </View>
                                        {expanded && (
                                            <>
                                                <Text style={styles.timelineComment}>{s.comment}</Text>
                                                {s.dept && <Text style={styles.officialLabel}>OFFICIAL UPDATE</Text>}
                                                <Text style={styles.timelineTime}>
                                                    {new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(s.timestamp).toLocaleDateString()}
                                                </Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            );
                        })}
                    </View>

                    {/* Actions */}
                    <View style={styles.actionsRow}>
                        <View style={styles.actionBtn}>
                            <TouchableOpacity onPress={handleUpvote} activeOpacity={0.7}>
                                <Ionicons
                                    name={issue.upvotes?.includes(user?._id) ? 'arrow-up-circle' : 'arrow-up-circle-outline'}
                                    size={24}
                                    color={issue.upvotes?.includes(user?._id) ? colors.primary : colors.textSecondary}
                                />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => openVoteList('upvoters')}
                                activeOpacity={0.7}
                                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                            >
                                <Text
                                    style={[
                                        styles.actionText,
                                        issue.upvotes?.includes(user?._id) && { color: colors.primary },
                                    ]}
                                >
                                    {issue.upvotes?.length || 0}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.actionBtn}>
                            <TouchableOpacity onPress={handleDownvote} activeOpacity={0.7}>
                                <Ionicons
                                    name={(issue.downvotes || []).includes(user?._id) ? 'arrow-down-circle' : 'arrow-down-circle-outline'}
                                    size={24}
                                    color={(issue.downvotes || []).includes(user?._id) ? '#FF453A' : colors.textSecondary}
                                />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => openVoteList('downvoters')}
                                activeOpacity={0.7}
                                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                            >
                                <Text
                                    style={[
                                        styles.actionText,
                                        (issue.downvotes || []).includes(user?._id) && { color: '#FF453A' },
                                    ]}
                                >
                                    {(issue.downvotes || []).length}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.actionBtn}>
                            <Ionicons name="chatbubble-outline" size={22} color={colors.textSecondary} />
                            <Text style={styles.actionText}>{comments.length}</Text>
                        </View>
                        <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
                            <Ionicons name="share-social-outline" size={22} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Comments */}
                    <View onLayout={(e) => setCommentsSectionY(e.nativeEvent.layout.y)}>
                        <Text style={styles.sectionTitle}>Comments</Text>
                        {comments.length === 0 && <Text style={styles.emptyText}>No comments yet. Be the first!</Text>}
                        {visibleComments.map((c: any, i: number) => (
                            <View key={c._id || i} style={styles.commentCard}>
                                <View style={styles.commentHeader}>
                                    <LinearGradient colors={c.user?.role === 'admin' ? ['#FF6B35', '#FF3C00'] : [colors.primary, '#0055CC']} style={styles.commentAvatar}>
                                        <Text style={styles.commentAvatarText}>{(c.user?.name || '?')[0]}</Text>
                                    </LinearGradient>
                                    <View style={{ flex: 1 }}>
                                        <View style={styles.commentNameRow}>
                                            <Text style={styles.commentName}>{c.user?.name || 'Unknown'}</Text>
                                            {c.user?.role === 'admin' && (
                                                <View style={styles.officialBadge}><Text style={styles.officialText}>OFFICIAL</Text></View>
                                            )}
                                        </View>
                                        <Text style={styles.commentTime}>{c.timeAgo}</Text>
                                    </View>
                                </View>
                                <Text style={styles.commentText}>{c.text}</Text>
                            </View>
                        ))}
                        {hiddenCommentsCount > 0 && !showAllComments && (
                            <TouchableOpacity
                                style={styles.sectionViewMoreBtn}
                                activeOpacity={0.85}
                                onPress={() => setShowAllComments(true)}
                            >
                                <Text style={styles.sectionViewMoreText}>View all {comments.length} comments</Text>
                            </TouchableOpacity>
                        )}
                        {showAllComments && comments.length > COMMENTS_PREVIEW_LIMIT && (
                            <TouchableOpacity
                                style={styles.sectionViewMoreBtn}
                                activeOpacity={0.85}
                                onPress={() => setShowAllComments(false)}
                            >
                                <Text style={styles.sectionViewMoreText}>Show fewer comments</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
                </View>
            </ScrollView>
            </Animated.View>

            {/* Comment Input */}
            <View style={[styles.commentInput, { paddingBottom: insets.bottom + 4 }]}>
                <TextInput style={styles.commentField} placeholder="Add a comment..." placeholderTextColor={colors.textMuted}
                    value={newComment} onChangeText={setNewComment} />
                <TouchableOpacity onPress={handleComment} disabled={posting || !newComment.trim()}>
                    <LinearGradient colors={[colors.primary, '#0055CC']} style={styles.sendBtn}>
                        <Ionicons name="send" size={16} color="#FFF" />
                    </LinearGradient>
                </TouchableOpacity>
            </View>
            {/* Image Preview Modal */}
            <Modal visible={!!previewImage} transparent animationType="fade">
                <View style={styles.modalBg}>
                    <TouchableOpacity style={styles.modalClose} onPress={() => setPreviewImage(null)}>
                        <Ionicons name="close" size={30} color="#FFF" />
                    </TouchableOpacity>
                    {previewImage && <Image source={{ uri: previewImage }} style={styles.modalImg} resizeMode="contain" />}
                </View>
            </Modal>

            {/* Reporter Details Modal (per merged community report) */}
            <Modal
                visible={!!selectedReporter}
                transparent
                animationType="fade"
                onRequestClose={() => setSelectedReporter(null)}
            >
                <View style={styles.modalBg}>
                    <TouchableOpacity style={styles.modalClose} onPress={() => setSelectedReporter(null)}>
                        <Ionicons name="close" size={30} color="#FFF" />
                    </TouchableOpacity>

                    <ScrollView style={{ width: '100%' }} contentContainerStyle={{ padding: 18, paddingTop: 58 }}>
                        {selectedReporter?.image ? (
                            <TouchableOpacity onPress={() => setPreviewImage(selectedReporter.image)}>
                                <Image source={{ uri: selectedReporter.image }} style={styles.reporterDetailImg} resizeMode="cover" />
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.reporterDetailImgPlaceholder}>
                                <Ionicons name="image-outline" size={30} color={colors.textMuted} />
                                <Text style={styles.reporterDetailPlaceholderText} allowFontScaling={false}>
                                    No image for this report
                                </Text>
                            </View>
                        )}

                        <View style={{ marginTop: 14 }}>
                            <Text style={styles.reporterDetailTitle}>
                                {selectedReporter?.reporter_anonymous
                                    ? '@anonymous'
                                    : (selectedReporter?.reporter_username || selectedReporter?.reporter_name || 'user').startsWith('@')
                                        ? selectedReporter?.reporter_username || selectedReporter?.reporter_name
                                        : `@${selectedReporter?.reporter_username || selectedReporter?.reporter_name || 'user'}`}
                            </Text>
                            {typeof selectedReporter?.reporter_impact_score === 'number' && (
                                <Text style={styles.reporterDetailProbity} allowFontScaling={false}>
                                    Probity/Impact Score: {selectedReporter.reporter_impact_score}
                                </Text>
                            )}

                            <Text style={styles.reporterDetailTime} allowFontScaling={false}>
                                {selectedReporter?.created_at ? `Reported ${getTimeAgoText(selectedReporter.created_at)}` : ''}
                            </Text>

                            <Text style={styles.reporterDetailLabel} allowFontScaling={false}>Location</Text>
                            <Text style={styles.reporterDetailText}>
                                {selectedReporter?.location_address || selectedReporter?.location?.address || 'Unknown'}
                            </Text>
                            {typeof selectedReporter?.location_accuracy_meters === 'number' && (
                                <Text style={styles.reporterDetailTextMuted} allowFontScaling={false}>
                                    ±{Math.round(selectedReporter.location_accuracy_meters)}m accuracy
                                </Text>
                            )}

                            <Text style={styles.reporterDetailLabel} allowFontScaling={false} >Report Title</Text>
                            <Text style={styles.reporterDetailText}>{selectedReporter?.title || ''}</Text>

                            {!!selectedReporter?.description && (
                                <>
                                    <Text style={styles.reporterDetailLabel} allowFontScaling={false}>Description</Text>
                                    <Text style={styles.reporterDetailText}>{selectedReporter?.description || ''}</Text>
                                </>
                            )}

                            {(Array.isArray(selectedReporter?.ai_tags) && selectedReporter.ai_tags.length > 0) && (
                                <>
                                    <Text style={styles.reporterDetailLabel} allowFontScaling={false}>AI Tags</Text>
                                    <View style={styles.reporterDetailTagsRow}>
                                        {selectedReporter.ai_tags.slice(0, 8).map((t: string, i: number) => (
                                            <View key={`${t}-${i}`} style={styles.reporterDetailTagChip}>
                                                <Text style={styles.reporterDetailTagText}>{t}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </>
                            )}
                        </View>
                    </ScrollView>
                </View>
            </Modal>

            {/* Updates Side Panel (Community | Municipal) */}
            <Modal
                visible={updatesPanelOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setUpdatesPanelOpen(false)}
            >
                <View style={styles.updatesOverlay}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setUpdatesPanelOpen(false)} />

                    <Animated.View
                        style={[
                            styles.updatesPanel,
                            {
                                width: updatesPanelWidth,
                                transform: [
                                    {
                                        translateX: updatesPanelAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [0, updatesPanelWidth],
                                        }),
                                    },
                                ],
                            },
                        ]}
                    >
                        <View style={styles.updatesPanelHeader}>
                            <Text style={styles.updatesPanelTitle} allowFontScaling={false}>Updates</Text>

                            <View style={styles.updatesTabsRow}>
                                <TouchableOpacity
                                    style={[styles.updatesTabBtn, updatesTab === 'community' && styles.updatesTabBtnActive]}
                                    onPress={() => setUpdatesTab('community')}
                                    activeOpacity={0.85}
                                >
                                    <Text style={styles.updatesTabBtnText}>Community</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.updatesTabBtn, updatesTab === 'municipal' && styles.updatesTabBtnActive]}
                                    onPress={() => setUpdatesTab('municipal')}
                                    activeOpacity={0.85}
                                >
                                    <Text style={styles.updatesTabBtnText}>Municipal</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <Animated.View style={{ flex: 1, opacity: updatesTabFade }}>
                            {updatesTab === 'community' ? (
                                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 14, gap: 12 }}>
                                    {communityReports.length === 0 ? (
                                        <Text style={styles.updatesEmptyText} allowFontScaling={false}>No community reports yet.</Text>
                                    ) : (
                                        communityReports.map((r: any, idx: number) => {
                                            const handle = r.reporter_anonymous
                                                ? '@anonymous'
                                                : (r.reporter_username || r.reporter_name || 'user').startsWith('@')
                                                    ? r.reporter_username || r.reporter_name || 'user'
                                                    : `@${r.reporter_username || r.reporter_name || 'user'}`;

                                            return (
                                                <TouchableOpacity
                                                    key={`${handle}-${idx}`}
                                                    style={styles.updateItemCard}
                                                    activeOpacity={0.9}
                                                    onPress={() => setSelectedReporter(r)}
                                                >
                                                    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                                                        <View style={styles.updateAvatar}>
                                                            <Text style={styles.updateAvatarText}>
                                                                {(handle || '?').replace('@', '').slice(0, 1).toUpperCase()}
                                                            </Text>
                                                        </View>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={styles.updateItemTitle} numberOfLines={1}>
                                                                {handle}
                                                            </Text>
                                                            <Text style={styles.updateItemSub} allowFontScaling={false}>
                                                                {r.created_at ? getTimeAgoText(r.created_at) : ''}
                                                            </Text>
                                                            {(typeof r.reporter_impact_score === 'number') ? (
                                                                <Text style={styles.updateProbity} allowFontScaling={false}>
                                                                    Probity: {r.reporter_impact_score}
                                                                </Text>
                                                            ) : null}
                                                        </View>
                                                    </View>

                                                    {r.image ? (
                                                        <TouchableOpacity
                                                            style={{ marginTop: 10 }}
                                                            activeOpacity={0.9}
                                                            onPress={() => setPreviewImage(r.image)}
                                                        >
                                                            <Image source={{ uri: r.image }} style={styles.updateThumbImg} resizeMode="cover" />
                                                        </TouchableOpacity>
                                                    ) : null}

                                                    {r.location_address ? (
                                                        <Text style={styles.updateLocText} allowFontScaling={false} numberOfLines={2}>
                                                            📍 {r.location_address}
                                                        </Text>
                                                    ) : null}
                                                </TouchableOpacity>
                                            );
                                        })
                                    )}
                                </ScrollView>
                            ) : (
                                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 14, gap: 12 }}>
                                    <View style={styles.updatesSectionBlock}>
                                        <Text style={styles.updatesSectionTitle} allowFontScaling={false}>Assignment</Text>
                                        <Text style={styles.updatesSectionText} allowFontScaling={false}>
                                            Assigned: {viewIssue.assignedToUser?.name || 'Not assigned'}
                                        </Text>
                                        {viewIssue.deadline ? (
                                            <Text style={styles.updatesSectionText} allowFontScaling={false}>
                                                Deadline: {new Date(viewIssue.deadline).toLocaleDateString()}
                                            </Text>
                                        ) : null}
                                    </View>

                                    <View style={styles.updatesSectionBlock}>
                                        <Text style={styles.updatesSectionTitle} allowFontScaling={false}>Municipal Updates</Text>
                                        {viewIssue.statusTimeline?.length ? (
                                            viewIssue.statusTimeline.map((s: any, i: number) => (
                                                <View key={`${s.status}-${i}`} style={styles.timelineMiniCard}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <Text style={styles.timelineMiniStatus} allowFontScaling={false}>{s.status}</Text>
                                                        {s.dept ? (
                                                            <View style={styles.timelineMiniDeptBadge}>
                                                                <Text style={styles.timelineMiniDeptText} allowFontScaling={false}>{s.dept}</Text>
                                                            </View>
                                                        ) : null}
                                                    </View>
                                                    <Text style={styles.timelineMiniSub} allowFontScaling={false}>
                                                        {s.updatedByUser?.name ? `By ${s.updatedByUser.name}` : ''}
                                                    </Text>
                                                    {!!s.comment && (
                                                        <Text style={styles.timelineMiniComment} allowFontScaling={false}>
                                                            {s.comment}
                                                        </Text>
                                                    )}
                                                    <Text style={styles.timelineMiniTime} allowFontScaling={false}>
                                                        {s.timestamp ? new Date(s.timestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : ''}
                                                    </Text>
                                                </View>
                                            ))
                                        ) : (
                                            <Text style={styles.updatesEmptyText} allowFontScaling={false}>No municipal updates yet.</Text>
                                        )}
                                    </View>

                                    {viewIssue.resolutionProof?.afterImage ? (
                                        <View style={styles.updatesSectionBlock}>
                                            <Text style={styles.updatesSectionTitle} allowFontScaling={false}>Work completion</Text>
                                            <TouchableOpacity activeOpacity={0.9} onPress={() => setPreviewImage(viewIssue.resolutionProof.afterImage)}>
                                                <Image source={{ uri: viewIssue.resolutionProof.afterImage }} style={styles.completionImg} resizeMode="cover" />
                                            </TouchableOpacity>
                                            {!!viewIssue.resolutionProof.workerRemarks ? (
                                                <Text style={styles.timelineMiniComment} allowFontScaling={false}>
                                                    {viewIssue.resolutionProof.workerRemarks}
                                                </Text>
                                            ) : null}
                                        </View>
                                    ) : null}
                                </ScrollView>
                            )}
                        </Animated.View>
                    </Animated.View>
                </View>
            </Modal>

            {/* Vote List Modal (who liked / who downvoted) */}
            <Modal visible={voteListOpen} transparent animationType="fade" onRequestClose={closeVoteList}>
                <View style={styles.voteModalOverlay}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeVoteList} />
                    <View style={styles.voteModalCard}>
                        <View style={styles.voteModalHeader}>
                            <View style={styles.voteModalTitleWrap}>
                                <Text style={styles.voteModalTitle}>
                                    {voteListType === 'upvoters' ? 'Liked by' : 'Disliked by'}
                                </Text>
                                {typeof issue?.[voteListType === 'upvoters' ? 'upvotes' : 'downvotes']?.length === 'number' ? (
                                    <Text style={styles.voteModalSubtitle}>
                                        {issue[voteListType === 'upvoters' ? 'upvotes' : 'downvotes']?.length} total
                                    </Text>
                                ) : null}
                            </View>

                            <TouchableOpacity onPress={closeVoteList} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <Ionicons name="close" size={22} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {voteListLoading ? (
                            <View style={{ paddingVertical: 22 }}>
                                <ActivityIndicator color={colors.primary} />
                            </View>
                        ) : voteUsernames.length === 0 ? (
                            <Text style={styles.voteEmptyText}>No users yet.</Text>
                        ) : (
                            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
                                {voteUsernames.map((u, idx) => (
                                    <View key={`${u}-${idx}`} style={styles.voteUserRow}>
                                        <View style={styles.voteUserAvatar} />
                                        <Text style={styles.voteUserName}>
                                            {u ? (u.startsWith('@') ? u : `@${u}`) : '@user'}
                                        </Text>
                                    </View>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A101C' },
    header: {
        flexDirection: 'column',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.border + '40',
        backgroundColor: '#090F1A',
    },
    headerTopRow: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 10,
        paddingBottom: 10,
    },
    headerBottomRow: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        paddingTop: 4,
        paddingBottom: 6,
    },
    headerBottomLeft: { flex: 1, alignItems: 'flex-start', justifyContent: 'center' },
    headerBottomRight: { width: 70, alignItems: 'flex-end', justifyContent: 'center' },
    headerSide: { width: 52, alignItems: 'flex-start', justifyContent: 'center' },
    headerSideSpacer: { width: 52, height: 38 },
    headerCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    issueDetailCard: {
        marginHorizontal: 12,
        marginTop: 12,
        borderRadius: radius.xxl,
        backgroundColor: '#0F1727',
        borderWidth: 1,
        borderColor: colors.border + '38',
        overflow: 'hidden',
        paddingBottom: 10,
    },
    contentSheet: {
        flex: 1,
        marginHorizontal: 0,
        marginTop: 0,
        borderRadius: 0,
        borderWidth: 0,
        borderColor: 'transparent',
        backgroundColor: '#0A101C',
        overflow: 'hidden',
    },
    scrollContent: { paddingBottom: 34 },
    backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surfaceLight, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border + '45' },
    headerTitle: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 18,
        color: colors.text,
        textAlign: 'left',
        flex: 1,
        paddingLeft: 2,
    },
    followBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(255,255,255,0.03)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    followBtnActive: {
        backgroundColor: 'rgba(26,94,255,0.22)',
        borderColor: 'rgba(26,94,255,0.55)',
    },
    deleteBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(255, 80, 80, 0.14)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 96, 96, 0.45)',
    },
    updatesBtn: {
        height: 38,
        minWidth: 108,
        borderRadius: 19,
        backgroundColor: '#1A5EFF',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#2B72FF',
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 12,
    },
    updatesBtnText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 12 },
    updatesBtnFlat: {
        height: 36,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.04)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 12,
    },
    updatesBtnFlatText: { fontFamily: 'Inter_700Bold', color: '#EAF1FF', fontSize: 13 },
    quickTabsWrap: {
        backgroundColor: '#090F1A',
        borderBottomWidth: 1,
        borderBottomColor: colors.border + '35',
    },
    quickTabsRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
    quickTabBtn: {
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1,
        borderColor: colors.border + '35',
    },
    quickTabBtnActive: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderColor: 'rgba(255,255,255,0.14)',
    },
    quickTabText: { fontFamily: 'Inter_600SemiBold', color: colors.textMuted, fontSize: 12 },
    quickTabTextActive: { color: '#EAF1FF' },
    errorText: { fontFamily: 'Inter_500Medium', color: colors.error, textAlign: 'center', marginTop: 40 },
    imageWrap: { position: 'relative', marginHorizontal: 0, marginTop: 0, borderRadius: 0, overflow: 'hidden' },
    image: { width: '100%', height: 220, backgroundColor: colors.surfaceLight },
    imgOverlay: { position: 'absolute', top: 12, right: 12 },
    sevBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
    sevText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 12 },
    emergencyOverlay: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FF003CDD', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    emergencyText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 11, letterSpacing: 0.5 },
    content: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8 },
    title: { fontFamily: 'Inter_700Bold', color: colors.text, fontSize: 22, lineHeight: 30 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
    metaLocationWrap: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaDot: { fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 12 },
    metaText: { fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 12, flexShrink: 1 },
    infoChipsRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
    infoChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border + '45',
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    infoChipDot: { width: 7, height: 7, borderRadius: 4 },
    infoChipText: { fontFamily: 'Inter_600SemiBold', color: colors.textMuted, fontSize: 11 },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
    tagChip: { backgroundColor: colors.primary + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    tagText: { fontFamily: 'Inter_500Medium', color: colors.primary, fontSize: 11 },
    descriptionCard: {
        marginTop: 14,
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderWidth: 1,
        borderColor: colors.border + '28',
        borderRadius: radius.md,
        padding: 12,
    },
    description: { fontFamily: 'Inter_400Regular', color: colors.textSecondary, fontSize: 14, lineHeight: 22 },
    inlineViewMoreBtn: { marginTop: 10, alignSelf: 'flex-start' },
    inlineViewMoreBtnText: { fontFamily: 'Inter_600SemiBold', color: colors.primary, fontSize: 12 },

    // Community gallery (merged reports)
    communitySection: { marginTop: 16, backgroundColor: '#101828', borderRadius: radius.lg, padding: 12, borderWidth: 1, borderColor: colors.border + '35' },
    communityHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    communityTitle: { fontFamily: 'Inter_700Bold', color: colors.text, fontSize: 15 },
    communityCount: {
        fontFamily: 'Inter_700Bold',
        color: colors.primary,
        fontSize: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: colors.primary + '1A',
        borderWidth: 1,
        borderColor: colors.primary + '45',
    },
    communityGalleryRow: { gap: 10, paddingBottom: 4 },
    communityImgItem: { width: 110, height: 80, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border + '40', backgroundColor: colors.surfaceLight },
    communityImg: { width: '100%', height: '100%' },
    galleryDotsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 8 },
    galleryDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textMuted + '55' },
    galleryDotActive: { width: 14, borderRadius: 6, backgroundColor: colors.primary },
    communityReporterList: { marginTop: 12, gap: 10 },
    communityReporterRow: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: radius.md, padding: 10, borderWidth: 1, borderColor: colors.border + '30' },
    communityReporterAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary + '20', justifyContent: 'center', alignItems: 'center' },
    communityReporterMain: { flex: 1, minWidth: 0 },
    communityReporterMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    communityReporterAvatarText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 12 },
    communityReporterName: { fontFamily: 'Inter_600SemiBold', color: colors.text, fontSize: 13, flex: 1, minWidth: 0 },
    communityReporterTime: { fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 11, marginTop: 2 },
    communityReporterProbity: { fontFamily: 'Inter_500Medium', color: colors.primary, fontSize: 11, marginTop: 4 },
    communityViewAllBtn: {
        marginTop: 8,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border + '50',
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    communityViewAllBtnText: { fontFamily: 'Inter_600SemiBold', color: colors.textMuted, fontSize: 12 },

    priorityCard: { backgroundColor: '#101828', borderRadius: radius.lg, padding: 14, marginTop: 16, borderWidth: 1, borderColor: colors.border + '35' },
    priorityHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    priorityLabel: { fontFamily: 'Inter_600SemiBold', color: colors.text, fontSize: 13 },
    priorityValue: { fontFamily: 'Inter_700Bold', color: colors.primary, fontSize: 13 },
    priorityBar: { height: 6, backgroundColor: colors.surfaceLight, borderRadius: 3, overflow: 'hidden' },
    priorityFill: { height: 6, borderRadius: 3 },
    sectionTitle: { fontFamily: 'Inter_700Bold', color: colors.text, fontSize: 16, marginTop: 20, marginBottom: 12 },
    timelineItem: { flexDirection: 'row', marginBottom: 16, position: 'relative' },
    timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, marginRight: 12 },
    timelineLine: { position: 'absolute', left: 4, top: 16, width: 2, height: 36, backgroundColor: colors.border },
    timelineContent: { flex: 1 },
    timelineStatus: { fontFamily: 'Inter_600SemiBold', color: colors.text, fontSize: 14 },
    timelineComment: { fontFamily: 'Inter_400Regular', color: colors.textSecondary, fontSize: 12, marginTop: 2 },
    timelineTime: { fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 11, marginTop: 2 },
    actionsRow: { flexDirection: 'row', gap: 24, marginTop: 16, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border + '55' },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    actionText: { fontFamily: 'Inter_600SemiBold', color: colors.textSecondary, fontSize: 13 },
    emptyText: { fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 13 },
    commentCard: { backgroundColor: '#0F1727', borderRadius: radius.lg, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border + '35' },
    commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    commentAvatar: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
    commentAvatarText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 13 },
    commentNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    commentName: { fontFamily: 'Inter_600SemiBold', color: colors.text, fontSize: 13 },
    officialBadge: { backgroundColor: '#FF6B35', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
    officialText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 8 },
    commentTime: { fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 11 },
    commentText: { fontFamily: 'Inter_400Regular', color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
    sectionViewMoreBtn: {
        marginTop: 6,
        alignSelf: 'center',
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border + '45',
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    sectionViewMoreText: { fontFamily: 'Inter_600SemiBold', color: colors.textMuted, fontSize: 12 },
    commentInput: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: 16, paddingTop: 10,
        backgroundColor: '#0E1523', borderTopWidth: 1, borderTopColor: colors.border + '45',
    },
    commentField: { flex: 1, fontFamily: 'Inter_400Regular', color: colors.text, fontSize: 14, backgroundColor: colors.surfaceLight, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10 },
    sendBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },

    // Skeleton (Issue Detail)
    issueSkeletonCard: {
        marginHorizontal: 10,
        marginTop: 12,
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        padding: 16,
        overflow: 'hidden',
    },
    skTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
    skAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.06)' },
    skLineWide: { height: 12, width: '80%', borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: 10 },
    skLineShort: { height: 10, width: '42%', borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.045)' },
    skLine: { height: 12, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: 12 },
    skMedia: { height: 190, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.04)', marginBottom: 12 },
    skPriority: { height: 46, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.04)', marginBottom: 12 },
    skTimeline: { height: 120, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.04)' },

    // Resolution Card
    resolutionCard: { backgroundColor: '#0F1727', borderRadius: radius.xl, padding: 16, marginTop: 16, borderWidth: 1, borderColor: colors.success + '30' },
    resolutionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
    resolutionTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, color: colors.success },
    comparisonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16 },
    compareItem: { flex: 1, position: 'relative' },
    compareImg: { width: '100%', height: 120, borderRadius: radius.md },
    compareLabel: { position: 'absolute', bottom: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    compareLabelText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 9 },
    officialRemarkBox: { backgroundColor: colors.surfaceLight, padding: 12, borderRadius: radius.md },
    remarkHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    remarkDept: { fontFamily: 'Inter_700Bold', fontSize: 13, color: colors.text },
    remarkTime: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.textMuted },
    remarkText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textSecondary, lineHeight: 18 },

    // Timeline Enhancements
    timelineHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    timelineHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
    officialTimeline: { backgroundColor: colors.primary + '08', padding: 10, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.primary + '20' },
    deptTimelineBadge: { backgroundColor: colors.primary + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    deptTimelineText: { fontFamily: 'Inter_700Bold', fontSize: 9, color: colors.primary },
    officialLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, color: colors.primary, marginTop: 6, letterSpacing: 0.5 },

    // Reporter details modal
    reporterDetailImg: { width: '100%', height: 220, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.surfaceLight },
    reporterDetailImgPlaceholder: {
        width: '100%',
        height: 220,
        borderRadius: radius.xl,
        backgroundColor: colors.surfaceLight,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: colors.border + '40',
    },
    reporterDetailPlaceholderText: { fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 13 },
    reporterDetailTitle: { fontFamily: 'Inter_700Bold', color: colors.text, fontSize: 18, marginBottom: 6 },
    reporterDetailProbity: { fontFamily: 'Inter_600SemiBold', color: colors.primary, fontSize: 13, marginBottom: 6 },
    reporterDetailTime: { fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 12, marginBottom: 12 },
    reporterDetailLabel: { fontFamily: 'Inter_600SemiBold', color: colors.textMuted, fontSize: 12, marginTop: 10 },
    reporterDetailText: { fontFamily: 'Inter_400Regular', color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 6 },
    reporterDetailTextMuted: { fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 12, marginTop: 4 },
    reporterDetailTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    reporterDetailTagChip: { backgroundColor: colors.primary + '15', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
    reporterDetailTagText: { fontFamily: 'Inter_500Medium', color: colors.primary, fontSize: 11 },

    // Updates side panel
    updatesOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    updatesPanel: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        backgroundColor: 'rgba(12,15,28,0.98)',
        borderLeftWidth: 1,
        borderLeftColor: colors.border + '50',
        paddingBottom: 12,
    },
    updatesPanelHeader: { padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border + '40', gap: 10 },
    updatesPanelTitle: { fontFamily: 'Inter_700Bold', color: colors.text, fontSize: 16 },
    updatesTabsRow: { flexDirection: 'row', gap: 10 },
    updatesTabBtn: {
        flex: 1,
        borderRadius: radius.md,
        paddingVertical: 12,
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1,
        borderColor: colors.border + '40',
    },
    updatesTabBtnActive: {
        backgroundColor: colors.primary + '18',
        borderColor: colors.primary + '40',
    },
    updatesTabBtnText: { fontFamily: 'Inter_600SemiBold', color: colors.textMuted, fontSize: 13 },
    updatesEmptyText: { fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 18 },

    updateItemCard: {
        borderRadius: radius.lg,
        backgroundColor: colors.surfaceLight,
        borderWidth: 1,
        borderColor: colors.border + '35',
        padding: 12,
    },
    updateAvatar: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: colors.primary + '20',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.primary + '30',
    },
    updateAvatarText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 12 },
    updateItemTitle: { fontFamily: 'Inter_600SemiBold', color: colors.text, fontSize: 13 },
    updateItemSub: { fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 11, marginTop: 2 },
    updateProbity: { fontFamily: 'Inter_600SemiBold', color: colors.primary, fontSize: 12, marginTop: 6 },
    updateThumbImg: { width: '100%', height: 120, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border + '40', marginTop: 4 },
    updateLocText: { fontFamily: 'Inter_400Regular', color: colors.textSecondary, fontSize: 12, marginTop: 10, lineHeight: 16 },

    updatesSectionBlock: {
        borderRadius: radius.lg,
        backgroundColor: colors.surfaceLight,
        borderWidth: 1,
        borderColor: colors.border + '35',
        padding: 12,
    },
    updatesSectionTitle: { fontFamily: 'Inter_700Bold', color: colors.text, fontSize: 13, marginBottom: 8 },
    updatesSectionText: { fontFamily: 'Inter_400Regular', color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: 6 },

    timelineMiniCard: { borderRadius: radius.md, padding: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: colors.border + '30', marginBottom: 10 },
    timelineMiniStatus: { fontFamily: 'Inter_700Bold', color: colors.text, fontSize: 14 },
    timelineMiniDeptBadge: { marginTop: 6, alignSelf: 'flex-start', backgroundColor: colors.primary + '15', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
    timelineMiniDeptText: { fontFamily: 'Inter_600SemiBold', color: colors.primary, fontSize: 11 },
    timelineMiniSub: { fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 12, marginTop: 6 },
    timelineMiniComment: { fontFamily: 'Inter_400Regular', color: colors.textSecondary, fontSize: 12, marginTop: 8, lineHeight: 18 },
    timelineMiniTime: { fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 11, marginTop: 8 },
    completionImg: { width: '100%', height: 160, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border + '40' },

    // Modal
    modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
    modalClose: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
    modalImg: { width: '100%', height: '80%' },

    // Vote list modal
    voteModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 16 },
    voteModalCard: { width: '100%', backgroundColor: colors.surface, borderRadius: radius.xl, padding: 16, borderWidth: 1, borderColor: colors.border + '40' },
    voteModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border + '35', marginBottom: 12 },
    voteModalTitleWrap: { flex: 1, gap: 4 },
    voteModalTitle: { fontFamily: fonts.bold, color: colors.text, fontSize: 18 },
    voteModalSubtitle: { fontFamily: fonts.medium, color: colors.textSecondary, fontSize: 12, marginTop: 2 },
    voteEmptyText: { fontFamily: fonts.regular, color: colors.textMuted, textAlign: 'center', paddingVertical: 18 },
    voteUserRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border + '30' },
    voteUserAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary + '20', borderWidth: 1, borderColor: colors.primary + '40' },
    voteUserName: { fontFamily: fonts.semibold, color: colors.text, fontSize: 14 },
});
