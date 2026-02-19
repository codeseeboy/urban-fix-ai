import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Image, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts } from '../../theme/colors';

const { width, height } = Dimensions.get('window');

export default function SplashScreen() {
    // Animation Values
    const logoScale = useRef(new Animated.Value(0.5)).current;
    const logoOpacity = useRef(new Animated.Value(0)).current;
    // Separate opacity for text and slogan
    const textOpacity = useRef(new Animated.Value(0)).current;
    const sloganOpacity = useRef(new Animated.Value(0)).current;
    const scanLine = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // 1. Logo Animation (Scale + Fade)
        Animated.parallel([
            Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
            Animated.timing(logoOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        ]).start();

        // 2. Text Animation (Fade In) - Delayed
        Animated.sequence([
            Animated.delay(600),
            Animated.timing(textOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        ]).start();

        // 3. Slogan Animation (Fade In) - Delayed more
        Animated.sequence([
            Animated.delay(1200),
            Animated.timing(sloganOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        ]).start();

        // 4. Background Scan Loop
        Animated.loop(
            Animated.sequence([
                Animated.timing(scanLine, { toValue: height, duration: 3000, useNativeDriver: true }),
                Animated.timing(scanLine, { toValue: 0, duration: 0, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    return (
        <View style={styles.container}>
            {/* Background Grid */}
            <View style={styles.gridContainer}>
                {[...Array(10)].map((_, i) => (
                    <View key={`v-${i}`} style={[styles.gridLineV, { left: `${i * 10}%` }]} />
                ))}
                {[...Array(20)].map((_, i) => (
                    <View key={`h-${i}`} style={[styles.gridLineH, { top: `${i * 5}%` }]} />
                ))}
            </View>

            {/* Background Scanning Effect (Behind content) */}
            <Animated.View
                style={[
                    styles.scanBeam,
                    { transform: [{ translateY: scanLine }] }
                ]}
            >
                <LinearGradient
                    colors={['transparent', 'rgba(0,122,255,0.15)', 'transparent']}
                    style={{ flex: 1 }}
                />
            </Animated.View>

            {/* Content */}
            <View style={styles.content}>
                <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
                    <Image
                        source={require('../../../assets/logo.png')}
                        style={styles.logo}
                        resizeMode="contain"
                    />
                </Animated.View>

                <Animated.View style={{ opacity: textOpacity, marginTop: 20 }}>
                    <Text style={styles.title}>UrbanFix AI</Text>
                </Animated.View>

                <Animated.View style={{ opacity: sloganOpacity, marginTop: 8 }}>
                    <Text style={styles.subtitle}>Detect • Report • Improve</Text>
                    {/* Pulse Bar */}
                    <View style={styles.pulseBar}>
                        <PulseIndicator />
                    </View>
                </Animated.View>
            </View>
        </View>
    );
}

// Simple pulsing line
const PulseIndicator = () => {
    const widthAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(widthAnim, { toValue: 60, duration: 1000, useNativeDriver: false }),
                Animated.timing(widthAnim, { toValue: 0, duration: 1000, useNativeDriver: false }),
            ])
        ).start();
    }, []);

    return (
        <Animated.View style={{ height: 3, backgroundColor: colors.primary, width: widthAnim, borderRadius: 2 }} />
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },
    gridContainer: { ...StyleSheet.absoluteFillObject, opacity: 0.1 }, // Low opacity grid
    gridLineV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: '#FFF' },
    gridLineH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#FFF' },
    scanBeam: { position: 'absolute', left: 0, right: 0, height: 150, zIndex: 0 },
    content: { flex: 1, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
    logo: { width: 140, height: 140 }, // Larger logo
    title: { fontFamily: 'Inter_900Black', fontSize: 38, color: '#FFF', letterSpacing: -0.5, textAlign: 'center' },
    subtitle: { fontFamily: 'Inter_500Medium', fontSize: 16, color: colors.textSecondary, letterSpacing: 1.2, textAlign: 'center', textTransform: 'uppercase' }, // Slogan style
    pulseBar: { height: 3, width: 60, marginTop: 24, alignItems: 'center', backgroundColor: colors.surfaceLight, borderRadius: 2, overflow: 'hidden' },
});
