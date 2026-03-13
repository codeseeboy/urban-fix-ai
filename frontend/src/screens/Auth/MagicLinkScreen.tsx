/**
 * MagicLinkScreen — Clean email entry screen for magic link authentication
 * Opens when user clicks "Sign up with Email Link" from login/register screens
 */
import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    KeyboardAvoidingView, Platform, Alert, Animated, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { colors, fonts, radius } from '../../theme/colors';
import logger from '../../utils/logger';
import AuthCanvas from '../../components/auth/AuthCanvas';

export default function MagicLinkScreen({ navigation, route }: any) {
    const insets = useSafeAreaInsets();
    const { loginWithOTP } = useAuth();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    const isSignup = route?.params?.mode === 'signup';

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 65, useNativeDriver: true }),
        ]).start();
    }, []);

    const isValidEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const handleSendLink = async () => {
        logger.tap('MagicLinkScreen', 'Send Magic Link', { email });

        if (!email.trim()) {
            Alert.alert('Email Required', 'Please enter your email address');
            return;
        }

        if (!isValidEmail(email.trim())) {
            Alert.alert('Invalid Email', 'Please enter a valid email address');
            return;
        }

        setLoading(true);
        const result = await loginWithOTP(email.trim());
        setLoading(false);

        if (result.success) {
            setSent(true);
        } else {
            Alert.alert('Error', result.error || 'Failed to send magic link. Please try again.');
        }
    };

    const handleResend = async () => {
        setSent(false);
        setLoading(true);
        const result = await loginWithOTP(email.trim());
        setLoading(false);

        if (result.success) {
            setSent(true);
            Alert.alert('Link Sent!', 'Check your email for the new magic link.');
        } else {
            Alert.alert('Error', result.error || 'Failed to resend. Please try again.');
        }
    };

    if (sent) {
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <AuthCanvas />
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>

                <Animated.View style={[styles.inner, styles.formCard, { opacity: fadeAnim }]}>
                    <View style={styles.successIcon}>
                        <LinearGradient colors={['#30D158', '#28B14C']} style={styles.successGradient}>
                            <Ionicons name="mail-open-outline" size={48} color="#FFF" />
                        </LinearGradient>
                    </View>

                    <Text style={styles.successTitle}>Check Your Email</Text>
                    <Text style={styles.successSubtitle}>
                        We sent a magic link to{'\n'}
                        <Text style={styles.emailHighlight}>{email}</Text>
                    </Text>
                    <Text style={styles.instructions}>
                        Click the link in the email to {isSignup ? 'complete your signup' : 'sign in'} instantly.
                        The link expires in 1 hour.
                    </Text>

                    <View style={styles.tipsBox}>
                        <Text style={styles.tipsTitle}>Didn't receive it?</Text>
                        <Text style={styles.tipItem}>• Check your spam/junk folder</Text>
                        <Text style={styles.tipItem}>• Make sure the email is correct</Text>
                        <Text style={styles.tipItem}>• Wait a few minutes and try again</Text>
                    </View>

                    <TouchableOpacity onPress={handleResend} disabled={loading} style={styles.resendBtn}>
                        {loading ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                            <Text style={styles.resendText}>Resend Magic Link</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => { setSent(false); setEmail(''); }} style={styles.changeEmailBtn}>
                        <Text style={styles.changeEmailText}>Use a different email</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={[styles.container, { paddingTop: insets.top }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <AuthCanvas />
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>

            <Animated.View
                style={[
                    styles.inner,
                    styles.formCard,
                    { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
                ]}
            >
                <View style={styles.iconWrap}>
                    <LinearGradient colors={[colors.primary, '#0055CC']} style={styles.iconGradient}>
                        <Ionicons name="sparkles" size={32} color="#FFF" />
                    </LinearGradient>
                </View>

                <Text style={styles.title}>
                    {isSignup ? 'Sign Up with Email' : 'Sign In with Email'}
                </Text>
                <Text style={styles.subtitle}>
                    Enter your email and we'll send you a magic link.{'\n'}
                    No password needed!
                </Text>

                <View style={styles.inputContainer}>
                    <View style={styles.inputWrap}>
                        <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your email"
                            placeholderTextColor={colors.textMuted}
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoFocus
                        />
                        {email.length > 0 && (
                            <TouchableOpacity onPress={() => setEmail('')}>
                                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                <TouchableOpacity
                    onPress={handleSendLink}
                    disabled={loading || !email.trim()}
                    activeOpacity={0.85}
                    style={styles.btnWrap}
                >
                    <LinearGradient
                        colors={email.trim() ? [colors.primary, '#0055CC'] : [colors.border, colors.border]}
                        style={styles.btn}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                    >
                        {loading ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <>
                                <Ionicons name="paper-plane" size={18} color="#FFF" />
                                <Text style={styles.btnText}>Send Magic Link</Text>
                            </>
                        )}
                    </LinearGradient>
                </TouchableOpacity>

                <View style={styles.infoBox}>
                    <Ionicons name="shield-checkmark-outline" size={16} color={colors.textMuted} />
                    <Text style={styles.infoText}>
                        Magic links are secure and expire after 1 hour. We'll never share your email.
                    </Text>
                </View>
            </Animated.View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    backBtn: {
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    inner: {
        flex: 1,
        paddingHorizontal: 28,
        paddingTop: 20,
    },
    formCard: {
        marginTop: 12,
        marginHorizontal: 12,
        borderRadius: radius.xl,
        backgroundColor: 'rgba(15,18,32,0.72)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    iconWrap: {
        alignSelf: 'center',
        marginBottom: 24,
    },
    iconGradient: {
        width: 72,
        height: 72,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: colors.primary,
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 8,
    },
    title: {
        fontFamily: fonts.bold,
        fontSize: 26,
        color: colors.text,
        textAlign: 'center',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontFamily: fonts.regular,
        fontSize: 15,
        color: colors.textSecondary,
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 32,
        lineHeight: 22,
    },
    inputContainer: {
        marginBottom: 20,
    },
    inputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        paddingHorizontal: 18,
        paddingVertical: 16,
        borderWidth: 1.5,
        borderColor: colors.border,
    },
    input: {
        flex: 1,
        fontFamily: fonts.regular,
        color: colors.text,
        fontSize: 16,
    },
    btnWrap: {
        borderRadius: radius.lg,
        overflow: 'hidden',
    },
    btn: {
        paddingVertical: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.lg,
        flexDirection: 'row',
        gap: 10,
    },
    btnText: {
        fontFamily: fonts.bold,
        color: '#FFF',
        fontSize: 17,
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        marginTop: 24,
        paddingHorizontal: 4,
    },
    infoText: {
        flex: 1,
        fontFamily: fonts.regular,
        fontSize: 13,
        color: colors.textMuted,
        lineHeight: 18,
    },
    // Success state styles
    successIcon: {
        alignSelf: 'center',
        marginBottom: 24,
        marginTop: 40,
    },
    successGradient: {
        width: 96,
        height: 96,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#30D158',
        shadowOpacity: 0.4,
        shadowRadius: 20,
        elevation: 10,
    },
    successTitle: {
        fontFamily: fonts.bold,
        fontSize: 28,
        color: colors.text,
        textAlign: 'center',
        letterSpacing: -0.5,
    },
    successSubtitle: {
        fontFamily: fonts.regular,
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
        marginTop: 12,
        lineHeight: 24,
    },
    emailHighlight: {
        fontFamily: fonts.semibold,
        color: colors.primary,
    },
    instructions: {
        fontFamily: fonts.regular,
        fontSize: 14,
        color: colors.textMuted,
        textAlign: 'center',
        marginTop: 20,
        paddingHorizontal: 20,
        lineHeight: 20,
    },
    tipsBox: {
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        padding: 16,
        marginTop: 32,
        borderWidth: 1,
        borderColor: colors.border,
    },
    tipsTitle: {
        fontFamily: fonts.semibold,
        fontSize: 14,
        color: colors.text,
        marginBottom: 8,
    },
    tipItem: {
        fontFamily: fonts.regular,
        fontSize: 13,
        color: colors.textSecondary,
        marginTop: 4,
    },
    resendBtn: {
        alignSelf: 'center',
        marginTop: 28,
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.primary,
    },
    resendText: {
        fontFamily: fonts.semibold,
        fontSize: 15,
        color: colors.primary,
    },
    changeEmailBtn: {
        alignSelf: 'center',
        marginTop: 16,
        padding: 12,
    },
    changeEmailText: {
        fontFamily: fonts.medium,
        fontSize: 14,
        color: colors.textMuted,
    },
});
