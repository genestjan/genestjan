// Every change to the shop goes through one of these actions.
// Each runs in a single transaction: stock, ledger and documents succeed or fail together.
// Names match the Supabase RPC functions in supabase/schema.sql.
import { db, nextNo } from './db';
import { LedgerTx, expandBundles, levelId } from '@/domain/stock';
import { jobTotals, canMove, findConflicts } from '@/domain/jobs';
import { settle } from '@/domain/payments';
import { reliabilityFrom } from '@/domain/po';
import { docNo, nowISO, uid } from '@/domain/util';
import type {
  Centavos,
  Channel,
  Estimate,
  ID,
  JobLine,
  JobStatus,
  LocationCode,
  NotifyTrigger,
  Payment,
  POItem,
  Sale,
  SaleLine,
  WorkOrder,
} from '@/domain/types';

const ALL = () => [
  db.staff, db.products, db.stock, db.movements, db.suppliers, db.supplierProducts, db.purchaseOrders,
  db.customers, db.bikes, db.services, db.estimates, db.workOrders, db.sales, db.shifts,
  db.notifications, db.settings, db.counters, db.outbox,
];

async function logOutbox(action: string, payload: unknown) {
  await db.outbox.add({ action, payload, createdAt: nowISO(), syncedAt: null, error: null });
}

async function snapshot(productIds: ID[]) {
  const ids = productIds.flatMap((p) => [levelId(p, 'STORE'), levelId(p, 'WAREHOUSE')]);
  return (await db.stock.bulkGet(ids)).filter((x) => !!x);
}

async function commit(tx: LedgerTx) {
  await db.stock.bulkPut(tx.changed());
  await db.movements.bulkAdd(tx.movements);
}

// ---------- POS ----------

export interface SaleInput {
  lines: { productId: ID; qty: number; unitPrice: Centavos; serial?: string }[];
  laborLines?: { name: string; qty: number; unitPrice: Centavos }[];
  payments: Payment[];
  discount: Centavos;
  customerId?: ID | null;
  staffId?: ID | null;
  shiftId?: ID | null;
  location?: LocationCode;
}

export async function recordSale(input: SaleInput): Promise<Sale> {
  return db.transaction('rw', ALL(), async () => {
    const products = new Map((await db.products.bulkGet(input.lines.map((l) => l.productId))).filter((p) => !!p).map((p) => [p!.id, p!]));
    const allProducts = new Map((await db.products.toArray()).map((p) => [p.id, p]));
    const parts = expandBundles(input.lines, allProducts);
    const tx = new LedgerTx(await snapshot(parts.map((p) => p.productId)));
    const loc = input.location ?? 'STORE';
    const id = uid();
    for (const p of parts) tx.out(p.productId, loc, p.qty, { reason: 'sale', refId: id, staffId: input.staffId });

    const lines: SaleLine[] = [
      ...input.lines.map((l) => ({
        productId: l.productId,
        name: products.get(l.productId)?.name ?? 'Item',
        qty: l.qty,
        unitPrice: l.unitPrice,
        serial: l.serial ?? '',
        kind: 'part' as const,
      })),
      ...(input.laborLines ?? []).map((l) => ({ productId: null, name: l.name, qty: l.qty, unitPrice: l.unitPrice, serial: '', kind: 'labor' as const })),
    ];
    for (const l of lines) {
      const p = l.productId ? products.get(l.productId) : null;
      if (p?.isSerialized && !l.serial) throw new Error(`Enter the frame serial number for ${p.name}`);
    }
    const subtotal = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
    const total = Math.max(0, subtotal - input.discount);
    const st = settle(total, input.payments);
    if (!st.ok) throw new Error(st.balance > 0 ? 'Payment is short' : 'Only cash can be more than the total');

    const sale: Sale = {
      id,
      receiptNo: docNo('R', await nextNo('receipt')),
      lines,
      payments: input.payments,
      subtotal,
      discount: input.discount,
      total,
      change: st.change,
      workOrderId: null,
      customerId: input.customerId ?? null,
      staffId: input.staffId ?? null,
      shiftId: input.shiftId ?? null,
      voided: false,
      createdAt: nowISO(),
    };
    await commit(tx);
    await db.sales.add(sale);
    await logOutbox('record_sale', { sale, movements: tx.movements });
    return sale;
  });
}

