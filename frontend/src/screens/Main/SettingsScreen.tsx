import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';

export default function SettingsScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const { logout } = useAuth();

    const MENU = [
        { icon: 'person-outline', label: 'Edit Profile', action: () => navigation.navigate('EditProfile') },
        { icon: 'notifications-outline', label: 'Notification Preferences' },
        { icon: 'location-outline', label: 'Default Location' },
        { icon: 'moon-outline', label: 'Dark Mode', toggle: true },
        { icon: 'language-outline', label: 'Language', value: 'English' },
        { icon: 'shield-checkmark-outline', label: 'Privacy & Security' },
        { icon: 'help-circle-outline', label: 'Help & Support' },
        { icon: 'document-text-outline', label: 'Terms of Service' },
        { icon: 'information-circle-outline', label: 'About UrbanFix AI' },
    ];

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settings</Text>
                <View style={{ width: 36 }} />
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
                {MENU.map((item, i) => (
                    <TouchableOpacity key={i} style={styles.menuItem} activeOpacity={0.7} onPress={item.action}>
                        <View style={styles.menuIcon}><Ionicons name={item.icon as any} size={20} color={colors.textSecondary} /></View>
                        <Text style={styles.menuLabel}>{item.label}</Text>
                        {item.toggle ? <Switch value={true} trackColor={{ true: colors.primary }} thumbColor="#FFF" /> :
                            item.value ? <Text style={styles.menuValue}>{item.value}</Text> :
                                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
                    </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.7}>
                    <Ionicons name="log-out-outline" size={20} color={colors.error} />
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
                <Text style={styles.version}>UrbanFix AI v1.0.0</Text>
                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 17, color: colors.text },
    menuItem: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16,
        borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    menuIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.surfaceLight, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
    menuLabel: { flex: 1, fontFamily: 'Inter_500Medium', color: colors.text, fontSize: 15 },
    menuValue: { fontFamily: 'Inter_400Regular', color: colors.textSecondary, fontSize: 14 },
    logoutBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        margin: 20, padding: 14, borderRadius: radius.md,
        backgroundColor: colors.error + '10', borderWidth: 1, borderColor: colors.error + '25',
    },
    logoutText: { fontFamily: 'Inter_600SemiBold', color: colors.error, fontSize: 15 },
    version: { fontFamily: 'Inter_400Regular', color: colors.textMuted, textAlign: 'center', marginTop: 12, fontSize: 12 },
});
