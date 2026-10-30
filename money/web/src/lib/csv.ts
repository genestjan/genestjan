import { INSTITUTIONS, type InstitutionId } from './model';
import { parseAmount } from './money';
import { pad } from './dates';

// Bank, e-wallet, PayPal and Wise statements as CSV, and the Budgeting tab of a Google Sheet.

export function parseCSV(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const first = src.split(/\r?\n/, 1)[0] ?? '';
  const delim = [',', ';', '\t'].map((d) => [d, first.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some(Boolean));
}

export interface Mapping {
  date: number;
  time?: number;
  description: number;
  amount?: number;
  debit?: number;
  credit?: number;
  currency?: number;
  fee?: number;
  ref?: number;
  status?: number;
  type?: number;
}

const H = {
  date: /^(transaction |posting |value |completed |created )?date( and time| time)?$|^date\b|^trans(action)?\.? date/i,
  time: /^time$/i,
  description: [/^description$/i, /^(name|payee|merchant|payee name|payer name)$/i, /details|particulars|narration|memo|remarks|^transaction$/i],
  amount: [/^(gross|amount|transaction amount)$/i, /^(net|net amount|value)$/i],
  debit: /debit|withdrawal|money out|paid out|outflow|^charges?$/i,
  credit: /credit|deposit|money in|paid in|inflow/i,
  currency: /^currency$/i,
  fee: /^(fee|fees|total fees)$/i,
  ref: /reference|ref\.? ?no|transaction id|transferwise id/i,
  status: /^status$/i,
  type: /^type$/i,
};

function find(header: string[], re: RegExp | RegExp[]): number | undefined {
  for (const r of Array.isArray(re) ? re : [re]) {
    const i = header.findIndex((h) => r.test(h));
    if (i >= 0) return i;
  }
  return undefined;
}

export function guessMapping(header: string[]): Mapping | null {
  const date = find(header, H.date);
  const description = find(header, H.description);
  if (date == null || description == null) return null;
  const m: Mapping = {
    date, description,
    time: find(header, H.time), amount: find(header, H.amount), currency: find(header, H.currency),
    fee: find(header, H.fee), ref: find(header, H.ref), status: find(header, H.status), type: find(header, H.type),
  };
  if (m.amount == null) {
    m.debit = find(header, H.debit);
    m.credit = find(header, H.credit);
    if (m.debit == null && m.credit == null) return null;
  }
  return m;
}

/** The first row (of the first 15) that looks like a header. */
export function findHeader(rows: string[][]): { index: number; mapping: Mapping } | null {
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const mapping = guessMapping(rows[i]);
    if (mapping) return { index: i, mapping };
  }
  return null;
}

const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export type DateOrder = 'MDY' | 'DMY';

/** Philippine statements write 10/30/2026; Wise and UK ones write 30-10-2026. */
export function detectOrder(values: string[]): DateOrder {
  for (const v of values) {
    const m = /^(\d{1,2})[/.-](\d{1,2})[/.-]\d{2,4}/.exec(v.trim());
    if (!m) continue;
    if (+m[1] > 12) return 'DMY';
    if (+m[2] > 12) return 'MDY';
  }
  return 'MDY';
}

export function parseDate(raw: string, order: DateOrder = 'MDY'): string | null {
  const s = raw.trim();
  let m = /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(s);
  if (m) {
    const [a, b] = order === 'MDY' ? [+m[1], +m[2]] : [+m[2], +m[1]];
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    if (a < 1 || a > 12 || b < 1 || b > 31) return null;
    return `${y}-${pad(a)}-${pad(b)}`;
  }
  m = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/.exec(s);
  if (m && MON.includes(m[1].toLowerCase())) return `${m[3]}-${pad(MON.indexOf(m[1].toLowerCase()) + 1)}-${pad(+m[2])}`;
  m = /^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})/.exec(s);
  if (m && MON.includes(m[2].toLowerCase())) return `${m[3]}-${pad(MON.indexOf(m[2].toLowerCase()) + 1)}-${pad(+m[1])}`;
  return null;
}

export interface Draft {
  date: string;
  time?: string;
  /** Signed: money in is positive. */
  amount: number;
  fee?: number;
  currency?: string;
  description: string;
  ref?: string;
}

const SKIP_TYPE = /currency conversion|authori[sz]ation|\bhold\b/i;

