import React, { useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, Animated, Dimensions, Easing,
    ImageBackground, Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';

const { width, height } = Dimensions.get('window');

// Particle configuration
const PARTICLE_COUNT = 20;
const PARTICLES = Array.from({ length: PARTICLE_COUNT }).map((_, i) => ({
    id: i,
    x: Math.random() * width,
    y: Math.random() * height,
    size: Math.random() * 3 + 1,
    duration: Math.random() * 2000 + 1500,
    delay: Math.random() * 1000,
}));

export default function SplashScreen() {
    const insets = useSafeAreaInsets();

    // ─── ANIMATIONS ─────────────────────────────────────────────────────────
    const logoScale = useRef(new Animated.Value(0)).current;
    const logoOpacity = useRef(new Animated.Value(0)).current;
    const textSlide = useRef(new Animated.Value(50)).current;
    const textOpacity = useRef(new Animated.Value(0)).current;
    const subTextOpacity = useRef(new Animated.Value(0)).current;
    const gridTranslateY = useRef(new Animated.Value(0)).current;
    const pulseScale = useRef(new Animated.Value(1)).current;
    const pulseOpacity = useRef(new Animated.Value(0.6)).current;

    // Font loading check (managed in App.tsx but good to have safety here too)
    const [fontsLoaded] = useFonts({
        'Inter_900Black': require('../../assets/fonts/Inter-Black.ttf'),
        'Inter_700Bold': require('../../assets/fonts/Inter-Bold.ttf'),
        'Inter_600SemiBold': require('../../assets/fonts/Inter-SemiBold.ttf'),
        'Inter_400Regular': require('../../assets/fonts/Inter-Regular.ttf'),
    });

    useEffect(() => {
        // 1. Grid movement loop (Infinite floor effect)
        Animated.loop(
            Animated.timing(gridTranslateY, {
                toValue: 100, // Move down by one grid cell size
                duration: 3000,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        ).start();

        // 2. Pulse effect loop
        Animated.loop(
            Animated.parallel([
                Animated.sequence([
                    Animated.timing(pulseScale, { toValue: 1.5, duration: 1500, useNativeDriver: true }),
                    Animated.timing(pulseScale, { toValue: 1, duration: 0, useNativeDriver: true }),
                ]),
                Animated.sequence([
                    Animated.timing(pulseOpacity, { toValue: 0, duration: 1500, useNativeDriver: true }),
                    Animated.timing(pulseOpacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
                ])
            ])
        ).start();

        // 3. Entrance Sequence
        Animated.sequence([
            // Logo pop
            Animated.parallel([
                Animated.spring(logoScale, {
                    toValue: 1,
                    friction: 6,
                    tension: 40,
                    useNativeDriver: true,
                }),
                Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
            ]),
            // Text slide up
            Animated.parallel([
                Animated.timing(textSlide, {
                    toValue: 0,
                    duration: 800,
                    easing: Easing.out(Easing.back(1.5)),
                    useNativeDriver: true,
                }),
                Animated.timing(textOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
            ]),
            // Subtext fade
            Animated.timing(subTextOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        ]).start();

    }, []);

    // ─── RENDERERS ──────────────────────────────────────────────────────────

    // Grid lines generator
    const renderGrid = () => {
        return (
            <Animated.View style={[
                styles.gridContainer,
                {
                    transform: [
                        { perspective: 800 },
                        { rotateX: '60deg' },
                        { translateY: gridTranslateY }
                    ]
                }
            ]}>
                {/* Horizontal lines */}
                {Array.from({ length: 20 }).map((_, i) => (
                    <View key={`h-${i}`} style={[styles.gridLine, { top: i * 50 - 500 }]} />
                ))}
                {/* Vertical lines */}
                {Array.from({ length: 15 }).map((_, i) => (
                    <View key={`v-${i}`} style={[styles.gridLineVertical, { left: i * 50 - width / 2 }]} />
                ))}
            </Animated.View>
        );
    };

    // Particle generator
    const renderParticles = () => {
        return PARTICLES.map((p) => {
            const anim = useRef(new Animated.Value(0)).current;

            useEffect(() => {
                const loop = Animated.loop(
                    Animated.sequence([
                        Animated.timing(anim, { toValue: 1, duration: p.duration / 2, useNativeDriver: true }),
                        Animated.timing(anim, { toValue: 0, duration: p.duration / 2, useNativeDriver: true }),
                    ])
                );
                setTimeout(() => loop.start(), p.delay);
            }, []);

            return (
                <Animated.View
                    key={p.id}
                    style={[
                        styles.particle,
                        {
                            left: p.x, top: p.y, width: p.size, height: p.size,
                            opacity: anim,
                        }
                    ]}
                />
            );
        });
    };

    if (!fontsLoaded) return null;

    return (
        <View style={styles.container}>
            {/* Background Gradient */}
            <LinearGradient
                colors={['#020205', '#0A0F1E', '#16213E']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
            />

            {/* 3D Perspective Grid Floor */}
            <View style={styles.floorContainer}>
                {renderGrid()}
                <LinearGradient
                    colors={['#020205', 'transparent']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 0.6 }} // Fade grid into distance
                />
            </View>

            {/* Floating Particles */}
            {renderParticles()}

            {/* Content Center */}
            <View style={styles.centerContent}>
                {/* Pulse Ring */}
                <Animated.View style={[
                    styles.pulseRing,
                    {
                        transform: [{ scale: pulseScale }],
                        opacity: pulseOpacity,
                    }
                ]} />

                {/* Logo Icon */}
                <Animated.View style={[
                    styles.logoWrapper,
                    { opacity: logoOpacity, transform: [{ scale: logoScale }] }
                ]}>
                    <LinearGradient
                        colors={[colors.primary, '#4facfe']}
                        style={styles.logoGradient}
                    >
                        <Ionicons name="business" size={48} color="#FFF" />
                    </LinearGradient>
                </Animated.View>

                {/* Text Group */}
                <Animated.View style={{
                    opacity: textOpacity,
                    transform: [{ translateY: textSlide }],
                    alignItems: 'center',
                    marginTop: 30
                }}>
                    <Text style={styles.title} allowFontScaling={false}>
                        Urban<Text style={{ color: colors.primary }}>Fix</Text> AI
                    </Text>

                    <Animated.Text style={[styles.subtitle, { opacity: subTextOpacity }]} allowFontScaling={false}>
                        Civic Intelligence for Smart Cities
                    </Animated.Text>
                </Animated.View>
            </View>

            {/* Bottom Branding */}
            <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 20 }]}>
                <Text style={styles.version} allowFontScaling={false}>v1.0.0 Production Build</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#020205',
        overflow: 'hidden',
    },
    floorContainer: {
        position: 'absolute',
        bottom: -200,
        width: width,
        height: height * 0.6,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.3,
    },
    gridContainer: {
        width: 1000,
        height: 1000,
        position: 'absolute',
    },
    gridLine: {
        position: 'absolute',
        left: 0, right: 0,
        height: 1,
        backgroundColor: colors.primary,
        opacity: 0.5,
    },
    gridLineVertical: {
        position: 'absolute',
        top: -500, bottom: 0,
        width: 1,
        backgroundColor: colors.primary,
        opacity: 0.3,
    },
    particle: {
        position: 'absolute',
        backgroundColor: colors.primaryLight,
        borderRadius: 2,
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    pulseRing: {
        position: 'absolute',
        width: 180,
        height: 180,
        borderRadius: 90,
        borderWidth: 1,
        borderColor: colors.primary,
        backgroundColor: 'rgba(0,122,255,0.05)',
    },
    logoWrapper: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 15,
    },
    logoGradient: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    title: {
        fontFamily: 'Inter_900Black',
        fontSize: 42,
        color: '#FFF',
        letterSpacing: -1,
        textShadowColor: 'rgba(0,122,255,0.5)',
        textShadowOffset: { width: 0, height: 4 },
        textShadowRadius: 10,
    },
    subtitle: {
        fontFamily: 'Inter_500Medium',
        fontSize: 14,
        color: 'rgba(255,255,255,0.6)',
        marginTop: 8,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        alignItems: 'center',
    },
    version: {
        fontFamily: 'Inter_400Regular',
        fontSize: 10,
        color: 'rgba(255,255,255,0.2)',
    },
});
