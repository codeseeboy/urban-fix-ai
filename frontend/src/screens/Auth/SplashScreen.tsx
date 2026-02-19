import React, { useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, Animated, Image, Dimensions,
    Easing, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';

const { width, height } = Dimensions.get('window');
const TITLE = 'UrbanFix AI';
const SLOGAN_WORDS = ['Detect', '•', 'Report', '•', 'Improve'];

export default function SplashScreen() {
    const insets = useSafeAreaInsets();

    // Logo
    const logoScale = useRef(new Animated.Value(0.3)).current;
    const logoOpacity = useRef(new Animated.Value(0)).current;

    // Glow ring
    const glowAnim = useRef(new Animated.Value(0.3)).current;
    const glowScale = useRef(new Animated.Value(0.8)).current;

    // Title letters
    const titleLetterAnims = useRef(
        TITLE.split('').map(() => ({
            opacity: new Animated.Value(0),
            translateY: new Animated.Value(24),
        }))
    ).current;

    // Slogan words
    const sloganWordAnims = useRef(
        SLOGAN_WORDS.map(() => ({
            opacity: new Animated.Value(0),
            scale: new Animated.Value(0.6),
        }))
    ).current;

    // Scan line
    const scanY = useRef(new Animated.Value(-2)).current;
    const scanOpacity = useRef(new Animated.Value(0)).current;

    // Grid fade
    const gridOpacity = useRef(new Animated.Value(0)).current;

    // Bottom line + version
    const lineWidth = useRef(new Animated.Value(0)).current;
    const versionOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Phase 0: Grid background fades in
        Animated.timing(gridOpacity, {
            toValue: 0.06,
            duration: 1200,
            useNativeDriver: true,
        }).start();

        // Phase 0b: Scan line starts
        Animated.sequence([
            Animated.timing(scanOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.loop(
                Animated.sequence([
                    Animated.timing(scanY, {
                        toValue: height,
                        duration: 3500,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(scanY, { toValue: -2, duration: 0, useNativeDriver: true }),
                ])
            ),
        ]).start();

        // Phase 1: Logo entrance (0ms)
        Animated.parallel([
            Animated.spring(logoScale, {
                toValue: 1,
                friction: 5,
                tension: 50,
                useNativeDriver: true,
            }),
            Animated.timing(logoOpacity, {
                toValue: 1,
                duration: 700,
                useNativeDriver: true,
            }),
        ]).start();

        // Phase 1b: Glow pulse loop
        Animated.loop(
            Animated.parallel([
                Animated.sequence([
                    Animated.timing(glowAnim, { toValue: 0.8, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                    Animated.timing(glowAnim, { toValue: 0.2, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                ]),
                Animated.sequence([
                    Animated.timing(glowScale, { toValue: 1.15, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                    Animated.timing(glowScale, { toValue: 0.85, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                ]),
            ])
        ).start();

        // Phase 2: Title letter cascade (after 600ms)
        const titleAnims = titleLetterAnims.map((anim, i) =>
            Animated.parallel([
                Animated.timing(anim.opacity, {
                    toValue: 1,
                    duration: 250,
                    delay: 600 + i * 70,
                    useNativeDriver: true,
                }),
                Animated.timing(anim.translateY, {
                    toValue: 0,
                    duration: 350,
                    delay: 600 + i * 70,
                    easing: Easing.out(Easing.back(1.3)),
                    useNativeDriver: true,
                }),
            ])
        );
        Animated.parallel(titleAnims).start();

        // Phase 3: Slogan words pop in
        const sloganStart = 600 + TITLE.length * 70 + 250;
        const sloganAnims = sloganWordAnims.map((anim, i) =>
            Animated.parallel([
                Animated.timing(anim.opacity, {
                    toValue: 1,
                    duration: 300,
                    delay: sloganStart + i * 150,
                    useNativeDriver: true,
                }),
                Animated.spring(anim.scale, {
                    toValue: 1,
                    friction: 7,
                    tension: 80,
                    delay: sloganStart + i * 150,
                    useNativeDriver: true,
                }),
            ])
        );
        Animated.parallel(sloganAnims).start();

        // Phase 4: Accent line
        const lineStart = sloganStart + SLOGAN_WORDS.length * 150 + 200;
        Animated.sequence([
            Animated.delay(lineStart),
            Animated.timing(lineWidth, {
                toValue: 80,
                duration: 600,
                easing: Easing.out(Easing.exp),
                useNativeDriver: false,
            }),
        ]).start();

        // Phase 5: Version
        Animated.sequence([
            Animated.delay(lineStart + 300),
            Animated.timing(versionOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]).start();
    }, []);

    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            {/* Deep gradient background */}
            <LinearGradient
                colors={['#060610', '#0D1B2A', '#0A0A14']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
            />

            {/* Grid overlay */}
            <Animated.View style={[styles.gridContainer, { opacity: gridOpacity }]}>
                {[...Array(12)].map((_, i) => (
                    <View key={`v-${i}`} style={[styles.gridV, { left: `${(i + 1) * 8}%` }]} />
                ))}
                {[...Array(20)].map((_, i) => (
                    <View key={`h-${i}`} style={[styles.gridH, { top: `${(i + 1) * 5}%` }]} />
                ))}
            </Animated.View>

            {/* Scan line beam */}
            <Animated.View
                style={[
                    styles.scanBeam,
                    { opacity: scanOpacity, transform: [{ translateY: scanY }] },
                ]}
            >
                <LinearGradient
                    colors={['transparent', 'rgba(0,122,255,0.12)', 'transparent']}
                    style={{ flex: 1 }}
                />
            </Animated.View>

            {/* Glow ring behind logo */}
            <Animated.View style={[styles.glowRing, { opacity: glowAnim, transform: [{ scale: glowScale }] }]}>
                <LinearGradient
                    colors={['rgba(0,122,255,0.20)', 'rgba(0,122,255,0.04)', 'transparent']}
                    style={styles.glowGrad}
                    start={{ x: 0.5, y: 0.5 }}
                    end={{ x: 1, y: 1 }}
                />
            </Animated.View>

            {/* Content */}
            <View style={styles.content}>
                {/* Logo */}
                <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
                    <View style={styles.logoWrap}>
                        <Image
                            source={require('../../../assets/logo.png')}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                    </View>
                </Animated.View>

                {/* Title: letter cascade */}
                <View style={styles.titleRow}>
                    {TITLE.split('').map((letter, i) => (
                        <Animated.Text
                            key={i}
                            style={[
                                styles.titleLetter,
                                letter === ' ' && { width: 8 },
                                {
                                    opacity: titleLetterAnims[i].opacity,
                                    transform: [{ translateY: titleLetterAnims[i].translateY }],
                                },
                            ]}
                            allowFontScaling={false}
                        >
                            {letter}
                        </Animated.Text>
                    ))}
                </View>

                {/* Slogan: word pop */}
                <View style={styles.sloganRow}>
                    {SLOGAN_WORDS.map((word, i) => (
                        <Animated.Text
                            key={i}
                            style={[
                                styles.sloganWord,
                                word === '•' && styles.sloganDot,
                                {
                                    opacity: sloganWordAnims[i].opacity,
                                    transform: [{ scale: sloganWordAnims[i].scale }],
                                },
                            ]}
                            allowFontScaling={false}
                        >
                            {word}
                        </Animated.Text>
                    ))}
                </View>

                {/* Accent gradient line */}
                <Animated.View style={[styles.accentLine, { width: lineWidth }]}>
                    <LinearGradient
                        colors={[colors.primary, '#00D4FF']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{ flex: 1, borderRadius: 2 }}
                    />
                </Animated.View>

                {/* Version */}
                <Animated.Text style={[styles.versionText, { opacity: versionOpacity }]}
                    allowFontScaling={false}>
                    v1.1.0
                </Animated.Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, overflow: 'hidden' },
    gridContainer: { ...StyleSheet.absoluteFillObject },
    gridV: {
        position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(255,255,255,0.5)',
    },
    gridH: {
        position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(255,255,255,0.5)',
    },
    scanBeam: {
        position: 'absolute', left: 0, right: 0, height: 120, zIndex: 1,
    },
    glowRing: {
        position: 'absolute',
        top: height * 0.22,
        left: width * 0.08,
        width: width * 0.84,
        height: width * 0.84,
        borderRadius: width * 0.42,
    },
    glowGrad: { flex: 1, borderRadius: width * 0.42 },
    content: {
        flex: 1, justifyContent: 'center', alignItems: 'center',
        paddingBottom: 80, zIndex: 10,
    },
    logoWrap: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 25,
        elevation: 15,
    },
    logo: { width: 120, height: 120 },
    titleRow: {
        flexDirection: 'row',
        marginTop: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    titleLetter: {
        fontFamily: 'Inter_900Black',
        fontSize: 34,
        color: '#FFFFFF',
        includeFontPadding: false,
    },
    sloganRow: {
        flexDirection: 'row',
        marginTop: 10,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
    },
    sloganWord: {
        fontFamily: 'Inter_500Medium',
        fontSize: 14,
        color: 'rgba(255,255,255,0.45)',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        includeFontPadding: false,
    },
    sloganDot: {
        color: colors.primary,
        fontSize: 16,
    },
    accentLine: {
        height: 3,
        marginTop: 28,
        borderRadius: 2,
        overflow: 'hidden',
    },
    versionText: {
        fontFamily: 'Inter_400Regular',
        fontSize: 11,
        color: 'rgba(255,255,255,0.15)',
        marginTop: 16,
        letterSpacing: 2,
        includeFontPadding: false,
    },
});
