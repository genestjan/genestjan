import { describe, expect, it } from 'vitest';
import { addLine, fitWithin, flowIndex, fromLocalInput, isOverdue, laborLine, matchProduct, nextHalfHour, partLine, promptTrigger, quoteHtml, quoteText, setLinePrice, setLineQty, toLocalInput } from './helpers';
import type { Product, Service } from '@/domain/types';

const svc = { id: 's1', name: 'Full tune-up', category: 'Service', laborFee: 80000, durationMins: 90, checklist: [], active: true } as Service;
const prod = { id: 'p1', sku: 'TIR-26', barcode: '123', name: 'Tyre 26"', category: 'Tyres', brand: 'Kenda', price: 45000, active: true } as Product;

describe('nextHalfHour', () => {
  it('rounds up to the next boundary', () => {
    expect(nextHalfHour(new Date(2026, 0, 1, 9, 10, 20)).getMinutes()).toBe(30);
    const d = nextHalfHour(new Date(2026, 0, 1, 9, 40));
    expect([d.getHours(), d.getMinutes()]).toEqual([10, 0]);
  });
  it('moves on when exactly on a boundary', () => {
    const d = nextHalfHour(new Date(2026, 0, 1, 9, 30, 0));
    expect([d.getHours(), d.getMinutes()]).toEqual([10, 0]);
  });
});

describe('local input', () => {
  it('round trips', () => {
    const iso = new Date(2026, 5, 3, 14, 30).toISOString();
    expect(fromLocalInput(toLocalInput(iso))).toBe(iso);
    expect(toLocalInput(iso)).toBe('2026-06-03T14:30');
  });
});

describe('isOverdue', () => {
  const end = new Date(2026, 0, 1, 12).toISOString();
  const now = new Date(2026, 0, 1, 13).getTime();
  it('flags open jobs past their end', () => expect(isOverdue({ scheduledEnd: end, status: 'in_repair' }, now)).toBe(true));
  it('ignores ready jobs', () => expect(isOverdue({ scheduledEnd: end, status: 'ready' }, now)).toBe(false));
  it('ignores future jobs', () => expect(isOverdue({ scheduledEnd: end, status: 'scheduled' }, now - 7_200_000)).toBe(false));
});

describe('lines', () => {
  it('merges repeat adds and edits qty and price', () => {
    let l = addLine([], laborLine(svc));
    l = addLine(l, laborLine(svc));
    expect(l).toHaveLength(1);
    expect(l[0].qty).toBe(2);
    l = addLine(l, partLine(prod));
    expect(l).toHaveLength(2);
    l = setLinePrice(l, l[1].id, 50000);
    expect(l[1].unitPrice).toBe(50000);
    l = setLineQty(l, l[0].id, 0);
    expect(l).toHaveLength(1);
  });
});

describe('search and flow', () => {
  it('matches products by sku, brand and name', () => {
    expect(matchProduct(prod, 'kenda')).toBe(true);
    expect(matchProduct(prod, 'tir-26')).toBe(true);
    expect(matchProduct(prod, 'chain')).toBe(false);
    expect(matchProduct({ ...prod, active: false }, '')).toBe(false);
  });
  it('maps waiting parts onto the repair step', () => {
    expect(flowIndex('waiting_parts')).toBe(flowIndex('in_repair'));
    expect(flowIndex('ready')).toBeGreaterThan(flowIndex('quality_check'));
  });
  it('prompts for the right trigger', () => {
    expect(promptTrigger('waiting_parts')).toBe('waiting_parts');
    expect(promptTrigger('ready')).toBe('ready_for_pickup');
    expect(promptTrigger('in_repair')).toBeNull();
  });
});

describe('quote', () => {
  const o = { shop: 'Bikemoko', estNo: 'E-000001', customer: 'Ana <Cruz>', bike: 'Trek FX', complaint: 'Squeaky brakes', lines: [{ ...laborLine(svc) }, { ...partLine(prod), qty: 2 }] };
  it('lists totals and duration', () => {
    const t = quoteText(o);
    expect(t).toContain('Total: ₱1,700.00');
    expect(t).toContain('Estimated time: 1h 30m');
    expect(t).toContain('2 x Tyre 26"');
  });
  it('escapes html', () => {
    expect(quoteHtml(o)).toContain('Ana &lt;Cruz&gt;');
  });
});

describe('fitWithin', () => {
  it('scales long side to 1280', () => expect(fitWithin(4000, 3000)).toEqual({ w: 1280, h: 960 }));
  it('does not upscale', () => expect(fitWithin(800, 600)).toEqual({ w: 800, h: 600 }));
});
