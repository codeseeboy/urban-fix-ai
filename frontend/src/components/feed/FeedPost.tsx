/**
 * FeedPost — Redesigned premium social-media-style post card
 * Supports both Community (user issue) and Municipal (official) posts
 * Instagram-level polish with smooth animations
 */
import React, { useRef, useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Image, Animated, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;
    const [imageLoaded, setImageLoaded] = useState(false);

    const isMunicipal = item.authorType === 'MunicipalPage';
    const isUpvoted = item.upvotes?.includes(userId);
    const isDownvoted = (item.downvotes || []).includes(userId);
    const initials = (item.user?.name || 'U')[0].toUpperCase();

    // Entrance animation
    useEffect(() => {
        const delay = Math.min(index * 80, 400);
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
            Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 60, delay, useNativeDriver: true }),
        ]).start();
    }, []);

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
        <Animated.View style={[
            styles.postContainer,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}>
            <TouchableOpacity activeOpacity={0.95} onPress={onPress}>
                {/* ─── Header ─── */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.userSection}
                        onPress={() => onUserPress?.(item)}
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
                                {item.timeAgo || '2h ago'}
                                {item.location?.address ? ` · ${item.location.address}` : ''}
                            </Text>
                        </View>
                    </TouchableOpacity>

                    {/* Right side - severity badge or follow button */}
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
                                    <Text style={styles.followBtnText}>Follow</Text>
                                </TouchableOpacity>
                            )
                        )}

                        <TouchableOpacity style={styles.moreBtn} activeOpacity={0.7}>
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

                {/* ─── Image ─── */}
                {item.image && (
                    <View style={styles.imageContainer}>
                        <Image
                            source={{ uri: item.image }}
                            style={styles.postImage}
                            onLoad={() => setImageLoaded(true)}
                        />

                        {/* Image overlay gradient */}
                        <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.4)']}
                            style={styles.imageGradient}
                        />

                        {/* Category tag on image */}
                        {item.departmentTag && (
                            <View style={styles.categoryOnImage}>
                                <Text style={styles.categoryText}>{item.departmentTag}</Text>
                            </View>
                        )}

                        {/* Emergency badge on image */}
                        {item.emergency && (
                            <View style={styles.emergencyOnImage}>
                                <Ionicons name="warning" size={12} color="#FFF" />
                                <Text style={styles.emergencyText}>EMERGENCY</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* ─── Status Row (Community posts only) ─── */}
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
                                size={22}
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
                            <Ionicons name="chatbubble-outline" size={20} color={colors.textSecondary} />
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
                            <Ionicons name="paper-plane-outline" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>

                        {/* Downvote (community only) */}
                        {!isMunicipal && (
                            <TouchableOpacity
                                style={styles.actionBtn}
                                onPress={() => onDownvote(item._id)}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name={isDownvoted ? 'arrow-down-circle' : 'arrow-down-circle-outline'}
                                    size={20}
                                    color={isDownvoted ? '#FF453A' : colors.textMuted}
                                />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Bookmark */}
                    <TouchableOpacity activeOpacity={0.7}>
                        <Ionicons name="bookmark-outline" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>

                {/* Engagement summary */}
                {(item.upvotes?.length > 0 || item.commentCount > 0) && (
                    <View style={styles.engagementRow}>
                        <Text style={styles.engagementText}>
                            {item.upvotes?.length > 0 ? `${item.upvotes.length} upvotes` : ''}
                            {item.upvotes?.length > 0 && item.commentCount > 0 ? '  ·  ' : ''}
                            {item.commentCount > 0 ? `${item.commentCount} comments` : ''}
                        </Text>
                    </View>
                )}
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    postContainer: {
        backgroundColor: colors.surface,
        borderRadius: 20,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 10,
    },
    userSection: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 10,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontFamily: fonts.bold,
        color: '#FFF',
        fontSize: 16,
    },
    userInfo: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    userName: {
        fontFamily: fonts.semibold,
        color: colors.text,
        fontSize: 14,
    },
    timeText: {
        fontFamily: fonts.regular,
        color: colors.textMuted,
        fontSize: 11,
        marginTop: 1,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    severityPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    severityDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    severityText: {
        fontFamily: fonts.bold,
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    followBtn: {
        backgroundColor: colors.primary,
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 6,
    },
    followBtnText: {
        fontFamily: fonts.semibold,
        color: '#FFF',
        fontSize: 12,
    },
    moreBtn: {
        padding: 4,
    },

    // Title
    title: {
        fontFamily: fonts.semibold,
        color: colors.text,
        fontSize: 15,
        lineHeight: 21,
        paddingHorizontal: 16,
        marginBottom: 10,
    },
    description: {
        fontFamily: fonts.regular,
        color: colors.textSecondary,
        fontSize: 13,
        lineHeight: 19,
        paddingHorizontal: 16,
        marginBottom: 10,
    },

    // Image
    imageContainer: {
        position: 'relative',
        marginHorizontal: 0,
    },
    postImage: {
        width: '100%',
        height: IMAGE_HEIGHT,
    },
    imageGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 80,
    },
    categoryOnImage: {
        position: 'absolute',
        bottom: 10,
        left: 12,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    categoryText: {
        fontFamily: fonts.semibold,
        color: '#FFF',
        fontSize: 11,
    },
    emergencyOnImage: {
        position: 'absolute',
        top: 10,
        right: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#FF003CDD',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    emergencyText: {
        fontFamily: fonts.bold,
        color: '#FFF',
        fontSize: 9,
        letterSpacing: 0.5,
    },

    // Status
    statusRow: {
        paddingHorizontal: 16,
        paddingTop: 8,
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        alignSelf: 'flex-start',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    statusText: {
        fontFamily: fonts.semibold,
        fontSize: 11,
    },

    // Actions
    actionsBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    actionsLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 18,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    actionCount: {
        fontFamily: fonts.medium,
        color: colors.textSecondary,
        fontSize: 13,
    },

    // Engagement
    engagementRow: {
        paddingHorizontal: 16,
        paddingBottom: 12,
        marginTop: -4,
    },
    engagementText: {
        fontFamily: fonts.medium,
        color: colors.textMuted,
        fontSize: 12,
    },
});
