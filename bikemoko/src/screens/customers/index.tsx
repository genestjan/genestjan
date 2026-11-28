import { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Bike, MessageCircle, Pencil, Plus, ShieldCheck, ShoppingCart, FilePlus2, Users } from 'lucide-react';
import { Badge, Button, Card, Drawer, Empty, Field, Input, Modal, Money, Section, SearchBox, Select, Table, Textarea, run } from '@/ui/kit';
import { db } from '@/data/db';
import { useCustomers, useLiveQuery, useSettings } from '@/data/hooks';
import { saveBike, saveCustomer } from '@/data/customersActions';
import { jobTotals, JOB_STATUS } from '@/domain/jobs';
import type { Channel, Customer, CustomerBike, NotificationLog, Sale, WorkOrder } from '@/domain/types';
import { JOB_TONE } from '../reports/calc';

const CHANNEL: Record<Channel, string> = { sms: 'SMS', messenger: 'Messenger', viber: 'Viber' };
const dateOf = (iso: string) => new Date(iso).toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: 'numeric' });

export default function Customers() {
  const customers = useCustomers();
  const settings = useSettings();
  const bikes = (useLiveQuery(() => db.bikes.toArray(), []) ?? []) as CustomerBike[];
  const sales = (useLiveQuery(() => db.sales.toArray(), []) ?? []) as Sale[];
  const jobs = (useLiveQuery(() => db.workOrders.toArray(), []) ?? []) as WorkOrder[];
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const stats = useMemo(() => {
    const m = new Map<string, { bikes: CustomerBike[]; spend: number; last: string }>();
    const get = (id: string) => {
      let e = m.get(id);
      if (!e) m.set(id, (e = { bikes: [], spend: 0, last: '' }));
      return e;
    };
    for (const b of bikes) get(b.customerId).bikes.push(b);
    for (const s of sales) {
      if (!s.customerId || s.voided) continue;
      const e = get(s.customerId);
      e.spend += s.total;
      if (s.createdAt > e.last) e.last = s.createdAt;
    }
    for (const j of jobs) {
      if (j.status === 'cancelled') continue;
      const e = get(j.customerId);
      if (j.scheduledStart > e.last && j.scheduledStart <= new Date().toISOString()) e.last = j.scheduledStart;
    }
    return m;
  }, [bikes, sales, jobs]);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    const digits = t.replace(/\D/g, '');
    return customers
      .filter((c) => {
        if (!t) return true;
        const bs = stats.get(c.id)?.bikes ?? [];
        return (
          c.name.toLowerCase().includes(t) ||
          (digits.length >= 3 && c.phone.replace(/\D/g, '').includes(digits)) ||
          c.phone.toLowerCase().includes(t) ||
          bs.some((b) => b.serial.toLowerCase().includes(t))
        );
      })
      .sort((a, b) => (stats.get(b.id)?.last ?? '').localeCompare(stats.get(a.id)?.last ?? '') || a.name.localeCompare(b.name));
  }, [customers, stats, q]);

  const open = customers.find((c) => c.id === openId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand"><Users className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-bold md:text-[28px]">Customers and bikes</h1>
            <p className="mt-0.5 text-sm text-muted">{customers.length} customer{customers.length === 1 ? '' : 's'}</p>
          </div>
        </div>
        <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>New customer</Button>
      </div>

      <SearchBox placeholder="Search name, phone or bike serial" value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ('')} />

      <Table
        rows={rows}
        rowKey={(c) => c.id}
        onRow={(c) => setOpenId(c.id)}
        empty={
          <Empty
            icon={<Users className="h-5 w-5" />}
            title={q ? 'No one matches that search' : 'No customers yet'}
            sub={q ? 'Try a shorter name, or the last digits of the phone number.' : 'Add the first customer to keep their bikes and repair history together.'}
            action={!q && <Button variant="primary" onClick={() => setCreating(true)}>New customer</Button>}
          />
        }
        cols={[
          { key: 'n', label: 'Name', cell: (c) => <span className="font-semibold">{c.name}</span> },
          { key: 'p', label: 'Phone', cell: (c) => <span className="num text-muted">{c.phone || '-'}</span> },
          { key: 'c', label: 'Prefers', cell: (c) => <Badge tone="info">{CHANNEL[c.channel]}</Badge> },
          { key: 'b', label: 'Bikes', align: 'right', cell: (c) => stats.get(c.id)?.bikes.length ?? 0 },
          { key: 'l', label: 'Last visit', align: 'right', cell: (c) => { const l = stats.get(c.id)?.last; return l ? dateOf(l) : '-'; } },
          { key: 's', label: 'Lifetime spend', align: 'right', cell: (c) => <Money value={stats.get(c.id)?.spend ?? 0} /> },
        ]}
      />

      <WarrantyLookup bikes={bikes} sales={sales} customers={customers} warrantyDays={settings?.warrantyDays ?? 30} onOpen={setOpenId} />

      {(open || creating) && (
        <CustomerDrawer
          key={open?.id ?? 'new'}
          customer={open}
          bikes={bikes.filter((b) => b.customerId === open?.id)}
          onClose={() => {
            setOpenId(null);
            setCreating(false);
          }}
          onCreated={(id) => {
            setCreating(false);
            setOpenId(id);
          }}
        />
      )}
    </div>
  );
}

