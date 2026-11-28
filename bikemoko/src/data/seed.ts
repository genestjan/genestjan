// Starter data so the shop can try every screen on day one.
// Replace with the real catalogue via CSV import (Settings > Import).
import { db } from './db';
import { levelId } from '@/domain/stock';
import { nowISO, uid } from '@/domain/util';
import type { Product, Service, Staff, StockLevel, Supplier, SupplierProduct, Settings, Customer, CustomerBike } from '@/domain/types';

const P = (n: number) => Math.round(n * 100);

type Row = [sku: string, name: string, category: string, brand: string, cost: number, price: number, store: number, wh: number, rpS: number, rpW: number, serial?: boolean];

const ROWS: Row[] = [
  ['FRM-MTB-29', 'Mountain Bike Frame 29er Alloy', 'Frames', 'Mountainpeak', 4200, 6500, 1, 1, 1, 2, true],
  ['BK-MTB-275', 'Complete MTB 27.5 Hydraulic', 'Bikes', 'Trinx', 9800, 13500, 2, 4, 1, 2, true],
  ['BK-RB-700', 'Road Bike 700c Claris 16s', 'Bikes', 'Sava', 14500, 19900, 1, 2, 1, 1, true],
  ['GS-DEO-1X11', 'Groupset 1x11 Deore', 'Drivetrain', 'Shimano', 7800, 9850, 1, 3, 1, 2],
  ['CH-KMC-11', 'Chain 11-speed', 'Drivetrain', 'KMC', 520, 850, 6, 20, 4, 10],
  ['CS-1150-1146', 'Cassette 11-46T', 'Drivetrain', 'Shimano', 1650, 2350, 2, 2, 2, 4],
  ['TR-275-2.1', 'Tyre 27.5 x 2.10', 'Tyres & Tubes', 'Kenda', 380, 650, 8, 24, 6, 12],
  ['TR-700-25', 'Tyre 700 x 25c', 'Tyres & Tubes', 'Continental', 950, 1450, 3, 4, 4, 8],
  ['TB-275-AV', 'Inner Tube 27.5 AV', 'Tyres & Tubes', 'Kenda', 95, 180, 12, 60, 10, 30],
  ['TB-700-PV', 'Inner Tube 700c Presta', 'Tyres & Tubes', 'Schwalbe', 160, 280, 10, 40, 8, 20],
  ['BR-MT200', 'Hydraulic Brake Set MT200', 'Brakes', 'Shimano', 1450, 2200, 2, 2, 2, 4],
  ['BP-RES', 'Brake Pads Resin (pair)', 'Brakes', 'Shimano', 180, 350, 10, 30, 8, 20],
  ['BC-CABLE', 'Brake Cable & Housing Kit', 'Brakes', 'Jagwire', 120, 250, 8, 25, 6, 15],
  ['BL-MIN-OIL', 'Mineral Oil Bleed Kit', 'Workshop', 'Shimano', 320, 550, 3, 10, 2, 5],
  ['GR-GREASE', 'Bearing Grease 100g', 'Workshop', 'Park Tool', 210, 380, 4, 12, 3, 6],
  ['LB-CHAIN', 'Chain Lube Wet 120ml', 'Workshop', 'Muc-Off', 260, 450, 6, 18, 5, 10],
  ['HL-USB', 'Headlight USB 800 lm', 'Accessories', 'Raypal', 450, 850, 5, 15, 3, 8],
  ['HM-MTB', 'Helmet MTB Adult', 'Accessories', 'Giro', 1200, 1950, 4, 8, 2, 4],
  ['PD-FLAT', 'Flat Pedals Alloy', 'Accessories', 'Wellgo', 480, 850, 3, 10, 2, 6],
  ['SD-COMF', 'Saddle Comfort', 'Accessories', 'Velo', 520, 950, 2, 6, 2, 4],
];