// ---------- Inventory ----------

export async function transferStock(productId: ID, from: LocationCode, to: LocationCode, qty: number, staffId?: ID | null, note = '') {
  return db.transaction('rw', ALL(), async () => {
    const tx = new LedgerTx(await snapshot([productId]));
    tx.transfer(productId, from, to, qty, { staffId, note });
    await commit(tx);
    await logOutbox('transfer_stock', { movements: tx.movements });
  });
}

export async function transferMany(rows: { productId: ID; qty: number }[], staffId?: ID | null) {
  return db.transaction('rw', ALL(), async () => {
    const tx = new LedgerTx(await snapshot(rows.map((r) => r.productId)));
    for (const r of rows) tx.transfer(r.productId, 'WAREHOUSE', 'STORE', r.qty, { staffId, note: 'Replenishment pick-list' });
    await commit(tx);
    await logOutbox('transfer_stock', { movements: tx.movements });
  });
}

export async function adjustCount(productId: ID, location: LocationCode, counted: number, staffId?: ID | null, note = 'Physical count') {
  return db.transaction('rw', ALL(), async () => {
    const tx = new LedgerTx(await snapshot([productId]));
    tx.setCount(productId, location, counted, { staffId, note });
    await commit(tx);
    await logOutbox('adjust_stock', { movements: tx.movements });
  });
}

export async function updateLevelSettings(productId: ID, location: LocationCode, patch: { reorderPoint?: number; bin?: string }) {
  const id = levelId(productId, location);
  const cur = (await db.stock.get(id)) ?? { id, productId, location, quantity: 0, reserved: 0, reorderPoint: 0, bin: '' };
  await db.stock.put({ ...cur, ...patch });
  await logOutbox('update_level', { id, ...patch });
}

// ---------- Purchase orders ----------

export async function createPO(supplierId: ID, items: Omit<POItem, 'receivedQty'>[], leadDays: number, notes = '') {
  return db.transaction('rw', ALL(), async () => {
    const expected = new Date(Date.now() + leadDays * 86_400_000).toISOString();
    const po = {
      id: uid(),
      poNo: docNo('PO', await nextNo('po')),
      supplierId,
      status: 'draft' as const,
      items: items.map((i) => ({ ...i, receivedQty: 0 })),
      notes,
      createdAt: nowISO(),
      expectedDate: expected,
      receivedDate: null,
    };
    await db.purchaseOrders.add(po);
    await logOutbox('create_po', po);
    return po;
  });
}

export async function setPOStatus(id: ID, status: 'sent' | 'cancelled') {
  await db.purchaseOrders.update(id, { status });
  await logOutbox('set_po_status', { id, status });
}

/** Receive a delivery into the warehouse. Partial deliveries are fine. */
export async function receivePO(id: ID, received: { productId: ID; qty: number }[], staffId?: ID | null) {
  return db.transaction('rw', ALL(), async () => {
    const po = await db.purchaseOrders.get(id);
    if (!po) throw new Error('PO not found');
    const tx = new LedgerTx(await snapshot(received.map((r) => r.productId)));
    for (const r of received) {
      if (r.qty <= 0) continue;
      const item = po.items.find((i) => i.productId === r.productId);
      if (!item) throw new Error('Item not on this PO');
      item.receivedQty += r.qty;
      tx.in(r.productId, 'WAREHOUSE', r.qty, { reason: 'po_receive', refId: po.id, staffId });
      // Keep product cost current with the latest buy price.
      await db.products.update(r.productId, { cost: item.unitCost });
    }
    const done = po.items.every((i) => i.receivedQty >= i.qty);
    po.status = done ? 'received' : 'partial';
    if (done) po.receivedDate = nowISO();
    await commit(tx);
    await db.purchaseOrders.put(po);
    if (done) await refreshReliability(po.supplierId);
    await logOutbox('receive_po', { po, movements: tx.movements });
    return po;
  });
}

