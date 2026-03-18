import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, Easing, Image, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');
const LOGO_SIZE = 96;

export default function SplashScreen() {
  const insets = useSafeAreaInsets();

  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;

  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(30)).current;

  const tagOpacity = useRef(new Animated.Value(0)).current;
  const tagSlide = useRef(new Animated.Value(16)).current;

  const barWidth = useRef(new Animated.Value(0)).current;

  const glow1 = useRef(new Animated.Value(0.08)).current;
  const glow2 = useRef(new Animated.Value(0.04)).current;

  const footerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Ambient glow breathing
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow1, { toValue: 0.18, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glow1, { toValue: 0.08, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow2, { toValue: 0.12, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glow2, { toValue: 0.04, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();

    // Main entrance sequence
    Animated.sequence([
      Animated.delay(200),

      // Logo appears with spring + subtle rotate
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 50, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(logoRotate, { toValue: 1, duration: 800, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
      ]),

      Animated.delay(150),

      // Title slides up
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(titleSlide, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
      ]),

      Animated.delay(100),

      // Tagline slides up
      Animated.parallel([
        Animated.timing(tagOpacity, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(tagSlide, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
      ]),

      Animated.delay(200),

      // Footer + loading bar
      Animated.parallel([
        Animated.timing(footerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(barWidth, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
      ]),
    ]).start();
  }, []);

  const spin = logoRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['-12deg', '0deg'],
  });

  const loadingBarW = barWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#020815', '#06101F', '#030A14']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Ambient glow orbs */}
      <Animated.View style={[styles.glowOrb, styles.glowTop, { opacity: glow1 }]} />
      <Animated.View style={[styles.glowOrb, styles.glowBottom, { opacity: glow2 }]} />

      {/* Centered content */}
      <View style={styles.center}>
        {/* Logo with shadow ring */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }, { rotate: spin }],
            },
          ]}
        >
          <View style={styles.logoShadow} />
          <View style={styles.logoBorder}>
            <Image
              source={require('../../../assets/logo2.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        </Animated.View>

        {/* Title */}
        <Animated.View
          style={{
            opacity: titleOpacity,
            transform: [{ translateY: titleSlide }],
            marginTop: 32,
            alignItems: 'center',
          }}
        >
          <Text style={styles.title} allowFontScaling={false}>
            Urban<Text style={styles.titleAccent}>Fix</Text>
          </Text>
        </Animated.View>

        {/* Tagline */}
        <Animated.View
          style={{
            opacity: tagOpacity,
            transform: [{ translateY: tagSlide }],
            marginTop: 14,
          }}
        >
          <Text style={styles.tagline} allowFontScaling={false}>
            Report smarter. Resolve faster.
          </Text>
        </Animated.View>
      </View>

      {/* Bottom section */}
      <Animated.View style={[styles.bottom, { opacity: footerOpacity, paddingBottom: insets.bottom + 24 }]}>
        {/* Loading bar */}
        <View style={styles.barTrack}>
          <Animated.View style={[styles.barFill, { width: loadingBarW }]}>
            <LinearGradient
              colors={['#007AFF', '#00C6FF']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </Animated.View>
        </View>

        <Text style={styles.footerText} allowFontScaling={false}>
          Smart Civic Platform
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020815',
  },
  glowOrb: {
    position: 'absolute',
    borderRadius: 999,
  },
  glowTop: {
    width: width * 1.2,
    height: width * 1.2,
    top: -width * 0.4,
    left: -width * 0.1,
    backgroundColor: '#007AFF',
  },
  glowBottom: {
    width: width,
    height: width,
    bottom: -width * 0.3,
    right: -width * 0.2,
    backgroundColor: '#5856D6',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoShadow: {
    position: 'absolute',
    width: LOGO_SIZE + 40,
    height: LOGO_SIZE + 40,
    borderRadius: (LOGO_SIZE + 40) / 2,
    backgroundColor: 'rgba(0, 122, 255, 0.12)',
  },
  logoBorder: {
    width: LOGO_SIZE + 8,
    height: LOGO_SIZE + 8,
    borderRadius: (LOGO_SIZE + 8) / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 15, 30, 0.6)',
  },
  logoImage: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
  },
  title: {
    fontSize: 44,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1.5,
  },
  titleAccent: {
    color: '#007AFF',
  },
  titleAI: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.35)',
    letterSpacing: 8,
    marginTop: 2,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.45)',
    letterSpacing: 0.5,
  },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  barTrack: {
    width: 140,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
    marginBottom: 16,
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
    overflow: 'hidden',
  },
  footerText: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.2)',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
