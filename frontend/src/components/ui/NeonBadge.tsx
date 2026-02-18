import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

interface NeonBadgeProps {
    label: string;
    severity?: 'High' | 'Medium' | 'Low' | 'Critical';
}

export const NeonBadge = ({ label, severity = 'Low' }: NeonBadgeProps) => {
    let badgeColor = colors.success;
    let glowColor = 'rgba(48, 209, 88, 0.4)';

    if (severity === 'Medium') {
        badgeColor = colors.accent;
        glowColor = 'rgba(255, 214, 10, 0.4)';
    } else if (severity === 'High') {
        badgeColor = colors.error;
        glowColor = 'rgba(255, 69, 58, 0.4)';
    } else if (severity === 'Critical') {
        badgeColor = '#FF0000';
        glowColor = 'rgba(255, 0, 0, 0.6)';
    }

    return (
        <View style={[styles.container, { borderColor: badgeColor, shadowColor: badgeColor }]}>
            <View style={[styles.glow, { backgroundColor: glowColor }]} />
            <Text style={[styles.text, { color: badgeColor }]}>{label}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderWidth: 1,
        alignSelf: 'flex-start',
        position: 'relative',
        overflow: 'hidden',
        // Shadow for iOS neon effect
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 8,
        // Elevation for Android
        elevation: 5,
    },
    glow: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.2,
    },
    text: {
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    }
});
