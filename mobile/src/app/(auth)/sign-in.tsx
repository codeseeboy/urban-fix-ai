import { Link, router } from 'expo-router';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type TextInputInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { authApi } from '@/api';
import { ServerPill } from '@/components/ServerPill';
import { Button, Header, IconButton, Screen, Text, TextField } from '@/components/ui';
import { useSession } from '@/store/session';
import { colors, gutter, spacing } from '@/theme/tokens';

export default function SignIn() {
  const insets = useSafeAreaInsets();
  const signIn = useSession((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pwRef = useRef<TextInputInstance>(null);

  const valid = /\S+@\S+\.\S+/.test(email.trim()) && password.length > 0;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(await authApi.login(email.trim().toLowerCase(), password));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header back onBack={() => (router.canGoBack() ? router.back() : router.replace("/welcome"))} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled">
          <Text variant="display">Welcome back</Text>
          <Text variant="body" tone="secondary" style={{ marginTop: spacing.xs }}>
            Sign in to keep track of your reports.
          </Text>

          <View style={styles.form}>
            <TextField
              label="Email"
              icon={Mail}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => pwRef.current?.focus()}
            />
            <TextField
              ref={pwRef}
              label="Password"
              icon={Lock}
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              secureTextEntry={!show}
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submit}
              right={<IconButton icon={show ? EyeOff : Eye} variant="plain" size={32} accessibilityLabel={show ? 'Hide password' : 'Show password'} onPress={() => setShow((v) => !v)} />}
            />
            {error ? (
              <Text variant="callout" tone="danger">
                {error}
              </Text>
            ) : null}
            <Button label="Sign in" onPress={submit} loading={busy} disabled={!valid} />
          </View>

          <View style={styles.footer}>
            <Text variant="callout" tone="secondary">
              New to UrbanFix?{' '}
              <Link href="/sign-up" replace style={styles.link}>
                Create an account
              </Link>
            </Text>
            <ServerPill />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: gutter, paddingTop: spacing.lg, flexGrow: 1 },
  form: { gap: spacing.lg, marginTop: spacing.xxxl },
  footer: { marginTop: 'auto', paddingTop: spacing.xxxl, alignItems: 'center', gap: spacing.lg },
  link: { fontFamily: 'Inter', fontWeight: '600', color: colors.info },
});
