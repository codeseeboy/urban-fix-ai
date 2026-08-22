import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ImageSourcePropType } from 'react-native';
import { colors, fonts, radius } from '../../theme/colors';

type Props = {
    image?: ImageSourcePropType;
    title: string;
    subtitle?: string;
    actionLabel?: string;
    onAction?: () => void;
};

export default function EmptyState({ image, title, subtitle, actionLabel, onAction }: Props) {
    return (
        <View style={styles.wrap}>
            {image ? <Image source={image} style={styles.image} resizeMode="cover" /> : null}
            <Text style={styles.title} allowFontScaling={false}>{title}</Text>
            {subtitle ? (
                <Text style={styles.subtitle} allowFontScaling={false}>{subtitle}</Text>
            ) : null}
            {actionLabel && onAction ? (
                <TouchableOpacity style={styles.btn} onPress={onAction} activeOpacity={0.85}>
                    <Text style={styles.btnText} allowFontScaling={false}>{actionLabel}</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        alignItems: 'center',
        paddingTop: 36,
        paddingHorizontal: 28,
        paddingBottom: 40,
    },
    image: {
        width: 220,
        height: 220,
        borderRadius: 28,
        marginBottom: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    title: {
        fontFamily: fonts.semibold,
        color: colors.text,
        fontSize: 18,
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontFamily: fonts.regular,
        color: colors.textSecondary,
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    btn: {
        marginTop: 18,
        backgroundColor: colors.primary,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: radius.md,
    },
    btnText: {
        fontFamily: fonts.semibold,
        color: '#FFF',
        fontSize: 14,
    },
});
