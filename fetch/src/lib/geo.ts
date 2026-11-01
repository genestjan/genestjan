import type { LatLng } from './types';

export const GENSAN: LatLng = { lat: 6.1164, lng: 125.1716 };
/** Mindanao bounding box (west, south, east, north) used to keep searches local. */
export const MINDANAO_BBOX = [121.8, 4.5, 126.7, 10.0] as const;

export function inMindanao(p: LatLng): boolean {
  const [w, s, e, n] = MINDANAO_BBOX;
  return p.lng >= w && p.lng <= e && p.lat >= s && p.lat <= n;
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la = (a.lat * Math.PI) / 180;
  const lb = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la) * Math.cos(lb) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Well-known GenSan and Mindanao places, so common bookings work without typing. */
export const PLACES: { label: string; p: LatLng }[] = [
  { label: 'KCC Mall of GenSan', p: { lat: 6.1166, lng: 125.1716 } },
  { label: 'SM City General Santos', p: { lat: 6.1197, lng: 125.1792 } },
  { label: 'Robinsons Place GenSan', p: { lat: 6.1119, lng: 125.1695 } },
  { label: 'Gaisano Mall GenSan', p: { lat: 6.1149, lng: 125.1743 } },
  { label: 'GenSan Fish Port Complex', p: { lat: 6.0894, lng: 125.1468 } },
  { label: 'GenSan International Airport', p: { lat: 6.0580, lng: 125.0960 } },
  { label: 'Bulaong Bus Terminal', p: { lat: 6.1226, lng: 125.1652 } },
  { label: 'City Hall, General Santos', p: { lat: 6.1128, lng: 125.1720 } },
  { label: 'Mindanao State University GenSan', p: { lat: 6.0722, lng: 125.1250 } },
  { label: 'St. Elizabeth Hospital', p: { lat: 6.1183, lng: 125.1697 } },
  { label: 'Koronadal City (Marbel)', p: { lat: 6.5009, lng: 124.8469 } },
  { label: 'Polomolok, South Cotabato', p: { lat: 6.2190, lng: 125.0640 } },
  { label: 'Alabel, Sarangani', p: { lat: 6.1028, lng: 125.2900 } },
  { label: 'Davao City (Ecoland Terminal)', p: { lat: 7.0560, lng: 125.5930 } },
  { label: 'Cotabato City', p: { lat: 7.2236, lng: 124.2464 } },
  { label: 'Cagayan de Oro', p: { lat: 8.4542, lng: 124.6319 } },
];