async function refreshReliability(supplierId: ID) {
  const pos = await db.purchaseOrders.where('supplierId').equals(supplierId).toArray();
  const r = reliabilityFrom(pos);
  if (r != null) await db.suppliers.update(supplierId, { reliability: r });
}

// ---------- Repairs ----------

export async function saveEstimate(e: Omit<Estimate, 'id' | 'estNo' | 'createdAt'> & { id?: ID }) {
  return db.transaction('rw', ALL(), async () => {
    const existing = e.id ? await db.estimates.get(e.id) : undefined;
    const est: Estimate = existing
      ? { ...existing, ...e, id: existing.id }
      : { ...e, id: uid(), estNo: docNo('E', await nextNo('estimate')), createdAt: nowISO() };
    await db.estimates.put(est);
    await logOutbox('save_estimate', est);
    return est;
  });
}

export interface ScheduleInput {
  mechanicId: ID | null;
  bay: string;
  start: string;
  end?: string;
}

/**
 * Approve & convert: books the calendar, reserves Store parts, assigns the mechanic.
 * Parts that are short are not reserved; the job goes to "Waiting for parts" instead.
 */
export async function approveEstimateToJob(estimateId: ID, sched: ScheduleInput, deposit: Centavos = 0) {
  return db.transaction('rw', ALL(), async () => {
    const est = await db.estimates.get(estimateId);
    if (!est) throw new Error('Estimate not found');
    if (est.status === 'converted') throw new Error('Already converted');
    const totals = jobTotals(est.lines);
    const end = sched.end ?? new Date(new Date(sched.start).getTime() + Math.max(30, totals.durationMins) * 60_000).toISOString();
    const open = await db.workOrders.toArray();
    const clash = findConflicts(open, { mechanicId: sched.mechanicId, bay: sched.bay, start: sched.start, end });
    if (clash.length) throw new Error(`Time clash with job ${clash[0].jobNo}`);

    const parts = est.lines.filter((l) => l.kind === 'part');
    const tx = new LedgerTx(await snapshot(parts.map((p) => p.refId)));
    let short = false;
    const lines: JobLine[] = est.lines.map((l) => ({ ...l }));
    for (const p of parts) {
      try {
        tx.reserve(p.refId, 'STORE', p.qty);
      } catch {
        short = true;
        lines.find((x) => x.id === p.id)!.short = true;
      }
    }
    const services = await db.services.bulkGet(est.lines.filter((l) => l.kind === 'labor').map((l) => l.refId));
    const checklist = services.flatMap((s) => s?.checklist ?? []).map((label) => ({ label, done: false }));

    const wo: WorkOrder = {
      id: uid(),
      jobNo: docNo('J', await nextNo('job')),
      estimateId: est.id,
      customerId: est.customerId,
      bikeId: est.bikeId,
      mechanicId: sched.mechanicId,
      bay: sched.bay,
      scheduledStart: sched.start,
      scheduledEnd: end,
      actualStart: null,
      actualEnd: null,
      timerSince: null,
      workedMins: 0,
      status: short ? 'waiting_parts' : 'scheduled',
      lines,
      checklist,
      complaint: est.complaint,
      intakeNotes: '',
      photos: [],
      deposit,
      createdAt: nowISO(),
    };
    await db.stock.bulkPut(tx.changed());
    await db.workOrders.add(wo);
    await db.estimates.update(est.id, { status: 'converted' });
    await logOutbox('approve_estimate_to_job', { wo });
    return wo;
  });
}

