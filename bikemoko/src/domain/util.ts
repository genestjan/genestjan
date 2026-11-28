import type { Centavos } from './types';

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export const nowISO = () => new Date().toISOString();

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 });
const pesoShort = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 });

/** ₱1,234.50 */
export const money = (c: Centavos) => peso.format(c / 100);
/** ₱1,235 */
export const moneyShort = (c: Centavos) => pesoShort.format(Math.round(c / 100));
/** Parse "1,234.50" typed by a cashier into centavos. */
export const toCentavos = (input: string | number): Centavos => {
  const n = typeof input === 'number' ? input : Number(String(input).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

export const minsLabel = (m: number) => {
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r} min`;
  return r ? `${h}h ${r}m` : `${h}h`;
};

/** Sequential human numbers like R-000123 */
export const docNo = (prefix: string, n: number) => `${prefix}-${String(n).padStart(6, '0')}`;

export const daysBetween = (a: string | Date, b: string | Date) =>
  Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
