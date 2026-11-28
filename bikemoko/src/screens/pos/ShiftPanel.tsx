import { useState } from 'react';
import { Badge, Button, Field, Modal, Money, MoneyInput, Stat, run } from '@/ui/kit';
import { db } from '@/data/db';
import { useLiveQuery } from '@/data/hooks';
import { closeShift, openShift } from '@/data/actions';
import { PAY_METHODS } from '@/domain/payments';
import type { Shift, Staff } from '@/domain/types';
import { overShort, reading } from './helpers';

export function ShiftPanel({ open, onClose, shift, staff }: { open: boolean; onClose: () => void; shift: Shift | null; staff: Staff | null }) {
  const [cash, setCash] = useState(0);
  const [counted, setCounted] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ counted: number; expected: number } | null>(null);
  const sales = useLiveQuery(() => (shift ? db.sales.where('shiftId').equals(shift.id).toArray() : []), [shift?.id]) ?? [];
  const r = shift ? reading(shift, sales) : null;

  const close = () => {
    setDone(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={close} title={shift ? 'Shift and X-reading' : done ? 'Shift closed (Z-reading)' : 'Open a shift'}>
      {done ? (
        <div className="space-y-3">
          <Stat label="Expected cash" value={<Money value={done.expected} />} />
          <Stat label="Counted cash" value={<Money value={done.counted} />} />
          <OverShort diff={overShort(done.counted, done.expected)} />
          <Button block variant="primary" onClick={close}>
            Done
          </Button>
        </div>
      ) : !shift || !r ? (
        <div className="space-y-4">
          <p className="text-sm text-muted">Count the cash in the drawer and enter it to start the day.</p>
          <Field label="Opening cash">
            <MoneyInput value={cash} onChange={setCash} autoFocus />
          </Field>
          <Button
            block
            size="lg"
            variant="primary"
            loading={busy}
            disabled={!staff}
            onClick={async () => {
              if (!staff) return;
              setBusy(true);
              await run(() => openShift(staff.id, cash), 'Shift opened');
              setBusy(false);
              setCash(0);
            }}
          >
            Open shift
          </Button>
          {!staff && <p className="text-xs text-faint">Choose who is using this device first.</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Sales" value={r.sales} hint={`Since ${new Date(shift.openedAt).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}`} />
            <Stat label="Total sold" value={<Money value={r.total} />} />
          </div>
          <div className="rounded-2xl border border-line">
            {PAY_METHODS.map((m) => (
              <div key={m.id} className="flex justify-between border-b border-line/70 px-4 py-2.5 text-sm last:border-0">
                <span className="text-muted">{m.label}</span>
                <Money value={r.byMethod[m.id]} strong />
              </div>
            ))}
          </div>
          <div className="rounded-2xl bg-raised p-4 text-sm">
            <Line k="Opening cash" v={shift.openingCash} />
            <Line k="Cash sales" v={r.cashSales} />
            <Line k="Change given" v={-r.change} />
            <div className="mt-2 flex justify-between border-t border-line pt-2 text-base font-bold">
              <span>Expected cash</span>
              <Money value={r.expectedCash} />
            </div>
          </div>
          <div className="border-t border-line pt-4">
            <h4 className="mb-2 font-semibold">Close shift (Z-reading)</h4>
            <Field label="Counted cash in drawer">
              <MoneyInput value={counted} onChange={setCounted} />
            </Field>
            <div className="mt-3">
              <OverShort diff={overShort(counted, r.expectedCash)} />
            </div>
            <Button
              block
              size="lg"
              variant="danger"
              className="mt-3"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                const ok = await run(async () => {
                  await closeShift(shift.id, counted);
                  return true;
                }, 'Shift closed');
                setBusy(false);
                if (ok) {
                  setDone({ counted, expected: r.expectedCash });
                  setCounted(0);
                }
              }}
            >
              Close shift
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Line({ k, v }: { k: string; v: number }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-muted">{k}</span>
      <Money value={v} />
    </div>
  );
}

function OverShort({ diff }: { diff: number }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-line px-4 py-3">
      <span className="text-sm text-muted">{diff === 0 ? 'Drawer balances' : diff > 0 ? 'Over' : 'Short'}</span>
      <span className="flex items-center gap-2">
        <Money value={Math.abs(diff)} className="text-xl font-bold" />
        <Badge tone={diff === 0 ? 'ok' : diff > 0 ? 'info' : 'bad'}>{diff === 0 ? 'OK' : diff > 0 ? 'Over' : 'Short'}</Badge>
      </span>
    </div>
  );
}
