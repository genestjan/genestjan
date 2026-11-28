// Pure helpers for the Repairs module. No database or React in here so they are easy to test.
import { jobTotals } from '@/domain/jobs';
import { money, minsLabel, uid } from '@/domain/util';
import type { JobLine, JobStatus, NotifyTrigger, Product, Service, WorkOrder, CustomerBike } from '@/domain/types';
import type { Tone } from '@/ui/kit';

export const JOB_TONE: Record<JobStatus, Tone> = {
  scheduled: 'neutral',
  checked_in: 'info',
  in_repair: 'brand',
  waiting_parts: 'warn',
  quality_check: 'violet',
  ready: 'ok',
  completed: 'neutral',
  cancelled: 'bad',
};

export const BOARD_COLUMNS: JobStatus[] = ['scheduled', 'checked_in', 'in_repair', 'waiting_parts', 'quality_check', 'ready'];

/** Main workflow shown in the stepper. Waiting for parts is a side step off "In repair". */
export const FLOW: JobStatus[] = ['scheduled', 'checked_in', 'in_repair', 'quality_check', 'ready', 'completed'];

export function flowIndex(s: JobStatus): number {
  if (s === 'waiting_parts') return FLOW.indexOf('in_repair');
  return FLOW.indexOf(s);
}

/** Moving a job here should offer to message the customer. */
export function promptTrigger(to: JobStatus): NotifyTrigger | null {
  if (to === 'waiting_parts') return 'waiting_parts';
  if (to === 'ready') return 'ready_for_pickup';
  return null;
}

export const bikeLabel = (b?: Pick<CustomerBike, 'brand' | 'model'> | null) => (b ? `${b.brand} ${b.model}`.trim() || 'Bike' : 'No bike');

export function isOverdue(job: Pick<WorkOrder, 'scheduledEnd' | 'status'>, now = Date.now()): boolean {
  if (job.status === 'ready' || job.status === 'completed' || job.status === 'cancelled') return false;
  return new Date(job.scheduledEnd).getTime() < now;
}

/** Default start for new bookings: the next half hour boundary. */
export function nextHalfHour(now = new Date()): Date {
  const d = new Date(now);
  d.setSeconds(0, 0);
  const m = d.getMinutes();
  if (m === 0 || m === 30) d.setMinutes(m + 30);
  else d.setMinutes(m < 30 ? 30 : 60);
  return d;
}

const p2 = (n: number) => String(n).padStart(2, '0');
/** Value for <input type="datetime-local"> in local time. */
export const toLocalInput = (d: Date | string) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${p2(x.getMonth() + 1)}-${p2(x.getDate())}T${p2(x.getHours())}:${p2(x.getMinutes())}`;
};
export const fromLocalInput = (s: string) => new Date(s).toISOString();

export function addMinsISO(startISO: string, mins: number) {
  return new Date(new Date(startISO).getTime() + mins * 60_000).toISOString();
}

export const laborLine = (s: Service): JobLine => ({ id: uid(), kind: 'labor', refId: s.id, name: s.name, qty: 1, unitPrice: s.laborFee, durationMins: s.durationMins });
export const partLine = (p: Product): JobLine => ({ id: uid(), kind: 'part', refId: p.id, name: p.name, qty: 1, unitPrice: p.price, durationMins: 0 });

/** Adding the same service or part again bumps its quantity instead of duplicating the row. */
export function addLine(lines: JobLine[], line: JobLine): JobLine[] {
  const i = lines.findIndex((l) => l.kind === line.kind && l.refId === line.refId);
  if (i < 0) return [...lines, line];
  return lines.map((l, j) => (j === i ? { ...l, qty: l.qty + line.qty } : l));
}
export const setLineQty = (lines: JobLine[], id: string, qty: number) => (qty <= 0 ? lines.filter((l) => l.id !== id) : lines.map((l) => (l.id === id ? { ...l, qty } : l)));
export const setLinePrice = (lines: JobLine[], id: string, unitPrice: number) => lines.map((l) => (l.id === id ? { ...l, unitPrice: Math.max(0, unitPrice) } : l));

const norm = (s: string) => s.toLowerCase().trim();
export function matchProduct(p: Product, q: string): boolean {
  const n = norm(q);
  if (!p.active) return false;
  if (!n) return true;
  return [p.name, p.sku, p.barcode, p.brand, p.category].some((f) => norm(f).includes(n));
}
export function matchService(s: Service, q: string): boolean {
  const n = norm(q);
  if (!s.active) return false;
  if (!n) return true;
  return [s.name, s.category].some((f) => norm(f).includes(n));
}

export function quoteText(o: { shop: string; estNo: string; customer: string; bike: string; complaint: string; lines: JobLine[] }): string {
  const t = jobTotals(o.lines);
  const out = [`${o.shop} repair quote ${o.estNo}`, `For: ${o.customer}`, `Bike: ${o.bike}`];
  if (o.complaint.trim()) out.push(`Problem: ${o.complaint.trim()}`);
  out.push('');
  for (const l of o.lines) out.push(`${l.qty} x ${l.name}: ${money(l.qty * l.unitPrice)}`);
  out.push('', `Parts: ${money(t.parts)}`, `Labour: ${money(t.labor)}`, `Total: ${money(t.total)}`);
  if (t.durationMins) out.push(`Estimated time: ${minsLabel(t.durationMins)}`);
  return out.join('\n');
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Standalone printable page for a quote. */
export function quoteHtml(o: { shop: string; estNo: string; customer: string; bike: string; complaint: string; lines: JobLine[] }): string {
  const t = jobTotals(o.lines);
  const rows = o.lines
    .map((l) => `<tr><td>${esc(l.name)}</td><td class="r">${l.qty}</td><td class="r">${esc(money(l.unitPrice))}</td><td class="r">${esc(money(l.qty * l.unitPrice))}</td></tr>`)
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(o.estNo)}</title><style>
body{font-family:system-ui,sans-serif;color:black;margin:32px;max-width:720px}
h1{font-size:22px;margin:0 0 4px}p{margin:2px 0}table{width:100%;border-collapse:collapse;margin-top:16px}
th,td{padding:6px 4px;border-bottom:1px solid gray;text-align:left}.r{text-align:right}
.tot{margin-top:12px;text-align:right}.tot p{font-size:15px}.tot .big{font-size:20px;font-weight:bold}
</style></head><body>
<h1>${esc(o.shop)}</h1><p>Repair quote ${esc(o.estNo)}</p>
<p>Customer: ${esc(o.customer)}</p><p>Bike: ${esc(o.bike)}</p>${o.complaint.trim() ? `<p>Problem: ${esc(o.complaint.trim())}</p>` : ''}
<table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Amount</th></tr></thead><tbody>${rows}</tbody></table>
<div class="tot"><p>Parts: ${esc(money(t.parts))}</p><p>Labour: ${esc(money(t.labor))}</p><p class="big">Total: ${esc(money(t.total))}</p>${t.durationMins ? `<p>Estimated time: ${esc(minsLabel(t.durationMins))}</p>` : ''}</div>
</body></html>`;
}

/** Scale (w, h) down so the longest side is at most max. Never scales up. */
export function fitWithin(w: number, h: number, max = 1280): { w: number; h: number } {
  const longest = Math.max(w, h);
  if (longest <= max) return { w, h };
  const k = max / longest;
  return { w: Math.round(w * k), h: Math.round(h * k) };
}
