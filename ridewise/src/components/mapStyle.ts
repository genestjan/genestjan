import type { StopCategory } from '../types';

export type MapGroup = 'food' | 'store' | 'water' | 'rest' | 'repair' | 'medical' | 'fuel' | 'other';

export const GROUP_OF: Record<StopCategory, MapGroup> = {
  convenience: 'store', 'sari-sari': 'store', supermarket: 'store', bakery: 'food', restaurant: 'food', cafe: 'food',
  water: 'water', toilets: 'rest', shelter: 'rest', fuel: 'fuel', bicycle: 'repair', pharmacy: 'medical',
  hospital: 'medical', clinic: 'medical', police: 'other', other: 'other',
};

/** Colour plus a letter, so the marker type never depends on colour alone. */
export const GROUP_STYLE: Record<MapGroup, { color: string; letter: string; label: string }> = {
  food: { color: '#c2410c', letter: 'F', label: 'Food' },
  store: { color: '#7c3aed', letter: 'S', label: 'Convenience / store' },
  water: { color: '#2b7bb9', letter: 'W', label: 'Water' },
  rest: { color: '#4d7c0f', letter: 'R', label: 'Rest / toilet' },
  repair: { color: '#334155', letter: 'B', label: 'Bike repair' },
  medical: { color: '#b91c1c', letter: '+', label: 'Medical' },
  fuel: { color: '#a16207', letter: 'G', label: 'Fuel station (confirm safe area)' },
  other: { color: '#64748b', letter: '•', label: 'Other' },
};
