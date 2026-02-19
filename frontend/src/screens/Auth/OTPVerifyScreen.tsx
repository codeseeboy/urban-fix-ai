import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { colors, radius } from '../../theme/colors';
import logger from '../../utils/logger';

export default function OTPVerifyScreen({ route, navigation }: any) {
    const { email } = route.params || {};
    const { verifyOTP, loginWithOTP } = useAuth();

    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [timer, setTimer] = useState(60);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // Auto-focus logic using ref not strictly needed if we autoFocus the input
    const inputRef = useRef<TextInput>(null);

    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
        if (!email) {
            Alert.alert('Error', 'Email missing', [{ text: 'Back', onPress: () => navigation.goBack() }]);
        }
    }, []);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (timer > 0) {
            interval = setInterval(() => setTimer(t => t - 1), 1000);
        }
        return () => clearInterval(interval);
    }, [timer]);

    const handleVerify = async () => {
        if (code.length !== 6) {
            Alert.alert('Invalid Code', 'Please enter the 6-digit code');
            return;
        }

        setLoading(true);
        const result = await verifyOTP(email, code);
        setLoading(false);

        if (result.success) {
            // Navigation handled by AuthContext state change or:
            // logic in AuthContext handles the user/token storage
        } else {
            Alert.alert('Verification Failed', result.error || 'Invalid code');
        }
    };

    const handleResend = async () => {
        if (timer > 0) return;
        setLoading(true);
        const result = await loginWithOTP(email);
        setLoading(false);

        if (result.success) {
            setTimer(60);
            Alert.alert('Sent', 'New code sent to your email');
        } else {
            Alert.alert('Error', result.error);
        }
    };

    // Render 6 boxes for the code
    const renderBoxes = () => {
        const boxes = [];
        for (let i = 0; i < 6; i++) {
            const digit = code[i] || '';
            const isFocused = i === code.length;
            boxes.push(
                <TouchableOpacity key={i} activeOpacity={1} onPress={() => inputRef.current?.focus()}
                    style={[
                        styles.box,
                        digit ? styles.boxFilled : null,
                        isFocused ? styles.boxFocused : null
                    ]}>
                    <Text style={styles.boxText}>{digit}</Text>
                </TouchableOpacity>
            );
        }
        return boxes;
    };

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <Animated.View style={[styles.inner, { opacity: fadeAnim }]}>

                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>

                <View style={styles.iconWrap}>
                    <LinearGradient colors={[colors.primary, '#0055CC']} style={styles.iconBg}>
                        <Ionicons name="shield-checkmark-outline" size={32} color="#FFF" />
                    </LinearGradient>
                </View>

                <Text style={styles.title}>Verification Code</Text>
                <Text style={styles.subtitle}>Enter the 6-digit code sent to{'\n'}<Text style={{ color: colors.text }}>{email}</Text></Text>

                <View style={styles.codeContainer}>
                    {renderBoxes()}
                </View>

                {/* Hidden Input */}
                <TextInput
                    ref={inputRef}
                    style={styles.hiddenInput}
                    value={code}
                    onChangeText={(text) => setCode(text.replace(/[^0-9]/g, '').slice(0, 6))}
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    autoFocus
                />

                <TouchableOpacity onPress={handleVerify} disabled={loading || code.length !== 6} activeOpacity={0.85} style={styles.btnWrap}>
                    <LinearGradient
                        colors={code.length === 6 ? [colors.primary, '#0055CC'] : [colors.border, colors.border]}
                        style={styles.btn}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                        <Text style={styles.btnText}>{loading ? 'Verifying...' : 'Verify Code'}</Text>
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.resendRow}
                    onPress={handleResend}
                    disabled={timer > 0 || loading}>
                    <Text style={styles.resendText}>
                        {timer > 0 ? `Resend code in ${timer}s` : "Didn't receive code? "}
                    </Text>
                    {timer === 0 && <Text style={styles.resendLink}>Resend</Text>}
                </TouchableOpacity>

            </Animated.View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center' },
    inner: { paddingHorizontal: 28 },
    backBtn: { position: 'absolute', top: -60, left: 28, zIndex: 10, padding: 8 },
    iconWrap: { alignItems: 'center', marginBottom: 24 },
    iconBg: { width: 72, height: 72, borderRadius: 24, justifyContent: 'center', alignItems: 'center', shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
    title: { fontFamily: 'Inter_900Black', fontSize: 26, color: colors.text, textAlign: 'center', marginBottom: 8 },
    subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 32, lineHeight: 22 },
    codeContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32, gap: 8 },
    box: {
        width: 44, height: 50, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border,
        justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface
    },
    boxFilled: { borderColor: colors.primary, backgroundColor: '#F0F7FF' },
    boxFocused: { borderColor: colors.primary, borderWidth: 2 },
    boxText: { fontFamily: 'Inter_700Bold', fontSize: 20, color: colors.text },
    hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },
    btnWrap: { borderRadius: radius.md, overflow: 'hidden' },
    btn: { paddingVertical: 16, alignItems: 'center', borderRadius: radius.md },
    btnText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 16 },
    resendRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
    resendText: { fontFamily: 'Inter_400Regular', color: colors.textSecondary, fontSize: 14 },
    resendLink: { fontFamily: 'Inter_700Bold', color: colors.primary, fontSize: 14 },
});
