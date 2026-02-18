import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts } from '../../theme/colors';

export default function SplashScreen() {
    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const scanLineAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
            Animated.timing(opacityAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]).start();

        Animated.loop(
            Animated.sequence([
                Animated.timing(scanLineAnim, { toValue: 300, duration: 2500, useNativeDriver: true }),
                Animated.timing(scanLineAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    return (
        <View style={styles.container}>
            {/* Map Grid Background */}
            <View style={styles.gridContainer}>
                {[...Array(20)].map((_, i) => (
                    <View key={`v-${i}`} style={[styles.gridLineV, { left: `${(i * 100) / 20}%` }]} />
                ))}
                {[...Array(40)].map((_, i) => (
                    <View key={`h-${i}`} style={[styles.gridLineH, { top: `${(i * 100) / 40}%` }]} />
                ))}
            </View>

            <LinearGradient colors={['rgba(0,122,255,0.15)', 'transparent']} style={StyleSheet.absoluteFill} />

            <Animated.View style={{ opacity: opacityAnim, transform: [{ scale: scaleAnim }], alignItems: 'center' }}>
                <LinearGradient colors={[colors.primary, '#0055CC']} style={styles.logo}>
                    <Text style={styles.logoText}>U</Text>
                    {/* Scan Line */}
                    <Animated.View
                        style={[
                            styles.scanLine,
                            { transform: [{ translateY: Animated.subtract(scanLineAnim, 100) }] }
                        ]}
                    />
                </LinearGradient>
                <Text style={styles.title}>UrbanFix AI</Text>
                <Text style={styles.subtitle}>Smart Civic Engagement</Text>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
    gridContainer: { ...StyleSheet.absoluteFillObject, opacity: 0.1 },
    gridLineV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: colors.primary },
    gridLineH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: colors.primary },
    logo: {
        width: 100, height: 100, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 20,
        overflow: 'hidden',
        shadowColor: colors.primary, shadowOpacity: 0.5, shadowRadius: 20, elevation: 12,
    },
    scanLine: {
        position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: '#FFF',
        shadowColor: '#FFF', shadowOpacity: 0.8, shadowRadius: 10, elevation: 10,
        opacity: 0.6,
    },
    logoText: { fontFamily: 'Inter_900Black', fontSize: 50, color: '#FFF' },
    title: { fontFamily: 'Inter_900Black', fontSize: 34, color: colors.text, letterSpacing: -1 },
    subtitle: { fontFamily: 'Inter_400Regular', fontSize: 16, color: colors.textSecondary, marginTop: 6 },
});
