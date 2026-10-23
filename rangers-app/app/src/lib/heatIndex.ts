/** NOAA Rothfusz heat index, as used for PAGASA categories. Inputs °C and RH %, returns whole °C. */
export function heatIndexC(tempC: number, rh: number): number {
  const T = (tempC * 9) / 5 + 32;
  const simple = 0.5 * (T + 61 + (T - 68) * 1.2 + rh * 0.094);
  let hi: number;
  if ((simple + T) / 2 < 80) hi = simple;
  else {
    hi =
      -42.379 + 2.04901523 * T + 10.14333127 * rh - 0.22475541 * T * rh - 0.00683783 * T * T -
      0.05481717 * rh * rh + 0.00122874 * T * T * rh + 0.00085282 * T * rh * rh - 0.00000199 * T * T * rh * rh;
    if (rh < 13 && T >= 80 && T <= 112) hi -= ((13 - rh) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
    else if (rh > 85 && T >= 80 && T <= 87) hi += ((rh - 85) / 10) * ((87 - T) / 5);
  }
  return Math.round(((hi - 32) * 5) / 9);
}

export type HeatCategory = 'Normal' | 'Caution' | 'Extreme caution' | 'Danger' | 'Extreme danger';

export function heatCategory(hiC: number): HeatCategory {
  if (hiC < 27) return 'Normal';
  if (hiC < 33) return 'Caution';
  if (hiC < 42) return 'Extreme caution';
  if (hiC < 52) return 'Danger';
  return 'Extreme danger';
}
