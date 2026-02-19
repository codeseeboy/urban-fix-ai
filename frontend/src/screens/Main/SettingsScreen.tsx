import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Switch, Alert, Linking, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, fonts, radius } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { clearStoredLocation } from '../../services/locationService';

// ─── STORAGE KEYS ───────────────────────────────────────────────────────────
const KEYS = {
    DARK_MODE: 'setting_dark_mode',
    NOTIFICATIONS: 'setting_notifications',
    LOCATION_UPDATES: 'setting_location_updates',
};

export default function SettingsScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const { user, logout } = useAuth();

    // ─── State (persisted via AsyncStorage) ──────────────────────────────────
    const [darkMode, setDarkMode] = useState(true);
    const [notifications, setNotifications] = useState(true);
    const [locationUpdates, setLocationUpdates] = useState(true);

    // Load persisted settings
    useEffect(() => {
        (async () => {
            const dm = await AsyncStorage.getItem(KEYS.DARK_MODE);
            const notif = await AsyncStorage.getItem(KEYS.NOTIFICATIONS);
            const loc = await AsyncStorage.getItem(KEYS.LOCATION_UPDATES);
            if (dm !== null) setDarkMode(dm === 'true');
            if (notif !== null) setNotifications(notif === 'true');
            if (loc !== null) setLocationUpdates(loc === 'true');
        })();
    }, []);

    // ─── Toggle handlers (persist immediately) ──────────────────────────────
    const toggleDarkMode = async (val: boolean) => {
        setDarkMode(val);
        await AsyncStorage.setItem(KEYS.DARK_MODE, String(val));
        if (!val) {
            Alert.alert(
                'Light Mode',
                'Light mode will be available in a future update. The app currently uses dark theme only.',
                [{ text: 'OK', onPress: () => { setDarkMode(true); AsyncStorage.setItem(KEYS.DARK_MODE, 'true'); } }]
            );
        }
    };

    const toggleNotifications = async (val: boolean) => {
        setNotifications(val);
        await AsyncStorage.setItem(KEYS.NOTIFICATIONS, String(val));
    };

    const toggleLocationUpdates = async (val: boolean) => {
        setLocationUpdates(val);
        await AsyncStorage.setItem(KEYS.LOCATION_UPDATES, String(val));
    };

    // ─── Actions ─────────────────────────────────────────────────────────────
    const handleClearCache = () => {
        Alert.alert('Clear Cache', 'This will clear cached location and temporary data.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Clear', style: 'destructive', onPress: async () => {
                    await clearStoredLocation();
                    Alert.alert('Done', 'Cache cleared successfully.');
                }
            },
        ]);
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            'Delete Account',
            'This action is permanent and cannot be undone. All your reports and data will be removed.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive', onPress: () => {
                        Alert.alert('Contact Support', 'Please email support@urbanfix.ai to request account deletion.');
                    }
                },
            ]
        );
    };

    const handleLogout = () => {
        Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: logout },
        ]);
    };

    const openPrivacyPolicy = () => Linking.openURL('https://urbanfix.ai/privacy');
    const openTerms = () => Linking.openURL('https://urbanfix.ai/terms');
    const openSupport = () => Linking.openURL('mailto:support@urbanfix.ai');

    // ─── MENU SECTIONS ──────────────────────────────────────────────────────
    type MenuItem = {
        icon: string;
        label: string;
        color: string;
        onPress?: () => void;
        toggle?: boolean;
        value?: boolean;
        onToggle?: (v: boolean) => void;
        subtitle?: string;
    };

    const sections: { title: string; items: MenuItem[] }[] = [
        {
            title: 'Account',
            items: [
                {
                    icon: 'person', label: 'Edit Profile', color: colors.primary,
                    subtitle: user?.name || 'Update your name and details',
                    onPress: () => Alert.alert('Edit Profile', 'Profile editing will be available soon.'),
                },
                {
                    icon: 'location', label: 'Default Location', color: '#30D158',
                    subtitle: user?.city ? `${user.ward || ''}, ${user.city}`.trim().replace(/^,\s*/, '') : 'Not set',
                    onPress: () => Alert.alert('Location', 'You can update your location from the profile setup.'),
                },
            ],
        },
        {
            title: 'Preferences',
            items: [
                {
                    icon: 'notifications', label: 'Push Notifications', color: '#FF9F0A',
                    toggle: true, value: notifications, onToggle: toggleNotifications,
                    subtitle: notifications ? 'Enabled' : 'Disabled',
                },
                {
                    icon: 'moon', label: 'Dark Mode', color: '#AF52DE',
                    toggle: true, value: darkMode, onToggle: toggleDarkMode,
                    subtitle: 'Currently dark theme only',
                },
                {
                    icon: 'navigate', label: 'Location Updates', color: '#5AC8FA',
                    toggle: true, value: locationUpdates, onToggle: toggleLocationUpdates,
                    subtitle: locationUpdates ? 'Background updates on' : 'Background updates off',
                },
            ],
        },
        {
            title: 'Data & Storage',
            items: [
                {
                    icon: 'trash', label: 'Clear Cache', color: '#FF6B35',
                    onPress: handleClearCache,
                    subtitle: 'Clear cached location & temp files',
                },
            ],
        },
        {
            title: 'Support & Legal',
            items: [
                {
                    icon: 'help-circle', label: 'Help & Support', color: '#007AFF',
                    subtitle: 'Contact us via email',
                    onPress: openSupport,
                },
                {
                    icon: 'shield-checkmark', label: 'Privacy Policy', color: '#30D158',
                    onPress: openPrivacyPolicy,
                },
                {
                    icon: 'document-text', label: 'Terms of Service', color: '#FF9F0A',
                    onPress: openTerms,
                },
                {
                    icon: 'information-circle', label: 'About UrbanFix AI', color: colors.textMuted,
                    subtitle: 'Version 1.0.0 · Build 1',
                    onPress: () => Alert.alert('UrbanFix AI', 'Version 1.0.0\nBuilt with React Native & Expo\n\n© 2025 UrbanFix AI. All rights reserved.'),
                },
            ],
        },
    ];

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={20} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} allowFontScaling={false}>Settings</Text>
                <View style={{ width: 38 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                {sections.map((section, sIndex) => (
                    <View key={sIndex} style={styles.section}>
                        <Text style={styles.sectionTitle} allowFontScaling={false}>{section.title}</Text>
                        <View style={styles.sectionCard}>
                            {section.items.map((item, iIndex) => (
                                <TouchableOpacity
                                    key={iIndex}
                                    style={[styles.menuRow, iIndex < section.items.length - 1 && styles.menuRowBorder]}
                                    activeOpacity={item.toggle ? 1 : 0.7}
                                    onPress={item.toggle ? undefined : item.onPress}
                                >
                                    <View style={[styles.menuIconWrap, { backgroundColor: item.color + '15' }]}>
                                        <Ionicons name={item.icon as any} size={18} color={item.color} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.menuLabel} allowFontScaling={false}>{item.label}</Text>
                                        {item.subtitle && (
                                            <Text style={styles.menuSub} allowFontScaling={false}>{item.subtitle}</Text>
                                        )}
                                    </View>
                                    {item.toggle ? (
                                        <Switch
                                            value={item.value}
                                            onValueChange={item.onToggle}
                                            trackColor={{ false: colors.surfaceLight, true: colors.primary + '70' }}
                                            thumbColor={item.value ? colors.primary : '#888'}
                                        />
                                    ) : (
                                        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                ))}

                {/* Danger zone */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.error }]} allowFontScaling={false}>
                        Danger Zone
                    </Text>
                    <View style={styles.sectionCard}>
                        <TouchableOpacity
                            style={[styles.menuRow, styles.menuRowBorder]}
                            onPress={handleLogout}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.menuIconWrap, { backgroundColor: colors.error + '15' }]}>
                                <Ionicons name="log-out" size={18} color={colors.error} />
                            </View>
                            <Text style={[styles.menuLabel, { color: colors.error }]} allowFontScaling={false}>
                                Sign Out
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.menuRow}
                            onPress={handleDeleteAccount}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.menuIconWrap, { backgroundColor: colors.error + '15' }]}>
                                <Ionicons name="skull" size={18} color={colors.error} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.menuLabel, { color: colors.error }]} allowFontScaling={false}>
                                    Delete Account
                                </Text>
                                <Text style={styles.menuSub} allowFontScaling={false}>
                                    Permanently remove your account and data
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Footer */}
                <Text style={styles.footerText} allowFontScaling={false}>
                    UrbanFix AI v1.0.0{'\n'}Made with care for smarter cities
                </Text>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    // Header
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backBtn: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: colors.border,
    },
    headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, color: colors.text, includeFontPadding: false },

    // Sections
    section: { marginTop: 24, paddingHorizontal: 16 },
    sectionTitle: {
        fontFamily: 'Inter_600SemiBold', color: colors.textMuted, fontSize: 12,
        textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
        marginLeft: 4, includeFontPadding: false,
    },
    sectionCard: {
        backgroundColor: colors.surface, borderRadius: radius.lg,
        borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
    },

    // Menu rows
    menuRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingVertical: 14, paddingHorizontal: 14,
    },
    menuRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
    menuIconWrap: {
        width: 34, height: 34, borderRadius: 10,
        justifyContent: 'center', alignItems: 'center',
    },
    menuLabel: { fontFamily: 'Inter_600SemiBold', color: colors.text, fontSize: 15, includeFontPadding: false },
    menuSub: { fontFamily: 'Inter_400Regular', color: colors.textMuted, fontSize: 12, marginTop: 1, includeFontPadding: false },

    // Footer
    footerText: {
        fontFamily: 'Inter_400Regular', color: colors.textMuted, textAlign: 'center',
        marginTop: 32, fontSize: 12, lineHeight: 18, includeFontPadding: false,
    },
});
