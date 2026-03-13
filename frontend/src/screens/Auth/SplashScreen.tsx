import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import AuthCanvas from '../../components/auth/AuthCanvas';

export default function SplashScreen() {
    const insets = useSafeAreaInsets();

    // ─── ANIMATIONS ─────────────────────────────────────────────────────────
    const logoScale = useRef(new Animated.Value(0.8)).current;
    const logoOpacity = useRef(new Animated.Value(0)).current;
    const textSlide = useRef(new Animated.Value(18)).current;
    const textOpacity = useRef(new Animated.Value(0)).current;
    const taglineOpacity = useRef(new Animated.Value(0)).current;
    const ringScale = useRef(new Animated.Value(1)).current;
    const ringOpacity = useRef(new Animated.Value(0.38)).current;

    useEffect(() => {
        Animated.loop(
            Animated.parallel([
                Animated.sequence([
                    Animated.timing(ringScale, {
                        toValue: 1.35,
                        duration: 1400,
                        easing: Easing.out(Easing.quad),
                        useNativeDriver: true,
                    }),
                    Animated.timing(ringScale, { toValue: 1, duration: 0, useNativeDriver: true }),
                ]),
                Animated.sequence([
                    Animated.timing(ringOpacity, { toValue: 0.06, duration: 1400, useNativeDriver: true }),
                    Animated.timing(ringOpacity, { toValue: 0.38, duration: 0, useNativeDriver: true }),
                ]),
            ])
        ).start();

        Animated.sequence([
            Animated.parallel([
                Animated.spring(logoScale, {
                    toValue: 1,
                    friction: 7,
                    tension: 65,
                    useNativeDriver: true,
                }),
                Animated.timing(logoOpacity, { toValue: 1, duration: 520, useNativeDriver: true }),
            ]),
            Animated.parallel([
                Animated.timing(textSlide, {
                    toValue: 0,
                    duration: 450,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.timing(textOpacity, { toValue: 1, duration: 420, useNativeDriver: true }),
            ]),
            Animated.timing(taglineOpacity, { toValue: 1, duration: 480, useNativeDriver: true }),
        ]).start();
    }, [logoScale, logoOpacity, textSlide, textOpacity, taglineOpacity, ringScale, ringOpacity]);

    return (
        <View style={styles.container}>
            <AuthCanvas />

            <View style={styles.centerContent}>
                <Animated.View style={[
                    styles.pulseRing,
                    {
                        transform: [{ scale: ringScale }],
                        opacity: ringOpacity,
                    },
                ]} />

                <Animated.View style={[
                    styles.logoWrapper,
                    { opacity: logoOpacity, transform: [{ scale: logoScale }] },
                ]}>
                    <LinearGradient
                        colors={['rgba(0,122,255,0.22)', 'rgba(0,122,255,0.08)']}
                        style={styles.logoGradient}
                    >
                        <Image
                            source={require('../../../assets/logo.png')}
                            style={{ width: 80, height: 80, borderRadius: 40 }}
                            resizeMode="contain"
                        />
                    </LinearGradient>
                </Animated.View>

                <Animated.View style={{
                    opacity: textOpacity,
                    transform: [{ translateY: textSlide }],
                    alignItems: 'center',
                    marginTop: 26,
                }}>
                    <Text style={styles.title} allowFontScaling={false}>
                        Urban<Text style={{ color: colors.primary }}>Fix</Text> AI
                    </Text>

                    <Animated.Text style={[styles.subtitle, { opacity: taglineOpacity }]} allowFontScaling={false}>
                        Report smarter. Resolve faster.
                    </Animated.Text>
                </Animated.View>
            </View>

            <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 20 }]}>
                <Text style={styles.version} allowFontScaling={false}>UrbanFix AI • Civic Platform</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#05070F',
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    pulseRing: {
        position: 'absolute',
        width: 170,
        height: 170,
        borderRadius: 85,
        borderWidth: 1.2,
        borderColor: colors.primary,
        backgroundColor: 'rgba(0,122,255,0.07)',
    },
    logoWrapper: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.42,
        shadowRadius: 16,
        elevation: 15,
    },
    logoGradient: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.24)',
    },
    title: {
        fontFamily: 'Inter_700Bold',
        fontSize: 40,
        color: '#FFF',
        letterSpacing: -1,
        textShadowColor: 'rgba(0,122,255,0.35)',
        textShadowOffset: { width: 0, height: 4 },
        textShadowRadius: 12,
    },
    subtitle: {
        fontFamily: 'Inter_500Medium',
        fontSize: 13,
        color: 'rgba(255,255,255,0.68)',
        marginTop: 8,
        letterSpacing: 0.2,
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
        color: 'rgba(255,255,255,0.28)',
    },
});
