import { sunTimes } from './sun';
import { parseLocal } from './time';
import { parseOpenMeteo } from '../services/weather';
import realMeteo from '../test/real/open-meteo-2026-11-07.json';

// Reference values: REAL Open-Meteo responses retrieved 2026-10-23 for 2026-11-07.
const at = (s: string) => parseLocal(s, 'Asia/Manila')!;
const minutesApart = (a: number, b: number) => Math.abs(a - b) / 60000;

describe('sunrise and sunset', () => {
  it('matches Open-Meteo for General Santos and Davao within 3 minutes', () => {
    const noon = at('2026-11-07T12:00');
    const gensan = sunTimes(noon, 6.1511, 125.188)!; // Open-Meteo grid point for GenSan
    const davao = sunTimes(noon, 7.065, 125.5743)!;
    expect(minutesApart(gensan.sunriseMs, at('2026-11-07T05:26'))).toBeLessThan(3);
    expect(minutesApart(gensan.sunsetMs, at('2026-11-07T17:19'))).toBeLessThan(3);
    expect(minutesApart(davao.sunriseMs, at('2026-11-07T05:26'))).toBeLessThan(3);
    expect(minutesApart(davao.sunsetMs, at('2026-11-07T17:16'))).toBeLessThan(3);
  });

  it('parses the real Open-Meteo response', () => {
    const gensan = (realMeteo as unknown as { url: string; body: never }[]).find((r) => r.url.includes('hourly'))!;
    const f = parseOpenMeteo(gensan.body, 'Start', { lat: 6.127, lng: 125.195 });
    expect(f.hours).toHaveLength(24);
    expect(f.sunrise['2026-11-07']).toBe(at('2026-11-07T05:26'));
    const threePm = f.hours.find((h) => h.timeMs === at('2026-11-07T15:00'))!;
    expect(threePm).toMatchObject({ rainProbPct: 76, code: 51 });
  });
});
