import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowUp, ChevronRight, Sparkles } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInUp, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { assistantApi, type AssistantIssueCard } from '@/api';
import { Header, IconButton, PressableScale, Screen, StatusBadge, Text } from '@/components/ui';
import { mediaUrl } from '@/lib/api';
import { firstName } from '@/lib/format';
import { quickPosition } from '@/lib/location';
import { useSession } from '@/store/session';
import { categoryMeta, categoryOf } from '@/theme/domain';
import { alphaOf, colors, gutter, palette, radius, spacing, type } from '@/theme/tokens';

type Msg = { id: string; role: 'user' | 'assistant'; text: string; issues?: AssistantIssueCard[]; suggestions?: string[]; error?: boolean };

const FALLBACK_PROMPTS = ['What issues are near me?', 'What’s the status of my reports?', 'How does the city look today?', 'How do I earn more points?'];

function Dot({ delay }: { delay: number }) {
  const o = useSharedValue(0.3);
  useEffect(() => {
    o.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 350 }), withTiming(0.3, { duration: 350 })), -1));
  }, [delay, o]);
  const s = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.typingDot, s]} />;
}

function IssueCardMini({ c }: { c: AssistantIssueCard }) {
  const cat = categoryMeta[categoryOf(c.category)];
  const img = mediaUrl(c.image);
  return (
    <PressableScale scaleTo={0.98} onPress={() => router.push(`/issue/${c.id}`)} style={styles.mini}>
      {img ? (
        <Image source={{ uri: img }} style={styles.miniImg} contentFit="cover" />
      ) : (
        <View style={[styles.miniImg, { backgroundColor: cat.soft, alignItems: 'center', justifyContent: 'center' }]}>
          <cat.icon size={18} color={cat.color} />
        </View>
      )}
      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="label" numberOfLines={1}>
          {c.title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <StatusBadge status={c.status} size="sm" />
          {c.distanceKm != null ? (
            <Text variant="caption" tone="tertiary">
              {c.distanceKm < 1 ? `${Math.round(c.distanceKm * 1000)} m` : `${c.distanceKm.toFixed(1)} km`}
            </Text>
          ) : null}
        </View>
      </View>
      <ChevronRight size={16} color={colors.textTertiary} />
    </PressableScale>
  );
}

export default function Assistant() {
  const insets = useSafeAreaInsets();
  const user = useSession((s) => s.user);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [loc, setLoc] = useState<{ latitude: number; longitude: number } | null>(null);
  const list = useRef<FlatList<Msg>>(null);
  const actions = useQuery({ queryKey: ['assistant', 'actions'], queryFn: assistantApi.quickActions, staleTime: Infinity });

  useEffect(() => {
    quickPosition().then(setLoc);
  }, []);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setInput('');
    const history = messages.filter((m) => !m.error).slice(-10).map((m) => ({ role: m.role, text: m.text }));
    const userMsg: Msg = { id: `u${Date.now()}`, role: 'user', text: message };
    setMessages((m) => [...m, userMsg]);
    setBusy(true);
    try {
      const r = await assistantApi.send({ message, history, location: loc });
      setMessages((m) => [...m, { id: `a${Date.now()}`, role: 'assistant', text: r.reply, issues: r.issues, suggestions: r.suggestions }]);
    } catch (e) {
      setMessages((m) => [...m, { id: `e${Date.now()}`, role: 'assistant', text: e instanceof Error ? e.message : 'Something went wrong.', error: true }]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (messages.length) setTimeout(() => list.current?.scrollToEnd({ animated: true }), 60);
  }, [messages.length, busy]);

  const prompts = actions.data?.actions?.map((a) => a.prompt) ?? FALLBACK_PROMPTS;
  const lastSuggestions = !busy ? [...messages].reverse().find((m) => m.role === 'assistant')?.suggestions ?? [] : [];

  return (
    <Screen>
      <Header title="UrbanFix AI" subtitle={loc ? 'Live city data · using your location' : 'Live city data · location off'} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <FlatList
          ref={list}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: gutter, gap: spacing.md, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.intro}>
              <View style={styles.orb}>
                <Sparkles size={30} color={palette.violet400} strokeWidth={1.8} />
              </View>
              <Text variant="title" align="center">
                Hi {firstName(user?.name)}, how can I help?
              </Text>
              <Text variant="callout" tone="secondary" align="center" style={{ maxWidth: 300 }}>
                I can look up live issues around you, check your reports and explain how things work — in English or Hinglish.
              </Text>
              <View style={styles.prompts}>
                {prompts.slice(0, 4).map((p) => (
                  <PressableScale key={p} onPress={() => send(p)} style={styles.prompt}>
                    <Text variant="callout">{p}</Text>
                    <ArrowUp size={16} color={colors.textTertiary} style={{ transform: [{ rotate: '45deg' }] }} />
                  </PressableScale>
                ))}
              </View>
            </View>
          }
          renderItem={({ item }) =>
            item.role === 'user' ? (
              <Animated.View entering={FadeInUp.duration(220)} style={[styles.bubble, styles.user]}>
                <Text variant="body" tone="inverse">
                  {item.text}
                </Text>
              </Animated.View>
            ) : (
              <Animated.View entering={FadeInUp.duration(260)} style={{ gap: spacing.sm, alignSelf: 'stretch' }}>
                <View style={styles.botRow}>
                  <View style={styles.botIcon}>
                    <Sparkles size={13} color={palette.violet400} />
                  </View>
                  <View style={[styles.bubble, styles.bot, item.error && styles.botError]}>
                    <Text variant="body" tone={item.error ? 'danger' : 'primary'}>
                      {item.text}
                    </Text>
                  </View>
                </View>
                {item.issues?.length ? (
                  <View style={{ gap: spacing.sm, marginLeft: 34 }}>
                    {item.issues.map((c) => (
                      <IssueCardMini key={c.id} c={c} />
                    ))}
                  </View>
                ) : null}
              </Animated.View>
            )
          }
          ListFooterComponent={
            busy ? (
              <View style={[styles.botRow, { marginTop: spacing.md }]}>
                <View style={styles.botIcon}>
                  <Sparkles size={13} color={palette.violet400} />
                </View>
                <View style={[styles.bubble, styles.bot, styles.typing]}>
                  <Dot delay={0} />
                  <Dot delay={150} />
                  <Dot delay={300} />
                </View>
              </View>
            ) : undefined
          }
        />

        {lastSuggestions.length ? (
          <View>
            <FlatList
              horizontal
              data={lastSuggestions}
              keyExtractor={(s) => s}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: gutter, paddingBottom: spacing.sm }}
              renderItem={({ item }) => (
                <PressableScale onPress={() => send(item)} style={styles.suggest}>
                  <Text variant="label" tone="secondary">
                    {item}
                  </Text>
                </PressableScale>
              )}
            />
          </View>
        ) : null}

        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask about issues, reports, your city…"
            placeholderTextColor={colors.textTertiary}
            selectionColor={colors.primary}
            style={styles.input}
            multiline
            maxLength={600}
            onSubmitEditing={() => send(input)}
            blurOnSubmit={false}
          />
          <IconButton
            icon={ArrowUp}
            accessibilityLabel="Send"
            size={42}
            variant="filled"
            color={input.trim() && !busy ? colors.textOnPrimary : colors.textTertiary}
            style={input.trim() && !busy ? { backgroundColor: colors.primary, borderWidth: 0 } : undefined}
            disabled={!input.trim() || busy}
            onPress={() => send(input)}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  orb: { width: 72, height: 72, borderRadius: 36, backgroundColor: alphaOf(palette.violet400, 0.14), alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  prompts: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.lg },
  prompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  bubble: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.xl, maxWidth: '86%' },
  user: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: radius.xs },
  botRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  botIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: alphaOf(palette.violet400, 0.16), alignItems: 'center', justifyContent: 'center' },
  bot: { flexShrink: 1, backgroundColor: colors.surfaceRaised, borderBottomLeftRadius: radius.xs },
  botError: { backgroundColor: colors.dangerSoft },
  typing: { flexDirection: 'row', gap: 5, paddingVertical: spacing.lg },
  typingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.textSecondary },
  mini: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.border },
  miniImg: { width: 48, height: 48, borderRadius: radius.md },
  suggest: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.borderStrong, backgroundColor: colors.surface },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.bgDeep,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: colors.border,
  },
  input: {
    ...(type.body as object),
    flex: 1,
    color: colors.text,
    minHeight: 42,
    maxHeight: 120,
    paddingHorizontal: spacing.lg,
    paddingTop: 10,
    paddingBottom: 10,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceRaised,
  },
});
