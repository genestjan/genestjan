import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/data/db';
import { createJob } from '@/data/actions';
import { useLiveQuery, useServices } from '@/data/hooks';
import { jobTotals } from '@/domain/jobs';
import { BAYS, type Customer, type JobLine, type Staff } from '@/domain/types';
import { minsLabel, uid } from '@/domain/util';
import { Button, Drawer, Field, Input, Money, Select, cx, run, toast } from '@/ui/kit';
import { hhmm, isoAt, parseHhmm } from './timeline';

export interface Slot {
  mechanicId: string | null;
  bay: string;
  mins: number;
}

export function BookingDrawer({
  open, onClose, day, slot, mechanics, customers,
}: {
  open: boolean;
  onClose: () => void;
  day: Date;
  slot: Slot;
  mechanics: Staff[];
  customers: Customer[];
}) {
  const nav = useNavigate();
  const services = useServices().filter((s) => s.active);
  const bikes = useLiveQuery(() => db.bikes.toArray(), [], []);
  const [customerId, setCustomerId] = useState('');
  const [bikeId, setBikeId] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [mechanicId, setMechanicId] = useState<string>(slot.mechanicId ?? '');
  const [bay, setBay] = useState(slot.bay);
  const [time, setTime] = useState(hhmm(slot.mins));
  const [busy, setBusy] = useState(false);

  const chosen = services.filter((s) => picked.includes(s.id));
  const lines: JobLine[] = chosen.map((s) => ({ id: uid(), kind: 'labor', refId: s.id, name: s.name, qty: 1, unitPrice: s.laborFee, durationMins: s.durationMins }));
  const totals = jobTotals(lines);
  const custBikes = useMemo(() => bikes.filter((b) => b.customerId === customerId), [bikes, customerId]);

  const book = async () => {
    if (!customerId) return toast.bad('Pick a customer first');
    if (!chosen.length) return toast.bad('Pick at least one service');
    const start = parseHhmm(time);
    setBusy(true);
    const wo = await run(
      () =>
        createJob({
          estimateId: null,
          customerId,
          bikeId: bikeId || null,
          mechanicId: mechanicId || null,
          bay,
          scheduledStart: isoAt(day, start),
          scheduledEnd: isoAt(day, start + Math.max(15, totals.durationMins)),
          status: 'scheduled',
          lines,
          checklist: chosen.flatMap((s) => s.checklist).filter((v, i, a) => a.indexOf(v) === i).map((label) => ({ label, done: false })),
          complaint: chosen.map((s) => s.name).join(', '),
          intakeNotes: '',
          photos: [],
          deposit: 0,
        }),
      'Job booked',
    );
    setBusy(false);
    if (wo) onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Quick booking"
      sub={day.toLocaleDateString('en-PH', { weekday: 'long', day: 'numeric', month: 'long' })}
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" disabled={!customerId} onClick={() => nav(`/repairs/estimate/new?customer=${customerId}`)}>
            Open full estimate
          </Button>
          <Button className="ml-auto" disabled={busy} onClick={book}>
            Book job
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Customer">
          <Select value={customerId} onChange={(e) => { setCustomerId(e.target.value); setBikeId(''); }}>
            <option value="">Choose a customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name} {c.phone && `(${c.phone})`}</option>
            ))}
          </Select>
        </Field>
        <Field label="Bike">
          <Select value={bikeId} onChange={(e) => setBikeId(e.target.value)} disabled={!customerId}>
            <option value="">{custBikes.length ? 'Choose a bike' : 'No bikes saved'}</option>
            {custBikes.map((b) => (
              <option key={b.id} value={b.id}>{b.brand} {b.model}</option>
            ))}
          </Select>
        </Field>
        <Field label="Services" hint={chosen.length ? `${minsLabel(totals.durationMins)} of work` : 'Tap to add'}>
          <div className="space-y-2">
            {services.map((s) => {
              const on = picked.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPicked((p) => (on ? p.filter((x) => x !== s.id) : [...p, s.id]))}
                  className={cx('flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm', on ? 'border-brand bg-brand-soft' : 'border-line bg-raised')}
                >
                  <span>{s.name}</span>
                  <span className="num text-xs text-muted">{minsLabel(s.durationMins)} · <Money value={s.laborFee} /></span>
                </button>
              );
            })}
            {!services.length && <div className="text-sm text-muted">No services set up yet.</div>}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mechanic">
            <Select value={mechanicId} onChange={(e) => setMechanicId(e.target.value)}>
              <option value="">Unassigned</option>
              {mechanics.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Bay">
            <Select value={bay} onChange={(e) => setBay(e.target.value)}>
              {BAYS.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Start time">
          <Input type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        <div className="flex items-center justify-between rounded-xl bg-raised px-3 py-3 text-sm">
          <span className="text-muted">Labour total</span>
          <Money value={totals.total} strong />
        </div>
      </div>
    </Drawer>
  );
}
