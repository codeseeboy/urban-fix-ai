import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Animated,
    Easing, ActivityIndicator, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import { colors, fonts, radius } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { getCurrentLocation, UserLocation, checkLocationPermission } from '../../services/locationService';
import logger from '../../utils/logger';

const { width } = Dimensions.get('window');

type DetectionState = 'idle' | 'detecting' | 'success' | 'error';

export default function LocationSetupScreen() {
    const { completeLocationSetup, user } = useAuth();
    const insets = useSafeAreaInsets();
    const [state, setState] = useState<DetectionState>('idle');
    const [location, setLocation] = useState<UserLocation | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Animations
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(40)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const pinBounce = useRef(new Animated.Value(0)).current;
    const mapFade = useRef(new Animated.Value(0)).current;
    const radarSpin = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Entrance animation
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        ]).start();

        // Pulse loop
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.12, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            ])
        ).start();
    }, []);

    const startRadarSpin = () => {
        radarSpin.setValue(0);
        Animated.loop(
            Animated.timing(radarSpin, {
                toValue: 1,
                duration: 1500,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        ).start();
    };

    const requestLocation = async () => {
        setState('detecting');
        setErrorMsg(null);
        startRadarSpin();
        logger.action('LocationSetup', 'Detecting location...');

        const loc = await getCurrentLocation();

        if (loc) {
            setState('success');
            setLocation(loc);
            // Animate map appearance
            Animated.parallel([
                Animated.timing(mapFade, { toValue: 1, duration: 500, useNativeDriver: true }),
                Animated.sequence([
                    Animated.timing(pinBounce, { toValue: -20, duration: 300, useNativeDriver: true }),
                    Animated.spring(pinBounce, { toValue: 0, friction: 4, useNativeDriver: true }),
                ]),
            ]).start();
            logger.success('LocationSetup', `Got location: ${loc.address} (±${loc.accuracy?.toFixed(0)}m)`);
        } else {
            setState('error');
            setErrorMsg('Could not detect your location. Please ensure GPS is enabled and try again.');
            logger.error('LocationSetup', 'Failed to get location after retries');
        }
    };

    const handleConfirm = async () => {
        if (location) {
            await completeLocationSetup(location);
        } else {
            await completeLocationSetup();
        }
    };

    const spinInterpolate = radarSpin.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const firstName = user?.name?.split(' ')[0] || 'there';

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <LinearGradient
                colors={['#060610', '#0D1B2A', '#0A0A14']}
                style={StyleSheet.absoluteFill}
            />

            {/* Subtle glow */}
            <View style={styles.bgGlow} />

            <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                {/* Animated Location Icon */}
                <Animated.View style={[styles.iconOuter, { transform: [{ scale: pulseAnim }] }]}>
                    {state === 'detecting' ? (
                        <Animated.View style={[styles.radarRing, { transform: [{ rotate: spinInterpolate }] }]}>
                            <LinearGradient
                                colors={[colors.primary, 'transparent']}
                                style={styles.radarGradient}
                                start={{ x: 0.5, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            />
                        </Animated.View>
                    ) : null}
                    <View style={styles.iconRing}>
                        <View style={styles.iconInner}>
                            <Ionicons
                                name={state === 'success' ? 'checkmark-circle' : state === 'error' ? 'alert-circle' : 'locate'}
                                size={44}
                                color={state === 'success' ? colors.success : state === 'error' ? colors.error : colors.primary}
                            />
                        </View>
                    </View>
                </Animated.View>

                {/* Greeting */}
                <Text style={styles.greeting} allowFontScaling={false}>Hey {firstName}! 👋</Text>
                <Text style={styles.title} allowFontScaling={false}>
                    {state === 'success' ? 'Location Detected!' :
                        state === 'detecting' ? 'Detecting Location...' :
                            state === 'error' ? 'Detection Failed' :
                                'Enable Location'}
                </Text>
                <Text style={styles.subtitle} allowFontScaling={false}>
                    {state === 'success'
                        ? 'Great! We\'ll use this to show nearby issues and route your reports accurately.'
                        : state === 'detecting'
                            ? 'Connecting to GPS satellites...\nThis may take a few seconds.'
                            : state === 'error'
                                ? errorMsg || 'Please check your GPS settings and try again.'
                                : 'We use your precise location to show nearby\ncivic issues and route reports to the right ward.'}
                </Text>

                {/* GPS Accuracy Badge */}
                {state === 'success' && location && (
                    <View style={styles.accuracyBadge}>
                        <Ionicons name="speedometer" size={14} color={colors.primary} />
                        <Text style={styles.accuracyText}>
                            ±{location.accuracy?.toFixed(0) || '?'}m accuracy
                        </Text>
                    </View>
                )}

                {/* Mini Map Preview */}
                {state === 'success' && location && (
                    <Animated.View style={[styles.mapContainer, { opacity: mapFade }]}>
                        <MapView
                            style={styles.miniMap}
                            initialRegion={{
                                latitude: location.latitude,
                                longitude: location.longitude,
                                latitudeDelta: 0.008,
                                longitudeDelta: 0.008,
                            }}
                            scrollEnabled={false}
                            zoomEnabled={false}
                            pitchEnabled={false}
                            rotateEnabled={false}
                        >
                            <Marker coordinate={{ latitude: location.latitude, longitude: location.longitude }}>
                                <View style={styles.mapPin}>
                                    <Ionicons name="location" size={24} color="#FFF" />
                                </View>
                            </Marker>
                        </MapView>

                        {/* Location info below map */}
                        <View style={styles.locationInfo}>
                            <Ionicons name="location" size={16} color={colors.success} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.locationAddr} numberOfLines={1} allowFontScaling={false}>
                                    {location.address}
                                </Text>
                                {(location.city || location.ward) && (
                                    <Text style={styles.locationSub} numberOfLines={1} allowFontScaling={false}>
                                        {[location.ward, location.city].filter(Boolean).join(', ')}
                                    </Text>
                                )}
                            </View>
                        </View>
                    </Animated.View>
                )}

                {/* Detecting spinner */}
                {state === 'detecting' && (
                    <View style={styles.detectingRow}>
                        <ActivityIndicator color={colors.primary} size="small" />
                        <Text style={styles.detectingText}>Trying GPS (High → Balanced → Low)...</Text>
                    </View>
                )}

                {/* Action Buttons */}
                {state === 'idle' || state === 'error' ? (
                    <TouchableOpacity style={styles.actionBtnWrap} onPress={requestLocation} activeOpacity={0.8}>
                        <LinearGradient
                            colors={[colors.primary, '#0055CC']}
                            style={styles.actionBtn}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        >
                            <Ionicons name="navigate" size={20} color="#FFF" />
                            <Text style={styles.actionText} allowFontScaling={false}>
                                {state === 'error' ? 'Retry Detection' : 'Detect My Location'}
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>
                ) : state === 'success' ? (
                    <TouchableOpacity style={styles.actionBtnWrap} onPress={handleConfirm} activeOpacity={0.8}>
                        <LinearGradient
                            colors={[colors.success, '#28A745']}
                            style={styles.actionBtn}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        >
                            <Ionicons name="checkmark" size={20} color="#FFF" />
                            <Text style={styles.actionText} allowFontScaling={false}>Confirm & Continue</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                ) : null}

                {/* Skip */}
                {state !== 'detecting' && (
                    <TouchableOpacity onPress={handleConfirm} style={styles.skipBtn}>
                        <Text style={styles.skipText}>Skip for now</Text>
                    </TouchableOpacity>
                )}

                {/* Features */}
                <View style={styles.features}>
                    {[
                        { icon: 'shield-checkmark', text: 'Your data stays private & secure', color: colors.success },
                        { icon: 'map', text: 'See civic issues in your neighborhood', color: colors.primary },
                        { icon: 'flash', text: 'Auto-attach GPS to every report', color: colors.warning },
                    ].map((f, i) => (
                        <View key={i} style={styles.featureItem}>
                            <View style={[styles.featureIcon, { backgroundColor: f.color + '15' }]}>
                                <Ionicons name={f.icon as any} size={14} color={f.color} />
                            </View>
                            <Text style={styles.featureText} allowFontScaling={false}>{f.text}</Text>
                        </View>
                    ))}
                </View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    bgGlow: {
        position: 'absolute',
        top: '10%', left: '10%',
        width: width * 0.8, height: width * 0.8,
        borderRadius: width * 0.4,
        backgroundColor: 'rgba(0,122,255,0.04)',
    },
    content: { flex: 1, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center' },
    iconOuter: { marginBottom: 24, alignItems: 'center', justifyContent: 'center' },
    radarRing: {
        position: 'absolute',
        width: 140, height: 140, borderRadius: 70,
        overflow: 'hidden',
    },
    radarGradient: {
        width: 70, height: 70,
        borderTopLeftRadius: 70,
    },
    iconRing: {
        width: 110, height: 110, borderRadius: 55,
        backgroundColor: 'rgba(0,122,255,0.08)',
        borderWidth: 1.5, borderColor: 'rgba(0,122,255,0.2)',
        justifyContent: 'center', alignItems: 'center',
    },
    iconInner: {
        width: 72, height: 72, borderRadius: 36,
        backgroundColor: 'rgba(0,122,255,0.12)',
        justifyContent: 'center', alignItems: 'center',
    },
    greeting: {
        fontFamily: 'Inter_600SemiBold', fontSize: 17, color: colors.primary,
        marginBottom: 6, includeFontPadding: false,
    },
    title: {
        fontFamily: 'Inter_700Bold', fontSize: 26, color: '#FFF',
        textAlign: 'center', marginBottom: 10, includeFontPadding: false,
    },
    subtitle: {
        fontFamily: 'Inter_400Regular', fontSize: 14, color: 'rgba(255,255,255,0.45)',
        textAlign: 'center', lineHeight: 20, marginBottom: 20, includeFontPadding: false,
    },
    accuracyBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: 'rgba(0,122,255,0.1)', paddingHorizontal: 12, paddingVertical: 6,
        borderRadius: 20, marginBottom: 16,
    },
    accuracyText: {
        fontFamily: 'Inter_500Medium', fontSize: 12, color: colors.primaryLight,
        includeFontPadding: false,
    },
    mapContainer: {
        width: '100%', borderRadius: radius.lg, overflow: 'hidden',
        marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    miniMap: {
        width: '100%', height: 180,
    },
    mapPin: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: colors.primary,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: colors.primary, shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5, shadowRadius: 8, elevation: 6,
    },
    locationInfo: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: 14, paddingVertical: 10,
        backgroundColor: 'rgba(48,209,88,0.06)',
    },
    locationAddr: {
        fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#FFF',
        includeFontPadding: false,
    },
    locationSub: {
        fontFamily: 'Inter_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.4)',
        marginTop: 2, includeFontPadding: false,
    },
    detectingRow: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        marginBottom: 20,
    },
    detectingText: {
        fontFamily: 'Inter_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.4)',
        includeFontPadding: false,
    },
    actionBtnWrap: { width: '100%', borderRadius: radius.lg, overflow: 'hidden', marginBottom: 12 },
    actionBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        paddingVertical: 16, borderRadius: radius.lg,
    },
    actionText: {
        fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 16, includeFontPadding: false,
    },
    skipBtn: { marginBottom: 32 },
    skipText: {
        fontFamily: 'Inter_500Medium', color: 'rgba(255,255,255,0.3)', fontSize: 14,
        includeFontPadding: false,
    },
    features: { width: '100%', gap: 10 },
    featureItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    featureIcon: {
        width: 28, height: 28, borderRadius: 14,
        justifyContent: 'center', alignItems: 'center',
    },
    featureText: {
        fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.4)',
        fontSize: 13, includeFontPadding: false,
    },
});
