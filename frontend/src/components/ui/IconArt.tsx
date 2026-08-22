import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../../theme/colors';

type ArtKind = 'report' | 'ai' | 'route' | 'community' | 'alerts' | 'feed' | 'location';

type Props = {
    kind: ArtKind;
    size?: number;
};

const PRESETS: Record<ArtKind, { bg: string; ring: string; icon: keyof typeof Ionicons.glyphMap; accent: string; chips: { icon: keyof typeof Ionicons.glyphMap; color: string }[] }> = {
    report: {
        bg: '#DBEAFE',
        ring: '#BFDBFE',
        icon: 'camera',
        accent: colors.primary,
        chips: [
            { icon: 'alert-circle', color: '#F59E0B' },
            { icon: 'location', color: colors.primary },
        ],
    },
    ai: {
        bg: '#E0F2FE',
        ring: '#BAE6FD',
        icon: 'scan',
        accent: '#0284C7',
        chips: [
            { icon: 'sparkles', color: '#7C3AED' },
            { icon: 'hardware-chip', color: '#0284C7' },
        ],
    },
    route: {
        bg: '#DCFCE7',
        ring: '#BBF7D0',
        icon: 'navigate',
        accent: colors.success,
        chips: [
            { icon: 'construct', color: '#0F766E' },
            { icon: 'checkmark-circle', color: colors.success },
        ],
    },
    community: {
        bg: '#FEF3C7',
        ring: '#FDE68A',
        icon: 'people',
        accent: '#D97706',
        chips: [
            { icon: 'heart', color: '#EF4444' },
            { icon: 'trophy', color: '#D97706' },
        ],
    },
    alerts: {
        bg: '#DBEAFE',
        ring: '#BFDBFE',
        icon: 'notifications',
        accent: colors.primary,
        chips: [{ icon: 'checkmark-done', color: colors.success }],
    },
    feed: {
        bg: '#E0E7FF',
        ring: '#C7D2FE',
        icon: 'newspaper',
        accent: '#4F46E5',
        chips: [{ icon: 'add-circle', color: colors.primary }],
    },
    location: {
        bg: '#DBEAFE',
        ring: '#BFDBFE',
        icon: 'locate',
        accent: colors.primary,
        chips: [{ icon: 'map', color: '#0EA5E9' }],
    },
};

export default function IconArt({ kind, size = 220 }: Props) {
    const preset = PRESETS[kind];
    const inner = size * 0.42;

    return (
        <View style={[styles.stage, { width: size, height: size, backgroundColor: preset.bg }]}>
            <View style={[styles.ring, { width: size * 0.72, height: size * 0.72, borderColor: preset.ring }]} />
            <View style={[styles.core, { width: inner, height: inner, backgroundColor: colors.surface }]}>
                <Ionicons name={preset.icon} size={inner * 0.48} color={preset.accent} />
            </View>
            {preset.chips.map((chip, i) => (
                <View
                    key={chip.icon}
                    style={[
                        styles.chip,
                        i === 0 ? styles.chipA : styles.chipB,
                        { backgroundColor: colors.surface },
                    ]}
                >
                    <Ionicons name={chip.icon} size={18} color={chip.color} />
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    stage: {
        borderRadius: radius.xxl,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
    },
    ring: {
        position: 'absolute',
        borderRadius: 999,
        borderWidth: 10,
    },
    core: {
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 18,
        elevation: 4,
    },
    chip: {
        position: 'absolute',
        width: 40,
        height: 40,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 3,
    },
    chipA: { top: 18, right: 18 },
    chipB: { bottom: 22, left: 16 },
});
