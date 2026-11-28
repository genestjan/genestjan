// Catalogue actions for the Inventory module. Product edits are plain catalogue writes;
// opening stock goes through the ledger so stock and movements always agree.
import { db } from './db';
import { LedgerTx } from '@/domain/stock';
import { nowISO, uid } from '@/domain/util';
import type { Centavos, ID, LocationCode, Product } from '@/domain/types';

export interface ProductInput {
  sku: string;
  barcode: string;
  name: string;
  category: string;
  brand: string;
  unit: string;
  cost: Centavos;
  price: Centavos;
  isSerialized: boolean;
  isBundle: boolean;
  bundleItems: { productId: ID; qty: number }[];
}

export type OpeningStock = Partial<Record<LocationCode, number>>;

const norm = (s: string) => s.trim().toLowerCase();

function clean(input: ProductInput): ProductInput {
  return {
    ...input,
    sku: input.sku.trim(),
    barcode: input.barcode.trim(),
    name: input.name.trim(),
    category: input.category.trim(),
    brand: input.brand.trim(),
    unit: input.unit.trim() || 'pc',
    bundleItems: input.isBundle ? input.bundleItems : [],
  };
}

async function validate(input: ProductInput, selfId: ID | null) {
  if (!input.name) throw new Error('Enter a product name');
  if (!input.sku) throw new Error('Enter a SKU');
  if (input.cost < 0 || input.price < 0) throw new Error('Cost and price cannot be negative');
  const all = await db.products.toArray();
  const others = all.filter((p) => p.id !== selfId);
  const sku = others.find((p) => norm(p.sku) === norm(input.sku));
  if (sku) throw new Error(`SKU ${input.sku} is already used by ${sku.name}`);
  if (input.barcode) {
    const bc = others.find((p) => p.barcode && norm(p.barcode) === norm(input.barcode));
    if (bc) throw new Error(`Barcode ${input.barcode} is already used by ${bc.name}`);
  }
  if (input.isBundle) {
    if (!input.bundleItems.length) throw new Error('Add at least one part to the bundle');
    const ids = new Set(all.map((p) => p.id));
    for (const b of input.bundleItems) {
      if (b.productId === selfId) throw new Error('A bundle cannot contain itself');
      if (!ids.has(b.productId)) throw new Error('A bundle part no longer exists');
      if (!Number.isInteger(b.qty) || b.qty <= 0) throw new Error('Bundle part quantities must be whole numbers above 0');
    }
  }
}

/** Create a product and record its opening stock in one transaction. */
export async function createProduct(input: ProductInput, opening: OpeningStock = {}, staffId?: ID | null): Promise<Product> {
  const data = clean(input);
  return db.transaction('rw', [db.products, db.stock, db.movements, db.outbox], async () => {
    await validate(data, null);
    const product: Product = { ...data, id: uid(), active: true, createdAt: nowISO() };
    const tx = new LedgerTx([]);
    // Bundles hold no stock of their own: their parts are deducted when sold.
    if (!product.isBundle) {
      for (const loc of ['STORE', 'WAREHOUSE'] as LocationCode[]) {
        const qty = opening[loc] ?? 0;
        if (qty > 0) tx.in(product.id, loc, qty, { reason: 'opening', staffId, note: 'Opening stock' });
      }
    }
    await db.products.add(product);
    await db.stock.bulkPut(tx.changed());
    await db.movements.bulkAdd(tx.movements);
    await db.outbox.add({
      action: 'create_product',
      payload: { product, movements: tx.movements },
      createdAt: nowISO(),
      syncedAt: null,
      error: null,
    });
    return product;
  });
}

/** Edit catalogue details. Stock is never touched here. */
export async function updateProduct(id: ID, input: ProductInput): Promise<void> {
  const data = clean(input);
  await db.transaction('rw', [db.products, db.outbox], async () => {
    const cur = await db.products.get(id);
    if (!cur) throw new Error('Product not found');
    await validate(data, id);
    await db.products.put({ ...cur, ...data });
    await db.outbox.add({ action: 'update_product', payload: { id, ...data }, createdAt: nowISO(), syncedAt: null, error: null });
  });
}

/** Find a product by barcode or SKU (exact, case-insensitive). Barcode wins over SKU. */
export async function findProductByCode(code: string): Promise<Product | undefined> {
  const c = norm(code);
  if (!c) return undefined;
  const all = await db.products.toArray();
  return all.find((p) => p.active && p.barcode && norm(p.barcode) === c) ?? all.find((p) => p.active && norm(p.sku) === c);
}
