import { heatIndexC, heatCategory, type HeatCategory } from './heatIndex';
export interface HourWx { time: string; tempC: number; rh: number; pop: number; code: number; cape: number }
export interface EventWx { maxHi: number; category: HeatCategory; thunder: boolean; hours: HourWx[] }

export function parseOpenMeteo(j: { hourly?: { time: string[]; temperature_2m: number[]; relative_humidity_2m: number[]; precipitation_probability: number[]; weather_code: number[]; cape: number[] } }): HourWx[] {
  const h = j.hourly; if (!h) return [];
  return h.time.map((time, i) => ({ time, tempC: h.temperature_2m[i], rh: h.relative_humidity_2m[i], pop: h.precipitation_probability[i] ?? 0, code: h.weather_code[i] ?? 0, cape: h.cape[i] ?? 0 }));
}
/** Hours that touch the event window (times are local Manila wall-clock strings from the API). */
export function forEvent(hours: HourWx[], startLocal: string, endLocal: string): EventWx | null {
  const s = startLocal.slice(0, 13), e = endLocal.slice(0, 13);
  const sel = hours.filter((h) => h.time.slice(0, 13) >= s && h.time.slice(0, 13) <= e);
  if (!sel.length) return null;
  const maxHi = Math.max(...sel.map((h) => heatIndexC(h.tempC, h.rh)));
  const thunder = sel.some((h) => [95, 96, 99].includes(h.code) || (h.cape >= 1000 && h.pop >= 40));
  return { maxHi, category: heatCategory(maxHi), thunder, hours: sel };
}
export const wxUrl = (lat: number, lng: number) => `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,cape&timezone=Asia%2FManila&forecast_days=7`;
export async function fetchWx(lat: number, lng: number, cache = true): Promise<HourWx[]> {
  const key = `wx:${lat.toFixed(2)},${lng.toFixed(2)}`;
  try { const c = JSON.parse(localStorage.getItem(key) ?? 'null'); if (cache && c && Date.now() - c.t < 3 * 3600e3) return c.h; } catch { /* no cache */ }
  const r = await fetch(wxUrl(lat, lng)); if (!r.ok) throw new Error('Weather unavailable');
  const h = parseOpenMeteo(await r.json());
  try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), h })); } catch { /* ignore */ }
  return h;
}
export const YAM1 = { lat: 6.1164, lng: 125.1716 }; // General Santos City centre; replace with the venue's coordinates
