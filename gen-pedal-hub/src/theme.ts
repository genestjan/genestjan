/**
 * Brand: deep navy, electric blue, white. The app is always dark, in daylight and at night.
 */
const navy = {
  bg: '#050A18',
  card: '#0D1730',
  line: '#1D2E55',
  text: '#FFFFFF',
  muted: '#93A4C6',
  brand: '#1A7BF5',
  onBrand: '#FFFFFF',
  accent: '#1A7BF5',
  onAccent: '#FFFFFF',
  accentText: '#56ABFF',
  soft: '#14264B',
  danger: '#FF5D62',
  warn: '#FFB020',
  good: '#2ED573',
  /** The lighter blue at the top of buttons and the hero card. */
  brandLight: '#33B1FF',
};

export type Theme = typeof navy;

export function useTheme(): Theme {
  return navy;
}

/** A soft blue light around the things you press. */
export const glow = { boxShadow: '0px 0px 18px rgba(30, 139, 255, 0.55)' } as const;
export const softGlow = { boxShadow: '0px 0px 14px rgba(30, 139, 255, 0.18)' } as const;

/** The ride screen uses the same colours, with a slightly darker page. */
export const rideTheme = {
  bg: '#040815',
  panel: '#0D1730',
  line: '#1D2E55',
  text: '#FFFFFF',
  muted: '#93A4C6',
  accent: '#1A7BF5',
  onAccent: '#FFFFFF',
  danger: '#F0444A',
  warn: '#FFB020',
  good: '#2ED573',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 18, lg: 24, pill: 999 } as const;
