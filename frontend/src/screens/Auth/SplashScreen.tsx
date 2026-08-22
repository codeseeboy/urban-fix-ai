import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, Easing, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, shadows } from '../../theme/colors';

const LOGO_SIZE = 88;

export default function SplashScreen() {
  const insets = useSafeAreaInsets();
  const logoScale = useRef(new Animated.Value(0.86)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(16)).current;
  const tagOpacity = useRef(new Animated.Value(0)).current;
  const barWidth = useRef(new Animated.Value(0)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, friction: 7, tension: 70, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 360, useNativeDriver: true }),
        Animated.spring(titleSlide, { toValue: 0, friction: 8, useNativeDriver: true }),
      ]),
      Animated.timing(tagOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(footerOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(barWidth, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
      ]),
    ]).start();
  }, [barWidth, footerOpacity, logoOpacity, logoScale, tagOpacity, titleOpacity, titleSlide]);

  const loadingBarW = barWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.root}>
      <View style={styles.orbTop} />
      <View style={styles.orbBottom} />

      <View style={styles.center}>
        <Animated.View style={[styles.logoWrap, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
          <Image
            source={require('../../../assets/logo2.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </Animated.View>

        <Animated.View style={{ opacity: titleOpacity, transform: [{ translateY: titleSlide }], marginTop: 22, alignItems: 'center' }}>
          <Text style={styles.title} allowFontScaling={false}>
            Urban<Text style={styles.titleAccent}>Fix</Text>
          </Text>
        </Animated.View>

        <Animated.View style={{ opacity: tagOpacity, marginTop: 8 }}>
          <Text style={styles.tagline} allowFontScaling={false}>
            Report civic issues. Track the fix.
          </Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.bottom, { opacity: footerOpacity, paddingBottom: insets.bottom + 28 }]}>
        <View style={styles.barTrack}>
          <Animated.View style={[styles.barFill, { width: loadingBarW }]} />
        </View>
        <Text style={styles.footerText} allowFontScaling={false}>Civic reporting for your city</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  orbTop: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    top: -80,
    right: -60,
    backgroundColor: '#DBEAFE',
  },
  orbBottom: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    bottom: -70,
    left: -50,
    backgroundColor: '#DCFCE7',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoWrap: {
    width: LOGO_SIZE + 20,
    height: LOGO_SIZE + 20,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  logoImage: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: 22,
  },
  title: {
    fontFamily: fonts.black,
    fontSize: 40,
    color: colors.text,
    letterSpacing: -1.4,
  },
  titleAccent: {
    color: colors.primary,
  },
  tagline: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textSecondary,
  },
  bottom: {
    alignItems: 'center',
  },
  barTrack: {
    width: 132,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
    marginBottom: 14,
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  footerText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 0.2,
  },
});
