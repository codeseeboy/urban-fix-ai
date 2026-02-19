/**
 * FeedToggle — Premium mechanical-style toggle for Community ↔ Municipal feed
 * Animated spring toggle with haptic-like feedback feel
 */
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, radius } from '../../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOGGLE_WIDTH = SCREEN_WIDTH - 40;
const HALF_WIDTH = (TOGGLE_WIDTH - 6) / 2;

interface FeedToggleProps {
    activeTab: 'community' | 'municipal';
    onToggle: (tab: 'community' | 'municipal') => void;
}

export default function FeedToggle({ activeTab, onToggle }: FeedToggleProps) {
    const slideAnim = useRef(new Animated.Value(activeTab === 'community' ? 0 : 1)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        // Spring animation for slider
        Animated.spring(slideAnim, {
            toValue: activeTab === 'community' ? 0 : 1,
            friction: 7,
            tension: 80,
            useNativeDriver: true,
        }).start();

        // Micro bounce
        Animated.sequence([
            Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
            Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
        ]).start();
    }, [activeTab]);

    const translateX = slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [3, HALF_WIDTH + 3],
    });

    return (
        <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
            {/* Track */}
            <View style={styles.track}>
                {/* Animated slider */}
                <Animated.View style={[styles.slider, { transform: [{ translateX }] }]}>
                    <LinearGradient
                        colors={activeTab === 'community' ? ['#007AFF', '#0055CC'] : ['#8B5CF6', '#6D28D9']}
                        style={styles.sliderGradient}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    />
                </Animated.View>

                {/* Community tab */}
                <TouchableOpacity
                    style={styles.tab}
                    onPress={() => onToggle('community')}
                    activeOpacity={0.8}
                >
                    <Ionicons
                        name="people"
                        size={16}
                        color={activeTab === 'community' ? '#FFF' : colors.textMuted}
                    />
                    <Text style={[
                        styles.tabText,
                        activeTab === 'community' && styles.tabTextActive,
                    ]}>
                        Community
                    </Text>
                </TouchableOpacity>

                {/* Municipal tab */}
                <TouchableOpacity
                    style={styles.tab}
                    onPress={() => onToggle('municipal')}
                    activeOpacity={0.8}
                >
                    <Ionicons
                        name="business"
                        size={16}
                        color={activeTab === 'municipal' ? '#FFF' : colors.textMuted}
                    />
                    <Text style={[
                        styles.tabText,
                        activeTab === 'municipal' && styles.tabTextActive,
                    ]}>
                        Municipal
                    </Text>
                    {/* Live indicator dot for municipal */}
                    <View style={styles.liveDot} />
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
        marginBottom: 6,
    },
    track: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: 16,
        height: 48,
        borderWidth: 1,
        borderColor: colors.border,
        position: 'relative',
        overflow: 'hidden',
    },
    slider: {
        position: 'absolute',
        width: HALF_WIDTH,
        height: 42,
        top: 3,
        borderRadius: 13,
        overflow: 'hidden',
        // Shadow for depth
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    sliderGradient: {
        flex: 1,
        borderRadius: 13,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        zIndex: 2,
    },
    tabText: {
        fontFamily: fonts.semibold,
        fontSize: 13,
        color: colors.textMuted,
        letterSpacing: -0.2,
    },
    tabTextActive: {
        color: '#FFF',
        fontFamily: fonts.bold,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#30D158',
        position: 'absolute',
        top: 12,
        right: 20,
    },
});
