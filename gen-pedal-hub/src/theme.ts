import { useColorScheme } from 'react-native';

/** Brand: forest green, fresh lime, charcoal, off-white. */
const light = {
  bg: '#F4F6F2',
  card: '#FFFFFF',
  line: '#DFE5DC',
  text: '#171C1B',
  muted: '#5C6965',
  brand: '#173B32',
  onBrand: '#FFFFFF',
  accent: '#A6D96A',
  onAccent: '#14261F',
  accentText: '#3F7D12',
  soft: '#E6EEDF',
  danger: '#C2362B',
  warn: '#B4690E',
};

const dark: typeof light = {
  bg: '#111615',
  card: '#1B2221',
  line: '#2B3533',
  text: '#F1F4EF',
  muted: '#9AA8A3',
  brand: '#A6D96A',
  onBrand: '#14261F',
  accent: '#A6D96A',
  onAccent: '#14261F',
  accentText: '#A6D96A',
  soft: '#22302B',
  danger: '#F0776C',
  warn: '#E7A64B',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

/** The ride screen is always dark: easier on the eyes and readable in sunlight. */
export const rideTheme = {
  bg: '#0E1513',
  panel: '#18211E',
  text: '#FFFFFF',
  muted: '#9DB0A8',
  accent: '#A6D96A',
  onAccent: '#14261F',
  danger: '#E5584C',
  warn: '#F2B544',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;
