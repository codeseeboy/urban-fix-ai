import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  Camera,
  CheckCircle2,
  Crosshair,
  EyeOff,
  ImagePlus,
  MapPin,
  RefreshCw,
  Siren,
  Sparkles,
  TriangleAlert,
  Users,
  Wand2,
  X,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { aiApi, issuesApi, type DuplicateCheck, type ImageAnalysis, type Issue } from '@/api';
import { AiVerdict } from '@/components/report/AiVerdict';
import { AnalyzingView } from '@/components/report/AnalyzingView';
import { Button, Chip, IconButton, PressableScale, Sheet, Text, TextField, ToggleRow, toast } from '@/components/ui';
import { ApiError, mediaUrl } from '@/lib/api';
import { distance } from '@/lib/format';
import { currentFix, type Fix } from '@/lib/location';
import { capturePhoto, pickPhoto, type PickedImage } from '@/lib/media';
import { useSession } from '@/store/session';
import { CATEGORY_ORDER, categoryMeta, categoryOf, type Category } from '@/theme/domain';
import { alphaOf, colors, gutter, palette, radius, spacing } from '@/theme/tokens';

type Step = 'capture' | 'analyzing' | 'rejected' | 'details' | 'done';

function useFix() {
  const [fix, setFix] = useState<Fix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      setFix(await currentFix());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not get your location.');
    } finally {
      setLoading(false);
    }
  };
  return { fix, error, loading, refresh };
}

