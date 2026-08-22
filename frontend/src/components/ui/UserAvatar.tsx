import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts } from '../../theme/colors';

type Props = {
    name?: string | null;
    uri?: string | null;
    size?: number;
    style?: ViewStyle;
};

export default function UserAvatar({ name, uri, size = 40, style }: Props) {
    const initials = (name || 'U').trim().charAt(0).toUpperCase() || 'U';
    const radius = size / 2;

    if (uri) {
        return (
            <Image
                source={{ uri }}
                style={[{ width: size, height: size, borderRadius: radius, backgroundColor: colors.surfaceLight }, style]}
                contentFit="cover"
            />
        );
    }

    return (
        <LinearGradient
            colors={[colors.primary, '#4DA3FF']}
            style={[{ width: size, height: size, borderRadius: radius, alignItems: 'center', justifyContent: 'center' }, style]}
        >
            <Text style={[styles.initial, { fontSize: size * 0.38 }]} allowFontScaling={false}>
                {initials}
            </Text>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    initial: {
        fontFamily: fonts.bold,
        color: '#FFF',
    },
});
