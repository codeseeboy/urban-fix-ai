import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Image, Dimensions, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';

const { width, height } = Dimensions.get('window');
const TITLE = 'UrbanFix AI';
const SLOGAN = 'Detect • Report • Improve';

export default function SplashScreen() {
    // Logo animations
    const logoScale = useRef(new Animated.Value(0.3)).current;
    const logoOpacity = useRef(new Animated.Value(0)).current;
    const logoRotateZ = useRef(new Animated.Value(-10)).current;

    // Glow ring animation
    const glowAnim = useRef(new Animated.Value(0.4)).current;
    const glowScale = useRef(new Animated.Value(0.8)).current;

    // Title letter animations (each letter fades + slides in)
    const titleLetterAnims = useRef(
        TITLE.split('').map(() => ({
            opacity: new Animated.Value(0),
            translateY: new Animated.Value(30),
        }))
    ).current;

    // Slogan word animations
    const sloganWordAnims = useRef(
        SLOGAN.split(' ').map(() => ({
            opacity: new Animated.Value(0),
            scale: new Animated.Value(0.5),
        }))
    ).current;

    // Bottom line animation
    const lineWidth = useRef(new Animated.Value(0)).current;
    const lineOpacity = useRef(new Animated.Value(0)).current;

    // Version fade
    const versionOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Phase 1: Logo entrance (0ms - 800ms)
        Animated.parallel([
            Animated.spring(logoScale, {
                toValue: 1,
                friction: 5,
                tension: 60,
                useNativeDriver: true,
            }),
            Animated.timing(logoOpacity, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }),
            Animated.timing(logoRotateZ, {
                toValue: 0,
                duration: 800,
                easing: Easing.out(Easing.back(1.5)),
                useNativeDriver: true,
            }),
        ]).start();

        // Phase 1b: Glow pulse loop (starts with logo)
        Animated.loop(
            Animated.parallel([
                Animated.sequence([
                    Animated.timing(glowAnim, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                    Animated.timing(glowAnim, { toValue: 0.3, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                ]),
                Animated.sequence([
                    Animated.timing(glowScale, { toValue: 1.2, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                    Animated.timing(glowScale, { toValue: 0.8, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                ]),
            ])
        ).start();

        // Phase 2: Title letters cascade (600ms start, 50ms per letter)
        const titleAnimations = titleLetterAnims.map((anim, i) =>
            Animated.parallel([
                Animated.timing(anim.opacity, {
                    toValue: 1,
                    duration: 300,
                    delay: 700 + i * 80,
                    useNativeDriver: true,
                }),
                Animated.timing(anim.translateY, {
                    toValue: 0,
                    duration: 400,
                    delay: 700 + i * 80,
                    easing: Easing.out(Easing.back(1.2)),
                    useNativeDriver: true,
                }),
            ])
        );
        Animated.parallel(titleAnimations).start();

        // Phase 3: Slogan words pop in (after title)
        const sloganDelay = 700 + TITLE.length * 80 + 300;
        const sloganAnimations = sloganWordAnims.map((anim, i) =>
            Animated.parallel([
                Animated.timing(anim.opacity, {
                    toValue: 1,
                    duration: 400,
                    delay: sloganDelay + i * 200,
                    useNativeDriver: true,
                }),
                Animated.spring(anim.scale, {
                    toValue: 1,
                    friction: 6,
                    tension: 80,
                    delay: sloganDelay + i * 200,
                    useNativeDriver: true,
                }),
            ])
        );
        Animated.parallel(sloganAnimations).start();

        // Phase 4: Bottom accent line sweeps in
        const lineDelay = sloganDelay + SLOGAN.split(' ').length * 200 + 200;
        Animated.sequence([
            Animated.delay(lineDelay),
            Animated.parallel([
                Animated.timing(lineOpacity, { toValue: 1, duration: 300, useNativeDriver: false }),
                Animated.timing(lineWidth, { toValue: 80, duration: 600, easing: Easing.out(Easing.exp), useNativeDriver: false }),
            ]),
        ]).start();

        // Phase 5: Version text
        Animated.sequence([
            Animated.delay(lineDelay + 400),
            Animated.timing(versionOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]).start();
    }, []);

    const logoSpin = logoRotateZ.interpolate({
        inputRange: [-10, 0],
        outputRange: ['-10deg', '0deg'],
    });

    return (
        <View style={styles.container}>
            {/* Gradient background */}
            <LinearGradient
                colors={['#0A0A14', '#0D1B2A', '#0A0A14']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />

            {/* Subtle radial glow behind logo */}
            <Animated.View style={[styles.glowRing, { opacity: glowAnim, transform: [{ scale: glowScale }] }]}>
                <LinearGradient
                    colors={['rgba(0,122,255,0.25)', 'rgba(0,122,255,0.05)', 'transparent']}
                    style={styles.glowGradient}
                    start={{ x: 0.5, y: 0.5 }}
                    end={{ x: 1, y: 1 }}
                />
            </Animated.View>

            {/* Content */}
            <View style={styles.content}>
                {/* Logo with spring + rotation entrance */}
                <Animated.View style={{
                    opacity: logoOpacity,
                    transform: [
                        { scale: logoScale },
                        { rotate: logoSpin },
                    ],
                }}>
                    <View style={styles.logoShadow}>
                        <Image
                            source={require('../../../assets/logo.png')}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                    </View>
                </Animated.View>

                {/* Title: Letter by letter cascade */}
                <View style={styles.titleRow}>
                    {TITLE.split('').map((letter, i) => (
                        <Animated.Text
                            key={i}
                            style={[
                                styles.titleLetter,
                                letter === ' ' && { width: 10 },
                                {
                                    opacity: titleLetterAnims[i].opacity,
                                    transform: [{ translateY: titleLetterAnims[i].translateY }],
                                },
                            ]}
                        >
                            {letter}
                        </Animated.Text>
                    ))}
                </View>

                {/* Slogan: Word by word pop */}
                <View style={styles.sloganRow}>
                    {SLOGAN.split(' ').map((word, i) => (
                        <Animated.Text
                            key={i}
                            style={[
                                styles.sloganWord,
                                {
                                    opacity: sloganWordAnims[i].opacity,
                                    transform: [{ scale: sloganWordAnims[i].scale }],
                                },
                            ]}
                        >
                            {word}{' '}
                        </Animated.Text>
                    ))}
                </View>

                {/* Accent line */}
                <Animated.View style={[styles.accentLine, { width: lineWidth, opacity: lineOpacity }]}>
                    <LinearGradient
                        colors={[colors.primary, '#00D4FF']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{ flex: 1, borderRadius: 2 }}
                    />
                </Animated.View>

                {/* Version badge */}
                <Animated.Text style={[styles.versionText, { opacity: versionOpacity }]}>
                    v1.1.0
                </Animated.Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, overflow: 'hidden' },
    glowRing: {
        position: 'absolute',
        top: height * 0.25,
        left: width * 0.1,
        width: width * 0.8,
        height: width * 0.8,
        borderRadius: width * 0.4,
    },
    glowGradient: { flex: 1, borderRadius: width * 0.4 },
    content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 60 },
    logoShadow: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 30,
        elevation: 20,
    },
    logo: { width: 130, height: 130 },
    titleRow: {
        flexDirection: 'row',
        marginTop: 28,
        justifyContent: 'center',
        flexWrap: 'nowrap',
    },
    titleLetter: {
        fontFamily: 'Inter_900Black',
        fontSize: 40,
        color: '#FFFFFF',
        letterSpacing: -0.5,
    },
    sloganRow: {
        flexDirection: 'row',
        marginTop: 12,
        justifyContent: 'center',
        flexWrap: 'wrap',
    },
    sloganWord: {
        fontFamily: 'Inter_500Medium',
        fontSize: 15,
        color: 'rgba(255,255,255,0.5)',
        letterSpacing: 2,
        textTransform: 'uppercase',
    },
    accentLine: { height: 3, marginTop: 28, borderRadius: 2, overflow: 'hidden' },
    versionText: {
        fontFamily: 'Inter_400Regular',
        fontSize: 11,
        color: 'rgba(255,255,255,0.2)',
        marginTop: 16,
        letterSpacing: 2,
    },
});
