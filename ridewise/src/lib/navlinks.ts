import type { LatLng } from '../types';

/** Google Maps cycling directions to exact coordinates. Opens the Maps app on phones. */
export function googleDirectionsUrl(dest: LatLng, origin?: LatLng | null): string {
  const p = new URLSearchParams({ api: '1', destination: `${dest.lat.toFixed(6)},${dest.lng.toFixed(6)}`, travelmode: 'bicycling' });
  if (origin) p.set('origin', `${origin.lat.toFixed(6)},${origin.lng.toFixed(6)}`);
  return `https://www.google.com/maps/dir/?${p.toString()}`;
}

export function osmUrl(p: LatLng, zoom = 18): string {
  return `https://www.openstreetmap.org/?mlat=${p.lat.toFixed(6)}&mlon=${p.lng.toFixed(6)}#map=${zoom}/${p.lat.toFixed(6)}/${p.lng.toFixed(6)}`;
}

/** geo: URI, handled by most Android map apps. */
export function geoUri(p: LatLng, label?: string): string {
  const q = `${p.lat.toFixed(6)},${p.lng.toFixed(6)}${label ? `(${encodeURIComponent(label)})` : ''}`;
  return `geo:${p.lat.toFixed(6)},${p.lng.toFixed(6)}?q=${q}`;
}
