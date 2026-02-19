/**
 * StoriesRow — Instagram-style stories/highlights row for municipal accounts
 * Shows circular avatars with gradient ring, shimmer on load
 */
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../theme/colors';

interface StoryItem {
    id: string;
    name: string;
    avatar?: string;
    hasUpdate?: boolean;
    isUser?: boolean;
    verified?: boolean;
}

interface StoriesRowProps {
    stories: StoryItem[];
    onStoryPress: (story: StoryItem) => void;
    onAddStory?: () => void;
}

function StoryBubble({ item, onPress, index }: { item: StoryItem; onPress: () => void; index: number }) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.8)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                delay: index * 60,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 6,
                tension: 80,
                delay: index * 60,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const initials = (item.name || 'U')[0].toUpperCase();

    return (
        <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity style={styles.storyItem} onPress={onPress} activeOpacity={0.8}>
                {/* Gradient ring */}
                <LinearGradient
                    colors={
                        item.isUser
                            ? [colors.border, colors.border]
                            : item.hasUpdate
                                ? ['#007AFF', '#8B5CF6', '#EC4899']
                                : [colors.border, colors.borderLight]
                    }
                    style={styles.storyRing}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                >
                    <View style={styles.storyAvatarContainer}>
                        {item.isUser ? (
                            <View style={styles.addStoryInner}>
                                <Ionicons name="add" size={24} color={colors.primary} />
                            </View>
                        ) : item.avatar ? (
                            <Image source={{ uri: item.avatar }} style={styles.storyAvatar} />
                        ) : (
                            <LinearGradient
                                colors={['#6366F1', '#8B5CF6']}
                                style={styles.storyAvatar}
                            >
                                <Text style={styles.storyInitial}>{initials}</Text>
                            </LinearGradient>
                        )}
                    </View>
                </LinearGradient>

                {/* Verified badge */}
                {item.verified && (
                    <View style={styles.verifiedBadge}>
                        <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                    </View>
                )}

                {/* Name */}
                <Text style={styles.storyName} numberOfLines={1}>
                    {item.isUser ? 'You' : item.name?.split(' ')[0]}
                </Text>
            </TouchableOpacity>
        </Animated.View>
    );
}

export default function StoriesRow({ stories, onStoryPress, onAddStory, showAddStory = true }: StoriesRowProps & { showAddStory?: boolean }) {
    // Prepend "You" story if enabled
    const data: StoryItem[] = showAddStory
        ? [{ id: 'user-story', name: 'You', isUser: true }, ...stories]
        : stories;

    return (
        <View style={styles.container}>
            <FlatList
                horizontal
                data={data}
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                renderItem={({ item, index }) => (
                    <StoryBubble
                        item={item}
                        index={index}
                        onPress={() => item.isUser ? onAddStory?.() : onStoryPress(item)}
                    />
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 8,
    },
    listContent: {
        paddingHorizontal: 16,
        gap: 14,
    },
    storyItem: {
        alignItems: 'center',
        width: 68,
    },
    storyRing: {
        width: 64,
        height: 64,
        borderRadius: 32,
        padding: 2.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    storyAvatarContainer: {
        width: '100%',
        height: '100%',
        borderRadius: 30,
        overflow: 'hidden',
        backgroundColor: colors.background,
        borderWidth: 2,
        borderColor: colors.background,
    },
    addStoryInner: {
        flex: 1,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 28,
    },
    storyAvatar: {
        width: '100%',
        height: '100%',
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    storyInitial: {
        fontFamily: fonts.bold,
        color: '#FFF',
        fontSize: 20,
    },
    storyName: {
        fontFamily: fonts.medium,
        fontSize: 10,
        color: colors.textSecondary,
        marginTop: 5,
        textAlign: 'center',
    },
    verifiedBadge: {
        position: 'absolute',
        bottom: 18,
        right: 2,
        backgroundColor: colors.background,
        borderRadius: 10,
    },
});
