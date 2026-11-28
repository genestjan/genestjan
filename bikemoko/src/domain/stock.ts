// Stock engine. Pure functions: they take current levels and return the new
// levels plus the ledger rows that explain every change. The data layer writes
// both in one transaction, so stock and ledger can never disagree.
import type {
  ID,
  LocationCode,
  MovementReason,
  Product,
  StockLevel,
  StockMovement,
} from './types';
import { uid, nowISO } from './util';

export class StockError extends Error {
  constructor(
    message: string,
    public productId: ID,
    public short: number,
  ) {
    super(message);
    this.name = 'StockError';
  }
}

export const levelId = (productId: ID, location: LocationCode) => `${productId}:${location}`;

export const available = (l: StockLevel | undefined) => (l ? l.quantity - l.reserved : 0);

export function emptyLevel(productId: ID, location: LocationCode): StockLevel {
  return { id: levelId(productId, location), productId, location, quantity: 0, reserved: 0, reorderPoint: 0, bin: '' };
}

export interface MoveContext {
  reason: MovementReason;
  refId?: ID | null;
  staffId?: ID | null;
  note?: string;
  allowNegative?: boolean;
}

/** Collects stock changes against a snapshot, validating as it goes. */
export class LedgerTx {
  private levels = new Map<string, StockLevel>();
  readonly movements: StockMovement[] = [];

  constructor(snapshot: StockLevel[]) {
    for (const l of snapshot) this.levels.set(l.id, { ...l });
  }

  get(productId: ID, location: LocationCode): StockLevel {
    const id = levelId(productId, location);
    let l = this.levels.get(id);
    if (!l) {
      l = emptyLevel(productId, location);
      this.levels.set(id, l);
    }
    return l;
  }

  private touched = new Set<string>();

  private record(productId: ID, from: LocationCode | null, to: LocationCode | null, qty: number, ctx: MoveContext) {
    this.movements.push({
      id: uid(),
      productId,
      from,
      to,
      qty,
      reason: ctx.reason,
      refId: ctx.refId ?? null,
      staffId: ctx.staffId ?? null,
      note: ctx.note ?? '',
      createdAt: nowISO(),
    });
  }

  /** Remove stock from a location. Checks only unreserved stock unless fromReserved. */
  out(productId: ID, location: LocationCode, qty: number, ctx: MoveContext, fromReserved = false) {
    assertQty(qty);
    const l = this.get(productId, location);
    if (fromReserved) {
      if (l.reserved < qty) throw new StockError('Not enough reserved stock', productId, qty - l.reserved);
      l.reserved -= qty;
    } else if (!ctx.allowNegative && available(l) < qty) {
      throw new StockError(`Only ${available(l)} available in ${location.toLowerCase()}`, productId, qty - available(l));
    }
    l.quantity -= qty;
    this.touched.add(l.id);
    this.record(productId, location, null, qty, ctx);
  }

  in(productId: ID, location: LocationCode, qty: number, ctx: MoveContext) {
    assertQty(qty);
    const l = this.get(productId, location);
    l.quantity += qty;
    this.touched.add(l.id);
    this.record(productId, null, location, qty, ctx);
  }

  transfer(productId: ID, from: LocationCode, to: LocationCode, qty: number, ctx: Omit<MoveContext, 'reason'>) {
    assertQty(qty);
    if (from === to) throw new Error('Pick two different locations');
    const a = this.get(productId, from);
    if (available(a) < qty) throw new StockError(`Only ${available(a)} available in ${from.toLowerCase()}`, productId, qty - available(a));
    const b = this.get(productId, to);
    a.quantity -= qty;
    b.quantity += qty;
    this.touched.add(a.id).add(b.id);
    this.record(productId, from, to, qty, { ...ctx, reason: 'transfer' });
  }

  /** Hold stock for a repair job. No ledger row: nothing has left the shelf yet. */
  reserve(productId: ID, location: LocationCode, qty: number) {
    assertQty(qty);
    const l = this.get(productId, location);
    if (available(l) < qty) throw new StockError(`Only ${available(l)} available to reserve`, productId, qty - available(l));
    l.reserved += qty;
    this.touched.add(l.id);
  }

