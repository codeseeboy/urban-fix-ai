import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import logger from '../../utils/logger';
import { colors, fonts, radius } from '../../theme/colors';

export default function LoginScreen({ navigation }: any) {
    const { login } = useAuth();
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
                        <Text style={styles.btnText}>{loading ? 'Logging in...' : 'Sign In'}</Text>
                    </LinearGradient>
                </TouchableOpacity>

                {/* Test Accounts */}
                <View style={styles.testBox}>
                    <Text style={styles.testTitle}>Quick Test Logins:</Text>
                    <TouchableOpacity onPress={() => { logger.tap('LoginScreen', 'Quick Login - Citizen'); setEmail('priya@test.com'); setPassword('pass123'); }}>
                        <Text style={styles.testItem}>👩 Citizen: priya@test.com / pass123</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { logger.tap('LoginScreen', 'Quick Login - Admin'); setEmail('admin@urbanfix.com'); setPassword('admin123'); }}>
                        <Text style={styles.testItem}>🏛️ Admin: admin@urbanfix.com / admin123</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { logger.tap('LoginScreen', 'Quick Login - Worker'); setEmail('suresh@urbanfix.com'); setPassword('worker123'); }}>
                        <Text style={styles.testItem}>👷 Worker: suresh@urbanfix.com / worker123</Text>
                    </TouchableOpacity>
                </View>

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
    testBox: {
        marginTop: 24, backgroundColor: colors.surface, borderRadius: radius.md,
        padding: 14, borderWidth: 1, borderColor: colors.border,
    },
    testTitle: { fontFamily: 'Inter_600SemiBold', color: colors.textSecondary, fontSize: 12, marginBottom: 8 },
    testItem: { fontFamily: 'Inter_400Regular', color: colors.primary, fontSize: 12, paddingVertical: 4 },
    registerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
    registerText: { fontFamily: 'Inter_400Regular', color: colors.textSecondary, fontSize: 14 },
    registerLink: { fontFamily: 'Inter_700Bold', color: colors.primary, fontSize: 14 },
});
