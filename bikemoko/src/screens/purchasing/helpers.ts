// Pure helpers for Smart POs. No database access here, so they are easy to test.
import type { ID, POItem, Product, PurchaseOrder, Supplier, WorkOrder } from '@/domain/types';
import type { SupplierOption } from '@/domain/po';

export interface ReorderItem {
  productId: ID;
  /** Suggested quantity to buy: stock suggestion plus parts short on jobs. */
  qty: number;
  /** Chips such as "Low stock" and "Job J-000012". */
  reasons: string[];
}

/** Merge stock-based reorder suggestions with parts that waiting jobs still need, one row per product. */
export function mergeReorder(
  low: { productId: ID; suggestQty: number }[],
  orders: Pick<WorkOrder, 'jobNo' | 'status' | 'lines'>[],
): ReorderItem[] {
  const map = new Map<ID, ReorderItem>();
  const get = (productId: ID) => {
    let e = map.get(productId);
    if (!e) {
      e = { productId, qty: 0, reasons: [] };
      map.set(productId, e);
    }
    return e;
  };
  for (const l of low) {
    const e = get(l.productId);
    e.qty += l.suggestQty;
    if (!e.reasons.includes('Low stock')) e.reasons.push('Low stock');
  }
  for (const w of orders) {
    if (w.status !== 'waiting_parts') continue;
    for (const line of w.lines) {
      if (line.kind !== 'part' || !line.short) continue;
      const e = get(line.refId);
      e.qty += line.qty;
      const chip = `Job ${w.jobNo}`;
      if (!e.reasons.includes(chip)) e.reasons.push(chip);
    }
  }
  return [...map.values()].sort((a, b) => a.productId.localeCompare(b.productId));
}

export interface POGroup {
  supplierId: ID;
  items: Omit<POItem, 'receivedQty'>[];
  leadDays: number;
}

/** Group chosen supplier options into one PO per supplier. Lead time is the slowest item. */
export function groupBySupplier(picks: { productId: ID; option: SupplierOption }[]): POGroup[] {
  const groups = new Map<ID, POGroup>();
  for (const p of picks) {
    let g = groups.get(p.option.supplierId);
    if (!g) {
      g = { supplierId: p.option.supplierId, items: [], leadDays: 0 };
      groups.set(p.option.supplierId, g);
    }
    g.items.push({ productId: p.productId, qty: p.option.orderQty, unitCost: p.option.unitCost });
    g.leadDays = Math.max(g.leadDays, p.option.leadDays);
  }
  return [...groups.values()];
}

export const openStatus = (s: PurchaseOrder['status']) => s === 'draft' || s === 'sent' || s === 'partial';

export function isOverdue(po: Pick<PurchaseOrder, 'status' | 'expectedDate'>, now = new Date()) {
  return openStatus(po.status) && !!po.expectedDate && po.expectedDate.slice(0, 10) < now.toISOString().slice(0, 10);
}

export const outstanding = (i: POItem) => Math.max(0, i.qty - i.receivedQty);

/** Plain text PO to paste into Messenger or Viber. */
export function poText(
  po: PurchaseOrder,
  supplier: Supplier | undefined,
  products: Map<ID, Product>,
  shopName: string,
  fmt: (c: number) => string,
): string {
  const lines = po.items.map((i, n) => {
    const p = products.get(i.productId);
    return `${n + 1}. ${p?.name ?? 'Item'}${p?.sku ? ` (${p.sku})` : ''} x ${i.qty} @ ${fmt(i.unitCost)} = ${fmt(i.qty * i.unitCost)}`;
  });
  const total = po.items.reduce((s, i) => s + i.qty * i.unitCost, 0);
  const out = [`Purchase order ${po.poNo}`, `From: ${shopName}`, `To: ${supplier?.name ?? 'Supplier'}`, ''];
  out.push(...lines, '', `Total: ${fmt(total)}`);
  if (po.expectedDate) out.push(`Needed by: ${po.expectedDate.slice(0, 10)}`);
  if (po.notes) out.push(`Notes: ${po.notes}`);
  out.push('', 'Please confirm. Thank you!');
  return out.join('\n');
}
