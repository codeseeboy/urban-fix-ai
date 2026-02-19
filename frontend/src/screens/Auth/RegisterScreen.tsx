import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { colors, fonts, radius } from '../../theme/colors';
import logger from '../../utils/logger';

export default function RegisterScreen({ navigation }: any) {
    const { register, loginWithOTP, loginWithGoogle } = useAuth();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, []);

    const handleRegister = async () => {
        logger.tap('RegisterScreen', 'Sign Up', { email });
        if (!name.trim() || !email.trim() || !password.trim()) {
            Alert.alert('Required', 'All fields are required');
            return;
        }
        if (password.length < 4) {
            Alert.alert('Weak Password', 'Password must be at least 4 characters');
            return;
        }
        setLoading(true);
        const result = await register(name.trim(), email.trim(), password.trim());
        setLoading(false);
        if (!result.success) {
            Alert.alert('Registration Failed', result.error);
        }
    };

    const handleOTPSignup = async () => {
        logger.tap('RegisterScreen', 'OTP Signup', { email });
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
                'We sent a magic link to your email. Click it to complete signup.',
                [{ text: 'OK' }]
            );
        } else {
            Alert.alert('Error', result.error);
        }
    };

    const handleGoogleSignup = async () => {
        logger.tap('RegisterScreen', 'Google Signup');
        setLoading(true);
        const result = await loginWithGoogle();
        setLoading(false);
        if (!result.success) {
            Alert.alert('Google Signup Failed', result.error);
        }
    };

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <Animated.View style={[styles.inner, { opacity: fadeAnim }]}>
                <LinearGradient colors={[colors.primary, '#0055CC']} style={styles.logo}>
                    <Text style={styles.logoText}>U</Text>
                </LinearGradient>
                <Text style={styles.title}>Create Account</Text>
                <Text style={styles.subtitle}>Join your civic community</Text>

                <View style={styles.inputWrap}>
                    <Ionicons name="person-outline" size={18} color={colors.textSecondary} />
                    <TextInput style={styles.input} placeholder="Full Name" placeholderTextColor={colors.textMuted}
                        value={name} onChangeText={setName} />
                </View>

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

                <TouchableOpacity onPress={handleRegister} disabled={loading} activeOpacity={0.85} style={styles.btnWrap}>
                    <LinearGradient colors={[colors.primary, '#0055CC']} style={styles.btn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                        <Text style={styles.btnText}>{loading ? 'Creating Account...' : 'Sign Up with Password'}</Text>
                    </LinearGradient>
                </TouchableOpacity>

                <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>OR</Text>
                    <View style={styles.dividerLine} />
                </View>

                {/* Email Magic Link Signup */}
                <TouchableOpacity onPress={handleOTPSignup} disabled={loading} activeOpacity={0.85} style={[styles.btnWrap, styles.secondaryBtn]}>
                    <View style={styles.btnContent}>
                        <Ionicons name="mail-unread-outline" size={20} color={colors.primary} />
                        <Text style={styles.secondaryBtnText}>Continue with Email Link</Text>
                    </View>
                </TouchableOpacity>

                {/* Google Signup */}
                <TouchableOpacity onPress={handleGoogleSignup} disabled={loading} activeOpacity={0.85} style={[styles.btnWrap, styles.secondaryBtn, { marginTop: 12 }]}>
                    <View style={styles.btnContent}>
                        <Ionicons name="logo-google" size={20} color="#DB4437" />
                        <Text style={styles.secondaryBtnText}>Continue with Google</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.loginRow} onPress={() => navigation.goBack()}>
                    <Text style={styles.loginText}>Already have an account? </Text>
                    <Text style={styles.loginLink}>Sign In</Text>
                </TouchableOpacity>
            </Animated.View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center' },
    inner: { paddingHorizontal: 28 },
    logo: {
        width: 64, height: 64, borderRadius: 18, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 16,
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
    divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: { marginHorizontal: 16, color: colors.textSecondary, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
    loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
    loginText: { fontFamily: 'Inter_400Regular', color: colors.textSecondary, fontSize: 14 },
    loginLink: { fontFamily: 'Inter_700Bold', color: colors.primary, fontSize: 14 },
});
