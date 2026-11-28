import { describe, it, expect, beforeEach } from 'vitest';
import { useTestDb, db } from './db';
import { seedIfEmpty } from './seed';
import { createProduct, updateProduct, findProductByCode, type ProductInput } from './inventoryActions';
import { levelId } from '@/domain/stock';

let n = 0;
beforeEach(async () => {
  useTestDb('inv' + n++);
  await seedIfEmpty();
});

const base: ProductInput = {
  sku: 'NEW-1', barcode: '9990000000017', name: 'Bell', category: 'Accessories', brand: 'Ding',
  unit: 'pc', cost: 5000, price: 9000, isSerialized: false, isBundle: false, bundleItems: [],
};

describe('createProduct', () => {
  it('creates the product, stock levels, opening movements and outbox row together', async () => {
    const outbox = await db.outbox.count();
    const p = await createProduct(base, { STORE: 5, WAREHOUSE: 12 }, null);
    expect((await db.stock.get(levelId(p.id, 'STORE')))!.quantity).toBe(5);
    expect((await db.stock.get(levelId(p.id, 'WAREHOUSE')))!.quantity).toBe(12);
    const mv = await db.movements.where('productId').equals(p.id).toArray();
    expect(mv).toHaveLength(2);
    expect(mv.every((m) => m.reason === 'opening' && m.from === null)).toBe(true);
    expect(await db.outbox.count()).toBe(outbox + 1);
  });

  it('skips zero opening quantities', async () => {
    const p = await createProduct(base, { STORE: 0, WAREHOUSE: 3 });
    expect(await db.movements.where('productId').equals(p.id).count()).toBe(1);
    expect(await db.stock.get(levelId(p.id, 'STORE'))).toBeUndefined();
  });

  it('rejects a duplicate SKU or barcode and writes nothing', async () => {
    const existing = (await db.products.toArray())[0];
    const products = await db.products.count();
    await expect(createProduct({ ...base, sku: existing.sku.toLowerCase() })).rejects.toThrow(/SKU/);
    await createProduct(base);
    await expect(createProduct({ ...base, sku: 'OTHER' })).rejects.toThrow(/Barcode/);
    expect(await db.products.count()).toBe(products + 1);
  });

  it('rejects a bad opening quantity without leaving a half-made product', async () => {
    const products = await db.products.count();
    await expect(createProduct(base, { STORE: 1.5 })).rejects.toThrow();
    expect(await db.products.count()).toBe(products);
  });

  it('bundles hold no stock and need valid parts', async () => {
    const part = (await db.products.toArray())[0];
    await expect(createProduct({ ...base, isBundle: true, bundleItems: [] })).rejects.toThrow(/bundle/i);
    await expect(createProduct({ ...base, isBundle: true, bundleItems: [{ productId: 'nope', qty: 1 }] })).rejects.toThrow();
    const b = await createProduct({ ...base, isBundle: true, bundleItems: [{ productId: part.id, qty: 2 }] }, { STORE: 9 });
    expect(await db.movements.where('productId').equals(b.id).count()).toBe(0);
  });
});

describe('updateProduct', () => {
  it('edits details, keeps stock, and allows keeping its own SKU', async () => {
    const p = await createProduct(base, { STORE: 4 });
    await updateProduct(p.id, { ...base, name: 'Loud Bell', price: 9500 });
    const got = (await db.products.get(p.id))!;
    expect(got.name).toBe('Loud Bell');
    expect(got.price).toBe(9500);
    expect((await db.stock.get(levelId(p.id, 'STORE')))!.quantity).toBe(4);
  });

  it('cannot take another product\'s SKU', async () => {
    const p = await createProduct(base);
    const other = (await db.products.toArray()).find((x) => x.id !== p.id)!;
    await expect(updateProduct(p.id, { ...base, sku: other.sku })).rejects.toThrow(/SKU/);
  });
});

describe('findProductByCode', () => {
  it('finds by barcode or SKU, ignoring case, and misses unknown codes', async () => {
    const p = await createProduct(base);
    expect((await findProductByCode(base.barcode))?.id).toBe(p.id);
    expect((await findProductByCode('new-1'))?.id).toBe(p.id);
    expect(await findProductByCode('000')).toBeUndefined();
    expect(await findProductByCode('  ')).toBeUndefined();
  });
});
