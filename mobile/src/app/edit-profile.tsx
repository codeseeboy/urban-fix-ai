import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { AtSign, Building, Camera, MapPinned, User } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usersApi, type Profile } from '@/api';
import { Avatar, Button, ErrorState, Header, PressableScale, Screen, Text, TextField, toast } from '@/components/ui';
import { mediaUrl } from '@/lib/api';
import { capturePhoto, pickPhoto } from '@/lib/media';
import { qk } from '@/lib/query';
import { useSession } from '@/store/session';
import { colors, gutter, spacing } from '@/theme/tokens';

function Form({ profile }: { profile: Profile }) {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const patchUser = useSession((s) => s.patchUser);
  const [name, setName] = useState(profile.name ?? '');
  const [username, setUsername] = useState(profile.username ?? '');
  const [city, setCity] = useState(profile.city ?? '');
  const [ward, setWard] = useState(profile.ward ?? '');
  const [avatar, setAvatar] = useState<string | null>(profile.avatar ?? null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const upload = async (lib: boolean) => {
    try {
      const p = lib ? await pickPhoto() : await capturePhoto();
      if (!p) return;
      setUploading(true);
      const r = await usersApi.uploadAvatar(p.uri);
      setAvatar(r.avatar);
      patchUser({ avatar: r.avatar });
      qc.invalidateQueries({ queryKey: qk.profile });
      toast.success('Photo updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const changePhoto = () =>
    Alert.alert('Profile photo', undefined, [
      { text: 'Take photo', onPress: () => upload(false) },
      { text: 'Choose from gallery', onPress: () => upload(true) },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const save = async () => {
    setSaving(true);
    try {
      const u = await usersApi.update({ name: name.trim(), username: username.trim() || undefined, city: city.trim() || undefined, ward: ward.trim() || undefined });
      patchUser({ name: u.name, username: u.username, city: u.city, ward: u.ward });
      qc.invalidateQueries({ queryKey: qk.profile });
      toast.success('Profile saved');
      router.back();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ padding: gutter, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
        <PressableScale onPress={changePhoto} style={styles.avatarWrap} accessibilityLabel="Change photo">
          <Avatar name={name} uri={mediaUrl(avatar)} size={96} />
          <View style={styles.cam}>
            <Camera size={16} color={colors.textOnPrimary} />
          </View>
          <Text variant="label" tone="brand" style={{ marginTop: spacing.sm }}>
            {uploading ? 'Uploading…' : 'Change photo'}
          </Text>
        </PressableScale>
        <TextField label="Full name" icon={User} value={name} onChangeText={setName} />
        <TextField label="Username" icon={AtSign} value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} />
        <TextField label="City" icon={Building} value={city} onChangeText={setCity} placeholder="e.g. Palghar" />
        <TextField label="Ward / area" icon={MapPinned} value={ward} onChangeText={setWard} placeholder="e.g. Ward 12" />
        <Button label="Save changes" loading={saving} disabled={name.trim().length < 2} onPress={save} style={{ marginTop: spacing.md }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default function EditProfile() {
  const profile = useQuery({ queryKey: qk.profile, queryFn: usersApi.profile });
  return (
    <Screen>
      <Header title="Edit profile" />
      {profile.data ? (
        <Form profile={profile.data} />
      ) : profile.isError ? (
        <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />
      ) : (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.huge }} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatarWrap: { alignItems: 'center', alignSelf: 'center', marginBottom: spacing.md },
  cam: {
    position: 'absolute',
    top: 66,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.bg,
  },
});
