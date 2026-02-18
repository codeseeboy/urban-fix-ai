import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { userAPI } from '../../services/api';
import { colors, radius } from '../../theme/colors';

export default function EditProfileScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const { user, refreshProfile } = useAuth();

    const [name, setName] = useState(user?.name || '');
    const [region, setRegion] = useState(user?.region || '');
    const [avatar, setAvatar] = useState(user?.badges?.includes('avatar_url') ? '' : null); // Mock logic for now
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        if (!name.trim()) { Alert.alert('Error', 'Name is required'); return; }

        setLoading(true);
        try {
            await userAPI.updateProfile({ name, region });
            await refreshProfile();
            Alert.alert('Success', 'Profile updated successfully', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (e: any) {
            Alert.alert('Error', e.response?.data?.message || 'Failed to update profile');
        }
        setLoading(false);
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Profile</Text>
                <View style={{ width: 36 }} />
            </View>

            <View style={styles.content}>
                <View style={styles.avatarContainer}>
                    <LinearGradient colors={[colors.primary, '#0055CC']} style={styles.avatar}>
                        <Text style={styles.avatarText}>{name ? name[0] : 'U'}</Text>
                    </LinearGradient>
                    <TouchableOpacity style={styles.editBadge}>
                        <Ionicons name="camera" size={14} color="#FFF" />
                    </TouchableOpacity>
                </View>

                <Text style={styles.label}>Full Name</Text>
                <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="Enter your name"
                    placeholderTextColor={colors.textMuted}
                />

                <Text style={styles.label}>Region / Ward</Text>
                <TextInput
                    style={styles.input}
                    value={region}
                    onChangeText={setRegion}
                    placeholder="e.g. Central Ward"
                    placeholderTextColor={colors.textMuted}
                />

                <Text style={styles.label}>Email (Read-only)</Text>
                <TextInput
                    style={[styles.input, styles.disabledInput]}
                    value={user?.email}
                    editable={false}
                />

                <TouchableOpacity onPress={handleSave} disabled={loading} activeOpacity={0.85} style={styles.saveBtnWrap}>
                    <LinearGradient colors={[colors.primary, '#0055CC']} style={styles.saveBtn}>
                        {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveText}>Save Changes</Text>}
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border
    },
    backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 17, color: colors.text },
    content: { padding: 20 },
    avatarContainer: { alignSelf: 'center', marginBottom: 24, position: 'relative' },
    avatar: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 40 },
    editBadge: {
        position: 'absolute', bottom: 0, right: 0, backgroundColor: colors.primary,
        width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center',
        borderWidth: 2, borderColor: colors.background
    },
    label: { fontFamily: 'Inter_500Medium', color: colors.textSecondary, fontSize: 13, marginBottom: 8, marginTop: 16 },
    input: {
        backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
        paddingHorizontal: 16, paddingVertical: 14, color: colors.text, fontFamily: 'Inter_400Regular', fontSize: 15
    },
    disabledInput: { opacity: 0.6, backgroundColor: colors.surfaceLight },
    saveBtnWrap: { marginTop: 40, borderRadius: radius.md, overflow: 'hidden' },
    saveBtn: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
    saveText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 16 }
});
