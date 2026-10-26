import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Camera, CheckCircle2, HardHat, ImagePlus, Play } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { workerApi, type Issue } from '@/api';
import { Button, PressableScale, Sheet, Text, TextField, toast } from '@/components/ui';
import { capturePhoto, pickPhoto, type PickedImage } from '@/lib/media';
import { qk } from '@/lib/query';
import { statusOf } from '@/theme/domain';
import { alphaOf, colors, palette, radius, spacing } from '@/theme/tokens';

/** Field-worker actions on an assigned task: start work, then resolve with an after-photo. */
export function WorkerPanel({ issue, userId }: { issue: Issue; userId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [remarks, setRemarks] = useState('');
  const status = statusOf(issue.status);

  const update = useMutation({
    mutationFn: (body: Parameters<typeof workerApi.update>[1]) => workerApi.update(issue._id, body),
    onSuccess: (_, body) => {
      qc.invalidateQueries({ queryKey: qk.issue(issue._id) });
      qc.invalidateQueries({ queryKey: qk.tasks(userId) });
      toast.success(body.status === 'Resolved' ? 'Task resolved — great work!' : 'Marked as in progress');
      setOpen(false);
      setPhoto(null);
      setRemarks('');
    },
    onError: (e) => toast.error(e.message),
  });

  const take = async (fromLibrary: boolean) => {
    try {
      const p = fromLibrary ? await pickPhoto() : await capturePhoto();
      if (p) setPhoto(p);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not get photo');
    }
  };

  if (status === 'Resolved' || status === 'Rejected') return null;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.icon}>
          <HardHat size={18} color={palette.amber400} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="subheading">Your task</Text>
          <Text variant="caption" tone="tertiary">
            {status === 'InProgress' ? 'Work in progress — resolve with an after-photo.' : 'Start work when you reach the site.'}
          </Text>
        </View>
      </View>
      {status !== 'InProgress' ? (
        <Button label="Start work" icon={Play} loading={update.isPending} onPress={() => update.mutate({ status: 'InProgress', comment: 'Field worker started work on site' })} />
      ) : null}
      <Button label="Mark as resolved" icon={CheckCircle2} variant={status === 'InProgress' ? 'success' : 'secondary'} onPress={() => setOpen(true)} />

      <Sheet visible={open} onClose={() => setOpen(false)} title="Resolve task">
        <View style={{ gap: spacing.lg }}>
          <Text variant="callout" tone="secondary">
            Add a clear photo of the fixed site. The citizen who reported it will see it as proof.
          </Text>
          {photo ? (
            <PressableScale onPress={() => take(false)}>
              <Image source={{ uri: photo.uri }} style={styles.photo} contentFit="cover" />
            </PressableScale>
          ) : (
            <View style={styles.pickRow}>
              <PressableScale onPress={() => take(false)} style={styles.pick}>
                <Camera size={22} color={colors.primary} />
                <Text variant="label">Take photo</Text>
              </PressableScale>
              <PressableScale onPress={() => take(true)} style={styles.pick}>
                <ImagePlus size={22} color={colors.textSecondary} />
                <Text variant="label">From gallery</Text>
              </PressableScale>
            </View>
          )}
          <TextField label="Remarks" value={remarks} onChangeText={setRemarks} placeholder="What was done?" multiline maxLength={400} />
          <Button
            label="Submit resolution"
            variant="success"
            disabled={!photo}
            loading={update.isPending}
            onPress={() => photo && update.mutate({ status: 'Resolved', comment: remarks.trim() || 'Resolved by field worker', imageUri: photo.uri })}
          />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    gap: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: alphaOf(palette.amber400, 0.06),
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: alphaOf(palette.amber400, 0.3),
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: alphaOf(palette.amber400, 0.15), alignItems: 'center', justifyContent: 'center' },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg },
  pickRow: { flexDirection: 'row', gap: spacing.md },
  pick: {
    flex: 1,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
  },
});
