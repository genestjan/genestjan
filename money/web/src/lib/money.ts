// Money is kept as whole centavos (integer "minor units") so totals never drift.

export type Currency = 'PHP' | 'USD' | 'EUR' | 'GBP' | 'AUD' | 'SGD' | 'CAD' | 'JPY';
export const CURRENCIES: Currency[] = ['PHP', 'USD', 'EUR', 'GBP', 'AUD', 'SGD', 'CAD', 'JPY'];

const SYMBOL: Record<Currency, string> = {
  PHP: '₱', USD: '$', EUR: '€', GBP: '£', AUD: 'A$', SGD: 'S$', CAD: 'C$', JPY: '¥',
};

export const symbol = (c: Currency) => SYMBOL[c] ?? c + ' ';

export const toMinor = (n: number) => Math.round(n * 100);
export const fromMinor = (m: number) => m / 100;

const two = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const zero = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** "₱1,234.56", "-₱20.00", "+$500.00"; hidden balances show dots. */
export function formatMoney(
  minor: number,
  currency: Currency = 'PHP',
  opts: { sign?: boolean; hide?: boolean; compact?: boolean; whole?: boolean } = {},
): string {
  const neg = minor < 0;
  const sign = neg ? '-' : opts.sign && minor > 0 ? '+' : '';
  if (opts.hide) return `${sign}${symbol(currency)}•••••`;
  const abs = Math.abs(minor) / 100;
  const body = opts.compact ? compact(abs) : opts.whole ? zero.format(Math.round(abs)) : two.format(abs);
  return `${sign}${symbol(currency)}${body}`;
}

export function compact(n: number): string {
  if (n >= 1_000_000) return trim(n / 1_000_000) + 'M';
  if (n >= 10_000) return trim(n / 1_000) + 'K';
  if (n >= 1_000) return trim(n / 1_000, 2) + 'K';
  return String(Math.round(n));
}
const trim = (n: number, d = 1) => n.toFixed(d).replace(/\.0+$|(\.\d*[1-9])0+$/, '$1');

/** Reads "1,234.56", "₱ 1,234", "PHP1234.5", "(1,234.00)" and returns centavos, or null. */
export function parseAmount(input: string | number | null | undefined): number | null {
  if (input == null) return null;
  if (typeof input === 'number') return Number.isFinite(input) ? toMinor(input) : null;
  let s = input.trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  s = s.replace(/[₱$€£¥]|PHP|Php|USD|EUR|GBP|AUD|SGD|CAD|JPY|\s/g, '');
  if (s.startsWith('-')) { neg = !neg; s = s.slice(1); }
  if (s.endsWith('-')) { neg = !neg; s = s.slice(0, -1); }
  if (s.startsWith('+')) s = s.slice(1);
  // "1.234,56" (European) only when a comma is followed by exactly two digits at the end
  if (/^\d{1,3}(\.\d{3})+,\d{2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  s = s.replace(/,/g, '');
  if (!/^\d*\.?\d+$/.test(s)) return null;
  const v = toMinor(parseFloat(s));
  return neg ? -v : v;
}

/** Exchange rates are stored as "pesos per one unit" of each currency. */
export type Rates = Partial<Record<Currency, number>>;

export const DEFAULT_RATES: Rates = { PHP: 1, USD: 58, EUR: 63, GBP: 74, AUD: 38, SGD: 44, CAD: 42, JPY: 0.39 };

export function toBase(minor: number, currency: Currency, rates: Rates, base: Currency = 'PHP'): number {
  if (currency === base) return minor;
  const from = currency === 'PHP' ? 1 : rates[currency] ?? DEFAULT_RATES[currency] ?? 1;
  const to = base === 'PHP' ? 1 : rates[base] ?? DEFAULT_RATES[base] ?? 1;
  return Math.round((minor * from) / to);
}
