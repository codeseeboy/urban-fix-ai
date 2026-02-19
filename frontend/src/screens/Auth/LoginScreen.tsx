import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import logger from '../../utils/logger';
import { colors, fonts, radius } from '../../theme/colors';

export default function LoginScreen({ navigation }: any) {
    const { login, loginWithOTP, loginWithGoogle } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, []);

    const handleLogin = async () => {
        logger.tap('LoginScreen', 'Sign In', { email });
        if (!email.trim() || !password.trim()) {
            Alert.alert('Required', 'Please enter email and password');
            return;
        }
        setLoading(true);
        const result = await login(email.trim(), password.trim());
        setLoading(false);
        if (!result.success) {
            Alert.alert('Login Failed', result.error);
        }
        // Success auto-navigates via AuthContext
    };

    const handleOTPLogin = async () => {
        logger.tap('LoginScreen', 'Magic Link Login', { email });
        if (!email.trim()) {
            Alert.alert('Required', 'Please enter your email address');
            return;
        }
        setLoading(true);
        const result = await loginWithOTP(email.trim());
        setLoading(false);
        if (result.success) {
            Alert.alert(
                'Check Your Email',
                'We sent a magic link to your email. Click it to sign in instantly.',
                [{ text: 'OK' }]
            );
        } else {
            Alert.alert('Error', result.error);
        }
    };

    const handleGoogleLogin = async () => {
        logger.tap('LoginScreen', 'Google Login');
        setLoading(true);
        const result = await loginWithGoogle();
        // If success, deep link listener in AuthContext handles navigation
        if (!result.success) {
            setLoading(false);
            Alert.alert('Google Login Failed', result.error);
        }
    };

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <Animated.View style={[styles.inner, { opacity: fadeAnim }]}>
                {/* Logo */}
                <LinearGradient colors={[colors.primary, '#0055CC']} style={styles.logo}>
                    <Text style={styles.logoText}>U</Text>
                </LinearGradient>
                <Text style={styles.title}>UrbanFix AI</Text>
                <Text style={styles.subtitle}>Detect • Report • Improve Your City</Text>

                {/* Form */}
                <View style={styles.inputWrap}>
                    <Ionicons name="mail-outline" size={18} color={colors.textSecondary} />
                    <TextInput style={styles.input} placeholder="Email" placeholderTextColor={colors.textMuted}
                        value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
                </View>

                <View style={styles.inputWrap}>
                    <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} />
                    <TextInput style={styles.input} placeholder="Password" placeholderTextColor={colors.textMuted}
                        value={password} onChangeText={setPassword} secureTextEntry={!showPass} />
                    <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                        <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>

                {/* Login Button */}
                <TouchableOpacity onPress={handleLogin} disabled={loading} activeOpacity={0.85} style={styles.btnWrap}>
                    <LinearGradient colors={[colors.primary, '#0055CC']} style={styles.btn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                        <Text style={styles.btnText}>{loading ? 'Logging in...' : 'Sign In with Password'}</Text>
                    </LinearGradient>
                </TouchableOpacity>

                <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>OR</Text>
                    <View style={styles.dividerLine} />
                </View>

                {/* Email Magic Link Login */}
                <TouchableOpacity onPress={handleOTPLogin} disabled={loading} activeOpacity={0.85} style={[styles.btnWrap, styles.secondaryBtn]}>
                    <View style={styles.btnContent}>
                        <Ionicons name="mail-unread-outline" size={20} color={colors.primary} />
                        <Text style={styles.secondaryBtnText}>Continue with Email Link</Text>
                    </View>
                </TouchableOpacity>

                {/* Google Login */}
                <TouchableOpacity onPress={handleGoogleLogin} disabled={loading} activeOpacity={0.85} style={[styles.btnWrap, styles.secondaryBtn, { marginTop: 12 }]}>
                    <View style={styles.btnContent}>
                        <Ionicons name="logo-google" size={20} color="#DB4437" />
                        <Text style={styles.secondaryBtnText}>Continue with Google</Text>
                    </View>
                </TouchableOpacity>



                {/* Register link */}
                <TouchableOpacity style={styles.registerRow} onPress={() => { logger.tap('LoginScreen', 'Sign Up link'); navigation.navigate('Register'); }}>
                    <Text style={styles.registerText}>Don't have an account? </Text>
                    <Text style={styles.registerLink}>Sign Up</Text>
                </TouchableOpacity>
            </Animated.View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center' },
    inner: { paddingHorizontal: 28 },
    logo: {
        width: 64, height: 64, borderRadius: 18, justifyContent: 'center', alignItems: 'center',
        alignSelf: 'center', marginBottom: 16,
        shadowColor: colors.primary, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
    },
    logoText: { fontFamily: 'Inter_900Black', fontSize: 32, color: '#FFF' },
    title: { fontFamily: 'Inter_900Black', fontSize: 28, color: colors.text, textAlign: 'center', letterSpacing: -1 },
    subtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: 32, marginTop: 4 },
    inputWrap: {
        flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface,
        borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 14,
        borderWidth: 1, borderColor: colors.border, marginBottom: 12,
    },
    input: { flex: 1, fontFamily: 'Inter_400Regular', color: colors.text, fontSize: 15 },
    btnWrap: { borderRadius: radius.md, overflow: 'hidden', marginTop: 8 },
    btn: { paddingVertical: 16, alignItems: 'center', borderRadius: radius.md },
    btnText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 16 },
    secondaryBtn: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    secondaryBtnText: { fontFamily: 'Inter_600SemiBold', color: colors.text, fontSize: 16 },
    btnContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 10 },
    divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: { marginHorizontal: 16, color: colors.textSecondary, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
    registerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
    registerText: { fontFamily: 'Inter_400Regular', color: colors.textSecondary, fontSize: 14 },
    registerLink: { fontFamily: 'Inter_700Bold', color: colors.primary, fontSize: 14 },
});
