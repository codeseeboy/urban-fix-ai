/**
 * ReelsTab — TikTok/Instagram Reels style vertical swipeable video feed
 * Full-screen video cards with like/comment/share overlay
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    Dimensions, Image, Animated, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius } from '../../theme/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
// Subtract tab bar + header for reel height
const REEL_HEIGHT = SCREEN_HEIGHT - 180;

interface ReelItem {
    _id: string;
    title: string;
    description?: string;
    video?: string;
    image?: string; // Thumbnail / fallback
    user?: { name: string; avatar?: string };
    upvotes?: string[];
    commentCount?: number;
    category?: string;
    location?: { address?: string };
    timeAgo?: string;
    aiSeverity?: string;
    authorType?: string;
}

interface ReelsTabProps {
    reels: ReelItem[];
    loading: boolean;
    userId?: string;
    onLike: (id: string) => void;
    onComment: (id: string) => void;
    onShare: (item: ReelItem) => void;
    onUserPress: (item: ReelItem) => void;
    activeToggle: 'community' | 'municipal';
}

function ReelCard({ item, userId, onLike, onComment, onShare, onUserPress }: {
    item: ReelItem;
    userId?: string;
    onLike: (id: string) => void;
    onComment: (id: string) => void;
    onShare: (item: ReelItem) => void;
    onUserPress: (item: ReelItem) => void;
}) {
    const [liked, setLiked] = useState(item.upvotes?.includes(userId || '') || false);
    const heartScale = useRef(new Animated.Value(1)).current;
    const isMunicipal = item.authorType === 'MunicipalPage';
    const initials = (item.user?.name || 'U')[0].toUpperCase();

    const handleLike = () => {
        setLiked(!liked);
        Animated.sequence([
            Animated.spring(heartScale, { toValue: 1.4, friction: 3, tension: 150, useNativeDriver: true }),
            Animated.spring(heartScale, { toValue: 1, friction: 5, useNativeDriver: true }),
        ]).start();
        onLike(item._id);
    };

    return (
        <View style={[styles.reelContainer, { height: REEL_HEIGHT }]}>
            {/* Background image/thumbnail */}
            {item.image ? (
                <Image source={{ uri: item.image }} style={styles.reelImage} resizeMode="cover" />
            ) : (
                <LinearGradient
                    colors={['#1a1a2e', '#16213e', '#0f3460']}
                    style={styles.reelImage}
                />
            )}

            {/* Gradient overlays */}
            <LinearGradient
                colors={['rgba(0,0,0,0.5)', 'transparent']}
                style={styles.topGradient}
            />
            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.85)']}
                style={styles.bottomGradient}
            />

            {/* Right side action buttons */}
            <View style={styles.actionColumn}>
                {/* User avatar */}
                <TouchableOpacity style={styles.reelAvatarWrap} onPress={() => onUserPress(item)}>
                    {item.user?.avatar ? (
                        <Image source={{ uri: item.user.avatar }} style={styles.reelAvatar} />
                    ) : (
                        <LinearGradient
                            colors={isMunicipal ? ['#8B5CF6', '#6D28D9'] : [colors.primary, '#0055CC']}
                            style={styles.reelAvatar}
                        >
                            <Text style={styles.reelAvatarText}>{initials}</Text>
                        </LinearGradient>
                    )}
                    {isMunicipal && (
                        <View style={styles.reelVerified}>
                            <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                        </View>
                    )}
                </TouchableOpacity>

                {/* Like */}
                <TouchableOpacity style={styles.reelActionBtn} onPress={handleLike}>
                    <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                        <Ionicons
                            name={liked ? 'heart' : 'heart-outline'}
                            size={28}
                            color={liked ? '#FF003C' : '#FFF'}
                        />
                    </Animated.View>
                    <Text style={styles.reelActionText}>
                        {(item.upvotes?.length || 0) + (liked && !item.upvotes?.includes(userId || '') ? 1 : 0)}
                    </Text>
                </TouchableOpacity>

                {/* Comment */}
                <TouchableOpacity style={styles.reelActionBtn} onPress={() => onComment(item._id)}>
                    <Ionicons name="chatbubble-ellipses" size={26} color="#FFF" />
                    <Text style={styles.reelActionText}>{item.commentCount || 0}</Text>
                </TouchableOpacity>

                {/* Share */}
                <TouchableOpacity style={styles.reelActionBtn} onPress={() => onShare(item)}>
                    <Ionicons name="paper-plane" size={24} color="#FFF" />
                    <Text style={styles.reelActionText}>Share</Text>
                </TouchableOpacity>

                {/* Bookmark */}
                <TouchableOpacity style={styles.reelActionBtn}>
                    <Ionicons name="bookmark-outline" size={24} color="#FFF" />
                </TouchableOpacity>
            </View>

            {/* Bottom info overlay */}
            <View style={styles.reelInfo}>
                <TouchableOpacity onPress={() => onUserPress(item)} style={styles.reelUserRow}>
                    <Text style={styles.reelUserName}>
                        {item.user?.name || 'Anonymous'}
                    </Text>
                    {isMunicipal && (
                        <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                    )}
                </TouchableOpacity>

                <Text style={styles.reelTitle} numberOfLines={2}>{item.title}</Text>

                {item.description && (
                    <Text style={styles.reelDescription} numberOfLines={2}>{item.description}</Text>
                )}

                {/* Tags row */}
                <View style={styles.reelTags}>
                    {item.category && (
                        <View style={styles.reelTag}>
                            <Ionicons name="pricetag" size={10} color="#FFF" />
                            <Text style={styles.reelTagText}>{item.category}</Text>
                        </View>
                    )}
                    {item.location?.address && (
                        <View style={styles.reelTag}>
                            <Ionicons name="location" size={10} color="#FFF" />
                            <Text style={styles.reelTagText} numberOfLines={1}>{item.location.address}</Text>
                        </View>
                    )}
                    {item.aiSeverity && (
                        <View style={[styles.reelTag, {
                            backgroundColor: item.aiSeverity === 'Critical' ? '#FF003C40' : 'rgba(255,255,255,0.15)'
                        }]}>
                            <Text style={[styles.reelTagText, {
                                color: item.aiSeverity === 'Critical' ? '#FF003C' : '#FFF'
                            }]}>{item.aiSeverity}</Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Video play icon overlay (since we're showing images as placeholder) */}
            {item.video && (
                <View style={styles.playOverlay}>
                    <View style={styles.playButton}>
                        <Ionicons name="play" size={32} color="#FFF" />
                    </View>
                </View>
            )}
        </View>
    );
}

export default function ReelsTab({
    reels, loading, userId, onLike, onComment, onShare, onUserPress, activeToggle,
}: ReelsTabProps) {
    const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 });
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        // Smooth entrance for empty state
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 60, useNativeDriver: true }),
        ]).start();

        // Gentle pulse for the icon
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.08, duration: 1500, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, []);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading Reels...</Text>
            </View>
        );
    }

    if (reels.length === 0) {
        return (
            <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
                <Animated.View style={[styles.emptyIconWrap, { transform: [{ scale: pulseAnim }] }]}>
                    <LinearGradient
                        colors={['#1a1a2e', '#16213e']}
                        style={styles.emptyIconCircle}
                    >
                        <Ionicons name="videocam-outline" size={48} color={colors.primary} />
                    </LinearGradient>
                </Animated.View>

                <Text style={styles.emptyTitle}>Reels Coming Soon</Text>
                <Text style={styles.emptySubtitle}>
                    {activeToggle === 'community'
                        ? 'Short video reports from your community will appear here. Be the first to upload!'
                        : 'Official video updates from municipal bodies will show up here.'
                    }
                </Text>

                <View style={styles.emptyFeatures}>
                    {[
                        { icon: 'camera-outline', text: 'Record & report issues' },
                        { icon: 'eye-outline', text: 'Watch community updates' },
                        { icon: 'heart-outline', text: 'Like & engage with citizens' },
                    ].map((f, i) => (
                        <View key={i} style={styles.emptyFeatureRow}>
                            <Ionicons name={f.icon as any} size={16} color={colors.textSecondary} />
                            <Text style={styles.emptyFeatureText}>{f.text}</Text>
                        </View>
                    ))}
                </View>
            </Animated.View>
        );
    }

    return (
        <FlatList
            data={reels}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
                <ReelCard
                    item={item}
                    userId={userId}
                    onLike={onLike}
                    onComment={onComment}
                    onShare={onShare}
                    onUserPress={onUserPress}
                />
            )}
            pagingEnabled
            snapToInterval={REEL_HEIGHT}
            decelerationRate="fast"
            showsVerticalScrollIndicator={false}
            viewabilityConfig={viewabilityConfig.current}
            getItemLayout={(_, index) => ({
                length: REEL_HEIGHT,
                offset: REEL_HEIGHT * index,
                index,
            })}
        />
    );
}