export default function Report() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const patchUser = useSession((s) => s.patchUser);
  const points = useSession((s) => s.user?.points ?? 0);

  const [step, setStep] = useState<Step>('capture');
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [analysis, setAnalysis] = useState<ImageAnalysis | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('other');
  const [emergency, setEmergency] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [refining, setRefining] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [duplicate, setDuplicate] = useState<DuplicateCheck['match']>(null);
  const [created, setCreated] = useState<{ id: string; joined: boolean } | null>(null);
  const location = useFix();
  const runId = useRef(0);

  // Start the GPS fix right away so it's ready by the time the form is.
  useEffect(() => {
    location.refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => (router.canGoBack() ? router.back() : router.replace('/home'));

  const analyze = async (p: PickedImage) => {
    const run = ++runId.current;
    setStep('analyzing');
    try {
      const a = await issuesApi.analyzeImage(p.uri);
      if (run !== runId.current) return;
      setAnalysis(a);
      setCategory(categoryOf(a.category));
      setTitle(a.title || '');
      setDescription(a.description || '');
      setEmergency(!!a.isEmergency);
      setStep(a.isValid === false ? 'rejected' : 'details');
    } catch (e) {
      if (run !== runId.current) return;
      setAnalysis(null);
      setStep('details');
      toast.info(e instanceof ApiError && e.status === 503 ? 'AI is busy right now — please fill in the details yourself.' : e instanceof Error ? e.message : 'Analysis failed.');
    }
  };

  const choose = async (fromLibrary: boolean) => {
    try {
      const p = fromLibrary ? await pickPhoto() : await capturePhoto();
      if (!p) return;
      setPhoto(p);
      analyze(p);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not get the photo.');
    }
  };

  const refine = async () => {
    setRefining(true);
    try {
      const r = await aiApi.refine({ title, description, category });
      setTitle(r.title);
      setDescription(r.description);
      toast.success('Polished by AI');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'AI could not refine the text.');
    } finally {
      setRefining(false);
    }
  };

  const finish = (issue: { id: string; joined: boolean }) => {
    patchUser({ points: points + 10 });
    qc.invalidateQueries({ queryKey: ['feed'] });
    qc.invalidateQueries({ queryKey: ['map'] });
    qc.invalidateQueries({ queryKey: ['profile'] });
    qc.invalidateQueries({ queryKey: ['stats'] });
    setCreated(issue);
    setStep('done');
  };

  const createNew = async () => {
    if (!photo || !location.fix) return;
    setSubmitting(true);
    try {
      const issue: Issue = await issuesApi.create({ title: title.trim(), description: description.trim(), category, anonymous, emergency, location: location.fix, imageUri: photo.uri });
      finish({ id: issue._id, joined: false });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'NOT_CIVIC_ISSUE') {
        setStep('rejected');
        setAnalysis((a) => (a ? { ...a, isValid: false, rejectionReason: e.message } : a));
      } else {
        toast.error(e instanceof Error ? e.message : 'Could not submit the report.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const join = async () => {
    if (!photo || !location.fix || !duplicate) return;
    setSubmitting(true);
    try {
      await issuesApi.joinReport(duplicate.issueId, { title: title.trim(), description: description.trim(), category, anonymous, location: location.fix, imageUri: photo.uri });
      const id = duplicate.issueId;
      setDuplicate(null);
      finish({ id, joined: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add your report.');
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async () => {
    if (!location.fix) {
      toast.error(location.error ?? 'Waiting for your location…');
      return;
    }
    setSubmitting(true);
    try {
      const dup = await issuesApi.duplicateCheck({ title: title.trim(), description: description.trim(), category, location: location.fix });
      if (dup.exists && dup.match) {
        setDuplicate(dup.match);
        setSubmitting(false);
        return;
      }
    } catch {
      // A failed duplicate check must not block reporting.
    }
    await createNew();
  };

  const canSubmit = !!photo && title.trim().length >= 5 && !!location.fix && !submitting;

  // ── Screens ──────────────────────────────────────────────────────────────
  const topBar = (
    <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
      <IconButton icon={X} accessibilityLabel="Close" variant={step === 'capture' ? 'glass' : 'filled'} onPress={close} />
      <Text variant="subheading">{step === 'done' ? '' : 'New report'}</Text>
      <View style={{ width: 42 }} />
    </View>
  );

  if (step === 'capture') {
    return (
      <View style={styles.root}>
        <Image source={require('../../assets/hero-report.jpg')} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient colors={[alphaOf(palette.navy900, 0.5), alphaOf(palette.navy900, 0.2), palette.navy900]} locations={[0, 0.35, 0.78]} style={StyleSheet.absoluteFill} />
        {topBar}
        <View style={{ flex: 1 }} />
        <Animated.View entering={FadeInDown.duration(450)} style={[styles.captureBody, { paddingBottom: insets.bottom + spacing.xl }]}>
          <Text variant="display">What needs fixing?</Text>
          <Text variant="body" tone="secondary">
            Take a clear photo of the problem. Our AI identifies it, rates severity and routes it to the right department.
          </Text>
          <View style={styles.locRow}>
            <MapPin size={14} color={location.fix ? colors.success : colors.textTertiary} />
            <Text variant="caption" tone={location.fix ? 'success' : 'tertiary'} numberOfLines={1} style={{ flex: 1 }}>
              {location.fix ? `Location locked · ±${Math.round(location.fix.accuracy ?? 0)} m` : location.error ?? 'Getting your location…'}
            </Text>
          </View>
          <Button label="Take a photo" icon={Camera} onPress={() => choose(false)} />
          <Button label="Choose from gallery" icon={ImagePlus} variant="secondary" onPress={() => choose(true)} />
        </Animated.View>
      </View>
    );
  }

  if (step === 'analyzing' && photo) {
    return (
      <View style={styles.root}>
        {topBar}
        <View style={[styles.pad, { flex: 1, paddingBottom: insets.bottom + spacing.xl }]}>
          <AnalyzingView uri={photo.uri} />
        </View>
      </View>
    );
  }

  if (step === 'rejected' && photo) {
    const strong = (analysis?.confidence ?? 0) >= 0.75;
    return (
      <View style={styles.root}>
        {topBar}
        <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: insets.bottom + spacing.xl, gap: spacing.xl }]}>
          <Image source={{ uri: photo.uri }} style={styles.rejectImg} contentFit="cover" />
          <Animated.View entering={FadeIn} style={styles.rejectCard}>
            <TriangleAlert size={22} color={palette.amber400} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="subheading">This doesn’t look like a civic issue</Text>
              <Text variant="callout" tone="secondary">
                {analysis?.rejectionReason || 'The AI couldn’t find a public infrastructure problem in this photo.'}
              </Text>
            </View>
          </Animated.View>
          <Text variant="callout" tone="tertiary">
            Tip: frame the problem itself — the pothole, the overflowing bin, the broken light — in daylight if you can.
          </Text>
          <View style={{ gap: spacing.md }}>
            <Button label="Retake photo" icon={Camera} onPress={() => choose(false)} />
            <Button label="Pick another photo" icon={ImagePlus} variant="secondary" onPress={() => choose(true)} />
            {!strong ? <Button label="It is an issue — continue" variant="ghost" onPress={() => setStep('details')} /> : null}
          </View>
        </ScrollView>
      </View>
    );
  }

  if (step === 'done' && created) {
    return (
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.done}>
          <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.doneIcon}>
            <CheckCircle2 size={56} color={palette.green400} strokeWidth={1.8} />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(150)} style={{ alignItems: 'center', gap: spacing.sm }}>
            <Text variant="display" align="center">
              {created.joined ? 'Added to the report' : 'Report submitted'}
            </Text>
            <Text variant="body" tone="secondary" align="center">
              {created.joined
                ? 'Your photo strengthens an existing report, which pushes up its priority.'
                : `Sent to ${analysis?.departmentTag ?? categoryMeta[category].department}. You’ll get a notification at every step.`}
            </Text>
            <View style={styles.pointsPill}>
              <Sparkles size={14} color={palette.amber400} />
              <Text variant="label" tone="warning">
                +10 points earned
              </Text>
            </View>
          </Animated.View>
        </View>
        <View style={[styles.pad, { gap: spacing.md }]}>
          <Button label="View report" onPress={() => router.replace(`/issue/${created.id}`)} />
          <Button
            label="Report another issue"
            variant="secondary"
            onPress={() => {
              setPhoto(null);
              setAnalysis(null);
              setTitle('');
              setDescription('');
              setCategory('other');
              setEmergency(false);
              setCreated(null);
              setStep('capture');
            }}
          />
          <Button label="Done" variant="ghost" onPress={close} />
        </View>
      </View>
    );
  }

  // details
  return (
    <View style={styles.root}>
      {topBar}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: spacing.xxxl, gap: spacing.xl }]} keyboardShouldPersistTaps="handled">
          {photo ? (
            <View style={styles.photoRow}>
              <Image source={{ uri: photo.uri }} style={styles.thumb} contentFit="cover" />
              <View style={{ flex: 1, gap: spacing.sm }}>
                <Text variant="bodyStrong">Photo attached</Text>
                <Button label="Change photo" icon={RefreshCw} size="sm" variant="secondary" fullWidth={false} onPress={() => choose(false)} />
              </View>
            </View>
          ) : null}

          {analysis ? <AiVerdict analysis={analysis} /> : null}

          <View style={{ gap: spacing.lg }}>
            <TextField label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Deep pothole near the bus stop" maxLength={120} />
            <TextField label="Description" value={description} onChangeText={setDescription} placeholder="What’s wrong, how big is it, since when?" multiline maxLength={1000} />
            <Button label={refining ? 'Polishing…' : 'Polish with AI'} icon={Wand2} size="sm" variant="secondary" fullWidth={false} loading={refining} disabled={!title.trim() && !description.trim()} onPress={refine} />
          </View>

          <View style={{ gap: spacing.md }}>
            <Text variant="label" tone="secondary">
              Category
            </Text>
            <View style={styles.cats}>
              {CATEGORY_ORDER.map((c) => (
                <Chip key={c} label={categoryMeta[c].label} icon={categoryMeta[c].icon} color={categoryMeta[c].color} selected={category === c} onPress={() => setCategory(c)} />
              ))}
            </View>
          </View>

          <View style={{ gap: spacing.md }}>
            <Text variant="label" tone="secondary">
              Location
            </Text>
            <View style={styles.locCard}>
              <View style={[styles.locIcon, { backgroundColor: location.fix ? colors.successSoft : colors.surfaceRaised }]}>
                <Crosshair size={18} color={location.fix ? colors.success : colors.textTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" numberOfLines={2}>
                  {location.fix?.address ?? (location.loading ? 'Getting precise location…' : location.error ?? 'Location unavailable')}
                </Text>
                {location.fix ? (
                  <Text variant="caption" tone={(location.fix.accuracy ?? 0) > 50 ? 'warning' : 'tertiary'}>
                    GPS accuracy ±{Math.round(location.fix.accuracy ?? 0)} m{(location.fix.accuracy ?? 0) > 50 ? ' — move to open sky for a better fix' : ''}
                  </Text>
                ) : null}
              </View>
              <IconButton icon={RefreshCw} size={36} accessibilityLabel="Refresh location" onPress={location.refresh} disabled={location.loading} />
            </View>
          </View>

          <View style={{ gap: spacing.sm }}>
            <ToggleRow icon={Siren} title="Emergency" subtitle="Immediate danger to people or property" value={emergency} onChange={setEmergency} tint={palette.red400} />
            <ToggleRow icon={EyeOff} title="Report anonymously" subtitle="Your name won’t be shown publicly" value={anonymous} onChange={setAnonymous} tint={palette.violet400} />
          </View>
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <Button label="Submit report" onPress={submit} loading={submitting} disabled={!canSubmit} />
        </View>
      </KeyboardAvoidingView>

      <Sheet visible={!!duplicate} onClose={() => setDuplicate(null)} title="Similar issue nearby">
        {duplicate ? (
          <View style={{ gap: spacing.lg }}>
            <Text variant="callout" tone="secondary">
              Someone already reported this {distance(duplicate.distanceMeters)} away. Adding your photo to it raises its priority instead of creating a duplicate.
            </Text>
            <PressableScale onPress={() => router.push(`/issue/${duplicate.issueId}`)} style={styles.dupCard}>
              {duplicate.image ? <Image source={{ uri: mediaUrl(duplicate.image)! }} style={styles.dupImg} contentFit="cover" /> : <View style={styles.dupImg} />}
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="bodyStrong" numberOfLines={2}>
                  {duplicate.title}
                </Text>
                <Text variant="caption" tone="tertiary" numberOfLines={1}>
                  {duplicate.address}
                </Text>
                <Text variant="caption" tone="brand">
                  {Math.round(duplicate.confidence * 100)}% match
                </Text>
              </View>
            </PressableScale>
            <Button label="Add my report to it" icon={Users} loading={submitting} onPress={join} />
            <Button
              label="It’s a different issue"
              variant="secondary"
              disabled={submitting}
              onPress={() => {
                setDuplicate(null);
                createNew();
              }}
            />
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  pad: { paddingHorizontal: gutter, paddingTop: spacing.md },
  captureBody: { paddingHorizontal: gutter, gap: spacing.lg },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rejectImg: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.xl, opacity: 0.85 },
  rejectCard: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: alphaOf(palette.amber400, 0.08),
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: alphaOf(palette.amber400, 0.3),
  },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  thumb: { width: 92, height: 92, borderRadius: radius.lg },
  cats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  locCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  locIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: gutter, paddingTop: spacing.md, backgroundColor: colors.bgDeep, borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: colors.border },
  done: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: gutter, gap: spacing.xl },
  doneIcon: { width: 112, height: 112, borderRadius: 56, backgroundColor: alphaOf(palette.green400, 0.12), alignItems: 'center', justifyContent: 'center' },
  pointsPill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: alphaOf(palette.amber400, 0.12) },
  dupCard: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceRaised },
  dupImg: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.surface },
});
