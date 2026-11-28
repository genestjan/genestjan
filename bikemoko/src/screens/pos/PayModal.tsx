import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Badge, Button, Field, Input, Modal, Money, MoneyInput, cx } from '@/ui/kit';
import { PAY_METHODS, settle } from '@/domain/payments';
import type { Centavos, PayMethod, Payment } from '@/domain/types';
import { cashChips } from './helpers';

interface Props {
  open: boolean;
  due: Centavos;
  busy: boolean;
  noShift: boolean;
  onClose: () => void;
  onConfirm: (payments: Payment[]) => void;
}

export function PayModal({ open, due, busy, noShift, onClose, onConfirm }: Props) {
  const [list, setList] = useState<Payment[]>([]);
  const [method, setMethod] = useState<PayMethod>('cash');
  const [amt, setAmt] = useState<number | null>(null);
  const [ref, setRef] = useState('');

  const addedPaid = list.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, due - addedPaid);
  const entry = amt ?? remaining;
  const pending: Payment[] = entry > 0 ? [{ method, amount: entry, ref: method === 'cash' ? '' : ref.trim() }] : [];
  const effective = [...list, ...pending];
  const st = settle(due, effective);
  const nonCashOver = effective.some((p) => p.method !== 'cash') && st.paid > due && st.change === 0;
  const needsRef = pending[0] && pending[0].method !== 'cash' && !pending[0].ref;
  const canConfirm = (st.ok || due === 0) && !busy;

  const reset = () => {
    setList([]);
    setMethod('cash');
    setAmt(null);
    setRef('');
  };
  const addPayment = () => {
    if (!pending.length) return;
    setList([...list, ...pending]);
    setAmt(null);
    setRef('');
  };
  const close = () => {
    reset();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Take payment"
      footer={
        <>
          <Button variant="ghost" onClick={close} className="shrink-0">
            Back
          </Button>
          <Button variant="primary" size="lg" block disabled={!canConfirm} loading={busy} onClick={() => onConfirm(effective)}>
            {st.change > 0 ? 'Confirm, give change' : 'Confirm payment'}
          </Button>
        </>
      }
    >
      <div className="rounded-2xl bg-raised p-4 text-center">
        <div className="text-sm text-muted">Amount due</div>
        <Money value={due} className="font-display text-4xl font-bold" />
      </div>

      {noShift && (
        <div className="mt-3 rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-sm text-warn">
          No cash shift is open. You can still sell, but this sale will not count in any X or Z reading.
        </div>
      )}

      {list.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {list.map((p, i) => (
            <li key={i} className="flex items-center justify-between rounded-xl border border-line px-3 py-2 text-sm">
              <span>
                {PAY_METHODS.find((m) => m.id === p.method)?.label}
                {p.ref && <span className="text-faint"> ({p.ref})</span>}
              </span>
              <span className="flex items-center gap-2">
                <Money value={p.amount} strong />
                <button aria-label="Remove payment" className="text-faint hover:text-bad" onClick={() => setList(list.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 grid grid-cols-5 gap-1.5">
        {PAY_METHODS.map((m) => (
          <button
            key={m.id}
            onClick={() => setMethod(m.id)}
            className={cx(
              'h-12 rounded-xl border text-[13px] font-semibold transition',
              method === m.id ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-raised text-muted hover:text-ink',
            )}
          >
            {m.id === 'bank' ? 'Bank' : m.label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-3">
        <Field label="Amount">
          <MoneyInput key={list.length} value={entry} onChange={setAmt} autoFocus />
        </Field>
        {method === 'cash' && remaining > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {cashChips(remaining).map((c, i) => (
              <button key={c} onClick={() => setAmt(c)} className="h-10 rounded-xl border border-line bg-raised px-3 text-sm font-semibold hover:border-brand/50">
                {i === 0 ? 'Exact ' : ''}
                <Money value={c} />
              </button>
            ))}
          </div>
        )}
        {method !== 'cash' && (
          <Field label="Reference number" hint="From the customer's receipt or screen">
            <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. 1234 567 890" />
          </Field>
        )}
        <Button onClick={addPayment} disabled={!pending.length || st.paid >= due} className="justify-self-start">
          Add as split payment
        </Button>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-2xl border border-line p-3">
        {st.balance > 0 ? (
          <>
            <span className="text-sm text-muted">Still to pay</span>
            <Money value={st.balance} className="text-2xl font-bold text-warn" />
          </>
        ) : nonCashOver ? (
          <Badge tone="bad">Only cash can be more than the total</Badge>
        ) : (
          <>
            <span className="text-sm text-muted">{st.change > 0 ? 'Change to give' : 'Fully paid'}</span>
            <Money value={st.change} className="text-2xl font-bold text-ok" />
          </>
        )}
      </div>
      {needsRef && <p className="mt-2 text-xs text-faint">Tip: add the reference number so the payment can be traced later.</p>}
    </Modal>
  );
}
