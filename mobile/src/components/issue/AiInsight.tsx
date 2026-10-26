import { useQuery } from '@tanstack/react-query';
import { ArrowRightCircle, Info, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { aiApi, type Issue } from '@/api';
import { Button, Skeleton, Text } from '@/components/ui';
import { qk } from '@/lib/query';
import { alphaOf, palette, radius, spacing } from '@/theme/tokens';

const VIOLET = palette.violet400;

function Section({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <View style={styles.section}>
      <Icon size={16} color={VIOLET} strokeWidth={2.2} style={{ marginTop: 2 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label">{title}</Text>
        <Text variant="callout" tone="secondary">
          {body}
        </Text>
      </View>
    </View>
  );
}

/** Plain-language explanation generated on demand by Gemini (Vertex AI). */
export function AiInsight({ issue }: { issue: Issue }) {
  const explain = useQuery({
    queryKey: [...qk.explain(issue._id), issue.status],
    queryFn: () =>
      aiApi.explain({ title: issue.title, category: issue.category, severity: issue.aiSeverity, status: issue.status, department: issue.departmentTag }),
    staleTime: Infinity,
    retry: false,
  });

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.icon}>
          <Sparkles size={16} color={VIOLET} strokeWidth={2.2} />
        </View>
        <Text variant="subheading" style={{ flex: 1 }}>
          AI insight
        </Text>
        <Text variant="caption" tone="tertiary">
          Gemini
        </Text>
      </View>
      {explain.isPending ? (
        <View style={{ gap: spacing.sm }}>
          <Skeleton width="90%" />
          <Skeleton width="75%" />
          <Skeleton width="82%" />
        </View>
      ) : explain.isError ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="callout" tone="tertiary">
            {explain.error.message}
          </Text>
          <Button label="Try again" size="sm" variant="secondary" fullWidth={false} onPress={() => explain.refetch()} />
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          <Section icon={Info} title="Why it matters" body={explain.data.whyItMatters} />
          <Section icon={ArrowRightCircle} title="What happens next" body={explain.data.whatHappensNext} />
          <Section icon={ShieldCheck} title="Stay safe" body={explain.data.staySafe} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    gap: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: alphaOf(VIOLET, 0.07),
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: alphaOf(VIOLET, 0.25),
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: { width: 30, height: 30, borderRadius: radius.sm, backgroundColor: alphaOf(VIOLET, 0.16), alignItems: 'center', justifyContent: 'center' },
  section: { flexDirection: 'row', gap: spacing.md },
});

