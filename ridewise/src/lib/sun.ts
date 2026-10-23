// Sunrise and sunset from the standard solar position equations (the same
// approach as NOAA's calculator and the suncalc library). Accurate to a few
// minutes, works offline, needs no API. Shown as "calculated", and treated
// as a planning guide, not a safety guarantee.

const rad = Math.PI / 180;
const DAY_MS = 86400000;
const J1970 = 2440588;
const J2000 = 2451545;
const OBLIQUITY = rad * 23.4397;
const J0 = 0.0009;

const toDays = (ms: number) => ms / DAY_MS - 0.5 + J1970 - J2000;
const fromJulian = (j: number) => (j + 0.5 - J1970) * DAY_MS;
const meanAnomaly = (d: number) => rad * (357.5291 + 0.98560028 * d);
const eclipticLongitude = (m: number) =>
  m + rad * (1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m)) + rad * 102.9372 + Math.PI;
const approxTransit = (ht: number, lw: number, n: number) => J0 + (ht + lw) / (2 * Math.PI) + n;
const transitJ = (ds: number, m: number, l: number) => J2000 + ds + 0.0053 * Math.sin(m) - 0.0069 * Math.sin(2 * l);

/**
 * Sunrise and sunset (epoch ms) for the solar day around `nearMs` at a
 * location. Returns null in polar day/night (never the case in the Philippines).
 */
export function sunTimes(nearMs: number, lat: number, lng: number): { sunriseMs: number; sunsetMs: number } | null {
  const lw = rad * -lng;
  const phi = rad * lat;
  const d = toDays(nearMs);
  const n = Math.round(d - J0 - lw / (2 * Math.PI));
  const ds = approxTransit(0, lw, n);
  const m = meanAnomaly(ds);
  const l = eclipticLongitude(m);
  const dec = Math.asin(Math.sin(OBLIQUITY) * Math.sin(l));
  const jNoon = transitJ(ds, m, l);
  const h0 = rad * -0.833; // upper limb on the horizon, with refraction
  const cosH = (Math.sin(h0) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
  if (cosH < -1 || cosH > 1) return null;
  const jSet = transitJ(approxTransit(Math.acos(cosH), lw, n), m, l);
  const jRise = jNoon - (jSet - jNoon);
  return { sunriseMs: fromJulian(jRise), sunsetMs: fromJulian(jSet) };
}
