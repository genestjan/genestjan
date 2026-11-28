// Smart PO engine: compares suppliers for one product on cost, speed and reliability.
import type { ID, Supplier, SupplierProduct, PurchaseOrder } from './types';

export type POMode = 'cheapest' | 'fastest' | 'best';

export interface SupplierOption {
  supplierId: ID;
  supplierName: string;
  unitCost: number;
  leadDays: number;
  moq: number;
  reliability: number;
  orderQty: number; // qty rounded up to the MOQ
  lineTotal: number;
  score: number; // 0..100 "Best Value"
  badges: ('Cheapest' | 'Fastest' | 'Most reliable' | 'Best value')[];
}

// Weights for the Best Value score. Cost matters most, then speed, then reliability.
export const WEIGHTS = { cost: 0.5, speed: 0.3, reliability: 0.2 };

export function compareSuppliers(
  needQty: number,
  offers: SupplierProduct[],
  suppliers: Map<ID, Supplier>,
): SupplierOption[] {
  const rows = offers
    .map((o) => {
      const s = suppliers.get(o.supplierId);
      if (!s || !s.active) return null;
      const orderQty = Math.max(needQty, o.moq, 1);
      return {
        supplierId: s.id,
        supplierName: s.name,
        unitCost: o.unitCost,
        leadDays: o.leadDays,
        moq: o.moq,
        reliability: s.reliability,
        orderQty,
        lineTotal: orderQty * o.unitCost,
        score: 0,
        badges: [] as SupplierOption['badges'],
      };
    })
    .filter((r): r is SupplierOption => r !== null);
  if (!rows.length) return rows;

  const minCost = Math.min(...rows.map((r) => r.unitCost));
  const maxCost = Math.max(...rows.map((r) => r.unitCost));
  const minLead = Math.min(...rows.map((r) => r.leadDays));
  const maxLead = Math.max(...rows.map((r) => r.leadDays));
  const maxRel = Math.max(...rows.map((r) => r.reliability));
  const norm = (v: number, lo: number, hi: number) => (hi === lo ? 1 : (hi - v) / (hi - lo));

  for (const r of rows) {
    r.score = Math.round(
      100 *
        (WEIGHTS.cost * norm(r.unitCost, minCost, maxCost) +
          WEIGHTS.speed * norm(r.leadDays, minLead, maxLead) +
          WEIGHTS.reliability * r.reliability),
    );
    if (r.unitCost === minCost) r.badges.push('Cheapest');
    if (r.leadDays === minLead) r.badges.push('Fastest');
    if (r.reliability === maxRel && rows.length > 1) r.badges.push('Most reliable');
  }
  const best = rows.reduce((a, b) => (b.score > a.score ? b : a));
  best.badges.push('Best value');
  return rows;
}

export function pickSupplier(options: SupplierOption[], mode: POMode): SupplierOption | undefined {
  if (!options.length) return undefined;
  const by = {
    cheapest: (a: SupplierOption, b: SupplierOption) => a.unitCost - b.unitCost || a.leadDays - b.leadDays,
    fastest: (a: SupplierOption, b: SupplierOption) => a.leadDays - b.leadDays || a.unitCost - b.unitCost,
    best: (a: SupplierOption, b: SupplierOption) => b.score - a.score,
  }[mode];
  return [...options].sort(by)[0];
}

export const poTotal = (po: Pick<PurchaseOrder, 'items'>) => po.items.reduce((s, i) => s + i.qty * i.unitCost, 0);

/** Reliability = share of received POs that arrived on or before the expected date. */
export function reliabilityFrom(pos: PurchaseOrder[]): number | null {
  const done = pos.filter((p) => p.status === 'received' && p.expectedDate && p.receivedDate);
  if (!done.length) return null;
  const onTime = done.filter((p) => p.receivedDate!.slice(0, 10) <= p.expectedDate!.slice(0, 10)).length;
  return Math.round((onTime / done.length) * 100) / 100;
}