  release(productId: ID, location: LocationCode, qty: number) {
    assertQty(qty);
    const l = this.get(productId, location);
    l.reserved = Math.max(0, l.reserved - qty);
    this.touched.add(l.id);
  }

  /** Physical count: records the difference as an adjustment. */
  setCount(productId: ID, location: LocationCode, counted: number, ctx: Omit<MoveContext, 'reason'>) {
    if (!Number.isInteger(counted) || counted < 0) throw new Error('Count must be a whole number, 0 or more');
    const l = this.get(productId, location);
    const diff = counted - l.quantity;
    if (diff === 0) return;
    if (diff > 0) this.in(productId, location, diff, { ...ctx, reason: 'adjustment' });
    else this.out(productId, location, -diff, { ...ctx, reason: 'adjustment', allowNegative: true });
  }

  changed(): StockLevel[] {
    return [...this.touched].map((id) => this.levels.get(id)!);
  }
}

function assertQty(qty: number) {
  if (!Number.isInteger(qty) || qty <= 0) throw new Error('Quantity must be a whole number above 0');
}

/** Bundles (bike builds, tune-up kits) expand into their parts. */
export function expandBundles(
  lines: { productId: ID; qty: number }[],
  products: Map<ID, Product>,
): { productId: ID; qty: number }[] {
  const out = new Map<ID, number>();
  const add = (productId: ID, qty: number, depth: number) => {
    const p = products.get(productId);
    if (!p) throw new Error('Unknown product');
    if (p.isBundle && p.bundleItems.length && depth < 4) {
      for (const b of p.bundleItems) add(b.productId, b.qty * qty, depth + 1);
    } else {
      out.set(productId, (out.get(productId) ?? 0) + qty);
    }
  };
  for (const l of lines) add(l.productId, l.qty, 0);
  return [...out].map(([productId, qty]) => ({ productId, qty }));
}

export interface LowStockRow {
  productId: ID;
  location: LocationCode;
  available: number;
  reorderPoint: number;
}

export function lowStock(levels: StockLevel[]): LowStockRow[] {
  return levels
    .filter((l) => l.reorderPoint > 0 && available(l) <= l.reorderPoint)
    .map((l) => ({ productId: l.productId, location: l.location, available: available(l), reorderPoint: l.reorderPoint }));
}

export interface PickRow {
  productId: ID;
  qty: number;
  storeAvailable: number;
  warehouseAvailable: number;
}

/** Warehouse to Store pick-list: refill each low store item up to twice its reorder point. */
export function replenishmentPickList(levels: StockLevel[]): PickRow[] {
  const byId = new Map(levels.map((l) => [l.id, l]));
  const rows: PickRow[] = [];
  for (const s of levels) {
    if (s.location !== 'STORE' || s.reorderPoint <= 0) continue;
    const sa = available(s);
    if (sa > s.reorderPoint) continue;
    const w = byId.get(levelId(s.productId, 'WAREHOUSE'));
    const wa = available(w);
    const qty = Math.min(wa, s.reorderPoint * 2 - sa);
    if (qty > 0) rows.push({ productId: s.productId, qty, storeAvailable: sa, warehouseAvailable: wa });
  }
  return rows;
}

/** Items that need buying: total available across both locations is at or below the warehouse reorder point. */
export function needsReorder(levels: StockLevel[]): { productId: ID; totalAvailable: number; suggestQty: number }[] {
  const byProduct = new Map<ID, { total: number; rp: number }>();
  for (const l of levels) {
    const e = byProduct.get(l.productId) ?? { total: 0, rp: 0 };
    e.total += available(l);
    if (l.location === 'WAREHOUSE') e.rp = l.reorderPoint;
    else e.rp = Math.max(e.rp, l.reorderPoint);
    byProduct.set(l.productId, e);
  }
  return [...byProduct]
    .filter(([, e]) => e.rp > 0 && e.total <= e.rp)
    .map(([productId, e]) => ({ productId, totalAvailable: e.total, suggestQty: Math.max(1, e.rp * 2 - e.total) }));
}