// ---------- Warranty lookup ----------

function WarrantyLookup({ bikes, sales, customers, warrantyDays, onOpen }: { bikes: CustomerBike[]; sales: Sale[]; customers: Customer[]; warrantyDays: number; onOpen: (id: string) => void }) {
  const [serial, setSerial] = useState('');
  const t = serial.trim().toLowerCase();
  const cust = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

  const results = useMemo(() => {
    if (t.length < 3) return null;
    const soldHits = sales
      .filter((s) => !s.voided)
      .flatMap((s) => s.lines.filter((l) => l.serial && l.serial.toLowerCase().includes(t)).map((l) => ({ sale: s, line: l })))
      .sort((a, b) => b.sale.createdAt.localeCompare(a.sale.createdAt));
    const bikeHits = bikes.filter((b) => b.serial && b.serial.toLowerCase().includes(t));
    return { soldHits, bikeHits };
  }, [t, sales, bikes]);

  const status = (iso: string) => {
    const until = new Date(iso).getTime() + warrantyDays * 86_400_000;
    const left = Math.ceil((until - Date.now()) / 86_400_000);
    return left >= 0
      ? { ok: true, label: `In warranty, ${left} day${left === 1 ? '' : 's'} left`, until: new Date(until) }
      : { ok: false, label: `Warranty ended ${-left} day${left === -1 ? '' : 's'} ago`, until: new Date(until) };
  };

  return (
    <Section title="Warranty lookup">
      <Card>
        <Field label="Frame serial number" hint={`Warranty lasts ${warrantyDays} days from the sale date.`}>
          <Input placeholder="Type at least 3 characters" value={serial} onChange={(e) => setSerial(e.target.value)} />
        </Field>
        {results && (
          <div className="mt-4 space-y-2">
            {results.soldHits.map(({ sale, line }) => {
              const st = status(sale.createdAt);
              const c = sale.customerId ? cust.get(sale.customerId) : undefined;
              return (
                <div key={sale.id + line.serial} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-raised px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{line.name}</div>
                    <div className="num text-xs text-muted">Serial {line.serial} · Sold {dateOf(sale.createdAt)} · {sale.receiptNo}</div>
                    {c && <button className="mt-0.5 text-xs font-semibold text-brand" onClick={() => onOpen(c.id)}>{c.name}</button>}
                  </div>
                  <Badge tone={st.ok ? 'ok' : 'bad'} dot>{st.label}</Badge>
                </div>
              );
            })}
            {results.bikeHits.map((b) => {
              const c = cust.get(b.customerId);
              return (
                <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-raised px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold">{b.brand} {b.model}</div>
                    <div className="num text-xs text-muted">Serial {b.serial} · Registered bike</div>
                  </div>
                  {c && <Button size="sm" variant="secondary" onClick={() => onOpen(c.id)}>{c.name}</Button>}
                </div>
              );
            })}
            {!results.soldHits.length && !results.bikeHits.length && (
              <p className="text-sm text-muted">No sale or registered bike has that serial. If the bike was bought here, check the serial was typed at the till.</p>
            )}
            {results.bikeHits.length > 0 && !results.soldHits.length && (
              <p className="text-xs text-faint">This bike is registered but we have no sale with this serial, so the warranty start date is unknown.</p>
            )}
          </div>
        )}
      </Card>
    </Section>
  );
}

