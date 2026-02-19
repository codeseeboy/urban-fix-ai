import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    Alert, Animated, KeyboardAvoidingView, Platform,
    Dimensions, Image, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { userAPI } from '../../services/api';
import logger from '../../utils/logger';
import { colors, fonts, radius } from '../../theme/colors';

const { width } = Dimensions.get('window');

// ─── STEP CONFIG ──────────────────────────────────────────────────────────────
const INTERESTS = [
    { id: 'roads', icon: 'car-outline' as const, label: 'Roads', color: '#FF6B35' },
    { id: 'lighting', icon: 'bulb-outline' as const, label: 'Lighting', color: '#FFD60A' },
    { id: 'garbage', icon: 'trash-outline' as const, label: 'Garbage', color: '#30D158' },
    { id: 'water', icon: 'water-outline' as const, label: 'Water', color: '#5AC8FA' },
    { id: 'parks', icon: 'leaf-outline' as const, label: 'Parks', color: '#AF52DE' },
    { id: 'drainage', icon: 'rainy-outline' as const, label: 'Drainage', color: '#007AFF' },
    { id: 'electricity', icon: 'flash-outline' as const, label: 'Electricity', color: '#FF9F0A' },
    { id: 'safety', icon: 'shield-outline' as const, label: 'Safety', color: '#FF453A' },
];

const WARDS = [
    'Central Ward', 'North Ward', 'South Ward',
    'East Ward', 'West Ward', 'Other',
];

// Step illustrations from Icons8 3D Fluency
const STEP_IMAGES = [
    'https://img.icons8.com/3d-fluency/512/user-male-circle.png',   // Username
    'https://img.icons8.com/3d-fluency/512/worldwide-location.png', // Location
    'https://img.icons8.com/3d-fluency/512/categorize.png',         // Interests
];

type Step = 0 | 1 | 2;

