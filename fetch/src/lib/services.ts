import type { LatLng } from './types';
import { MINDANAO_BBOX, PLACES, haversineKm } from './geo';

/** Road route from the free OSRM demo server (car profile). Falls back to a straight-line estimate. */
export async function route(a: LatLng, b: LatLng): Promise<{ km: number; min: number; line: LatLng[] }> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=simplified&geometries=geojson`;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(url, { signal: ctl.signal });
    clearTimeout(t);
    const j = await r.json();
    const rt = j.routes?.[0];
    if (!rt) throw new Error('no route');
    return {
      km: rt.distance / 1000,
      min: rt.duration / 60,
      line: rt.geometry.coordinates.map(([lng, lat]: [number, number]) => ({ lat, lng })),
    };
  } catch {
    const km = haversineKm(a, b) * 1.3; // road factor
    // Straight line split into steps so moving markers glide instead of jumping.
    const line = Array.from({ length: 13 }, (_, i) => ({ lat: a.lat + ((b.lat - a.lat) * i) / 12, lng: a.lng + ((b.lng - a.lng) * i) / 12 }));
    return { km, min: (km / 25) * 60, line };
  }
}

/** Place search limited to Mindanao. Known places answer instantly; Nominatim covers the rest. */
export async function searchPlaces(q: string): Promise<{ label: string; p: LatLng }[]> {
  const s = q.trim().toLowerCase();
  if (!s) return PLACES.slice(0, 8);
  const local = PLACES.filter((x) => x.label.toLowerCase().includes(s));
  if (s.length < 3) return local;
  try {
    const [w, so, e, n] = MINDANAO_BBOX;
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=6&countrycodes=ph&bounded=1&viewbox=${w},${n},${e},${so}&q=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const j: { display_name: string; lat: string; lon: string }[] = await r.json();
    return [...local, ...j.map((x) => ({ label: x.display_name.split(',').slice(0, 3).join(','), p: { lat: +x.lat, lng: +x.lon } }))];
  } catch {
    return local;
  }
}

export async function reverse(p: LatLng): Promise<string> {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=17&lat=${p.lat}&lon=${p.lng}`);
    const j = await r.json();
    return (j.display_name as string).split(',').slice(0, 2).join(',');
  } catch {
    return `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`;
  }
}

/** Shrinks a photo before upload so ID pictures stay small. */
export function compressImage(file: File, max = 900): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = img.width * k;
      c.height = img.height * k;
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      res(c.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}
