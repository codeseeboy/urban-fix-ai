import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../../theme/colors';

export default function AuthCanvas() {
    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={styles.canvas} />
            <View style={styles.orbTop} />
            <View style={styles.orbBottom} />
        </View>
    );
}

const styles = StyleSheet.create({
    canvas: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: colors.background,
    },
    orbTop: {
        position: 'absolute',
        width: 280,
        height: 280,
        borderRadius: 140,
        top: -90,
        right: -70,
        backgroundColor: '#DBEAFE',
        opacity: 0.7,
    },
    orbBottom: {
        position: 'absolute',
        width: 220,
        height: 220,
        borderRadius: 110,
        bottom: -80,
        left: -60,
        backgroundColor: '#DCFCE7',
        opacity: 0.55,
    },
});
