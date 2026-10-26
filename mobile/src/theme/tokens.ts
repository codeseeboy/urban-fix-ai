/**
 * UrbanFix design tokens — the single source of truth for colour, type, spacing,
 * radius and motion. Components read from here; screens never hard-code values.
 *
 * The palette is anchored on the logo's navy (#0F152D) and its blue→cyan shield,
 * so the launcher icon, splash and app read as one brand.
 */

export const palette = {
  navy950: '#070B18',
  navy900: '#0B1021', // app background
  navy850: '#0F152D', // logo background
  navy800: '#121933', // cards
  navy750: '#18213F', // raised / inputs
  navy700: '#1E2850', // sheets
  navy600: '#283563',
  line: '#222C4F',
  lineStrong: '#2E3A66',

  white: '#FFFFFF',
  ink100: '#EEF2FB',
  ink300: '#A3AECB',
  ink500: '#6E7AA0',
  ink700: '#46507A',

  blue500: '#2D7CF6',
  blue600: '#2468D6',
  blue400: '#5B9BFF',
  cyan400: '#22C7E8',
  violet400: '#8B7CF6',
  green400: '#2BC48A',
  amber400: '#F5B544',
  orange400: '#FF8A3D',
  red400: '#F2555A',
  yellow400: '#FACC15',
  sky400: '#38BDF8',
  lime400: '#4ADE80',
} as const;

const alpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

export const colors = {
  bg: palette.navy900,
  bgDeep: palette.navy950,
  surface: palette.navy800,
  surfaceRaised: palette.navy750,
  surfaceSheet: palette.navy700,
  border: palette.line,
  borderStrong: palette.lineStrong,

  text: palette.ink100,
  textSecondary: palette.ink300,
  textTertiary: palette.ink500,
  textDisabled: palette.ink700,
  textOnPrimary: palette.white,

  primary: palette.blue500,
  primaryPressed: palette.blue600,
  primarySoft: alpha(palette.blue500, 0.16),
  accent: palette.cyan400,
  accentSoft: alpha(palette.cyan400, 0.14),

  success: palette.green400,
  successSoft: alpha(palette.green400, 0.14),
  warning: palette.amber400,
  warningSoft: alpha(palette.amber400, 0.14),
  danger: palette.red400,
  dangerSoft: alpha(palette.red400, 0.14),
  info: palette.blue400,
  infoSoft: alpha(palette.blue400, 0.14),

  scrim: 'rgba(4, 7, 16, 0.72)',
  overlay: 'rgba(11, 16, 33, 0.92)',
  skeleton: palette.navy750,
  skeletonHighlight: palette.navy700,
} as const;

export const alphaOf = alpha;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

/** Horizontal page padding used by every screen. */
export const gutter = spacing.xl;

export const radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
} as const;

// Inter is embedded at build time (expo-font config plugin), so it is always
// available — no runtime font loading and no splash-screen wait for it.
const FONT = 'Inter';

export const type = {
  display: { fontFamily: FONT, fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.6 },
  title: { fontFamily: FONT, fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.3 },
  heading: { fontFamily: FONT, fontSize: 18, lineHeight: 24, fontWeight: '700', letterSpacing: -0.2 },
  subheading: { fontFamily: FONT, fontSize: 16, lineHeight: 22, fontWeight: '600', letterSpacing: -0.1 },
  body: { fontFamily: FONT, fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontFamily: FONT, fontSize: 15, lineHeight: 22, fontWeight: '600' },
  callout: { fontFamily: FONT, fontSize: 14, lineHeight: 20, fontWeight: '400' },
  label: { fontFamily: FONT, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  caption: { fontFamily: FONT, fontSize: 12, lineHeight: 16, fontWeight: '500' },
  overline: { fontFamily: FONT, fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  numeric: { fontFamily: FONT, fontSize: 22, lineHeight: 26, fontWeight: '800', letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
} as const;

export type TypeVariant = keyof typeof type;

export const motion = {
  pressScale: 0.97,
  spring: { damping: 18, stiffness: 260, mass: 0.6 },
  fast: 140,
  base: 220,
  slow: 360,
} as const;

export const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 } as const;