export function toDrafts(rows: string[][], header: { index: number; mapping: Mapping }): { drafts: Draft[]; skipped: number } {
  const m = header.mapping;
  const body = rows.slice(header.index + 1);
  const order = detectOrder(body.map((r) => r[m.date] ?? ''));
  const drafts: Draft[] = [];
  let skipped = 0;
  for (const r of body) {
    const date = parseDate(r[m.date] ?? '', order);
    if (!date) { skipped++; continue; }
    if (m.status != null && r[m.status] && !/complete|success|posted|cleared/i.test(r[m.status])) { skipped++; continue; }
    if (m.type != null && SKIP_TYPE.test(r[m.type] ?? '')) { skipped++; continue; }
    let amount: number | null;
    if (m.amount != null) amount = parseAmount(r[m.amount]);
    else {
      const out = m.debit != null ? parseAmount(r[m.debit]) : null;
      const inn = m.credit != null ? parseAmount(r[m.credit]) : null;
      amount = (inn ? Math.abs(inn) : 0) - (out ? Math.abs(out) : 0);
    }
    if (!amount) { skipped++; continue; }
    const fee = m.fee != null ? parseAmount(r[m.fee]) : null;
    const timeCell = m.time != null ? r[m.time] : /\d{1,2}:\d{2}/.exec(r[m.date] ?? '')?.[0];
    const t = timeCell ? /(\d{1,2}):(\d{2})\s*(am|pm)?/i.exec(timeCell) : null;
    const hh = t ? (+t[1] % 12) + (t[3]?.toLowerCase() === 'pm' ? 12 : t[3] ? 0 : Math.floor(+t[1] / 12) * 12) : undefined;
    drafts.push({
      date,
      time: t ? `${pad(hh!)}:${t[2]}` : undefined,
      amount,
      fee: fee ? Math.abs(fee) : undefined,
      currency: m.currency != null ? r[m.currency] || undefined : undefined,
      description: (r[m.description] || (m.type != null ? r[m.type] : '') || 'Imported').slice(0, 120),
      ref: m.ref != null ? r[m.ref] || undefined : undefined,
    });
  }
  return { drafts, skipped };
}

export const draftKey = (d: { date: string; amount: number; description?: string; payee?: string }) =>
  `${d.date}|${d.amount}|${(d.description ?? d.payee ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24)}`;

// ---- The "Budgeting" tab layout: one row per bill, a column per month, each followed by "Due" ----

export interface BillDraft {
  name: string;
  amount: number;
  amounts: Record<string, number>;
  dueDay: number;
  isCard: boolean;
  institution?: InstitutionId;
}

const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

export function parseBillsMatrix(rows: string[][], fallbackYear = new Date().getFullYear()): BillDraft[] {
  const hi = rows.findIndex((r) => r.filter((c) => MONTH_NAMES.includes(c.trim().toLowerCase())).length >= 2);
  if (hi < 0) return [];
  const header = rows[hi].map((c) => c.trim().toLowerCase());
  const cols = header.map((h, i) => ({ month: MONTH_NAMES.indexOf(h), i })).filter((c) => c.month >= 0);
  const out: BillDraft[] = [];
  for (const r of rows.slice(hi + 1)) {
    const name = (r[0] ?? '').trim();
    if (!name || /^(total|expenses?|income)$/i.test(name)) continue;
    const amounts: Record<string, number> = {};
    const days: number[] = [];
    let year = fallbackYear;
    for (const c of cols) {
      const dueCell = header[c.i + 1] && /due|date/.test(header[c.i + 1]) ? r[c.i + 1] ?? '' : '';
      const due = dueCell ? parseDate(dueCell, 'MDY') : null;
      if (due) { year = +due.slice(0, 4); days.push(+due.slice(8, 10)); }
      const v = parseAmount(r[c.i] ?? '');
      if (v && v > 0) amounts[`${year}-${pad(c.month + 1)}`] = v;
    }
    const keys = Object.keys(amounts).sort();
    if (!keys.length) continue;
    // Banks move due dates (a card that was due on the 17th is now due on the 13th), so the
    // latest one wins.
    const current = days.length ? days[days.length - 1] : 15;
    out.push({
      name,
      amount: amounts[keys[keys.length - 1]],
      amounts,
      dueDay: current,
      isCard: /visa|master\s?card|jcb|amex|credit/i.test(name),
      institution: INSTITUTIONS.find((i) => i.words.test(name))?.id,
    });
  }
  return out;
}
