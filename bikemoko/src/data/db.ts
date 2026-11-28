// Local database (IndexedDB via Dexie). Works fully offline.
// Every write action also lands in `outbox`, which the Supabase sync pushes
// to the cloud when the shop is online, so all devices share one truth.
import Dexie, { type Table } from 'dexie';
import type {
  Customer,
  CustomerBike,
  Estimate,
  NotificationLog,
  Product,
  PurchaseOrder,
  Sale,
  Service,
  Settings,
  Shift,
  Staff,
  StockLevel,
  StockMovement,
  Supplier,
  SupplierProduct,
  WorkOrder,
} from '@/domain/types';

export interface Counter {
  id: string;
  n: number;
}

export interface OutboxRow {
  id?: number;
  action: string;
  payload: unknown;
  createdAt: string;
  syncedAt: string | null;
  error: string | null;
}

export class BikemokoDB extends Dexie {
  staff!: Table<Staff, string>;
  products!: Table<Product, string>;
  stock!: Table<StockLevel, string>;
  movements!: Table<StockMovement, string>;
  suppliers!: Table<Supplier, string>;
  supplierProducts!: Table<SupplierProduct, string>;
  purchaseOrders!: Table<PurchaseOrder, string>;
  customers!: Table<Customer, string>;
  bikes!: Table<CustomerBike, string>;
  services!: Table<Service, string>;
  estimates!: Table<Estimate, string>;
  workOrders!: Table<WorkOrder, string>;
  sales!: Table<Sale, string>;
  shifts!: Table<Shift, string>;
  notifications!: Table<NotificationLog, string>;
  settings!: Table<Settings, string>;
  counters!: Table<Counter, string>;
  outbox!: Table<OutboxRow, number>;

  constructor(name = 'bikemoko') {
    super(name);
    this.version(1).stores({
      staff: 'id, role',
      products: 'id, sku, barcode, name, category, brand',
      stock: 'id, productId, location',
      movements: 'id, productId, reason, refId, createdAt',
      suppliers: 'id, name',
      supplierProducts: 'id, supplierId, productId',
      purchaseOrders: 'id, poNo, supplierId, status, createdAt',
      customers: 'id, name, phone',
      bikes: 'id, customerId, serial',
      services: 'id, category',
      estimates: 'id, estNo, customerId, status, createdAt',
      workOrders: 'id, jobNo, customerId, mechanicId, status, scheduledStart',
      sales: 'id, receiptNo, customerId, workOrderId, shiftId, createdAt',
      shifts: 'id, staffId, openedAt',
      notifications: 'id, customerId, workOrderId, createdAt',
      settings: 'id',
      counters: 'id',
      outbox: '++id, syncedAt, createdAt',
    });
  }
}

export let db = new BikemokoDB();

/** Tests use a fresh database each time. */
export function useTestDb(name: string) {
  db = new BikemokoDB(name);
  return db;
}

export async function nextNo(key: string): Promise<number> {
  const c = await db.counters.get(key);
  const n = (c?.n ?? 0) + 1;
  await db.counters.put({ id: key, n });
  return n;
}
