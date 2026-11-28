// Live queries: screens re-render automatically when the database changes.
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Product, StockLevel, Staff, Customer, Supplier, Service, Settings } from '@/domain/types';
import { levelId } from '@/domain/stock';

export { useLiveQuery };

const EMPTY: never[] = [];

export const useProducts = () => useLiveQuery(() => db.products.toArray(), [], EMPTY as Product[]);
export const useStock = () => useLiveQuery(() => db.stock.toArray(), [], EMPTY as StockLevel[]);
export const useStaff = () => useLiveQuery(() => db.staff.toArray(), [], EMPTY as Staff[]);
export const useCustomers = () => useLiveQuery(() => db.customers.toArray(), [], EMPTY as Customer[]);
export const useSuppliers = () => useLiveQuery(() => db.suppliers.toArray(), [], EMPTY as Supplier[]);
export const useServices = () => useLiveQuery(() => db.services.toArray(), [], EMPTY as Service[]);
export const useSettings = () => useLiveQuery(() => db.settings.get('shop'), []) as Settings | undefined;

/** Map of `${productId}:${location}` to level, for fast lookups in lists. */
export function useStockMap() {
  const stock = useStock();
  const map = new Map(stock.map((s) => [s.id, s]));
  return {
    stock,
    get: (productId: string, loc: 'STORE' | 'WAREHOUSE') => map.get(levelId(productId, loc)),
  };
}

export const byId = <T extends { id: string }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));
