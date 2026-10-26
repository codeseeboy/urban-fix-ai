/**
 * Display metadata for UrbanFix's domain values — categories, severities and
 * statuses. Every badge, chip, marker and filter reads from these maps, so a
 * category always has the same name, colour and icon everywhere in the app.
 */
import type { LucideIcon } from 'lucide-react-native';
import {
  Construction,
  Droplets,
  Lightbulb,
  CircleEllipsis,
  ShieldAlert,
  Trash2,
  TreePine,
  Waves,
  Zap,
} from 'lucide-react-native';

import { alphaOf, palette } from './tokens';

export type Category =
  | 'roads'
  | 'trash'
  | 'water'
  | 'drainage'
  | 'lighting'
  | 'electricity'
  | 'parks'
  | 'safety'
  | 'other';

export type Severity = 'Low' | 'Medium' | 'High' | 'Critical';
export type Status = 'Submitted' | 'Acknowledged' | 'InProgress' | 'Resolved' | 'Rejected';

type Meta = { label: string; color: string; soft: string };

export const CATEGORY_ORDER: Category[] = [
  'roads',
  'trash',
  'drainage',
  'water',
  'lighting',
  'electricity',
  'parks',
  'safety',
  'other',
];

export const categoryMeta: Record<Category, Meta & { icon: LucideIcon; department: string; hint: string }> = {
  roads: { label: 'Roads', icon: Construction, color: palette.orange400, soft: alphaOf(palette.orange400, 0.15), department: 'PWD', hint: 'Potholes, cracks, broken footpaths' },
  trash: { label: 'Garbage', icon: Trash2, color: palette.green400, soft: alphaOf(palette.green400, 0.15), department: 'Sanitation', hint: 'Dumps, overflowing bins, litter' },
  drainage: { label: 'Drainage', icon: Waves, color: palette.cyan400, soft: alphaOf(palette.cyan400, 0.15), department: 'Drainage', hint: 'Blocked drains, sewage, waterlogging' },
  water: { label: 'Water', icon: Droplets, color: palette.sky400, soft: alphaOf(palette.sky400, 0.15), department: 'Water Supply', hint: 'Leaks, burst pipes, contaminated water' },
  lighting: { label: 'Streetlights', icon: Lightbulb, color: palette.amber400, soft: alphaOf(palette.amber400, 0.15), department: 'Electrical', hint: 'Broken or dark streetlights' },
  electricity: { label: 'Electrical', icon: Zap, color: palette.yellow400, soft: alphaOf(palette.yellow400, 0.15), department: 'Electrical', hint: 'Exposed wires, damaged poles' },
  parks: { label: 'Parks & Trees', icon: TreePine, color: palette.lime400, soft: alphaOf(palette.lime400, 0.15), department: 'Horticulture', hint: 'Fallen trees, broken benches' },
  safety: { label: 'Public Safety', icon: ShieldAlert, color: palette.red400, soft: alphaOf(palette.red400, 0.15), department: 'Safety', hint: 'Dangerous structures, signals' },
  other: { label: 'Other', icon: CircleEllipsis, color: palette.ink300, soft: alphaOf(palette.ink300, 0.15), department: 'General', hint: 'Anything else that needs fixing' },
};

export function categoryOf(value?: string | null): Category {
  const v = (value || '').toLowerCase();
  if (v === 'garbage') return 'trash';
  return (CATEGORY_ORDER as string[]).includes(v) ? (v as Category) : 'other';
}

export const SEVERITY_ORDER: Severity[] = ['Critical', 'High', 'Medium', 'Low'];

export const severityMeta: Record<Severity, Meta & { rank: number }> = {
  Critical: { label: 'Critical', color: palette.red400, soft: alphaOf(palette.red400, 0.16), rank: 4 },
  High: { label: 'High', color: palette.orange400, soft: alphaOf(palette.orange400, 0.16), rank: 3 },
  Medium: { label: 'Medium', color: palette.amber400, soft: alphaOf(palette.amber400, 0.16), rank: 2 },
  Low: { label: 'Low', color: palette.green400, soft: alphaOf(palette.green400, 0.16), rank: 1 },
};

export function severityOf(value?: string | null): Severity {
  return value && value in severityMeta ? (value as Severity) : 'Medium';
}

export const STATUS_FLOW: Status[] = ['Submitted', 'Acknowledged', 'InProgress', 'Resolved'];

export const statusMeta: Record<Status, Meta & { description: string }> = {
  Submitted: { label: 'Submitted', color: palette.ink300, soft: alphaOf(palette.ink300, 0.14), description: 'Report received, waiting for the municipality.' },
  Acknowledged: { label: 'Acknowledged', color: palette.violet400, soft: alphaOf(palette.violet400, 0.16), description: 'The department has seen and accepted it.' },
  InProgress: { label: 'In progress', color: palette.blue400, soft: alphaOf(palette.blue400, 0.16), description: 'A crew is working on it.' },
  Resolved: { label: 'Resolved', color: palette.green400, soft: alphaOf(palette.green400, 0.16), description: 'Fixed and verified.' },
  Rejected: { label: 'Rejected', color: palette.ink500, soft: alphaOf(palette.ink500, 0.16), description: 'Closed without action.' },
};

export function statusOf(value?: string | null): Status {
  return value && value in statusMeta ? (value as Status) : 'Submitted';
}

export const isOpenStatus = (s: Status) => s !== 'Resolved' && s !== 'Rejected';
