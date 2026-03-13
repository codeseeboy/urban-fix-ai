import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { colors, fonts, radius } from '../../theme/colors';
import logger from '../../utils/logger';
import AuthCanvas from '../../components/auth/AuthCanvas';

export default function RegisterScreen({ navigation }: any) {
    const { register, loginWithGoogle } = useAuth();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(16)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 420, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 420, useNativeDriver: true }),
        ]).start();
    }, [fadeAnim, slideAnim]);

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

    const handleOTPSignup = () => {
        logger.tap('RegisterScreen', 'OTP Signup');
        navigation.navigate('MagicLink', { mode: 'signup' });
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
            <AuthCanvas />
            <Animated.View style={[styles.inner, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                <LinearGradient colors={[colors.primary, '#0055CC']} style={styles.logo}>
                    <Text style={styles.logoText}>U</Text>
                </LinearGradient>
                <Text style={styles.title}>Create Account</Text>
                <Text style={styles.subtitle}>Start reporting smarter with UrbanFix AI</Text>

                <View style={styles.formCard}>
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
    subtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, color: 'rgba(255,255,255,0.65)', textAlign: 'center', marginBottom: 26, marginTop: 4 },
    formCard: {
        backgroundColor: 'rgba(15,18,32,0.72)',
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        padding: 12,
    },
    inputWrap: {
        flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface,
        borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 14,
        borderWidth: 1, borderColor: colors.border, marginBottom: 10,
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
