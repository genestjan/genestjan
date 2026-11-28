// Shared data contract for every module. Mirrors supabase/schema.sql.
// Money is always stored as integer centavos (₱1.00 = 100) so totals never drift.

export type ID = string;
export type ISODate = string;
export type Centavos = number;

export type LocationCode = 'STORE' | 'WAREHOUSE';
export const LOCATIONS: LocationCode[] = ['STORE', 'WAREHOUSE'];

export type Role = 'owner' | 'cashier' | 'advisor' | 'mechanic' | 'warehouse';

export interface Staff {
  id: ID;
  name: string;
  role: Role;
  pin: string; // 4-digit quick-switch PIN on shared devices
  skills: string[];
  dailyCapacityMins: number;
  color: string; // calendar lane colour
  active: boolean;
}

export interface Product {
  id: ID;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  brand: string;
  isSerialized: boolean;
  isBundle: boolean;
  bundleItems: { productId: ID; qty: number }[];
  cost: Centavos;
  price: Centavos;
  unit: string;
  active: boolean;
  createdAt: ISODate;
}

export interface StockLevel {
  id: string; // `${productId}:${location}`
  productId: ID;
  location: LocationCode;
  quantity: number; // on hand
  reserved: number; // held for approved repair jobs
  reorderPoint: number;
  bin: string;
}

export type MovementReason =
  | 'sale'
  | 'po_receive'
  | 'transfer'
  | 'repair'
  | 'adjustment'
  | 'return'
  | 'opening';

// Immutable ledger. Stock is never changed without one of these.
export interface StockMovement {
  id: ID;
  productId: ID;
  from: LocationCode | null;
  to: LocationCode | null;
  qty: number; // always positive
  reason: MovementReason;
  refId: ID | null;
  staffId: ID | null;
  note: string;
  createdAt: ISODate;
}

export interface Supplier {
  id: ID;
  name: string;
  contact: string;
  phone: string;
  avgLeadDays: number;
  reliability: number; // 0..1, share of POs delivered on time
  active: boolean;
}

export interface SupplierProduct {
  id: ID;
  supplierId: ID;
  productId: ID;
  supplierSku: string;
  unitCost: Centavos;
  leadDays: number;
  moq: number;
}

export type POStatus = 'draft' | 'sent' | 'partial' | 'received' | 'cancelled';

export interface POItem {
  productId: ID;
  qty: number;
  unitCost: Centavos;
  receivedQty: number;
}

export interface PurchaseOrder {
  id: ID;
  poNo: string;
  supplierId: ID;
  status: POStatus;
  items: POItem[];
  notes: string;
  createdAt: ISODate;
  expectedDate: ISODate | null;
  receivedDate: ISODate | null;
}

export type Channel = 'sms' | 'messenger' | 'viber';

export interface Customer {
  id: ID;
  name: string;
  phone: string;
  messenger: string; // Facebook username or profile link, optional
  channel: Channel;
  notes: string;
  createdAt: ISODate;
}

export interface CustomerBike {
  id: ID;
  customerId: ID;
  brand: string;
  model: string;
  serial: string;
  color: string;
  notes: string;
}

export interface Service {
  id: ID;
  name: string;
  category: string;
  laborFee: Centavos;
  durationMins: number;
  checklist: string[];
  active: boolean;
}

export type LineKind = 'labor' | 'part';

export interface JobLine {
  id: ID;
  kind: LineKind;
  refId: ID; // serviceId or productId
  name: string;
  qty: number;
  unitPrice: Centavos;
  durationMins: number; // per unit, labour only
  short?: boolean; // part was out of stock when the job was booked
}

export type EstimateStatus = 'draft' | 'sent' | 'approved' | 'declined' | 'converted';

export interface Estimate {
  id: ID;
  estNo: string;
  customerId: ID;
  bikeId: ID | null;
  lines: JobLine[];
  status: EstimateStatus;
  complaint: string;
  createdAt: ISODate;
}

export type JobStatus =
  | 'scheduled'
  | 'checked_in'
  | 'in_repair'
  | 'waiting_parts'
  | 'quality_check'
  | 'ready'
  | 'completed'
  | 'cancelled';

export const BAYS = ['Bay 1', 'Bay 2', 'Bay 3'] as const;

export interface ChecklistItem {
  label: string;
  done: boolean;
}

export interface WorkOrder {
  id: ID;
  jobNo: string;
  estimateId: ID | null;
  customerId: ID;
  bikeId: ID | null;
  mechanicId: ID | null;
  bay: string;
  scheduledStart: ISODate;
  scheduledEnd: ISODate;
  actualStart: ISODate | null;
  actualEnd: ISODate | null;
  timerSince: ISODate | null; // set while the timer is running
  workedMins: number; // accumulated timer minutes
  status: JobStatus;
  lines: JobLine[];
  checklist: ChecklistItem[];
  complaint: string;
  intakeNotes: string;
  photos: string[]; // data URLs or storage paths
  deposit: Centavos;
  createdAt: ISODate;
}

export type PayMethod = 'cash' | 'gcash' | 'maya' | 'bank' | 'card';

export interface Payment {
  method: PayMethod;
  amount: Centavos;
  ref: string;
}

export interface SaleLine {
  productId: ID | null; // null for labour lines
  name: string;
  qty: number;
  unitPrice: Centavos;
  serial: string;
  kind: LineKind;
}

export interface Sale {
  id: ID;
  receiptNo: string;
  lines: SaleLine[];
  payments: Payment[];
  subtotal: Centavos;
  discount: Centavos;
  total: Centavos;
  change: Centavos;
  workOrderId: ID | null;
  customerId: ID | null;
  staffId: ID | null;
  shiftId: ID | null;
  voided: boolean;
  createdAt: ISODate;
}

export interface Shift {
  id: ID;
  staffId: ID;
  openedAt: ISODate;
  closedAt: ISODate | null;
  openingCash: Centavos;
  countedCash: Centavos | null;
}

export type NotifyTrigger =
  | 'appointment_confirmed'
  | 'estimate_ready'
  | 'waiting_parts'
  | 'ready_for_pickup'
  | 'follow_up';

export interface NotificationLog {
  id: ID;
  customerId: ID;
  workOrderId: ID | null;
  channel: Channel;
  trigger: NotifyTrigger;
  body: string;
  createdAt: ISODate;
}

export interface Settings {
  id: 'shop';
  shopName: string;
  address: string;
  phone: string;
  facebookPage: string;
  receiptFooter: string;
  warrantyDays: number;
  deadStockDays: number;
  followUpDays: number;
  openHour: number;
  closeHour: number;
}
