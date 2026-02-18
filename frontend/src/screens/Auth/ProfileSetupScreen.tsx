import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Animated, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { userAPI } from '../../services/api';
import logger from '../../utils/logger';
import { colors, fonts, radius } from '../../theme/colors';

const INTERESTS = [
    { id: 'roads', icon: 'car-outline', label: 'Roads' },
    { id: 'lighting', icon: 'bulb-outline', label: 'Lighting' },
    { id: 'garbage', icon: 'trash-outline', label: 'Garbage' },
    { id: 'water', icon: 'water-outline', label: 'Water' },
    { id: 'parks', icon: 'leaf-outline', label: 'Parks' },
    { id: 'drainage', icon: 'rainy-outline', label: 'Drainage' },
    { id: 'electricity', icon: 'flash-outline', label: 'Electricity' },
    { id: 'safety', icon: 'shield-outline', label: 'Safety' },
];

const WARDS = ['Central Ward', 'North Ward', 'South Ward', 'East Ward', 'West Ward'];

export default function ProfileSetupScreen() {
    const { user, completeProfileSetup } = useAuth();
    const [username, setUsername] = useState('');
    const [city, setCity] = useState('');
    const [ward, setWard] = useState('');
    const [interests, setInterests] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, []);

    const toggleInterest = (id: string) => {
        setInterests(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleSave = async () => {
        logger.tap('ProfileSetup', 'Save Profile', { username, city, ward, interests });
        if (!username.trim()) { Alert.alert('Required', 'Please choose a username'); return; }
        if (!city.trim()) { Alert.alert('Required', 'Please enter your city'); return; }
        if (!ward) { Alert.alert('Required', 'Please select your ward/locality'); return; }
        if (interests.length === 0) { Alert.alert('Required', 'Please select at least one interest'); return; }

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

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                <Animated.View style={[styles.inner, { opacity: fadeAnim }]}>
                    {/* Header */}
                    <View style={styles.headerSection}>
                        <LinearGradient colors={[colors.primary, '#0055CC']} style={styles.headerIcon}>
                            <Ionicons name="person-add" size={32} color="#FFF" />
                        </LinearGradient>
                        <Text style={styles.title}>Complete Your Profile</Text>
                        <Text style={styles.subtitle}>Help us personalize your civic experience</Text>
                    </View>

                    {/* Username */}
                    <Text style={styles.label}>Username</Text>
                    <View style={styles.inputWrap}>
                        <Text style={styles.atSign}>@</Text>
                        <TextInput style={styles.input} placeholder="choose a unique username"
                            placeholderTextColor={colors.textMuted} value={username}
                            onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                            autoCapitalize="none" maxLength={20} />
                    </View>

                    {/* City */}
                    <Text style={styles.label}>City</Text>
                    <View style={styles.inputWrap}>
                        <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
                        <TextInput style={styles.input} placeholder="Enter your city"
                            placeholderTextColor={colors.textMuted} value={city} onChangeText={setCity} />
                    </View>

                    {/* Ward */}
                    <Text style={styles.label}>Ward / Locality</Text>
                    <View style={styles.wardGrid}>
                        {WARDS.map((w) => (
                            <TouchableOpacity key={w} style={[styles.wardChip, ward === w && styles.wardActive]}
                                onPress={() => setWard(w)} activeOpacity={0.7}>
                                <Text style={[styles.wardText, ward === w && styles.wardTextActive]}>{w}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Interests */}
                    <Text style={styles.label}>What issues matter to you?</Text>
                    <Text style={styles.labelSub}>Select topics to personalize your feed</Text>
                    <View style={styles.interestGrid}>
                        {INTERESTS.map((item) => {
                            const selected = interests.includes(item.id);
                            return (
                                <TouchableOpacity key={item.id}
                                    style={[styles.interestItem, selected && styles.interestActive]}
                                    onPress={() => toggleInterest(item.id)} activeOpacity={0.7}>
                                    <Ionicons name={item.icon as any} size={22}
                                        color={selected ? '#FFF' : colors.textSecondary} />
                                    <Text style={[styles.interestLabel, selected && { color: '#FFF' }]}>{item.label}</Text>
                                    {selected && <Ionicons name="checkmark-circle" size={14} color="#FFF" style={styles.checkIcon} />}
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Save */}
                    <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.85} style={styles.btnWrap}>
                        <LinearGradient colors={[colors.primary, '#0055CC']} style={styles.btn}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                            <Text style={styles.btnText}>{saving ? 'Setting up...' : 'Start Exploring'}</Text>
                            <Ionicons name="arrow-forward" size={18} color="#FFF" />
                        </LinearGradient>
                    </TouchableOpacity>
                </Animated.View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    inner: { paddingHorizontal: 24, paddingTop: 60 },
    headerSection: { alignItems: 'center', marginBottom: 30 },
    headerIcon: {
        width: 72, height: 72, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 16,
        shadowColor: colors.primary, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
    },
    title: { fontFamily: 'Inter_900Black', fontSize: 24, color: colors.text, letterSpacing: -0.5 },
    subtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textSecondary, marginTop: 6 },
    label: { fontFamily: 'Inter_600SemiBold', color: colors.text, fontSize: 14, marginBottom: 8, marginTop: 20 },
    labelSub: { fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 12, marginBottom: 10, marginTop: -4 },
    inputWrap: {
        flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface,
        borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 14,
        borderWidth: 1, borderColor: colors.border,
    },
    atSign: { fontFamily: 'Inter_600SemiBold', color: colors.primary, fontSize: 16 },
    input: { flex: 1, fontFamily: 'Inter_400Regular', color: colors.text, fontSize: 15 },
    wardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    wardChip: {
        paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
        backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    },
    wardActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    wardText: { fontFamily: 'Inter_500Medium', color: colors.textSecondary, fontSize: 13 },
    wardTextActive: { color: '#FFF' },
    interestGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    interestItem: {
        width: '23%', alignItems: 'center', paddingVertical: 14, borderRadius: radius.md,
        backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, position: 'relative',
    },
    interestActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    interestLabel: { fontFamily: 'Inter_500Medium', color: colors.textSecondary, fontSize: 10, marginTop: 4 },
    checkIcon: { position: 'absolute', top: 4, right: 4 },
    btnWrap: { borderRadius: radius.md, overflow: 'hidden', marginTop: 28 },
    btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: radius.md },
    btnText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 16 },
});