/** Walk-in job without a formal estimate. */
export async function createJob(input: Omit<WorkOrder, 'id' | 'jobNo' | 'createdAt' | 'actualStart' | 'actualEnd' | 'timerSince' | 'workedMins'>) {
  return db.transaction('rw', ALL(), async () => {
    const clash = findConflicts(await db.workOrders.toArray(), { mechanicId: input.mechanicId, bay: input.bay, start: input.scheduledStart, end: input.scheduledEnd });
    if (clash.length) throw new Error(`Time clash with job ${clash[0].jobNo}`);
    const tx = new LedgerTx(await snapshot(input.lines.filter((l) => l.kind === 'part').map((l) => l.refId)));
    for (const l of input.lines) if (l.kind === 'part') tx.reserve(l.refId, 'STORE', l.qty);
    const wo: WorkOrder = { ...input, id: uid(), jobNo: docNo('J', await nextNo('job')), createdAt: nowISO(), actualStart: null, actualEnd: null, timerSince: null, workedMins: 0 };
    await db.stock.bulkPut(tx.changed());
    await db.workOrders.add(wo);
    await logOutbox('create_job', wo);
    return wo;
  });
}

export async function rescheduleJob(id: ID, sched: { mechanicId: ID | null; bay: string; start: string; end: string }) {
  return db.transaction('rw', ALL(), async () => {
    const clash = findConflicts(await db.workOrders.toArray(), { id, mechanicId: sched.mechanicId, bay: sched.bay, start: sched.start, end: sched.end });
    if (clash.length) throw new Error(`Time clash with job ${clash[0].jobNo}`);
    await db.workOrders.update(id, { mechanicId: sched.mechanicId, bay: sched.bay, scheduledStart: sched.start, scheduledEnd: sched.end });
    await logOutbox('reschedule_job', { id, ...sched });
  });
}

export async function setJobStatus(id: ID, to: JobStatus) {
  return db.transaction('rw', ALL(), async () => {
    const wo = await db.workOrders.get(id);
    if (!wo) throw new Error('Job not found');
    if (!canMove(wo.status, to)) throw new Error(`Can't move from ${wo.status} to ${to}`);
    const patch: Partial<WorkOrder> = { status: to };
    if (to === 'in_repair' && !wo.actualStart) patch.actualStart = nowISO();
    if ((to === 'ready' || to === 'quality_check') && wo.timerSince) {
      patch.workedMins = wo.workedMins + Math.floor((Date.now() - new Date(wo.timerSince).getTime()) / 60_000);
      patch.timerSince = null;
    }
    if (to === 'ready') patch.actualEnd = nowISO();
    if (to === 'cancelled') {
      const tx = new LedgerTx(await snapshot(wo.lines.filter((l) => l.kind === 'part').map((l) => l.refId)));
      for (const l of wo.lines) if (l.kind === 'part' && !l.short) tx.release(l.refId, 'STORE', l.qty);
      await db.stock.bulkPut(tx.changed());
    }
    await db.workOrders.update(id, patch);
    await logOutbox('set_job_status', { id, to });
  });
}

export async function toggleTimer(id: ID) {
  const wo = await db.workOrders.get(id);
  if (!wo) return;
  if (wo.timerSince) {
    const add = Math.floor((Date.now() - new Date(wo.timerSince).getTime()) / 60_000);
    await db.workOrders.update(id, { timerSince: null, workedMins: wo.workedMins + add });
  } else {
    const patch: Partial<WorkOrder> = { timerSince: nowISO() };
    if (wo.status === 'scheduled' || wo.status === 'checked_in') {
      patch.status = 'in_repair';
      patch.actualStart = wo.actualStart ?? nowISO();
    }
    await db.workOrders.update(id, patch);
  }
  await logOutbox('toggle_timer', { id });
}

