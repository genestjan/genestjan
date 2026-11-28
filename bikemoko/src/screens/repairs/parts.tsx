// Small shared pieces for the Repairs screens.
import { useEffect, useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { db } from '@/data/db';
import { useCustomers, useLiveQuery, useStaff } from '@/data/hooks';
import { bookedMins } from '@/domain/jobs';
import { nowISO, uid, minsLabel } from '@/domain/util';
import type { Channel, Customer, CustomerBike, Staff } from '@/domain/types';
import { BAYS } from '@/domain/types';
import { Button, Field, Input, Modal, Select, cx, run } from '@/ui/kit';
import { bikeLabel } from './helpers';

export function useNow(everyMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

export function Confirm({ open, title, children, confirmLabel = 'Yes', onConfirm, onClose }: { open: boolean; title: string; children?: ReactNode; confirmLabel?: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button className="flex-1" onClick={onClose}>
            Keep it
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={() => {
              onClose();
              onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">{children}</p>
    </Modal>
  );
}

export function MechAvatar({ staff, size = 28 }: { staff?: Staff | null; size?: number }) {
  return (
    <span
      title={staff?.name ?? 'No mechanic'}
      className={cx('grid shrink-0 place-items-center rounded-full text-[11px] font-bold', !staff && 'bg-raised text-faint')}
      style={{ width: size, height: size, ...(staff ? { backgroundColor: staff.color, color: 'white' } : {}) }}
    >
      {staff ? staff.name.slice(0, 1).toUpperCase() : '?'}
    </span>
  );
}

const outbox = (action: string, payload: unknown) => db.outbox.add({ action, payload, createdAt: nowISO(), syncedAt: null, error: null });

/** Customer and bike pickers with inline "new" forms. */
export function CustomerBikePicker({ customerId, bikeId, onChange, disabled }: { customerId: string; bikeId: string | null; onChange: (customerId: string, bikeId: string | null) => void; disabled?: boolean }) {
  const customers = useCustomers();
  const bikes = useLiveQuery(() => (customerId ? db.bikes.where('customerId').equals(customerId).toArray() : Promise.resolve([] as CustomerBike[])), [customerId], [] as CustomerBike[]);
  const [newCust, setNewCust] = useState(false);
  const [newBike, setNewBike] = useState(false);
  const [c, setC] = useState({ name: '', phone: '', channel: 'sms' as Channel });
  const [b, setB] = useState({ brand: '', model: '', serial: '', color: '' });
  const sorted = [...customers].sort((x, y) => x.name.localeCompare(y.name));

  const saveCustomer = async () => {
    if (!c.name.trim()) throw new Error('Enter the customer name');
    const row: Customer = { id: uid(), name: c.name.trim(), phone: c.phone.trim(), messenger: '', channel: c.channel, notes: '', createdAt: nowISO() };
    await db.customers.add(row);
    await outbox('save_customer', row);
    setNewCust(false);
    setC({ name: '', phone: '', channel: 'sms' });
    onChange(row.id, null);
  };
  const saveBike = async () => {
    if (!b.brand.trim() && !b.model.trim()) throw new Error('Enter the bike brand or model');
    const row: CustomerBike = { id: uid(), customerId, brand: b.brand.trim(), model: b.model.trim(), serial: b.serial.trim(), color: b.color.trim(), notes: '' };
    await db.bikes.add(row);
    await outbox('save_bike', row);
    setNewBike(false);
    setB({ brand: '', model: '', serial: '', color: '' });
    onChange(customerId, row.id);
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <Field label="Customer">
          <Select disabled={disabled} value={customerId} onChange={(e) => onChange(e.target.value, null)}>
            <option value="">Choose a customer</option>
            {sorted.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name} {x.phone && `(${x.phone})`}
              </option>
            ))}
          </Select>
        </Field>
        {!disabled && (
          <Button size="sm" variant="ghost" className="mt-1" icon={<Plus className="h-4 w-4" />} onClick={() => setNewCust(true)}>
            New customer
          </Button>
        )}
      </div>
      <div>
        <Field label="Bike">
          <Select disabled={disabled || !customerId} value={bikeId ?? ''} onChange={(e) => onChange(customerId, e.target.value || null)}>
            <option value="">{customerId ? 'No bike chosen' : 'Pick a customer first'}</option>
            {bikes.map((x) => (
              <option key={x.id} value={x.id}>
                {bikeLabel(x)} {x.color && `(${x.color})`}
              </option>
            ))}
          </Select>
        </Field>
        {!disabled && customerId && (
          <Button size="sm" variant="ghost" className="mt-1" icon={<Plus className="h-4 w-4" />} onClick={() => setNewBike(true)}>
            New bike
          </Button>
        )}
      </div>

      <Modal
        open={newCust}
        onClose={() => setNewCust(false)}
        title="New customer"
        footer={
          <Button variant="primary" block onClick={() => run(saveCustomer, 'Customer added')}>
            Save customer
          </Button>
        }
      >
        <div className="grid gap-3">
          <Field label="Name">
            <Input autoFocus value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
          </Field>
          <Field label="Phone">
            <Input inputMode="tel" value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} placeholder="0917 123 4567" />
          </Field>
          <Field label="Preferred channel">
            <Select value={c.channel} onChange={(e) => setC({ ...c, channel: e.target.value as Channel })}>
              <option value="sms">SMS</option>
              <option value="messenger">Messenger</option>
              <option value="viber">Viber</option>
            </Select>
          </Field>
        </div>
      </Modal>

      <Modal
        open={newBike}
        onClose={() => setNewBike(false)}
        title="New bike"
        footer={
          <Button variant="primary" block onClick={() => run(saveBike, 'Bike added')}>
            Save bike
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Brand">
            <Input autoFocus value={b.brand} onChange={(e) => setB({ ...b, brand: e.target.value })} />
          </Field>
          <Field label="Model">
            <Input value={b.model} onChange={(e) => setB({ ...b, model: e.target.value })} />
          </Field>
          <Field label="Serial number">
            <Input value={b.serial} onChange={(e) => setB({ ...b, serial: e.target.value })} />
          </Field>
          <Field label="Colour">
            <Input value={b.color} onChange={(e) => setB({ ...b, color: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

export interface ScheduleValue {
  mechanicId: string;
  bay: string;
  start: string; // datetime-local value
}

/** Mechanic (with booked hours today), bay and start time. */
export function ScheduleFields({ value, onChange }: { value: ScheduleValue; onChange: (v: ScheduleValue) => void }) {
  const staff = useStaff();
  const jobs = useLiveQuery(() => db.workOrders.toArray(), [], []);
  const mechanics = staff.filter((s) => s.role === 'mechanic' && s.active);
  const day = value.start ? new Date(value.start) : new Date();
  return (
    <div className="grid gap-4">
      <div>
        <div className="mb-1.5 text-[13px] font-medium text-muted">Mechanic</div>
        <div className="grid gap-2">
          {mechanics.map((m) => {
            const booked = Math.round(bookedMins(jobs, m.id, day));
            const pct = Math.min(100, Math.round((booked / Math.max(1, m.dailyCapacityMins)) * 100));
            const on = value.mechanicId === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onChange({ ...value, mechanicId: m.id })}
                className={cx('flex min-h-[44px] items-center gap-3 rounded-xl border px-3 py-2 text-left transition', on ? 'border-brand bg-brand-soft' : 'border-line bg-raised hover:border-faint/40')}
              >
                <MechAvatar staff={m} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{m.name}</div>
                  <div className="num text-xs text-muted">
                    {minsLabel(booked)} booked of {minsLabel(m.dailyCapacityMins)} that day
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                    <div className={cx('h-full rounded-full', pct >= 100 ? 'bg-bad' : pct >= 75 ? 'bg-warn' : 'bg-ok')} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </button>
            );
          })}
          {!mechanics.length && <p className="text-sm text-muted">No mechanics set up yet. Add one in Settings.</p>}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Bay">
          <Select value={value.bay} onChange={(e) => onChange({ ...value, bay: e.target.value })}>
            {BAYS.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </Select>
        </Field>
        <Field label="Start">
          <Input type="datetime-local" value={value.start} onChange={(e) => onChange({ ...value, start: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}
