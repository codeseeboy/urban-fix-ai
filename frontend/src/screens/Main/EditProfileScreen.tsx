import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { userAPI } from '../../services/api';
import { colors, fonts, radius } from '../../theme/colors';
import UserAvatar from '../../components/ui/UserAvatar';

export default function EditProfileScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const { user, refreshProfile } = useAuth();

    const [name, setName] = useState(user?.name || '');
    const [username, setUsername] = useState(user?.username || '');
    const [city, setCity] = useState(user?.city || '');
    const [ward, setWard] = useState(user?.ward || user?.region || '');
    const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatar || null);
    const [loading, setLoading] = useState(false);

    const pickAvatar = async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
            Alert.alert('Photos', 'Allow photo access to set a profile picture.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });
        if (result.canceled || !result.assets?.[0]?.uri) return;
        setAvatarUri(result.assets[0].uri);
    };

    const handleSave = async () => {
        if (!name.trim()) { Alert.alert('Required', 'Name is required'); return; }

        setLoading(true);
        try {
            let nextAvatar = user?.avatar || null;
            if (avatarUri && avatarUri !== user?.avatar && !avatarUri.startsWith('http')) {
                const { data } = await userAPI.uploadAvatar(avatarUri);
                nextAvatar = data?.avatar || nextAvatar;
            }
            await userAPI.updateProfile({
                name: name.trim(),
                username: username.trim() || undefined,
                city: city.trim() || undefined,
                ward: ward.trim() || undefined,
                region: ward.trim() || city.trim() || undefined,
                avatar: nextAvatar,
            });
            await refreshProfile();
            Alert.alert('Saved', 'Your profile is up to date.', [
                { text: 'OK', onPress: () => navigation.goBack() },
            ]);
        } catch (e: any) {
            Alert.alert('Could not save', e.response?.data?.message || 'Try again in a moment.');
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

            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <TouchableOpacity onPress={pickAvatar} activeOpacity={0.85} style={styles.avatarContainer}>
                    <UserAvatar name={name} uri={avatarUri} size={100} />
                    <View style={styles.editBadge}>
                        <Ionicons name="camera" size={14} color="#FFF" />
                    </View>
                </TouchableOpacity>
                <Text style={styles.hint}>Tap to change photo</Text>

                <Text style={styles.label}>Full Name</Text>
                <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="Your name"
                    placeholderTextColor={colors.textMuted}
                />

                <Text style={styles.label}>Username</Text>
                <TextInput
                    style={styles.input}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    placeholder="citizen_name"
                    placeholderTextColor={colors.textMuted}
                />

                <Text style={styles.label}>City</Text>
                <TextInput
                    style={styles.input}
                    value={city}
                    onChangeText={setCity}
                    placeholder="Your city"
                    placeholderTextColor={colors.textMuted}
                />

                <Text style={styles.label}>Ward / area</Text>
                <TextInput
                    style={styles.input}
                    value={ward}
                    onChangeText={setWard}
                    placeholder="e.g. Central Ward"
                    placeholderTextColor={colors.textMuted}
                />

                <Text style={styles.label}>Email</Text>
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
    headerTitle: { fontFamily: fonts.semibold, fontSize: 17, color: colors.text },
    content: { padding: 20, paddingBottom: 40 },
    avatarContainer: { alignSelf: 'center', marginBottom: 8, position: 'relative' },
    hint: { textAlign: 'center', color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12, marginBottom: 16 },
    editBadge: {
        position: 'absolute', bottom: 0, right: 0, backgroundColor: colors.primary,
        width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center',
        borderWidth: 2, borderColor: colors.background,
    },
    label: { fontFamily: fonts.medium, color: colors.textSecondary, fontSize: 13, marginBottom: 8, marginTop: 16 },
    input: {
        backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
        paddingHorizontal: 16, paddingVertical: 14, color: colors.text, fontFamily: fonts.regular, fontSize: 15,
    },
    disabledInput: { opacity: 0.6, backgroundColor: colors.surfaceLight },
    saveBtnWrap: { marginTop: 32, borderRadius: radius.md, overflow: 'hidden' },
    saveBtn: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
    saveText: { fontFamily: fonts.bold, color: '#FFF', fontSize: 16 },
});
