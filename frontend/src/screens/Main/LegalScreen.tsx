import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius } from '../../theme/colors';
import AuthCanvas from '../../components/auth/AuthCanvas';

const COPY: Record<string, { title: string; body: string }> = {
    privacy: {
        title: 'Privacy Policy',
        body:
            'UrbanFix collects the information you give us — name, email, city, and the photos you attach to civic reports.\n\n' +
            'Location is used only to route a report to the right ward and to show nearby issues. We do not sell personal data.\n\n' +
            'Photos are stored so municipal staff can verify the issue. You can ask us to delete your account and associated reports by using Delete Account in Settings.\n\n' +
            'Push tokens are stored so we can send status updates about issues you reported or follow. Turning off notifications in Settings removes the token from our servers.',
    },
    terms: {
        title: 'Terms of Use',
        body:
            'UrbanFix is a civic reporting platform. Use it to report real public issues such as road damage, lighting, trash, water leaks, and park maintenance.\n\n' +
            'Do not upload private photos of people without consent, fake reports, or illegal content. Duplicate reports may be merged. Municipal staff may reject reports that are not civic issues.\n\n' +
            'Points and badges are engagement features and have no cash value. Service availability depends on network and municipal operations.\n\n' +
            'By creating an account you agree to these terms and our privacy policy.',
    },
    about: {
        title: 'About UrbanFix',
        body:
            'UrbanFix AI helps citizens photograph civic problems, detect the issue with computer vision, and send it to the right municipal team.\n\n' +
            'Version 1.1.0\nBuilt for real city reporting — not a demo.\n\n' +
            'Support: support@urbanfix.app',
    },
};

export default function LegalScreen({ navigation, route }: any) {
    const insets = useSafeAreaInsets();
    const type = (route?.params?.type || 'about') as keyof typeof COPY;
    const doc = COPY[type] || COPY.about;

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <AuthCanvas />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={20} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} allowFontScaling={false}>{doc.title}</Text>
                <View style={{ width: 38 }} />
            </View>
            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
                <View style={styles.card}>
                    <Text style={styles.text} allowFontScaling={false}>{doc.body}</Text>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backBtn: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: colors.border,
    },
    headerTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
    body: { padding: 16, paddingBottom: 40 },
    card: {
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 18,
    },
    text: {
        fontFamily: fonts.regular,
        color: colors.textSecondary,
        fontSize: 15,
        lineHeight: 23,
    },
});
