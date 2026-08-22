import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Switch, Alert, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { colors, fonts, radius } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { confirmAction } from '../../utils/confirm';
import { clearStoredLocation } from '../../services/locationService';
import {
    SETTINGS_KEYS,
    getBoolSetting,
    applyNotificationPreference,
    applyLocationPreference,
    openSystemAppSettings,
} from '../../services/settingsService';
import AuthCanvas from '../../components/auth/AuthCanvas';
import UserAvatar from '../../components/ui/UserAvatar';

const APP_VERSION = Constants.expoConfig?.version || '1.1.0';

export default function SettingsScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const { user, logout } = useAuth();
    const [notifications, setNotifications] = useState(true);
    const [locationUpdates, setLocationUpdates] = useState(true);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        (async () => {
            setNotifications(await getBoolSetting(SETTINGS_KEYS.NOTIFICATIONS, true));
            setLocationUpdates(await getBoolSetting(SETTINGS_KEYS.LOCATION_UPDATES, true));
        })();
    }, []);

    const toggleNotifications = useCallback(async (val: boolean) => {
        setNotifications(val);
        setBusy(true);
        const result = await applyNotificationPreference(val);
        setBusy(false);
        if (!result.ok) {
            setNotifications(false);
            Alert.alert('Notifications', result.message || 'Could not enable alerts.', [
                { text: 'Not now', style: 'cancel' },
                { text: 'Open Settings', onPress: openSystemAppSettings },
            ]);
        }
    }, []);

    const toggleLocationUpdates = useCallback(async (val: boolean) => {
        setLocationUpdates(val);
        const result = await applyLocationPreference(val);
        if (!result.ok) {
            setLocationUpdates(false);
            Alert.alert('Location', result.message || 'Permission needed.', [
                { text: 'Not now', style: 'cancel' },
                { text: 'Open Settings', onPress: openSystemAppSettings },
            ]);
        }
    }, []);

    const handleClearCache = useCallback(() => {
        Alert.alert('Clear Cache', 'This clears saved map location on this device. Your account stays signed in.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Clear', style: 'destructive', onPress: async () => {
                    await clearStoredLocation();
                    Alert.alert('Done', 'Cached location cleared.');
                },
            },
        ]);
    }, []);

    const handleDeleteAccount = useCallback(() => {
        Alert.alert(
            'Delete Account',
            'This permanently removes your reports and profile. Email support to confirm deletion.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Email support',
                    onPress: () => Linking.openURL('mailto:support@urbanfix.app?subject=Delete%20UrbanFix%20account'),
                },
            ],
        );
    }, []);

    const handleLogout = useCallback(async () => {
        const ok = await confirmAction(
            'Sign Out',
            'You will stop receiving push alerts on this device.',
            'Sign Out',
        );
        if (ok) await logout();
    }, [logout]);

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

    const locationLabel = user?.city
        ? `${user.ward || ''}${user.ward && user.city ? ', ' : ''}${user.city}`.trim()
        : 'Not set — tap to detect';

    const sections: { title: string; items: MenuItem[] }[] = [
        {
            title: 'Account',
            items: [
                {
                    icon: 'person',
                    label: 'Edit Profile',
                    color: colors.primary,
                    subtitle: user?.name || 'Name, photo, username',
                    onPress: () => navigation.navigate('EditProfile'),
                },
                {
                    icon: 'location',
                    label: 'Home location',
                    color: '#30D158',
                    subtitle: locationLabel,
                    onPress: () => navigation.navigate('LocationSetup', { mode: 'update' }),
                },
            ],
        },
        {
            title: 'Alerts & location',
            items: [
                {
                    icon: 'notifications',
                    label: 'Push notifications',
                    color: '#FF9F0A',
                    toggle: true,
                    value: notifications,
                    onToggle: busy ? undefined : toggleNotifications,
                    subtitle: notifications ? 'Status, comments, and nearby reports' : 'Off — no live alerts',
                },
                {
                    icon: 'navigate',
                    label: 'Use device location',
                    color: '#5AC8FA',
                    toggle: true,
                    value: locationUpdates,
                    onToggle: toggleLocationUpdates,
                    subtitle: locationUpdates ? 'GPS attached to new reports' : 'Manual location only',
                },
            ],
        },
        {
            title: 'Data',
            items: [
                {
                    icon: 'trash',
                    label: 'Clear cached location',
                    color: '#FF6B35',
                    onPress: handleClearCache,
                    subtitle: 'Does not delete your reports',
                },
            ],
        },
        {
            title: 'Support & legal',
            items: [
                {
                    icon: 'help-circle',
                    label: 'Help & Support',
                    color: '#007AFF',
                    subtitle: 'support@urbanfix.app',
                    onPress: () => Linking.openURL('mailto:support@urbanfix.app'),
                },
                {
                    icon: 'shield-checkmark',
                    label: 'Privacy Policy',
                    color: '#30D158',
                    onPress: () => navigation.navigate('Legal', { type: 'privacy' }),
                },
                {
                    icon: 'document-text',
                    label: 'Terms of Use',
                    color: '#FF9F0A',
                    onPress: () => navigation.navigate('Legal', { type: 'terms' }),
                },
                {
                    icon: 'information-circle',
                    label: 'About UrbanFix',
                    color: colors.textMuted,
                    subtitle: `Version ${APP_VERSION}`,
                    onPress: () => navigation.navigate('Legal', { type: 'about' }),
                },
            ],
        },
    ];

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <AuthCanvas />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={20} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} allowFontScaling={false}>Settings</Text>
                <View style={{ width: 38 }} />
            </View>

            <View style={styles.contentSheet}>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                    <View style={styles.profilePeek}>
                        <UserAvatar name={user?.name} uri={user?.avatar} size={52} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.peekName} allowFontScaling={false}>{user?.name || 'Citizen'}</Text>
                            <Text style={styles.peekEmail} allowFontScaling={false}>{user?.email}</Text>
                        </View>
                    </View>

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
                                            {item.subtitle ? (
                                                <Text style={styles.menuSub} allowFontScaling={false}>{item.subtitle}</Text>
                                            ) : null}
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

                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: colors.error }]} allowFontScaling={false}>
                            Account actions
                        </Text>
                        <View style={styles.sectionCard}>
                            <TouchableOpacity style={[styles.menuRow, styles.menuRowBorder]} onPress={handleLogout} activeOpacity={0.7}>
                                <View style={[styles.menuIconWrap, { backgroundColor: colors.error + '15' }]}>
                                    <Ionicons name="log-out" size={18} color={colors.error} />
                                </View>
                                <Text style={[styles.menuLabel, { color: colors.error }]} allowFontScaling={false}>
                                    Sign Out
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.menuRow} onPress={handleDeleteAccount} activeOpacity={0.7}>
                                <View style={[styles.menuIconWrap, { backgroundColor: colors.error + '15' }]}>
                                    <Ionicons name="person-remove" size={18} color={colors.error} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.menuLabel, { color: colors.error }]} allowFontScaling={false}>
                                        Delete Account
                                    </Text>
                                    <Text style={styles.menuSub} allowFontScaling={false}>
                                        Request permanent removal
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <Text style={styles.footerText} allowFontScaling={false}>
                        UrbanFix {APP_VERSION}{'\n'}Live civic reporting for your city
                    </Text>
                </ScrollView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    contentSheet: {
        flex: 1,
        marginHorizontal: 10,
        marginTop: 8,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(15,18,32,0.72)',
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(12,15,28,0.76)',
    },
    backBtn: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: colors.border,
    },
    headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, color: colors.text, includeFontPadding: false },
    profilePeek: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        marginTop: 18, marginHorizontal: 16, padding: 14,
        backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    },
    peekName: { fontFamily: fonts.semibold, color: colors.text, fontSize: 16 },
    peekEmail: { fontFamily: fonts.regular, color: colors.textMuted, fontSize: 12, marginTop: 2 },
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
    footerText: {
        fontFamily: 'Inter_400Regular', color: colors.textMuted, textAlign: 'center',
        marginTop: 32, fontSize: 12, lineHeight: 18, includeFontPadding: false,
    },
});