const SERVICES: [string, string, number, number, string[]][] = [
  ['Basic Tune-Up', 'Tune-Up', 350, 45, ['Check tyre pressure', 'Adjust brakes', 'Index gears', 'Lube chain', 'Bolt check']],
  ['Full Tune-Up', 'Tune-Up', 650, 90, ['Clean drivetrain', 'Adjust brakes', 'Index gears', 'True wheels', 'Lube chain', 'Bolt check', 'Test ride']],
  ['Full Overhaul', 'Overhaul', 1800, 180, ['Strip bike', 'Degrease all parts', 'Repack bearings', 'Rebuild drivetrain', 'Adjust brakes', 'True wheels', 'Test ride']],
  ['Hydraulic Brake Bleed (per wheel)', 'Brakes', 300, 30, ['Bleed caliper', 'Check lever feel', 'Clean rotor']],
  ['Brake Pad Replacement', 'Brakes', 150, 15, ['Remove old pads', 'Fit new pads', 'Bed in pads']],
  ['Wheel Truing', 'Wheels', 250, 30, ['Check spoke tension', 'True lateral', 'True radial']],
  ['Flat Tyre Repair', 'Wheels', 80, 15, ['Find puncture', 'Replace or patch tube', 'Inflate and check']],
  ['Drivetrain Install', 'Drivetrain', 600, 60, ['Fit groupset', 'Set chain length', 'Index gears', 'Test ride']],
  ['Bike Build (from frame)', 'Builds', 1500, 180, ['Fit components', 'Route cables', 'Adjust brakes', 'Index gears', 'Torque check', 'Test ride']],
  ['Suspension Fork Service', 'Suspension', 900, 60, ['Strip fork', 'Clean stanchions', 'Replace oil', 'Check seals']],
];

let seeding: Promise<boolean> | null = null;

/** Safe to call many times at once: only the first call seeds. */
export function seedIfEmpty(): Promise<boolean> {
  seeding ??= doSeed().finally(() => {
    seeding = null;
  });
  return seeding;
}