const styles = StyleSheet.create({
    reelContainer: {
        width: SCREEN_WIDTH,
        position: 'relative',
        backgroundColor: '#000',
    },
    reelImage: {
        ...StyleSheet.absoluteFillObject,
        width: '100%',
        height: '100%',
    },
    topGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 100,
    },
    bottomGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 250,
    },
    actionColumn: {
        position: 'absolute',
        right: 12,
        bottom: 100,
        alignItems: 'center',
        gap: 18,
    },
    reelAvatarWrap: {
        marginBottom: 8,
    },
    reelAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    reelAvatarText: {
        fontFamily: fonts.bold,
        fontSize: 18,
        color: '#FFF',
    },
    reelVerified: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: '#000',
        borderRadius: 8,
    },
    reelActionBtn: {
        alignItems: 'center',
        gap: 3,
    },
    reelActionText: {
        fontFamily: fonts.semibold,
        fontSize: 11,
        color: '#FFF',
    },
    reelInfo: {
        position: 'absolute',
        bottom: 20,
        left: 16,
        right: 70,
    },
    reelUserRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginBottom: 6,
    },
    reelUserName: {
        fontFamily: fonts.bold,
        fontSize: 14,
        color: '#FFF',
    },
    reelTitle: {
        fontFamily: fonts.semibold,
        fontSize: 15,
        color: '#FFF',
        lineHeight: 20,
        marginBottom: 4,
    },
    reelDescription: {
        fontFamily: fonts.regular,
        fontSize: 13,
        color: 'rgba(255,255,255,0.8)',
        lineHeight: 18,
        marginBottom: 8,
    },
    reelTags: {
        flexDirection: 'row',
        gap: 6,
        flexWrap: 'wrap',
    },
    reelTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    reelTagText: {
        fontFamily: fonts.medium,
        fontSize: 10,
        color: '#FFF',
    },
    playOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    playButton: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingLeft: 4,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    loadingText: {
        fontFamily: fonts.medium,
        fontSize: 14,
        color: colors.textMuted,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        backgroundColor: colors.background,
    },
    emptyIconWrap: {
        marginBottom: 20,
    },
    emptyIconCircle: {
        width: 96,
        height: 96,
        borderRadius: 48,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    emptyTitle: {
        fontFamily: fonts.bold,
        fontSize: 20,
        color: colors.text,
        marginBottom: 8,
    },
    emptySubtitle: {
        fontFamily: fonts.regular,
        fontSize: 14,
        color: colors.textMuted,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 28,
    },
    emptyFeatures: {
        gap: 14,
    },
    emptyFeatureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    emptyFeatureText: {
        fontFamily: fonts.medium,
        fontSize: 13,
        color: colors.textSecondary,
    },
});
