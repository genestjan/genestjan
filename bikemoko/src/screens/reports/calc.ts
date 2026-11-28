// Pure report maths. No database access here, so it is easy to test.
import { jobTotals } from '@/domain/jobs';
import type { JobStatus, Customer, PayMethod, Product, PurchaseOrder, Sale, StockLevel, StockMovement, Supplier, WorkOrder } from '@/domain/types';

export const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export type RangeKey = 'today' | '7d' | '30d' | 'month';

export function rangeFor(key: RangeKey, now = new Date()): { from: Date; to: Date } {
  const today = startOfDay(now);
  const to = addDays(today, 1);
  if (key === 'today') return { from: today, to };
  if (key === '7d') return { from: addDays(today, -6), to };
  if (key === '30d') return { from: addDays(today, -29), to };
  return { from: new Date(today.getFullYear(), today.getMonth(), 1), to };
}

export interface SalesSummary {
  count: number;
  gross: number;
  discounts: number;
  net: number;
  avgTicket: number;
  byMethod: Record<PayMethod, number>;
  parts: number; // revenue from parts lines (before discount)
  labor: number;
  cost: number; // cost of goods sold
  margin: number; // net minus cost
  marginPct: number;
}

export function summariseSales(sales: Sale[], products: Map<string, Product>): SalesSummary {
  const s: SalesSummary = {
    count: 0, gross: 0, discounts: 0, net: 0, avgTicket: 0,
    byMethod: { cash: 0, gcash: 0, maya: 0, bank: 0, card: 0 },
    parts: 0, labor: 0, cost: 0, margin: 0, marginPct: 0,
  };
  for (const sale of sales) {
    if (sale.voided) continue;
    s.count++;
    s.gross += sale.subtotal;
    s.discounts += sale.discount;
    s.net += sale.total;
    let changeLeft = sale.change;
    for (const p of sale.payments) {
      // Change is handed back in cash, so it comes off the cash taken.
      const amt = p.method === 'cash' ? p.amount - changeLeft : p.amount;
      if (p.method === 'cash') changeLeft = 0;
      s.byMethod[p.method] += amt;
    }
    for (const l of sale.lines) {
      const amt = l.qty * l.unitPrice;
      if (l.kind === 'labor') s.labor += amt;
      else {
        s.parts += amt;
        const prod = l.productId ? products.get(l.productId) : undefined;
        s.cost += l.qty * (prod?.cost ?? 0);
      }
    }
  }
  s.avgTicket = s.count ? Math.round(s.net / s.count) : 0;
  s.margin = s.net - s.cost;
  s.marginPct = s.net > 0 ? s.margin / s.net : 0;
  return s;
}

export interface TopProduct {
  productId: string;
  name: string;
  qty: number;
  revenue: number;
  margin: number;
}