async function doSeed() {
  if ((await db.products.count()) > 0) return false;
  const now = nowISO();

  const settings: Settings = {
    id: 'shop',
    shopName: 'Bikemoko',
    address: 'Bayabas St. / Sofronio Y. Manansala St., General Santos City',
    phone: '',
    facebookPage: 'https://www.facebook.com/Bikemoko',
    receiptFooter: 'Thank you for riding with Bikemoko!',
    warrantyDays: 30,
    deadStockDays: 60,
    followUpDays: 90,
    openHour: 8,
    closeHour: 18,
  };

  const staff: Staff[] = [
    { id: uid(), name: 'Owner', role: 'owner', pin: '1234', skills: [], dailyCapacityMins: 0, color: '#f97316', active: true },
    { id: uid(), name: 'Cashier', role: 'cashier', pin: '1111', skills: [], dailyCapacityMins: 0, color: '#38bdf8', active: true },
    { id: uid(), name: 'Jun (Mekaniko)', role: 'mechanic', pin: '2222', skills: ['tune-up', 'brakes', 'drivetrain'], dailyCapacityMins: 480, color: '#22c55e', active: true },
    { id: uid(), name: 'Ronnie (Mekaniko)', role: 'mechanic', pin: '3333', skills: ['suspension', 'wheel truing', 'builds'], dailyCapacityMins: 480, color: '#a78bfa', active: true },
    { id: uid(), name: 'Bodega', role: 'warehouse', pin: '4444', skills: [], dailyCapacityMins: 0, color: '#facc15', active: true },
  ];

  const products: Product[] = [];
  const stock: StockLevel[] = [];
  for (const [sku, name, category, brand, cost, price, s, w, rpS, rpW, serial] of ROWS) {
    const id = uid();
    products.push({ id, sku, barcode: '480' + String(products.length + 1).padStart(10, '0'), name, category, brand, isSerialized: !!serial, isBundle: false, bundleItems: [], cost: P(cost), price: P(price), unit: 'pc', active: true, createdAt: now });
    stock.push({ id: levelId(id, 'STORE'), productId: id, location: 'STORE', quantity: s, reserved: 0, reorderPoint: rpS, bin: 'Floor' });
    stock.push({ id: levelId(id, 'WAREHOUSE'), productId: id, location: 'WAREHOUSE', quantity: w, reserved: 0, reorderPoint: rpW, bin: `A${(products.length % 4) + 1}-S${(products.length % 3) + 1}` });
  }
  // A tune-up kit bundle: selling it deducts every part inside.
  const bySku = (s: string) => products.find((p) => p.sku === s)!.id;
  products.push({
    id: uid(), sku: 'KIT-TUNE', barcode: '4800000000099', name: 'Tune-Up Parts Kit', category: 'Kits', brand: 'Bikemoko',
    isSerialized: false, isBundle: true,
    bundleItems: [{ productId: bySku('BC-CABLE'), qty: 1 }, { productId: bySku('BP-RES'), qty: 1 }, { productId: bySku('LB-CHAIN'), qty: 1 }],
    cost: P(560), price: P(950), unit: 'kit', active: true, createdAt: now,
  });

  const suppliers: Supplier[] = [
    { id: uid(), name: 'Davao Cycle Supply', contact: 'Ma. Santos', phone: '0917 000 0001', avgLeadDays: 2, reliability: 0.92, active: true },
    { id: uid(), name: 'Manila Bike Parts Trading', contact: 'R. Cruz', phone: '0918 000 0002', avgLeadDays: 6, reliability: 0.8, active: true },
    { id: uid(), name: 'GenSan Bike Hub Wholesale', contact: 'L. Reyes', phone: '0919 000 0003', avgLeadDays: 1, reliability: 0.75, active: true },
  ];
  const sp: SupplierProduct[] = [];
  products.filter((p) => !p.isBundle).forEach((p, i) => {
    const base = p.cost;
    const offers: [Supplier, number, number, number][] = [
      [suppliers[0], 1.0, 2, 1],
      [suppliers[1], 0.9, 6, 5],
      [suppliers[2], 1.08, 1, 1],
    ];
    offers.forEach(([s, mult, lead, moq], j) => {
      if ((i + j) % 4 === 3) return; // not every supplier carries everything
      sp.push({ id: uid(), supplierId: s.id, productId: p.id, supplierSku: `${s.name.slice(0, 3).toUpperCase()}-${p.sku}`, unitCost: Math.round((base * mult) / 100) * 100, leadDays: lead, moq });
    });
  });

  const services: Service[] = SERVICES.map(([name, category, fee, mins, checklist]) => ({ id: uid(), name, category, laborFee: P(fee), durationMins: mins, checklist, active: true }));

  const customers: Customer[] = [
    { id: uid(), name: 'Mark Villanueva', phone: '0917 123 4567', messenger: '', channel: 'sms', notes: 'Weekend rider', createdAt: now },
    { id: uid(), name: 'Joy Dela Cruz', phone: '0998 765 4321', messenger: '', channel: 'messenger', notes: '', createdAt: now },
  ];
  const bikes: CustomerBike[] = [
    { id: uid(), customerId: customers[0].id, brand: 'Trinx', model: 'M136 27.5', serial: 'TX2025-88123', color: 'Black', notes: '' },
    { id: uid(), customerId: customers[1].id, brand: 'Sava', model: 'R08 700c', serial: 'SV-77812', color: 'White', notes: '' },
  ];

  await db.transaction('rw', [db.settings, db.staff, db.products, db.stock, db.suppliers, db.supplierProducts, db.services, db.customers, db.bikes], async () => {
    await db.settings.put(settings);
    await db.staff.bulkAdd(staff);
    await db.products.bulkAdd(products);
    await db.stock.bulkAdd(stock);
    await db.suppliers.bulkAdd(suppliers);
    await db.supplierProducts.bulkAdd(sp);
    await db.services.bulkAdd(services);
    await db.customers.bulkAdd(customers);
    await db.bikes.bulkAdd(bikes);
  });
  return true;
}