// ---------- Customer drawer ----------

function CustomerDrawer({ customer, bikes, onClose, onCreated }: { customer: Customer | null; bikes: CustomerBike[]; onClose: () => void; onCreated: (id: string) => void }) {
  const nav = useNavigate();
  const [f, setF] = useState({
    name: customer?.name ?? '',
    phone: customer?.phone ?? '',
    messenger: customer?.messenger ?? '',
    channel: (customer?.channel ?? 'sms') as Channel,
    notes: customer?.notes ?? '',
  });
  const [bike, setBike] = useState<Partial<CustomerBike> | null>(null);
  const id = customer?.id;

  const jobs = (useLiveQuery(() => (id ? db.workOrders.where('customerId').equals(id).toArray() : []), [id]) ?? []) as WorkOrder[];
  const sales = (useLiveQuery(() => (id ? db.sales.where('customerId').equals(id).toArray() : []), [id]) ?? []) as Sale[];
  const notes = (useLiveQuery(() => (id ? db.notifications.where('customerId').equals(id).toArray() : []), [id]) ?? []) as NotificationLog[];

  const dirty = !customer || f.name !== customer.name || f.phone !== customer.phone || f.messenger !== customer.messenger || f.channel !== customer.channel || f.notes !== customer.notes;
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const go = (to: string) => {
    onClose();
    nav(to);
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={customer ? customer.name : 'New customer'}
      sub={customer ? `Customer since ${dateOf(customer.createdAt)}` : 'Add contact details first, then their bikes'}
      footer={
        customer ? (
          <>
            <Button variant="primary" className="flex-1" icon={<FilePlus2 className="h-4 w-4" />} onClick={() => go(`/repairs/estimate/new?customer=${customer.id}`)}>New estimate</Button>
            <Button className="flex-1" icon={<ShoppingCart className="h-4 w-4" />} onClick={() => go(`/pos?customer=${customer.id}`)}>New sale</Button>
          </>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <section className="space-y-3">
          <Field label="Name"><Input value={f.name} onChange={(e) => set('name', e.target.value)} autoComplete="off" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone"><Input inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
            <Field label="Prefers">
              <Select value={f.channel} onChange={(e) => set('channel', e.target.value as Channel)}>
                <option value="sms">SMS</option>
                <option value="messenger">Messenger</option>
                <option value="viber">Viber</option>
              </Select>
            </Field>
          </div>
          <Field label="Messenger name or link" hint="Optional"><Input value={f.messenger} onChange={(e) => set('messenger', e.target.value)} /></Field>
          <Field label="Notes"><Textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
          <Button
            variant={customer ? 'secondary' : 'primary'}
            disabled={!dirty}
            onClick={() => run(async () => {
              const saved = await saveCustomer({ ...f, id });
              if (!customer) onCreated(saved.id);
            }, customer ? 'Customer saved' : 'Customer added')}
          >
            {customer ? 'Save changes' : 'Add customer'}
          </Button>
        </section>

        {customer && (
          <>
            <Section title="Bikes" action={<Button size="sm" variant="soft" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setBike({ customerId: customer.id })}>Add bike</Button>}>
              {bikes.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line px-4 py-5 text-sm text-muted">No bikes saved yet. Add the frame serial so the warranty can be checked later.</p>
              ) : (
                <div className="space-y-2">
                  {bikes.map((b) => (
                    <div key={b.id} className="flex items-center gap-3 rounded-xl border border-line bg-raised px-4 py-3">
                      <Bike className="h-5 w-5 shrink-0 text-faint" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{b.brand} {b.model}</div>
                        <div className="num truncate text-xs text-muted">{[b.color, b.serial && `Serial ${b.serial}`].filter(Boolean).join(' · ') || 'No details yet'}</div>
                      </div>
                      <Button size="sm" variant="ghost" aria-label={`Edit ${b.brand} ${b.model}`} icon={<Pencil className="h-4 w-4" />} onClick={() => setBike(b)} />
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Service history">
              {jobs.length === 0 ? (
                <p className="text-sm text-muted">No repairs yet.</p>
              ) : (
                <div className="divide-y divide-line rounded-xl border border-line">
                  {[...jobs].sort((a, b) => b.scheduledStart.localeCompare(a.scheduledStart)).map((j) => (
                    <Link key={j.id} to={`/jobs/${j.id}`} onClick={onClose} className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-2.5 hover:bg-raised">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{j.jobNo}</div>
                        <div className="truncate text-xs text-muted">{dateOf(j.scheduledStart)}{j.complaint ? ` · ${j.complaint}` : ''}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <Money value={jobTotals(j.lines).total} className="text-sm" />
                        <Badge tone={JOB_TONE[j.status]}>{JOB_STATUS[j.status].label}</Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Purchases">
              {sales.length === 0 ? (
                <p className="text-sm text-muted">No purchases yet.</p>
              ) : (
                <div className="divide-y divide-line rounded-xl border border-line">
                  {[...sales].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{s.receiptNo} {s.voided && <Badge tone="bad">Voided</Badge>}</div>
                        <div className="truncate text-xs text-muted">{dateOf(s.createdAt)} · {s.lines.map((l) => l.name).join(', ')}</div>
                      </div>
                      <Money value={s.total} strong />
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Messages sent">
              {notes.length === 0 ? (
                <p className="text-sm text-muted">No messages logged yet.</p>
              ) : (
                <div className="space-y-2">
                  {[...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((n) => (
                    <div key={n.id} className="rounded-xl border border-line px-4 py-2.5">
                      <div className="flex items-center gap-2 text-xs text-muted"><MessageCircle className="h-3.5 w-3.5" />{CHANNEL[n.channel]} · {dateOf(n.createdAt)}</div>
                      <p className="mt-1 text-sm">{n.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </Section>
            <div className="flex items-center gap-2 text-xs text-faint"><ShieldCheck className="h-3.5 w-3.5" /> Changes save on this device and sync when the shop is online.</div>
          </>
        )}
      </div>
      {bike && <BikeModal bike={bike} onClose={() => setBike(null)} />}
    </Drawer>
  );
}

function BikeModal({ bike, onClose }: { bike: Partial<CustomerBike>; onClose: () => void }) {
  const [b, setB] = useState({ brand: bike.brand ?? '', model: bike.model ?? '', serial: bike.serial ?? '', color: bike.color ?? '', notes: bike.notes ?? '' });
  const set = (k: keyof typeof b, v: string) => setB((x) => ({ ...x, [k]: v }));
  return (
    <Modal
      open
      onClose={onClose}
      title={bike.id ? 'Edit bike' : 'Add bike'}
      footer={
        <>
          <Button className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="primary" className="flex-1" onClick={() => run(async () => { await saveBike({ ...b, id: bike.id, customerId: bike.customerId! }); onClose(); }, 'Bike saved')}>Save bike</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Brand"><Input value={b.brand} onChange={(e) => set('brand', e.target.value)} /></Field>
          <Field label="Model"><Input value={b.model} onChange={(e) => set('model', e.target.value)} /></Field>
        </div>
        <Field label="Frame serial number"><Input value={b.serial} onChange={(e) => set('serial', e.target.value)} /></Field>
        <Field label="Colour"><Input value={b.color} onChange={(e) => set('color', e.target.value)} /></Field>
        <Field label="Notes"><Textarea value={b.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
