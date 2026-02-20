/**
 * FeedPost — Redesigned premium social-media-style post card
 * Supports both Community (user issue) and Municipal (official) posts
 * Instagram-level polish with smooth animations
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Image, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withSequence,
    withDelay,
    withTiming,
    runOnJS
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { colors, fonts, radius } from '../../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_HEIGHT = 260;

interface FeedPostProps {
    item: any;
    userId?: string;
    index: number;
    onPress: () => void;
    onUpvote: (id: string) => void;
    onDownvote: (id: string) => void;
    onComment: (id: string) => void;
    onShare: (item: any) => void;
    onUserPress?: (item: any) => void;
    onFollowPress?: (item: any) => void;
}

export default function FeedPost({
    item, userId, index, onPress, onUpvote, onDownvote,
    onComment, onShare, onUserPress, onFollowPress,
}: FeedPostProps) {
    const [imageLoaded, setImageLoaded] = useState(false);
    const blockSingleTapRef = useRef(false);
    const isMunicipal = item.authorType === 'MunicipalPage';
    const isUpvoted = item.upvotes?.includes(userId);
    const isDownvoted = (item.downvotes || []).includes(userId);
    const initials = (item.user?.name || 'U')[0].toUpperCase();

    // ─── Animations ───
    const scale = useSharedValue(0); // For heart icon
    const opacity = useSharedValue(0); // For heart icon

    // Entrance animation (calm + subtle)
    const slideY = useSharedValue(4);
    const fadeOpacity = useSharedValue(0.01);

    useEffect(() => {
        slideY.value = withTiming(0, { duration: 180 });
        fadeOpacity.value = withTiming(1, { duration: 220 });
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: slideY.value }],
        opacity: fadeOpacity.value,
    }));

    const heartStyle = useAnimatedStyle(() => ({
        transform: [{ scale: Math.max(scale.value, 0) }],
        opacity: opacity.value,
    }));

    // ─── Double Tap Logic ───
    const handleDoubleTap = useCallback(() => {
        onUpvote(item._id);

        // Heart Animation
        opacity.value = 1;
        scale.value = 0;
        scale.value = withSequence(
            withSpring(1.2, { damping: 15 }),
            withDelay(100, withSpring(0, { damping: 15 }))
        );
        opacity.value = withDelay(500, withTiming(0));
    }, [item._id, onUpvote]);

    const handleSingleTap = useCallback(() => {
        if (blockSingleTapRef.current) {
            blockSingleTapRef.current = false;
            return;
        }
        onPress();
    }, [onPress]);

    const handleUserPress = useCallback(() => {
        if (!onUserPress) return;
        blockSingleTapRef.current = true;
        onUserPress(item);
        setTimeout(() => {
            blockSingleTapRef.current = false;
        }, 250);
    }, [item, onUserPress]);

    const doubleTap = Gesture.Tap()
        .numberOfTaps(2)
        .maxDuration(250)
        .onEnd(() => {
            runOnJS(handleDoubleTap)();
        });

    const singleTap = Gesture.Tap()
        .numberOfTaps(1)
        .onEnd(() => {
            runOnJS(handleSingleTap)();
        });

    // Provide exclusive gesture handling: wait for double tap to fail before triggering single tap
    const composed = Gesture.Exclusive(doubleTap, singleTap);

    const getSeverityStyle = (severity: string) => {
        switch (severity) {
            case 'Critical': return { color: '#FF003C', bg: '#FF003C15', glow: '#FF003C' };
            case 'High': return { color: '#FF453A', bg: '#FF453A15', glow: '#FF453A' };
            case 'Medium': return { color: '#FFD60A', bg: '#FFD60A15', glow: '#FFD60A' };
            default: return { color: '#30D158', bg: '#30D15815', glow: '#30D158' };
        }
    };

    const severity = getSeverityStyle(item.aiSeverity);

    return (
        <Animated.View style={[styles.postContainer, animatedStyle]}>
            <GestureDetector gesture={composed}>
                <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                    {/* ─── Header ─── */}
                    <View style={styles.header}>
                        <TouchableOpacity
                            style={styles.userSection}
                            onPress={handleUserPress}
                            activeOpacity={0.8}
                        >
                            {/* Avatar */}
                            {item.user?.avatar ? (
                                <Image source={{ uri: item.user.avatar }} style={styles.avatar} />
                            ) : (
                                <LinearGradient
                                    colors={isMunicipal ? ['#8B5CF6', '#6D28D9'] : [colors.primary, '#0055CC']}
                                    style={styles.avatar}
                                >
                                    <Text style={styles.avatarText}>{initials}</Text>
                                </LinearGradient>
                            )}

                            <View style={styles.userInfo}>
                                <View style={styles.nameRow}>
                                    <Text style={styles.userName} numberOfLines={1}>
                                        {item.user?.name || 'Anonymous'}
                                    </Text>
                                    {isMunicipal && (
                                        <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                                    )}
                                </View>
                                <Text style={styles.timeText}>
                                    {item.timeAgo || 'Just now'}
                                    {item.location?.address ? ` · ${item.location.address}` : ''}
                                </Text>
                            </View>
                        </TouchableOpacity>

                        {/* Right side */}
                        <View style={styles.headerRight}>
                            {!isMunicipal ? (
                                <View style={[styles.severityPill, { backgroundColor: severity.bg }]}>
                                    <View style={[styles.severityDot, { backgroundColor: severity.color }]} />
                                    <Text style={[styles.severityText, { color: severity.color }]}>
                                        {item.aiSeverity || 'Low'}
                                    </Text>
                                </View>
                            ) : (
                                onFollowPress && (
                                    <TouchableOpacity
                                        style={styles.followBtn}
                                        onPress={() => onFollowPress(item)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.followBtnText}>{item.isFollowingPage ? 'Following' : 'Follow'}</Text>
                                    </TouchableOpacity>
                                )
                            )}

                            <TouchableOpacity style={styles.moreBtn} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* ─── Title ─── */}
                    <Text style={styles.title} numberOfLines={2}>{item.title}</Text>

                    {/* Description for municipal posts */}
                    {isMunicipal && item.description && (
                        <Text style={styles.description} numberOfLines={3}>{item.description}</Text>
                    )}

                    {/* ─── Image Area with Double Tap ─── */}
                    {/* Note: We use the parent Gesture Detector, but this View holds the heart overlay */}
                    {item.image && (
                        <View style={styles.imageContainer}>
                            <Image
                                source={{ uri: item.image }}
                                style={styles.postImage}
                                onLoad={() => setImageLoaded(true)}
                            />

                            {/* Overlay Gradient */}
                            <LinearGradient
                                colors={['transparent', 'rgba(0,0,0,0.4)']}
                                style={styles.imageGradient}
                            />

                            {/* Tags */}
                            {item.departmentTag && (
                                <View style={styles.categoryOnImage}>
                                    <Text style={styles.categoryText}>{item.departmentTag}</Text>
                                </View>
                            )}

                            {/* Big Heart Animation Overlay */}
                            <View style={[StyleSheet.absoluteFillObject, styles.heartOverlay]} pointerEvents="none">
                                <Animated.View style={heartStyle}>
                                    <Ionicons name="heart" size={100} color="#FFF" />
                                </Animated.View>
                            </View>
                        </View>
                    )}

                    {/* ─── Status Row (Community) ─── */}
                    {!isMunicipal && (
                        <View style={styles.statusRow}>
                            <View style={[styles.statusPill, {
                                backgroundColor: item.status === 'Resolved' ? '#30D15815' :
                                    item.status === 'InProgress' ? colors.primary + '15' : '#FF9F0A15',
                            }]}>
                                <Ionicons
                                    name={item.status === 'Resolved' ? 'checkmark-circle' :
                                        item.status === 'InProgress' ? 'sync' : 'time'}
                                    size={12}
                                    color={item.status === 'Resolved' ? '#30D158' :
                                        item.status === 'InProgress' ? colors.primary : '#FF9F0A'}
                                />
                                <Text style={[styles.statusText, {
                                    color: item.status === 'Resolved' ? '#30D158' :
                                        item.status === 'InProgress' ? colors.primary : '#FF9F0A',
                                }]}>
                                    {item.status === 'InProgress' ? 'In Progress' : item.status || 'Submitted'}
                                </Text>
                            </View>
                        </View>
                    )}

                    {/* ─── Actions Bar ─── */}
                    <View style={styles.actionsBar}>
                        <View style={styles.actionsLeft}>
                            {/* Upvote */}
                            <TouchableOpacity
                                style={styles.actionBtn}
                                onPress={() => onUpvote(item._id)}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name={isUpvoted ? 'heart' : 'heart-outline'}
                                    size={24}
                                    color={isUpvoted ? '#FF003C' : colors.textSecondary}
                                />
                                {(item.upvotes?.length > 0) && (
                                    <Text style={[styles.actionCount, isUpvoted && { color: '#FF003C' }]}>
                                        {item.upvotes?.length}
                                    </Text>
                                )}
                            </TouchableOpacity>

                            {/* Comment */}
                            <TouchableOpacity
                                style={styles.actionBtn}
                                onPress={() => onComment(item._id)}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="chatbubble-outline" size={22} color={colors.textSecondary} />
                                {(item.commentCount > 0) && (
                                    <Text style={styles.actionCount}>{item.commentCount}</Text>
                                )}
                            </TouchableOpacity>

                            {/* Share */}
                            <TouchableOpacity
                                style={styles.actionBtn}
                                onPress={() => onShare(item)}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="paper-plane-outline" size={22} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {/* Bookmark */}
                        <TouchableOpacity activeOpacity={0.7}>
                            <Ionicons name="bookmark-outline" size={22} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {(item.upvotes?.length > 0 || item.commentCount > 0) && (
                        <View style={styles.engagementRow}>
                            <Text style={styles.engagementText}>
                                {item.upvotes?.length} likes
                            </Text>
                        </View>
                    )}
                </View>
            </GestureDetector>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    postContainer: {
        backgroundColor: colors.surface,
        borderRadius: 0,
        marginBottom: 10,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: colors.border + '40', // Slightly transparent border
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 10,
    },
    userSection: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 10,
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontFamily: fonts.bold,
        color: '#FFF',
        fontSize: 14,
    },
    userInfo: { flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    userName: { fontFamily: fonts.semibold, color: colors.text, fontSize: 14 },
    timeText: { fontFamily: fonts.regular, color: colors.textMuted, fontSize: 11, marginTop: 1 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    severityPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
    severityDot: { width: 6, height: 6, borderRadius: 3 },
    severityText: { fontFamily: fonts.bold, fontSize: 10, textTransform: 'uppercase' },
    followBtn: { backgroundColor: colors.surfaceLight, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
    followBtnText: { fontFamily: fonts.semibold, color: colors.text, fontSize: 12 },
    moreBtn: { padding: 4 },
    title: { fontFamily: fonts.medium, color: colors.text, fontSize: 15, lineHeight: 22, paddingHorizontal: 16, marginBottom: 8 },
    description: { fontFamily: fonts.regular, color: colors.textSecondary, fontSize: 14, lineHeight: 20, paddingHorizontal: 16, marginBottom: 10 },
    imageContainer: { position: 'relative', width: '100%', height: 300, backgroundColor: colors.surfaceLight },
    postImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    imageGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80 },
    heartOverlay: { justifyContent: 'center', alignItems: 'center', zIndex: 10 },
    categoryOnImage: { position: 'absolute', bottom: 10, left: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
    categoryText: { fontFamily: fonts.semibold, color: '#FFF', fontSize: 11 },
    statusRow: { paddingHorizontal: 16, paddingTop: 8 },
    statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
    statusText: { fontFamily: fonts.semibold, fontSize: 11 },
    actionsBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
    actionsLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 4 },
    actionCount: { fontFamily: fonts.medium, color: colors.text, fontSize: 14 },
    engagementRow: { paddingHorizontal: 16, paddingBottom: 12 },
    engagementText: { fontFamily: fonts.bold, color: colors.text, fontSize: 13 },
});
