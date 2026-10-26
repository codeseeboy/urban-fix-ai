import Constants from 'expo-constants';
import { CheckCircle2, Cpu, Database, Globe, Server, XCircle } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Header, Screen, Text, TextField, toast } from '@/components/ui';
import { useServer } from '@/hooks/useServer';
import { buildServerUrl, candidates, getOverride, normaliseServerUrl, probe, setOverride, type Health } from '@/lib/server';
import { colors, gutter, spacing } from '@/theme/tokens';

type Probe = { url: string; health: Health | null; ms: number };

export default function Settings() {
  const insets = useSafeAreaInsets();
  const { url, recheck, checking } = useServer();
  const [override, setOverrideState] = useState('');
  const [saving, setSaving] = useState(false);
  const [probes, setProbes] = useState<Probe[]>([]);

  const runProbes = async (ov?: string) => {
    const list = candidates(ov ?? (await getOverride()));
    const res = await Promise.all(
      list.map(async (u) => {
        const t = Date.now();
        const health = await probe(u);
        return { url: u, health, ms: Date.now() - t };
      }),
    );
    setProbes(res);
  };

  useEffect(() => {
    getOverride().then((v) => {
      setOverrideState(v);
      runProbes(v);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const v = normaliseServerUrl(override);
      if (v && !(await probe(v))) {
        toast.error(`No UrbanFix server answered at ${v}`);
        return;
      }
      await setOverride(v);
      setOverrideState(v);
      const found = await recheck();
      await runProbes(v);
      toast.success(found ? `Connected to ${found.replace(/^https?:\/\//, '')}` : 'Saved');
    } finally {
      setSaving(false);
    }
  };

  const active = probes.find((p) => p.url === url)?.health;
  const aiReady = !!active?.ai?.project && !active.ai.authError;

  return (
    <Screen>
      <Header title="Server & app" />
      <ScrollView contentContainerStyle={{ padding: gutter, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.xl }} keyboardShouldPersistTaps="handled">
        <Card style={{ gap: spacing.md }}>
          <View style={styles.row}>
            {url ? <CheckCircle2 size={20} color={colors.success} /> : <XCircle size={20} color={colors.danger} />}
            <Text variant="subheading" style={{ flex: 1 }}>
              {url ? 'Connected' : 'Not connected'}
            </Text>
          </View>
          <Text variant="callout" tone="secondary">
            {url ?? 'The app could not reach the UrbanFix backend. Make sure it is running on your computer and that your phone is on the same Wi-Fi, or connect over USB.'}
          </Text>
          {active ? (
            <View style={{ gap: spacing.sm }}>
              <View style={styles.row}>
                <Database size={15} color={active.db === 'up' ? colors.success : colors.danger} />
                <Text variant="callout" tone="secondary">
                  Database {active.db === 'up' ? `online (${active.dbLatencyMs ?? '?'} ms)` : 'offline'}
                </Text>
              </View>
              <View style={styles.row}>
                <Cpu size={15} color={aiReady ? colors.success : colors.warning} />
                <Text variant="callout" tone="secondary">
                  AI {aiReady ? `ready · ${active.ai?.chatModels?.[0] ?? 'Vertex AI'}` : active.ai?.authError ? 'credentials error' : 'not configured'}
                </Text>
              </View>
            </View>
          ) : null}
          <Button label="Check again" variant="secondary" size="md" loading={checking} onPress={async () => { await recheck(); await runProbes(); }} />
        </Card>

        <View style={{ gap: spacing.md }}>
          <Text variant="heading">Server address</Text>
          <TextField
            icon={Server}
            value={override}
            onChangeText={setOverrideState}
            placeholder={buildServerUrl || 'http://192.168.x.x:5000'}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            hint="Leave empty to use automatic discovery."
          />
          <Button label="Save & connect" loading={saving} onPress={save} />
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text variant="heading">Discovery</Text>
          {probes.map((p) => (
            <View key={p.url} style={styles.probe}>
              <Globe size={15} color={p.health ? colors.success : colors.textTertiary} />
              <Text variant="callout" tone={p.health ? 'primary' : 'tertiary'} style={{ flex: 1 }} numberOfLines={1}>
                {p.url.replace(/^https?:\/\//, '')}
              </Text>
              <Text variant="caption" tone={p.health ? 'success' : 'tertiary'}>
                {p.health ? `${p.ms} ms` : 'no answer'}
              </Text>
            </View>
          ))}
          <Text variant="caption" tone="tertiary">
            127.0.0.1 works when the phone is connected by USB with “adb reverse tcp:5000 tcp:5000”.
          </Text>
        </View>

        <Text variant="caption" tone="tertiary" align="center">
          UrbanFix {Constants.expoConfig?.version ?? ''}
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  probe: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: colors.border },
});
