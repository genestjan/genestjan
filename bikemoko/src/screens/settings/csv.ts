// Small CSV reader/writer (RFC 4180 style) plus product-import validation.
// Written in-house: the repo rule is no new dependencies without asking the lead.
import { toCentavos } from '@/domain/util';

/** Split CSV text into rows of cells. Handles quotes, escaped quotes, CRLF, BOM and blank lines. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQ = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQ) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQ = false;
      } else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

/** Turn rows into CSV text. Text that starts like a spreadsheet formula is neutralised. */
export function toCsv(rows: (string | number | boolean | null | undefined)[][]): string {
  const esc = (v: string | number | boolean | null | undefined) => {
    if (v == null) return '';
    let s = String(v);
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
}

export const PRODUCT_COLUMNS = [
  'sku', 'barcode', 'name', 'category', 'brand', 'cost', 'price',
  'store_qty', 'warehouse_qty', 'store_reorder', 'warehouse_reorder', 'serialized',
] as const;

const REQUIRED = ['sku', 'name', 'price'] as const;

export interface ImportRow {
  sku: string;
  barcode: string;
  name: string;
  category: string;
  brand: string;
  cost: number; // centavos
  price: number; // centavos
  storeQty: number;
  warehouseQty: number;
  storeReorder: number;
  warehouseReorder: number;
  serialized: boolean;
}

export interface ParsedRow {
  line: number; // line number in the file, header is line 1
  row: ImportRow | null;
  errors: string[];
}

export interface ParsedImport {
  rows: ParsedRow[];
  fatal: string | null; // problems with the whole file, e.g. missing columns
}

const MONEY = /^\s*₱?\s*\d[\d,]*(\.\d{1,2})?\s*$|^\s*₱?\s*\.\d{1,2}\s*$/;
const WHOLE = /^\s*\d+\s*$/;

/** Parse and validate a product CSV. Existing SKUs in the database are checked by the caller. */
export function parseProductCsv(text: string): ParsedImport {
  const table = parseCsv(text);
  if (!table.length) return { rows: [], fatal: 'The file is empty.' };
  const header = table[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const missing = REQUIRED.filter((c) => !header.includes(c));
  if (missing.length) return { rows: [], fatal: `Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.` };
  const idx = (name: string) => header.indexOf(name);
  const seen = new Set<string>();
  const rows: ParsedRow[] = [];

  table.slice(1).forEach((cells, i) => {
    const get = (name: string) => {
      const j = idx(name);
      return j < 0 ? '' : (cells[j] ?? '').trim();
    };
    const errors: string[] = [];
    const sku = get('sku');
    const name = get('name');
    if (!sku) errors.push('SKU is missing');
    else if (seen.has(sku.toLowerCase())) errors.push('SKU appears twice in this file');
    if (sku) seen.add(sku.toLowerCase());
    if (!name) errors.push('Name is missing');

    const money = (col: string, required: boolean) => {
      const v = get(col);
      if (!v) {
        if (required) errors.push(`${col} is missing`);
        return 0;
      }
      if (!MONEY.test(v)) {
        errors.push(`${col} is not an amount`);
        return 0;
      }
      return toCentavos(v);
    };
    const whole = (col: string) => {
      const v = get(col);
      if (!v) return 0;
      if (!WHOLE.test(v)) {
        errors.push(`${col} must be a whole number`);
        return 0;
      }
      return parseInt(v, 10);
    };
    const cost = money('cost', false);
    const price = money('price', true);
    const storeQty = whole('store_qty');
    const warehouseQty = whole('warehouse_qty');
    const storeReorder = whole('store_reorder');
    const warehouseReorder = whole('warehouse_reorder');
    const ser = get('serialized').toLowerCase();
    if (ser && !['yes', 'y', 'true', '1', 'no', 'n', 'false', '0'].includes(ser)) errors.push('serialized must be yes or no');
    const serialized = ['yes', 'y', 'true', '1'].includes(ser);

    rows.push({
      line: i + 2,
      errors,
      row: errors.length
        ? null
        : { sku, barcode: get('barcode'), name, category: get('category') || 'General', brand: get('brand'), cost, price, storeQty, warehouseQty, storeReorder, warehouseReorder, serialized },
    });
  });
  if (!rows.length) return { rows, fatal: 'No product rows found under the header.' };
  return { rows, fatal: null };
}

export const IMPORT_TEMPLATE = toCsv([
  [...PRODUCT_COLUMNS],
  ['CH-EXAMPLE', '4801234567890', 'Example chain 11 speed', 'Drivetrain', 'KMC', '450', '690', '5', '20', '3', '10', 'no'],
]);