/** Mechanic adds a part mid-repair. Reserves it now; the customer re-approves the higher total. */
export async function addJobPart(id: ID, productId: ID, qty: number) {
  return db.transaction('rw', ALL(), async () => {
    const wo = await db.workOrders.get(id);
    const p = await db.products.get(productId);
    if (!wo || !p) throw new Error('Not found');
    const tx = new LedgerTx(await snapshot([productId]));
    tx.reserve(productId, 'STORE', qty);
    const lines = [...wo.lines, { id: uid(), kind: 'part' as const, refId: productId, name: p.name, qty, unitPrice: p.price, durationMins: 0 }];
    await db.stock.bulkPut(tx.changed());
    await db.workOrders.update(id, { lines });
    await logOutbox('add_job_part', { id, productId, qty });
  });
}

export async function updateJob(id: ID, patch: Partial<Pick<WorkOrder, 'checklist' | 'intakeNotes' | 'photos' | 'complaint' | 'deposit'>>) {
  await db.workOrders.update(id, patch);
  await logOutbox('update_job', { id, ...patch });
}

/**
 * Bill a finished job: reserved parts leave the shelf for good, labour is logged
 * for the mechanic, and the deposit is credited.
 */
export async function completeRepairBilling(id: ID, payments: Payment[], discount: Centavos = 0, staffId?: ID | null, shiftId?: ID | null) {
  return db.transaction('rw', ALL(), async () => {
    const wo = await db.workOrders.get(id);
    if (!wo) throw new Error('Job not found');
    if (wo.status !== 'ready') throw new Error('Only jobs marked Ready can be billed');
    const parts = wo.lines.filter((l) => l.kind === 'part');
    const tx = new LedgerTx(await snapshot(parts.map((p) => p.refId)));
    const saleId = uid();
    for (const p of parts) {
      if (p.short) tx.out(p.refId, 'STORE', p.qty, { reason: 'repair', refId: saleId, staffId, note: wo.jobNo });
      else tx.out(p.refId, 'STORE', p.qty, { reason: 'repair', refId: saleId, staffId, note: wo.jobNo }, true);
    }
    const totals = jobTotals(wo.lines);
    const total = Math.max(0, totals.total - discount);
    const due = Math.max(0, total - wo.deposit);
    const st = settle(due, payments);
    if (!st.ok) throw new Error(st.balance > 0 ? 'Payment is short' : 'Only cash can be more than the balance');
    const sale: Sale = {
      id: saleId,
      receiptNo: docNo('R', await nextNo('receipt')),
      lines: wo.lines.map((l) => ({ productId: l.kind === 'part' ? l.refId : null, name: l.name, qty: l.qty, unitPrice: l.unitPrice, serial: '', kind: l.kind })),
      payments: wo.deposit ? [{ method: 'cash', amount: wo.deposit, ref: 'Deposit' }, ...payments] : payments,
      subtotal: totals.total,
      discount,
      total,
      change: st.change,
      workOrderId: wo.id,
      customerId: wo.customerId,
      staffId: staffId ?? null,
      shiftId: shiftId ?? null,
      voided: false,
      createdAt: nowISO(),
    };
    await commit(tx);
    await db.sales.add(sale);
    await db.workOrders.update(id, { status: 'completed' });
    await logOutbox('complete_repair_billing', { sale, movements: tx.movements });
    return sale;
  });
}

// ---------- Customers & notifications ----------

export async function logNotification(customerId: ID, workOrderId: ID | null, channel: Channel, trigger: NotifyTrigger, body: string) {
  const row = { id: uid(), customerId, workOrderId, channel, trigger, body, createdAt: nowISO() };
  await db.notifications.add(row);
  await logOutbox('log_notification', row);
}

// ---------- Shifts (X / Z reading) ----------

export async function openShift(staffId: ID, openingCash: Centavos) {
  const s = { id: uid(), staffId, openedAt: nowISO(), closedAt: null, openingCash, countedCash: null };
  await db.shifts.add(s);
  await logOutbox('open_shift', s);
  return s;
}

export async function closeShift(id: ID, countedCash: Centavos) {
  await db.shifts.update(id, { closedAt: nowISO(), countedCash });
  await logOutbox('close_shift', { id, countedCash });
}
