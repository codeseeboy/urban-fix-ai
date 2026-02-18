import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, FlatList, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, radius } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';

const { width } = Dimensions.get('window');

const slides = [
    { id: '1', icon: 'camera-outline', title: 'Report Issues', desc: 'Snap a photo, tag location, submit in seconds.', colors: [colors.primary, '#0055CC'] },
    { id: '2', icon: 'flash-outline', title: 'AI Validates', desc: 'Our AI classifies, scores severity & prevents dupes.', colors: ['#FF6B35', '#FF453A'] },
    { id: '3', icon: 'business-outline', title: 'Action Taken', desc: 'Routed to the right dept. Track progress live.', colors: ['#30D158', '#28A745'] },
    { id: '4', icon: 'trophy-outline', title: 'Earn Rewards', desc: 'Get points, badges, and climb the leaderboard!', colors: ['#FFD60A', '#FF9F0A'] },
    { id: '5', icon: 'globe-outline', title: 'Build Smarter Cities', desc: 'Together we create transparent, responsive governance for everyone.', colors: ['#AF52DE', '#8E44AD'] },
];

export default function OnboardingScreen({ navigation }: any) {
    const { completeOnboarding } = useAuth();
    const [index, setIndex] = useState(0);
    const ref = useRef<FlatList>(null);

    const handleNext = async () => {
        if (index < slides.length - 1) {
            ref.current?.scrollToIndex({ index: index + 1 });
            setIndex(index + 1);
        } else {
            await completeOnboarding();
            navigation.navigate('Login');
        }
    };

    return (
        <View style={styles.container}>
            <FlatList
                ref={ref} data={slides} horizontal pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
                renderItem={({ item }) => (
                    <View style={[styles.slide, { width }]}>
                        <LinearGradient colors={item.colors} style={styles.iconBg}>
                            <Ionicons name={item.icon as any} size={64} color="#FFF" />
                        </LinearGradient>
                        <Text style={styles.slideTitle}>{item.title}</Text>
                        <Text style={styles.slideDesc}>{item.desc}</Text>
                    </View>
                )}
            />

            <View style={styles.dots}>
                {slides.map((_, i) => (
                    <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
                ))}
            </View>

            <View style={styles.buttons}>
                <TouchableOpacity onPress={async () => { await completeOnboarding(); navigation.navigate('Login'); }}>
                    <Text style={styles.skipText}>Skip</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleNext} activeOpacity={0.85}>
                    <LinearGradient colors={[colors.primary, '#0055CC']} style={styles.nextBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                        <Text style={styles.nextText}>{index === slides.length - 1 ? 'Get Started' : 'Next'}</Text>
                        <Ionicons name="arrow-forward" size={18} color="#FFF" />
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    slide: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
    iconBg: { width: 140, height: 140, borderRadius: 70, justifyContent: 'center', alignItems: 'center', marginBottom: 40 },
    slideTitle: { fontFamily: 'Inter_700Bold', fontSize: 28, color: colors.text, textAlign: 'center', marginBottom: 14 },
    slideDesc: { fontFamily: 'Inter_400Regular', fontSize: 16, color: colors.textSecondary, textAlign: 'center', lineHeight: 24 },
    dots: { flexDirection: 'row', justifyContent: 'center', marginBottom: 40 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border, marginHorizontal: 4 },
    dotActive: { width: 24, backgroundColor: colors.primary },
    buttons: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 28, paddingBottom: 50,
    },
    skipText: { fontFamily: 'Inter_500Medium', color: colors.textMuted, fontSize: 16 },
    nextBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 24, paddingVertical: 14, borderRadius: radius.md,
    },
    nextText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 16 },
});
