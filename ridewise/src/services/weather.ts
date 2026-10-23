// Open-Meteo forecast (free for non-commercial use, no key). Forecasts reach
// about 16 days ahead; beyond that RideWise says conditions are not verified.

import type { LatLng } from '../types';
import { config } from '../config';
import { fetchWithRetry, type RetryOptions } from './http';

export type HourWeather = { timeMs: number; tempC: number; rainProbPct: number | null; windKmh: number; code: number };
export type PointForecast = {
  label: string;
  point: LatLng;
  hours: HourWeather[];
  sunrise: Record<string, number>; // local date -> epoch ms
  sunset: Record<string, number>;
};
export type WeatherReport = { points: PointForecast[]; retrievedAt: string; source: string };

type OM = {
  utc_offset_seconds: number;
  hourly?: { time: string[]; temperature_2m: number[]; precipitation_probability?: (number | null)[]; wind_speed_10m: number[]; weather_code: number[] };
  daily?: { time: string[]; sunrise: string[]; sunset: string[] };
};

/** Open-Meteo returns local times without offset; convert with utc_offset_seconds. */
const toMs = (local: string, offsetS: number) => Date.parse(`${local}:00Z`) - offsetS * 1000;

export function parseOpenMeteo(j: OM, label: string, point: LatLng): PointForecast {
  const off = j.utc_offset_seconds ?? 0;
  const h = j.hourly;
  const hours: HourWeather[] = h
    ? h.time.map((t, i) => ({
        timeMs: toMs(t, off),
        tempC: h.temperature_2m[i],
        rainProbPct: h.precipitation_probability?.[i] ?? null,
        windKmh: h.wind_speed_10m[i],
        code: h.weather_code[i],
      }))
    : [];
  const sunrise: Record<string, number> = {};
  const sunset: Record<string, number> = {};
  j.daily?.time.forEach((d, i) => {
    sunrise[d] = toMs(j.daily!.sunrise[i], off);
    sunset[d] = toMs(j.daily!.sunset[i], off);
  });
  return { label, point, hours, sunrise, sunset };
}

export async function fetchRouteWeather(points: { label: string; point: LatLng }[], timeZone: string, opts?: RetryOptions): Promise<WeatherReport> {
  const out: PointForecast[] = [];
  for (const p of points) {
    const params = new URLSearchParams({
      latitude: p.point.lat.toFixed(4),
      longitude: p.point.lng.toFixed(4),
      hourly: 'temperature_2m,precipitation_probability,wind_speed_10m,weather_code',
      daily: 'sunrise,sunset',
      timezone: timeZone,
      forecast_days: '16',
    });
    const res = await fetchWithRetry(`${config.openMeteoUrl}?${params}`, {}, opts);
    out.push(parseOpenMeteo((await res.json()) as OM, p.label, p.point));
  }
  return { points: out, retrievedAt: new Date().toISOString(), source: 'Open-Meteo.com' };
}

export function hourAt(f: PointForecast, ms: number): HourWeather | null {
  if (!f.hours.length) return null;
  const first = f.hours[0].timeMs;
  const last = f.hours[f.hours.length - 1].timeMs;
  if (ms < first - 3600000 || ms > last + 3600000) return null;
  return f.hours.reduce((a, b) => (Math.abs(b.timeMs - ms) < Math.abs(a.timeMs - ms) ? b : a));
}

export function describeCode(code: number): string {
  if (code === 0) return 'Clear';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 48) return 'Fog';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Rain showers';
  if (code <= 99) return 'Thunderstorm';
  return 'Unknown';
}

export function weatherAdvice(h: HourWeather): string[] {
  const tips: string[] = [];
  if ((h.rainProbPct ?? 0) >= 60) tips.push('High chance of rain: pack rain protection and allow more time.');
  if (h.code >= 95) tips.push('Thunderstorms forecast: consider postponing or plan sheltered stops.');
  if (h.tempC >= 32) tips.push('Hot conditions: start earlier, add shaded rest stops and drink more often.');
  if (h.windKmh >= 30) tips.push('Strong wind forecast: expect slower riding on exposed stretches.');
  return tips;
}
