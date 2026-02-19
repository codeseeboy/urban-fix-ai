import React, { useRef, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Dimensions,
    FlatList, Animated, Image, NativeScrollEvent, NativeSyntheticEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';

const { width, height } = Dimensions.get('window');

// ─── SLIDE DATA ─────────────────────────────────────────────────────────────
// Premium illustrations from Storyset (Freepik) — free for commercial use
const slides = [
    {
        id: '1',
        image: 'https://cdn-icons-png.flaticon.com/512/4727/4727424.png',
        title: 'Snap & Report',
        subtitle: 'See a pothole, broken light, or garbage pile?\nJust snap a photo and our AI handles the rest.',
        accent: '#007AFF',
    },
    {
        id: '2',
        image: 'https://cdn-icons-png.flaticon.com/512/4616/4616734.png',
        title: 'AI-Powered Analysis',
        subtitle: 'Instant severity scoring, smart duplicate\ndetection and automatic department routing.',
        accent: '#FF6B35',
    },
    {
        id: '3',
        image: 'https://cdn-icons-png.flaticon.com/512/3815/3815243.png',
        title: 'Direct to Authorities',
        subtitle: 'Reports go straight to the right municipal\ndepartment. No middlemen, no delays.',
        accent: '#30D158',
    },
    {
        id: '4',
        image: 'https://cdn-icons-png.flaticon.com/512/3176/3176366.png',
        title: 'Track & Earn Rewards',
        subtitle: 'Follow your report in real-time. Earn points,\nbadges, and climb the civic leaderboard.',
        accent: '#FFD60A',
    },
    {
        id: '5',
        image: 'https://cdn-icons-png.flaticon.com/512/2942/2942243.png',
        title: 'Build Smart Cities',
        subtitle: 'Join thousands of citizens making their\nneighborhoods cleaner, safer and better.',
        accent: '#AF52DE',
    },
];

export default function OnboardingScreen({ navigation }: any) {
    const { completeOnboarding } = useAuth();
    const insets = useSafeAreaInsets();
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const scrollX = useRef(new Animated.Value(0)).current;

    const isLastSlide = currentIndex === slides.length - 1;

    const handleScroll = Animated.event(
        [{ nativeEvent: { contentOffset: { x: scrollX } } }],
        { useNativeDriver: false }
    );

    const handleMomentumEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
        setCurrentIndex(newIndex);
    }, []);

    const goNext = async () => {
        if (isLastSlide) {
            await completeOnboarding();
            navigation.navigate('Login');
        } else {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
            setCurrentIndex(currentIndex + 1);
        }
    };

    const handleSkip = async () => {
        await completeOnboarding();
        navigation.navigate('Login');
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Background */}
            <LinearGradient
                colors={['#020205', '#0A0F1E', '#0A0A14']}
                style={StyleSheet.absoluteFill}
            />

            {/* Skip */}
            <TouchableOpacity
                onPress={handleSkip}
                style={[styles.skipBtn, { top: insets.top + 12 }]}
                activeOpacity={0.7}
            >
                <Text style={styles.skipText} allowFontScaling={false}>Skip</Text>
            </TouchableOpacity>

            {/* Slides */}
            <FlatList
                ref={flatListRef}
                data={slides}
                horizontal
                pagingEnabled
                bounces={false}
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                onScroll={handleScroll}
                onMomentumScrollEnd={handleMomentumEnd}
                scrollEventThrottle={16}
                renderItem={({ item, index }) => {
                    const inputRange = [
                        (index - 1) * width,
                        index * width,
                        (index + 1) * width,
                    ];

                    // Parallax for image
                    const imageTranslateX = scrollX.interpolate({
                        inputRange,
                        outputRange: [width * 0.25, 0, -width * 0.25],
                        extrapolate: 'clamp',
                    });
                    const imageScale = scrollX.interpolate({
                        inputRange,
                        outputRange: [0.7, 1, 0.7],
                        extrapolate: 'clamp',
                    });

                    // Fade + slide for text
                    const textOpacity = scrollX.interpolate({
                        inputRange,
                        outputRange: [0, 1, 0],
                        extrapolate: 'clamp',
                    });
                    const textTranslateY = scrollX.interpolate({
                        inputRange,
                        outputRange: [40, 0, 40],
                        extrapolate: 'clamp',
                    });

                    return (
                        <View style={[styles.slide, { width }]}>
                            {/* Accent glow */}
                            <View style={[styles.accentGlow, { backgroundColor: item.accent + '08' }]} />

                            {/* Illustration */}
                            <Animated.View style={[
                                styles.imageWrap,
                                {
                                    transform: [
                                        { translateX: imageTranslateX },
                                        { scale: imageScale },
                                    ],
                                },
                            ]}>
                                {/* Glow ring behind image */}
                                <View style={[styles.imageRing, { borderColor: item.accent + '15' }]}>
                                    <View style={[styles.imageInnerRing, { backgroundColor: item.accent + '08' }]}>
                                        <Image
                                            source={{ uri: item.image }}
                                            style={styles.slideImage}
                                            resizeMode="contain"
                                        />
                                    </View>
                                </View>
                            </Animated.View>

                            {/* Text content */}
                            <Animated.View style={[
                                styles.textWrap,
                                {
                                    opacity: textOpacity,
                                    transform: [{ translateY: textTranslateY }],
                                },
                            ]}>
                                {/* Step indicator */}
                                <View style={[styles.stepPill, { backgroundColor: item.accent + '12' }]}>
                                    <Text style={[styles.stepPillText, { color: item.accent }]}
                                        allowFontScaling={false}>
                                        Step {index + 1} of {slides.length}
                                    </Text>
                                </View>

                                <Text style={styles.slideTitle} allowFontScaling={false}>
                                    {item.title}
                                </Text>

                                {/* Accent line */}
                                <View style={[styles.accentLine, { backgroundColor: item.accent }]} />

                                <Text style={styles.slideSubtitle} allowFontScaling={false}>
                                    {item.subtitle}
                                </Text>
                            </Animated.View>
                        </View>
                    );
                }}
            />

            {/* Bottom controls */}
            <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 20) + 16 }]}>
                {/* Gradient progress dots */}
                <View style={styles.dotsRow}>
                    {slides.map((slide, i) => {
                        const dotWidth = scrollX.interpolate({
                            inputRange: [(i - 1) * width, i * width, (i + 1) * width],
                            outputRange: [8, 32, 8],
                            extrapolate: 'clamp',
                        });
                        const dotOpacity = scrollX.interpolate({
                            inputRange: [(i - 1) * width, i * width, (i + 1) * width],
                            outputRange: [0.25, 1, 0.25],
                            extrapolate: 'clamp',
                        });

                        return (
                            <Animated.View
                                key={i}
                                style={[
                                    styles.dot,
                                    {
                                        width: dotWidth,
                                        opacity: dotOpacity,
                                        backgroundColor: i === currentIndex ? slide.accent : 'rgba(255,255,255,0.2)',
                                    },
                                ]}
                            />
                        );
                    })}
                </View>

                {/* Next / Get Started button */}
                <TouchableOpacity onPress={goNext} activeOpacity={0.85} style={styles.nextBtnWrap}>
                    <LinearGradient
                        colors={[slides[currentIndex].accent, slides[currentIndex].accent + 'BB']}
                        style={styles.nextBtn}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <Text style={styles.nextText} allowFontScaling={false}>
                            {isLastSlide ? 'Get Started' : 'Continue'}
                        </Text>
                        <Ionicons
                            name={isLastSlide ? 'arrow-forward' : 'arrow-forward'}
                            size={18}
                            color="#FFF"
                        />
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },

    // Skip button
    skipBtn: {
        position: 'absolute', right: 20, zIndex: 10,
        paddingVertical: 8, paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    skipText: {
        fontFamily: 'Inter_500Medium', color: 'rgba(255,255,255,0.4)',
        fontSize: 14, includeFontPadding: false,
    },

    // Slide
    slide: {
        flex: 1, justifyContent: 'center', alignItems: 'center',
        paddingHorizontal: 32,
    },
    accentGlow: {
        position: 'absolute', top: height * 0.08,
        width: width * 0.7, height: width * 0.7,
        borderRadius: width * 0.35,
    },

    // Image
    imageWrap: { marginBottom: 48 },
    imageRing: {
        width: 240, height: 240, borderRadius: 120,
        borderWidth: 1.5, justifyContent: 'center', alignItems: 'center',
    },
    imageInnerRing: {
        width: 210, height: 210, borderRadius: 105,
        justifyContent: 'center', alignItems: 'center',
    },
    slideImage: { width: 140, height: 140 },

    // Text
    textWrap: { alignItems: 'center', paddingHorizontal: 8 },
    stepPill: {
        paddingHorizontal: 14, paddingVertical: 5,
        borderRadius: 20, marginBottom: 16,
    },
    stepPillText: {
        fontFamily: 'Inter_600SemiBold', fontSize: 11,
        textTransform: 'uppercase', letterSpacing: 1,
        includeFontPadding: false,
    },
    slideTitle: {
        fontFamily: 'Inter_700Bold', fontSize: 30, color: '#FFFFFF',
        textAlign: 'center', marginBottom: 14, letterSpacing: -0.5,
        includeFontPadding: false,
    },
    accentLine: {
        width: 40, height: 3, borderRadius: 2, marginBottom: 16,
    },
    slideSubtitle: {
        fontFamily: 'Inter_400Regular', fontSize: 15,
        color: 'rgba(255,255,255,0.45)', textAlign: 'center',
        lineHeight: 23, includeFontPadding: false,
    },

    // Bottom
    bottomBar: { paddingHorizontal: 24 },
    dotsRow: {
        flexDirection: 'row', justifyContent: 'center',
        alignItems: 'center', gap: 6, marginBottom: 24,
    },
    dot: { height: 5, borderRadius: 3 },

    // Button
    nextBtnWrap: { borderRadius: radius.lg, overflow: 'hidden' },
    nextBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 10, paddingVertical: 16, borderRadius: radius.lg,
    },
    nextText: {
        fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 17,
        includeFontPadding: false,
    },
});
