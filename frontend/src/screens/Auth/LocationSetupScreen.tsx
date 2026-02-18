import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { colors, fonts, radius } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';

export default function LocationSetupScreen() {
    const { completeLocationSetup, user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [address, setAddress] = useState<string | null>(null);
    const [granted, setGranted] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(40)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        ]).start();

        // Pulse animation for the icon
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    const requestLocation = async () => {
        setLoading(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Location access helps us show nearby issues and route your reports to the right municipal department.');
                setLoading(false);
                return;
            }
            setGranted(true);
            const location = await Location.getCurrentPositionAsync({});
            const reverseGeocode = await Location.reverseGeocodeAsync({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            });
            if (reverseGeocode.length > 0) {
                const geo = reverseGeocode[0];
                setAddress(`${geo.name || ''}, ${geo.city || geo.subregion || ''}, ${geo.region || ''}`);
            } else {
                setAddress('Location detected');
            }
        } catch (err) {
            setAddress('Location detected');
        }
        setLoading(false);
    };

    const handleConfirm = async () => {
        await completeLocationSetup();
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['rgba(0,122,255,0.08)', 'transparent']}
                style={styles.gradientBg}
            />

            <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                {/* Pulsing Location Icon */}
                <Animated.View style={[styles.iconContainer, { transform: [{ scale: pulseAnim }] }]}>
                    <View style={styles.iconRing}>
                        <View style={styles.iconInner}>
                            <Ionicons name="location" size={48} color={colors.primary} />
                        </View>
                    </View>
                </Animated.View>

                <Text style={styles.greeting}>Hey {user?.name?.split(' ')[0]}! 👋</Text>
                <Text style={styles.title}>Where are you located?</Text>
                <Text style={styles.subtitle}>
                    We use your location to show nearby issues{'\n'}and route reports to the correct ward.
                </Text>

                {/* Location Result */}
                {address && (
                    <View style={styles.locationResult}>
                        <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                        <Text style={styles.locationText}>{address}</Text>
                    </View>
                )}

                {/* Detect Button */}
                {!address ? (
                    <TouchableOpacity style={styles.detectButton} onPress={requestLocation} disabled={loading} activeOpacity={0.8}>
                        <LinearGradient colors={[colors.primary, '#0055CC']} style={styles.detectGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                            <Ionicons name={loading ? 'sync' : 'navigate'} size={22} color="#FFF" />
                            <Text style={styles.detectText}>{loading ? 'Detecting...' : 'Detect My Location'}</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm} activeOpacity={0.8}>
                        <LinearGradient colors={[colors.success, '#28A745']} style={styles.detectGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                            <Ionicons name="checkmark" size={22} color="#FFF" />
                            <Text style={styles.detectText}>Confirm & Continue</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                )}

                {/* Skip */}
                <TouchableOpacity onPress={handleConfirm} style={styles.skip}>
                    <Text style={styles.skipText}>Skip for now</Text>
                </TouchableOpacity>

                {/* Features List */}
                <View style={styles.features}>
                    {[
                        { icon: 'shield-checkmark', text: 'Your data is kept private & secure' },
                        { icon: 'map', text: 'See civic issues near you' },
                        { icon: 'flash', text: 'Faster reports with auto-location' },
                    ].map((f, i) => (
                        <View key={i} style={styles.featureItem}>
                            <Ionicons name={f.icon as any} size={18} color={colors.primaryLight} />
                            <Text style={styles.featureText}>{f.text}</Text>
                        </View>
                    ))}
                </View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center' },
    gradientBg: { ...StyleSheet.absoluteFillObject },
    content: { paddingHorizontal: 28, alignItems: 'center' },
    iconContainer: { marginBottom: 28 },
    iconRing: {
        width: 120, height: 120, borderRadius: 60,
        backgroundColor: colors.primary + '10', justifyContent: 'center', alignItems: 'center',
        borderWidth: 2, borderColor: colors.primary + '30',
    },
    iconInner: {
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: colors.primary + '20', justifyContent: 'center', alignItems: 'center',
    },
    greeting: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: colors.primary, marginBottom: 8 },
    title: { fontFamily: 'Inter_700Bold', fontSize: 28, color: colors.text, textAlign: 'center', marginBottom: 12 },
    subtitle: { fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
    locationResult: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: colors.success + '15', borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 12,
        marginBottom: 20, borderWidth: 1, borderColor: colors.success + '30',
    },
    locationText: { fontFamily: 'Inter_500Medium', color: colors.success, fontSize: 14 },
    detectButton: { width: '100%', marginBottom: 16, borderRadius: radius.lg, overflow: 'hidden' },
    confirmButton: { width: '100%', marginBottom: 16, borderRadius: radius.lg, overflow: 'hidden' },
    detectGradient: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        paddingVertical: 16, borderRadius: radius.lg,
    },
    detectText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 16 },
    skip: { marginBottom: 40 },
    skipText: { fontFamily: 'Inter_500Medium', color: colors.textSecondary, fontSize: 14 },
    features: { width: '100%', gap: 12 },
    featureItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    featureText: { fontFamily: 'Inter_400Regular', color: colors.textSecondary, fontSize: 13 },
});
