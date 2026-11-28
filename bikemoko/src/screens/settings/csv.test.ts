import { describe, it, expect } from 'vitest';
import { parseCsv, parseProductCsv, toCsv, IMPORT_TEMPLATE } from './csv';

const HEAD = 'sku,barcode,name,category,brand,cost,price,store_qty,warehouse_qty,store_reorder,warehouse_reorder,serialized';

describe('parseCsv', () => {
  it('handles quotes, commas, escaped quotes, CRLF and BOM', () => {
    const rows = parseCsv('﻿a,"b,c","say ""hi"""\r\n1,2,3\r\n\r\n');
    expect(rows).toEqual([['a', 'b,c', 'say "hi"'], ['1', '2', '3']]);
  });
  it('keeps newlines inside quotes and a last row with no newline', () => {
    expect(parseCsv('a,"x\ny"\nb,c')).toEqual([['a', 'x\ny'], ['b', 'c']]);
  });
});

describe('toCsv', () => {
  it('round-trips and neutralises formulas', () => {
    const text = toCsv([['name', 'note'], ['A, B', '=SUM(1)'], ['q"q', 5]]);
    expect(text).toContain("'=SUM(1)");
    expect(parseCsv(text)[1][0]).toBe('A, B');
    expect(parseCsv(text)[2]).toEqual(['q"q', '5']);
  });
});

describe('parseProductCsv', () => {
  it('parses a good row into centavos and numbers', () => {
    const r = parseProductCsv(`${HEAD}\nCH-1,480123,"Chain, 11s",Drivetrain,KMC,"1,250.50",1800,5,20,3,10,yes`);
    expect(r.fatal).toBeNull();
    expect(r.rows[0].errors).toEqual([]);
    expect(r.rows[0].row).toMatchObject({ sku: 'CH-1', name: 'Chain, 11s', cost: 125050, price: 180000, storeQty: 5, warehouseQty: 20, storeReorder: 3, warehouseReorder: 10, serialized: true });
  });
  it('reports missing required columns', () => {
    expect(parseProductCsv('sku,name\nA,B').fatal).toMatch(/price/);
  });
  it('reports empty file and header-only file', () => {
    expect(parseProductCsv('').fatal).toBeTruthy();
    expect(parseProductCsv(HEAD).fatal).toBeTruthy();
  });
  it('flags bad values and duplicate SKUs without dropping other rows', () => {
    const r = parseProductCsv(`${HEAD}\nA,,Item A,,,10,abc,1.5,,,,maybe\nB,,Item B,,,,100,,,,,\nb,,Item B2,,,,100,,,,,\n,,No sku,,,,100,,,,,`);
    expect(r.rows[0].row).toBeNull();
    expect(r.rows[0].errors.join(' ')).toMatch(/price is not an amount/);
    expect(r.rows[0].errors.join(' ')).toMatch(/store_qty must be a whole number/);
    expect(r.rows[0].errors.join(' ')).toMatch(/serialized/);
    expect(r.rows[1].row).toMatchObject({ sku: 'B', cost: 0, category: 'General', serialized: false });
    expect(r.rows[2].errors).toContain('SKU appears twice in this file');
    expect(r.rows[3].errors).toContain('SKU is missing');
    expect(r.rows.map((x) => x.line)).toEqual([2, 3, 4, 5]);
  });
  it('rejects negative amounts and quantities', () => {
    const r = parseProductCsv(`${HEAD}\nA,,Item,,,-5,100,-1,,,,`);
    expect(r.rows[0].row).toBeNull();
  });
  it('accepts the downloadable template', () => {
    const r = parseProductCsv(IMPORT_TEMPLATE);
    expect(r.fatal).toBeNull();
    expect(r.rows[0].row).not.toBeNull();
  });
});
