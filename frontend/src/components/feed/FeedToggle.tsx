import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, shadows } from '../../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOGGLE_WIDTH = SCREEN_WIDTH - 40;
const HALF_WIDTH = (TOGGLE_WIDTH - 6) / 2;

interface FeedToggleProps {
    activeTab: 'community' | 'municipal';
    onToggle: (tab: 'community' | 'municipal') => void;
}

export default function FeedToggle({ activeTab, onToggle }: FeedToggleProps) {
    const slideAnim = useRef(new Animated.Value(activeTab === 'community' ? 0 : 1)).current;

    useEffect(() => {
        Animated.spring(slideAnim, {
            toValue: activeTab === 'community' ? 0 : 1,
            friction: 8,
            tension: 80,
            useNativeDriver: true,
        }).start();
    }, [activeTab, slideAnim]);

    const translateX = slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [3, HALF_WIDTH + 3],
    });

    return (
        <View style={styles.container}>
            <View style={styles.track}>
                <Animated.View style={[styles.slider, { transform: [{ translateX }] }]} />
                <TouchableOpacity style={styles.tab} onPress={() => onToggle('community')} activeOpacity={0.8}>
                    <Ionicons name="people" size={16} color={activeTab === 'community' ? colors.primary : colors.textMuted} />
                    <Text style={[styles.tabText, activeTab === 'community' && styles.tabTextActive]}>Community</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tab} onPress={() => onToggle('municipal')} activeOpacity={0.8}>
                    <Ionicons name="business" size={16} color={activeTab === 'municipal' ? colors.primary : colors.textMuted} />
                    <Text style={[styles.tabText, activeTab === 'municipal' && styles.tabTextActive]}>Municipal</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
        marginBottom: 10,
    },
    track: {
        flexDirection: 'row',
        backgroundColor: colors.surfaceLight,
        borderRadius: radius.md,
        height: 46,
        position: 'relative',
    },
    slider: {
        position: 'absolute',
        width: HALF_WIDTH,
        height: 40,
        top: 3,
        borderRadius: 10,
        backgroundColor: colors.surface,
        ...shadows.card,
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
    },
    tabTextActive: {
        color: colors.text,
        fontFamily: fonts.bold,
    },
});