export default function ProfileSetupScreen() {
    const insets = useSafeAreaInsets();
    const { user, completeProfileSetup, userLocation } = useAuth();
    const [step, setStep] = useState<Step>(0);
    const [username, setUsername] = useState('');
    const [city, setCity] = useState('');
    const [ward, setWard] = useState('');
    const [interests, setInterests] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);

    // Animations per step
    const slideAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const imageScale = useRef(new Animated.Value(0.5)).current;
    const contentSlide = useRef(new Animated.Value(30)).current;

    // Pre-fill city from GPS detection
    useEffect(() => {
        if (userLocation?.city) {
            setCity(userLocation.city);
            logger.info('ProfileSetup', `Auto-filled city: ${userLocation.city}`);
        }
        if (userLocation?.ward) {
            // Try to match ward or leave for manual selection
            const matchedWard = WARDS.find(w =>
                w.toLowerCase().includes((userLocation.ward || '').toLowerCase())
            );
            if (matchedWard) setWard(matchedWard);
        }
    }, [userLocation]);

    // Animate step entrance
    useEffect(() => {
        imageScale.setValue(0.5);
        contentSlide.setValue(30);
        fadeAnim.setValue(0);

        Animated.parallel([
            Animated.spring(imageScale, {
                toValue: 1,
                friction: 6,
                tension: 60,
                useNativeDriver: true,
            }),
            Animated.timing(contentSlide, {
                toValue: 0,
                duration: 400,
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start();
    }, [step]);

    const firstName = user?.name?.split(' ')[0] || 'there';

    const toggleInterest = (id: string) => {
        setInterests(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    // ─── STEP NAVIGATION ──────────────────────────────────────────────
    const goNext = async () => {
        if (step === 0) {
            if (!username.trim() || username.length < 3) {
                Alert.alert('Username Required', 'Please choose a username with at least 3 characters.');
                return;
            }
            setStep(1);
        } else if (step === 1) {
            if (!city.trim()) {
                Alert.alert('City Required', 'Please confirm your city.');
                return;
            }
            if (!ward) {
                Alert.alert('Locality Required', 'Please select your ward or locality.');
                return;
            }
            setStep(2);
        } else if (step === 2) {
            if (interests.length === 0) {
                Alert.alert('Select Interests', 'Please choose at least one topic that matters to you.');
                return;
            }
            await handleSave();
        }
    };

    const goBack = () => {
        if (step > 0) setStep((step - 1) as Step);
    };

    const handleSave = async () => {
        logger.tap('ProfileSetup', 'Save Profile', { username, city, ward, interests });
        setSaving(true);
        try {
            await userAPI.updateProfile({
                name: user?.name || '',
                region: ward,
                avatar: null,
            });
            await completeProfileSetup({ username, city, ward, interests });
            logger.success('ProfileSetup', 'Profile setup completed');
        } catch (e: any) {
            Alert.alert('Error', e.response?.data?.message || 'Failed to save profile');
        }
        setSaving(false);
    };

    // ─── STEP RENDERERS ────────────────────────────────────────────────
    const renderStep0 = () => (
        <>
            <Text style={styles.stepTitle} allowFontScaling={false}>
                Welcome, {firstName}!
            </Text>
            <Text style={styles.stepSubtitle} allowFontScaling={false}>
                Choose a username for your civic profile.{'\n'}
                This is how other citizens will recognize you.
            </Text>

            <View style={styles.usernameCard}>
                <View style={styles.usernameInputRow}>
                    <Text style={styles.atSign}>@</Text>
                    <TextInput
                        style={styles.usernameInput}
                        placeholder="enter_username"
                        placeholderTextColor={colors.textMuted}
                        value={username}
                        onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        autoCapitalize="none"
                        autoCorrect={false}
                        maxLength={20}
                        autoFocus
                    />
                </View>
                {username.length > 0 && (
                    <View style={styles.usernamePreview}>
                        <Ionicons name="person-circle-outline" size={16} color={colors.textMuted} />
                        <Text style={styles.usernamePreviewText} allowFontScaling={false}>
                            Your profile: <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold' }}>@{username}</Text>
                        </Text>
                    </View>
                )}
                <View style={styles.usernameHints}>
                    <View style={styles.hintRow}>
                        <Ionicons name={username.length >= 3 ? 'checkmark-circle' : 'ellipse-outline'}
                            size={14} color={username.length >= 3 ? colors.success : colors.textMuted} />
                        <Text style={[styles.hintText, username.length >= 3 && { color: colors.success }]}
                            allowFontScaling={false}>At least 3 characters</Text>
                    </View>
                    <View style={styles.hintRow}>
                        <Ionicons name={/^[a-z]/.test(username) ? 'checkmark-circle' : 'ellipse-outline'}
                            size={14} color={/^[a-z]/.test(username) ? colors.success : colors.textMuted} />
                        <Text style={[styles.hintText, /^[a-z]/.test(username) && { color: colors.success }]}
                            allowFontScaling={false}>Starts with a letter</Text>
                    </View>
                </View>
            </View>
        </>
    );

    const renderStep1 = () => (
        <>
            <Text style={styles.stepTitle} allowFontScaling={false}>
                Confirm Your Location
            </Text>
            <Text style={styles.stepSubtitle} allowFontScaling={false}>
                We detected your area from GPS.{'\n'}
                Confirm your city and select your locality.
            </Text>

            {/* City (auto-filled, editable) */}
            <Text style={styles.fieldLabel} allowFontScaling={false}>City</Text>
            <View style={styles.inputCard}>
                <Ionicons name="business-outline" size={18} color={colors.primary} />
                <TextInput
                    style={styles.fieldInput}
                    placeholder="Your city"
                    placeholderTextColor={colors.textMuted}
                    value={city}
                    onChangeText={setCity}
                />
                {userLocation?.city && city === userLocation.city && (
                    <View style={styles.autoTag}>
                        <Ionicons name="navigate" size={10} color={colors.success} />
                        <Text style={styles.autoTagText} allowFontScaling={false}>GPS</Text>
                    </View>
                )}
            </View>

            {/* Ward / Locality */}
            <Text style={styles.fieldLabel} allowFontScaling={false}>Ward / Locality</Text>
            <View style={styles.wardGrid}>
                {WARDS.map((w) => {
                    const isSelected = ward === w;
                    return (
                        <TouchableOpacity
                            key={w}
                            style={[styles.wardChip, isSelected && styles.wardActive]}
                            onPress={() => setWard(w)}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name={isSelected ? 'location' : 'location-outline'}
                                size={14}
                                color={isSelected ? '#FFF' : colors.textSecondary}
                            />
                            <Text style={[styles.wardText, isSelected && styles.wardTextActive]}
                                allowFontScaling={false}>{w}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Detected address */}
            {userLocation?.address && (
                <View style={styles.detectedAddr}>
                    <Ionicons name="pin" size={14} color={colors.primaryLight} />
                    <Text style={styles.detectedAddrText} numberOfLines={2} allowFontScaling={false}>
                        {userLocation.address}
                    </Text>
                </View>
            )}
        </>
    );

    const renderStep2 = () => (
        <>
            <Text style={styles.stepTitle} allowFontScaling={false}>
                What Matters to You?
            </Text>
            <Text style={styles.stepSubtitle} allowFontScaling={false}>
                Select the civic issues you care about.{'\n'}
                We'll personalize your feed and notifications.
            </Text>

            <View style={styles.interestGrid}>
                {INTERESTS.map((item) => {
                    const selected = interests.includes(item.id);
                    return (
                        <TouchableOpacity
                            key={item.id}
                            style={[
                                styles.interestItem,
                                selected && { backgroundColor: item.color, borderColor: item.color },
                            ]}
                            onPress={() => toggleInterest(item.id)}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name={item.icon as any}
                                size={26}
                                color={selected ? '#FFF' : item.color}
                            />
                            <Text style={[
                                styles.interestLabel,
                                selected && { color: '#FFF' },
                            ]} allowFontScaling={false}>{item.label}</Text>
                            {selected && (
                                <View style={styles.checkBadge}>
                                    <Ionicons name="checkmark" size={10} color="#FFF" />
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>

            <Text style={styles.selectedCount} allowFontScaling={false}>
                {interests.length} selected
            </Text>
        </>
    );

    const stepContent = [renderStep0, renderStep1, renderStep2];
    const stepLabels = ['Username', 'Location', 'Interests'];
    const stepButtonLabels = ['Continue', 'Confirm & Continue', saving ? 'Setting up...' : 'Start Exploring'];

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <LinearGradient
                colors={['#060610', '#0D1B2A', '#0A0A14']}
                style={StyleSheet.absoluteFill}
            />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 30 },
                ]}
                keyboardShouldPersistTaps="handled"
            >
                {/* Progress bar */}
                <View style={styles.progressRow}>
                    {stepLabels.map((label, i) => (
                        <View key={i} style={styles.progressItem}>
                            <View style={[
                                styles.progressDot,
                                i <= step && styles.progressDotActive,
                                i < step && styles.progressDotDone,
                            ]}>
                                {i < step ? (
                                    <Ionicons name="checkmark" size={12} color="#FFF" />
                                ) : (
                                    <Text style={[
                                        styles.progressDotText,
                                        i <= step && { color: '#FFF' },
                                    ]} allowFontScaling={false}>{i + 1}</Text>
                                )}
                            </View>
                            <Text style={[
                                styles.progressLabel,
                                i <= step && { color: colors.text },
                            ]} allowFontScaling={false}>{label}</Text>
                            {i < stepLabels.length - 1 && (
                                <View style={[
                                    styles.progressLine,
                                    i < step && { backgroundColor: colors.primary },
                                ]} />
                            )}
                        </View>
                    ))}
                </View>

                {/* Step illustration */}
                <Animated.View style={[styles.imageContainer, { transform: [{ scale: imageScale }] }]}>
                    <View style={styles.imageGlow} />
                    <Image
                        source={{ uri: STEP_IMAGES[step] }}
                        style={styles.stepImage}
                        resizeMode="contain"
                    />
                </Animated.View>

                {/* Step content */}
                <Animated.View style={[
                    styles.stepContent,
                    { opacity: fadeAnim, transform: [{ translateY: contentSlide }] },
                ]}>
                    {stepContent[step]()}
                </Animated.View>

                {/* Navigation buttons */}
                <View style={styles.navRow}>
                    {step > 0 && (
                        <TouchableOpacity onPress={goBack} style={styles.backBtn} activeOpacity={0.7}>
                            <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
                            <Text style={styles.backText} allowFontScaling={false}>Back</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        onPress={goNext}
                        disabled={saving}
                        activeOpacity={0.85}
                        style={[styles.nextBtnWrap, step === 0 && { flex: 1 }]}
                    >
                        <LinearGradient
                            colors={
                                step === 2
                                    ? [colors.success, '#28A745']
                                    : [colors.primary, '#0055CC']
                            }
                            style={styles.nextBtn}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        >
                            <Text style={styles.nextText} allowFontScaling={false}>
                                {stepButtonLabels[step]}
                            </Text>
                            <Ionicons
                                name={step === 2 ? 'rocket' : 'arrow-forward'}
                                size={18}
                                color="#FFF"
                            />
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { paddingHorizontal: 24 },

    // Progress
    progressRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        marginBottom: 24, gap: 4,
    },
    progressItem: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
    },
    progressDot: {
        width: 24, height: 24, borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center', alignItems: 'center',
    },
    progressDotActive: {
        backgroundColor: colors.primary, borderColor: colors.primary,
    },
    progressDotDone: {
        backgroundColor: colors.success, borderColor: colors.success,
    },
    progressDotText: {
        fontFamily: 'Inter_700Bold', fontSize: 10, color: colors.textMuted,
        includeFontPadding: false,
    },
    progressLabel: {
        fontFamily: 'Inter_500Medium', fontSize: 11, color: colors.textMuted,
        includeFontPadding: false,
    },
    progressLine: {
        width: 20, height: 2, borderRadius: 1,
        backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 4,
    },

    // Image
    imageContainer: {
        alignItems: 'center', marginBottom: 20, position: 'relative',
    },
    imageGlow: {
        position: 'absolute', width: 150, height: 150, borderRadius: 75,
        backgroundColor: 'rgba(0,122,255,0.06)',
    },
    stepImage: { width: 120, height: 120 },

    // Content
    stepContent: { marginBottom: 24 },
    stepTitle: {
        fontFamily: 'Inter_700Bold', fontSize: 26, color: '#FFF',
        textAlign: 'center', marginBottom: 8, includeFontPadding: false,
    },
    stepSubtitle: {
        fontFamily: 'Inter_400Regular', fontSize: 14, color: 'rgba(255,255,255,0.45)',
        textAlign: 'center', lineHeight: 20, marginBottom: 28, includeFontPadding: false,
    },

    // Step 0: Username
    usernameCard: {
        backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: radius.lg,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 16,
    },
    usernameInputRow: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: colors.surface, borderRadius: radius.md,
        paddingHorizontal: 14, paddingVertical: 12,
        borderWidth: 1, borderColor: colors.border,
    },
    atSign: {
        fontFamily: 'Inter_700Bold', color: colors.primary, fontSize: 18,
        includeFontPadding: false,
    },
    usernameInput: {
        flex: 1, fontFamily: 'Inter_500Medium', color: '#FFF', fontSize: 17,
        paddingVertical: 0, includeFontPadding: false,
    },
    usernamePreview: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        marginTop: 12, paddingHorizontal: 4,
    },
    usernamePreviewText: {
        fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 13,
        includeFontPadding: false,
    },
    usernameHints: { marginTop: 14, gap: 6 },
    hintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
    hintText: {
        fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textMuted,
        includeFontPadding: false,
    },

    // Step 1: Location
    fieldLabel: {
        fontFamily: 'Inter_600SemiBold', color: 'rgba(255,255,255,0.6)', fontSize: 12,
        marginBottom: 8, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1,
        includeFontPadding: false,
    },
    inputCard: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: colors.surface, borderRadius: radius.md,
        paddingHorizontal: 14, paddingVertical: 14,
        borderWidth: 1, borderColor: colors.border, marginBottom: 18,
    },
    fieldInput: {
        flex: 1, fontFamily: 'Inter_500Medium', color: '#FFF', fontSize: 15,
        paddingVertical: 0, includeFontPadding: false,
    },
    autoTag: {
        flexDirection: 'row', alignItems: 'center', gap: 3,
        backgroundColor: 'rgba(48,209,88,0.12)', paddingHorizontal: 8, paddingVertical: 3,
        borderRadius: 10,
    },
    autoTagText: {
        fontFamily: 'Inter_600SemiBold', fontSize: 9, color: colors.success,
        includeFontPadding: false,
    },
    wardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    wardChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    wardActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    wardText: {
        fontFamily: 'Inter_500Medium', color: colors.textSecondary, fontSize: 13,
        includeFontPadding: false,
    },
    wardTextActive: { color: '#FFF' },
    detectedAddr: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: 'rgba(0,122,255,0.06)', borderRadius: radius.md,
        paddingHorizontal: 12, paddingVertical: 10,
    },
    detectedAddrText: {
        fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.primaryLight,
        flex: 1, includeFontPadding: false,
    },

    // Step 2: Interests
    interestGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    interestItem: {
        width: '22%', alignItems: 'center', paddingVertical: 16,
        borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
        position: 'relative',
    },
    interestLabel: {
        fontFamily: 'Inter_500Medium', color: colors.textSecondary,
        fontSize: 10, marginTop: 6, includeFontPadding: false,
    },
    checkBadge: {
        position: 'absolute', top: 4, right: 4,
        width: 16, height: 16, borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.25)',
        justifyContent: 'center', alignItems: 'center',
    },
    selectedCount: {
        fontFamily: 'Inter_500Medium', color: colors.textMuted, fontSize: 12,
        textAlign: 'center', marginTop: 12, includeFontPadding: false,
    },

    // Navigation
    navRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8,
    },
    backBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingVertical: 14, paddingHorizontal: 16,
        borderRadius: radius.md,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    },
    backText: {
        fontFamily: 'Inter_500Medium', color: colors.textSecondary, fontSize: 14,
        includeFontPadding: false,
    },
    nextBtnWrap: { flex: 1, borderRadius: radius.md, overflow: 'hidden' },
    nextBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, paddingVertical: 16, borderRadius: radius.md,
    },
    nextText: {
        fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 16,
        includeFontPadding: false,
    },
});
