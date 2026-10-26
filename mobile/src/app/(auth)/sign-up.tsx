import { Link, router } from 'expo-router';
import { AtSign, Eye, EyeOff, Lock, Mail, User } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type TextInputInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { authApi, usersApi } from '@/api';
import { ServerPill } from '@/components/ServerPill';
import { Button, Header, IconButton, Screen, Text, TextField } from '@/components/ui';
import { useSession } from '@/store/session';
import { colors, gutter, spacing } from '@/theme/tokens';

const USERNAME_RE = /^[a-z0-9_.]{3,24}$/;

export default function SignUp() {
  const insets = useSafeAreaInsets();
  const signIn = useSession((s) => s.signIn);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<{ name: string; available: boolean } | null>(null);
  const usernameRef = useRef<TextInputInstance>(null);
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);

  const uname = username.trim().toLowerCase();
  const formatOk = !!uname && USERNAME_RE.test(uname);
  useEffect(() => {
    if (!formatOk) return;
    const t = setTimeout(() => {
      usersApi
        .checkUsername(uname)
        .then((r) => setChecked({ name: uname, available: r.available }))
        .catch(() => {});
    }, 450);
    return () => clearTimeout(t);
  }, [uname, formatOk]);
  const userState = !formatOk ? 'idle' : checked?.name !== uname ? 'checking' : checked.available ? 'ok' : 'taken';

  const usernameError = uname && !USERNAME_RE.test(uname) ? '3–24 characters: letters, numbers, _ and .' : userState === 'taken' ? 'That username is taken.' : null;
  const passwordError = password && password.length < 8 ? 'Use at least 8 characters.' : null;
  const valid = name.trim().length >= 2 && /\S+@\S+\.\S+/.test(email.trim()) && password.length >= 8 && !usernameError;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(await authApi.register({ name: name.trim(), email: email.trim().toLowerCase(), password, username: uname || undefined }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create your account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header back onBack={() => (router.canGoBack() ? router.back() : router.replace("/welcome"))} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled">
          <Text variant="display">Create account</Text>
          <Text variant="body" tone="secondary" style={{ marginTop: spacing.xs }}>
            Earn points for every report that helps your city.
          </Text>

          <View style={styles.form}>
            <TextField label="Full name" icon={User} value={name} onChangeText={setName} placeholder="Your name" autoComplete="name" returnKeyType="next" onSubmitEditing={() => usernameRef.current?.focus()} />
            <TextField
              ref={usernameRef}
              label="Username (optional)"
              icon={AtSign}
              value={username}
              onChangeText={setUsername}
              placeholder="e.g. priya.k"
              autoCapitalize="none"
              autoCorrect={false}
              error={usernameError}
              hint={userState === 'ok' ? 'Available' : userState === 'checking' ? 'Checking…' : undefined}
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
            />
            <TextField
              ref={emailRef}
              label="Email"
              icon={Mail}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <TextField
              ref={passwordRef}
              label="Password"
              icon={Lock}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              secureTextEntry={!show}
              autoCapitalize="none"
              autoComplete="new-password"
              error={passwordError}
              returnKeyType="go"
              onSubmitEditing={submit}
              right={<IconButton icon={show ? EyeOff : Eye} variant="plain" size={32} accessibilityLabel={show ? 'Hide password' : 'Show password'} onPress={() => setShow((v) => !v)} />}
            />
            {error ? (
              <Text variant="callout" tone="danger">
                {error}
              </Text>
            ) : null}
            <Button label="Create account" onPress={submit} loading={busy} disabled={!valid} />
          </View>

          <View style={styles.footer}>
            <Text variant="callout" tone="secondary">
              Already have an account?{' '}
              <Link href="/sign-in" replace style={styles.link}>
                Sign in
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
  form: { gap: spacing.lg, marginTop: spacing.xxl },
  footer: { marginTop: 'auto', paddingTop: spacing.xxl, alignItems: 'center', gap: spacing.lg },
  link: { fontFamily: 'Inter', fontWeight: '600', color: colors.info },
});
