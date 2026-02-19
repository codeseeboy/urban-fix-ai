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
// Using royalty-free illustrations from Storyset / Undraw / Icons8
const slides = [
    {
        id: '1',
        image: 'https://img.icons8.com/3d-fluency/512/camera.png',
        title: 'Snap & Report',
        subtitle: 'See a pothole, broken light, or garbage pile?\nJust snap a photo — our AI handles the rest.',
        accent: '#007AFF',
        icon: 'camera' as const,
    },
    {
        id: '2',
        image: 'https://img.icons8.com/3d-fluency/512/artificial-intelligence.png',
        title: 'AI-Powered Analysis',
        subtitle: 'Instant severity scoring, smart duplicate\ndetection & automatic department routing.',
        accent: '#FF6B35',
        icon: 'flash' as const,
    },
    {
        id: '3',
        image: 'https://img.icons8.com/3d-fluency/512/government.png',
        title: 'Direct to Authorities',
        subtitle: 'Reports go straight to the right municipal\ndepartment. No middlemen, no delays.',
        accent: '#30D158',
        icon: 'business' as const,
    },
    {
        id: '4',
        image: 'https://img.icons8.com/3d-fluency/512/prize.png',
        title: 'Track & Earn',
        subtitle: 'Follow progress in real-time. Earn points,\nbadges, and climb the civic leaderboard.',
        accent: '#FFD60A',
        icon: 'trophy' as const,
    },
    {
        id: '5',
        image: 'https://img.icons8.com/3d-fluency/512/city-buildings.png',
        title: 'Build Smart Cities',
        subtitle: 'Join thousands of citizens making their\nneighborhoods cleaner, safer & better.',
        accent: '#AF52DE',
        icon: 'globe' as const,
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
            {/* Background gradient */}
            <LinearGradient
                colors={['#060610', '#0D1B2A', '#0A0A14']}
                style={StyleSheet.absoluteFill}
            />

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
                    // Parallax: image translates slower than page
                    const inputRange = [
                        (index - 1) * width,
                        index * width,
                        (index + 1) * width,
                    ];
                    const imageTranslateX = scrollX.interpolate({
                        inputRange,
                        outputRange: [width * 0.3, 0, -width * 0.3],
                        extrapolate: 'clamp',
                    });
                    const textOpacity = scrollX.interpolate({
                        inputRange,
                        outputRange: [0, 1, 0],
                        extrapolate: 'clamp',
                    });
                    const textTranslateY = scrollX.interpolate({
                        inputRange,
                        outputRange: [30, 0, 30],
                        extrapolate: 'clamp',
                    });

                    return (
                        <View style={[styles.slide, { width }]}>
                            {/* Accent glow behind image */}
                            <View style={[styles.accentGlow, { backgroundColor: item.accent + '15' }]} />

                            {/* Illustration with parallax */}
                            <Animated.View style={[
                                styles.imageWrap,
                                { transform: [{ translateX: imageTranslateX }] },
                            ]}>
                                <View style={[styles.imageBg, { borderColor: item.accent + '25' }]}>
                                    <Image
                                        source={{ uri: item.image }}
                                        style={styles.slideImage}
                                        resizeMode="contain"
                                    />
                                </View>
                            </Animated.View>

                            {/* Text with fade */}
                            <Animated.View style={[
                                styles.textWrap,
                                { opacity: textOpacity, transform: [{ translateY: textTranslateY }] },
                            ]}>
                                {/* Icon badge */}
                                <View style={[styles.iconBadge, { backgroundColor: item.accent + '18' }]}>
                                    <Ionicons name={item.icon} size={16} color={item.accent} />
                                </View>

                                <Text style={styles.slideTitle} allowFontScaling={false}>
                                    {item.title}
                                </Text>
                                <Text style={styles.slideSubtitle} allowFontScaling={false}>
                                    {item.subtitle}
                                </Text>
                            </Animated.View>
                        </View>
                    );
                }}
            />

            {/* Bottom controls */}
            <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 24) + 16 }]}>
                {/* Gradient progress dots */}
                <View style={styles.dotsRow}>
                    {slides.map((slide, i) => {
                        const dotWidth = scrollX.interpolate({
                            inputRange: [(i - 1) * width, i * width, (i + 1) * width],
                            outputRange: [8, 28, 8],
                            extrapolate: 'clamp',
                        });
                        const dotOpacity = scrollX.interpolate({
                            inputRange: [(i - 1) * width, i * width, (i + 1) * width],
                            outputRange: [0.3, 1, 0.3],
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
                                        backgroundColor: i === currentIndex ? slide.accent : '#444',
                                    },
                                ]}
                            />
                        );
                    })}
                </View>

                {/* Navigation buttons */}
                <View style={styles.buttonsRow}>
                    <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
                        <Text style={styles.skipText}>Skip</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={goNext} activeOpacity={0.85}>
                        <LinearGradient
                            colors={[slides[currentIndex].accent, slides[currentIndex].accent + 'CC']}
                            style={styles.nextBtn}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        >
                            <Text style={styles.nextText} allowFontScaling={false}>
                                {isLastSlide ? 'Get Started' : 'Next'}
                            </Text>
                            <Ionicons
                                name={isLastSlide ? 'rocket' : 'arrow-forward'}
                                size={18}
                                color="#FFF"
                            />
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    slide: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    accentGlow: {
        position: 'absolute',
        top: height * 0.1,
        width: width * 0.8,
        height: width * 0.8,
        borderRadius: width * 0.4,
    },
    imageWrap: {
        marginBottom: 40,
    },
    imageBg: {
        width: 200,
        height: 200,
        borderRadius: 100,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1.5,
    },
    slideImage: {
        width: 140,
        height: 140,
    },
    textWrap: {
        alignItems: 'center',
        paddingHorizontal: 12,
    },
    iconBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    slideTitle: {
        fontFamily: 'Inter_700Bold',
        fontSize: 28,
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 12,
        includeFontPadding: false,
    },
    slideSubtitle: {
        fontFamily: 'Inter_400Regular',
        fontSize: 15,
        color: 'rgba(255,255,255,0.5)',
        textAlign: 'center',
        lineHeight: 22,
        includeFontPadding: false,
    },
    bottomBar: {
        paddingHorizontal: 24,
    },
    dotsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
        marginBottom: 28,
    },
    dot: {
        height: 6,
        borderRadius: 3,
    },
    buttonsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    skipBtn: {
        paddingVertical: 12,
        paddingHorizontal: 8,
    },
    skipText: {
        fontFamily: 'Inter_500Medium',
        color: 'rgba(255,255,255,0.35)',
        fontSize: 15,
    },
    nextBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 28,
        paddingVertical: 14,
        borderRadius: radius.lg,
    },
    nextText: {
        fontFamily: 'Inter_700Bold',
        color: '#FFF',
        fontSize: 16,
        includeFontPadding: false,
    },
});
