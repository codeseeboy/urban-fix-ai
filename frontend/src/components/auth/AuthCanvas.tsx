import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';

export default function AuthCanvas() {
    const floatA = useRef(new Animated.Value(0)).current;
    const floatB = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(floatA, { toValue: 1, duration: 7000, useNativeDriver: true }),
                Animated.timing(floatA, { toValue: 0, duration: 7000, useNativeDriver: true }),
            ])
        ).start();

        Animated.loop(
            Animated.sequence([
                Animated.timing(floatB, { toValue: 1, duration: 9000, useNativeDriver: true }),
                Animated.timing(floatB, { toValue: 0, duration: 9000, useNativeDriver: true }),
            ])
        ).start();
    }, [floatA, floatB]);

    const blobATranslateY = floatA.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -18],
    });

    const blobBTranslateY = floatB.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 22],
    });

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <LinearGradient
                colors={['#05070F', '#0B1022', '#0A0A14']}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={StyleSheet.absoluteFill}
            />

            <Animated.View
                style={[
                    styles.blob,
                    styles.blobA,
                    { transform: [{ translateY: blobATranslateY }] },
                ]}
            />
            <Animated.View
                style={[
                    styles.blob,
                    styles.blobB,
                    { transform: [{ translateY: blobBTranslateY }] },
                ]}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    blob: {
        position: 'absolute',
        borderRadius: 999,
    },
    blobA: {
        width: 260,
        height: 260,
        top: -40,
        right: -60,
        backgroundColor: 'rgba(0,122,255,0.16)',
    },
    blobB: {
        width: 220,
        height: 220,
        bottom: -50,
        left: -50,
        backgroundColor: 'rgba(90,200,250,0.10)',
    },
});