export function topProducts(sales: Sale[], products: Map<string, Product>, limit = 8): TopProduct[] {
  const m = new Map<string, TopProduct>();
  for (const sale of sales) {
    if (sale.voided) continue;
    for (const l of sale.lines) {
      if (l.kind !== 'part' || !l.productId) continue;
      const e = m.get(l.productId) ?? { productId: l.productId, name: l.name, qty: 0, revenue: 0, margin: 0 };
      e.qty += l.qty;
      e.revenue += l.qty * l.unitPrice;
      e.margin += l.qty * (l.unitPrice - (products.get(l.productId)?.cost ?? 0));
      m.set(l.productId, e);
    }
  }
  return [...m.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

export interface DeadRow {
  productId: string;
  name: string;
  qty: number;
  value: number; // qty at cost
}

/** Products with stock on the shelf and no sale or repair use inside the window. */
export function deadStock(products: Product[], levels: StockLevel[], recentMovements: StockMovement[], days: number, now = new Date()): DeadRow[] {
  const cutoff = now.getTime() - days * 86_400_000;
  const moved = new Set(recentMovements.filter((m) => m.reason === 'sale' || m.reason === 'repair').map((m) => m.productId));
  const qty = new Map<string, number>();
  for (const l of levels) qty.set(l.productId, (qty.get(l.productId) ?? 0) + l.quantity);
  return products
    .filter((p) => p.active && !p.isBundle && (qty.get(p.id) ?? 0) > 0 && !moved.has(p.id) && new Date(p.createdAt).getTime() <= cutoff)
    .map((p) => ({ productId: p.id, name: p.name, qty: qty.get(p.id)!, value: qty.get(p.id)! * p.cost }))
    .sort((a, b) => b.value - a.value);
}

export interface MechanicRow {
  mechanicId: string;
  jobs: number;
  labor: number;
  workedMins: number;
  estimatedMins: number;
}

export function mechanicProductivity(jobs: WorkOrder[], from: Date, to: Date): MechanicRow[] {
  const m = new Map<string, MechanicRow>();
  for (const j of jobs) {
    if (j.status !== 'completed' || !j.mechanicId) continue;
    const at = new Date(j.actualEnd ?? j.scheduledEnd).getTime();
    if (at < from.getTime() || at >= to.getTime()) continue;
    const t = jobTotals(j.lines);
    const e = m.get(j.mechanicId) ?? { mechanicId: j.mechanicId, jobs: 0, labor: 0, workedMins: 0, estimatedMins: 0 };
    e.jobs++;
    e.labor += t.labor;
    e.workedMins += j.workedMins;
    e.estimatedMins += t.durationMins;
    m.set(j.mechanicId, e);
  }
  return [...m.values()].sort((a, b) => b.labor - a.labor);
}

export interface SupplierRow {
  supplier: Supplier;
  orders: number;
  received: number;
}

export function supplierPerformance(suppliers: Supplier[], pos: PurchaseOrder[], from: Date, to: Date): SupplierRow[] {
  return suppliers
    .map((supplier) => {
      const mine = pos.filter((p) => p.supplierId === supplier.id && p.status !== 'draft' && p.status !== 'cancelled' && new Date(p.createdAt) >= from && new Date(p.createdAt) < to);
      return { supplier, orders: mine.length, received: mine.filter((p) => p.status === 'received').length };
    })
    .sort((a, b) => b.supplier.reliability - a.supplier.reliability);
}

export const overduePOs = (pos: PurchaseOrder[], now = new Date()) =>
  pos.filter((p) => (p.status === 'sent' || p.status === 'partial') && p.expectedDate && new Date(p.expectedDate).getTime() < now.getTime());

export interface FollowUp {
  customer: Customer;
  lastJobAt: string;
  daysAgo: number;
}

/** Customers whose last completed job was more than `days` ago and who have nothing open now. */
export function followUpsDue(customers: Customer[], jobs: WorkOrder[], days: number, now = new Date()): FollowUp[] {
  const last = new Map<string, string>();
  const open = new Set<string>();
  for (const j of jobs) {
    if (j.status === 'completed') {
      const at = j.actualEnd ?? j.scheduledEnd;
      if (!last.has(j.customerId) || at > last.get(j.customerId)!) last.set(j.customerId, at);
    } else if (j.status !== 'cancelled') open.add(j.customerId);
  }
  return customers
    .filter((c) => last.has(c.id) && !open.has(c.id))
    .map((customer) => {
      const lastJobAt = last.get(customer.id)!;
      return { customer, lastJobAt, daysAgo: Math.floor((now.getTime() - new Date(lastJobAt).getTime()) / 86_400_000) };
    })
    .filter((f) => f.daysAgo > days)
    .sort((a, b) => b.daysAgo - a.daysAgo);
}

/** Sales totals per local hour, from `open` to `close` (extended if sales fall outside). */
export function salesByHour(sales: Sale[], open: number, close: number): { hour: number; total: number }[] {
  const t = new Map<number, number>();
  for (const s of sales) if (!s.voided) {
    const h = new Date(s.createdAt).getHours();
    t.set(h, (t.get(h) ?? 0) + s.total);
  }
  const hours = [...t.keys()];
  const lo = Math.min(open, ...hours);
  const hi = Math.max(close - 1, ...hours);
  return Array.from({ length: hi - lo + 1 }, (_, i) => ({ hour: lo + i, total: t.get(lo + i) ?? 0 }));
}

/** Net sales per local day for the last `n` days ending today. */
export function salesByDay(sales: Sale[], n: number, now = new Date()): { day: Date; total: number }[] {
  const first = addDays(startOfDay(now), -(n - 1));
  const days = Array.from({ length: n }, (_, i) => ({ day: addDays(first, i), total: 0 }));
  for (const s of sales) {
    if (s.voided) continue;
    const i = Math.floor((startOfDay(new Date(s.createdAt)).getTime() - first.getTime()) / 86_400_000);
    if (i >= 0 && i < n) days[i].total += s.total;
  }
  return days;
}

export const JOB_TONE: Record<JobStatus, 'neutral' | 'info' | 'brand' | 'warn' | 'violet' | 'ok' | 'bad'> = {
  scheduled: 'neutral',
  checked_in: 'info',
  in_repair: 'brand',
  waiting_parts: 'warn',
  quality_check: 'violet',
  ready: 'ok',
  completed: 'neutral',
  cancelled: 'bad',
};
