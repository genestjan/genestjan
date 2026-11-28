// Customer messages: pick a trigger, edit the text, open SMS / Viber / Messenger, then log it.
import { useEffect, useMemo, useState } from 'react';
import { Send } from 'lucide-react';
import { db } from '@/data/db';
import { logNotification } from '@/data/actions';
import { useLiveQuery, useSettings } from '@/data/hooks';
import { jobTotals } from '@/domain/jobs';
import { TRIGGERS, channelLink, messageFor, type NotifyVars } from '@/domain/notify';
import type { Channel, NotifyTrigger } from '@/domain/types';
import { Badge, Button, Modal, Segmented, Textarea, run, toast } from '@/ui/kit';
import { bikeLabel } from './helpers';

const CHANNELS: { value: Channel; label: string }[] = [
  { value: 'sms', label: 'SMS' },
  { value: 'viber', label: 'Viber' },
  { value: 'messenger', label: 'Messenger' },
];

export interface NotifyPanelProps {
  workOrderId: string | null;
  customerId: string;
  /** Trigger to select first. */
  trigger?: NotifyTrigger;
  /** For quotes that have no job yet. */
  estimate?: { ref: string; bikeId: string | null; total: number };
  onSent?: () => void;
}

export function NotifyPanel({ workOrderId, customerId, trigger: first, estimate, onSent }: NotifyPanelProps) {
  const customer = useLiveQuery(() => db.customers.get(customerId), [customerId]);
  const job = useLiveQuery(() => (workOrderId ? db.workOrders.get(workOrderId) : undefined), [workOrderId]);
  const bike = useLiveQuery(async () => {
    const id = job?.bikeId ?? estimate?.bikeId;
    return id ? db.bikes.get(id) : undefined;
  }, [job?.bikeId, estimate?.bikeId]);
  const history = useLiveQuery(() => db.notifications.where('customerId').equals(customerId).toArray(), [customerId], []);
  const settings = useSettings();

  const [trigger, setTrigger] = useState<NotifyTrigger>(first ?? (estimate ? 'estimate_ready' : 'appointment_confirmed'));
  const [channel, setChannel] = useState<Channel | null>(null);
  const [edited, setEdited] = useState<string | null>(null);
  const ch: Channel = channel ?? customer?.channel ?? 'sms';

  useEffect(() => {
    if (first) {
      setTrigger(first);
      setEdited(null);
    }
  }, [first]);

  const vars: NotifyVars = useMemo(
    () => ({
      shop: settings?.shopName ?? 'Bikemoko',
      customer: customer?.name ?? '',
      bike: bike ? bikeLabel(bike) : 'bike',
      jobNo: job?.jobNo ?? estimate?.ref ?? '',
      total: job ? jobTotals(job.lines).total : estimate?.total,
      when: job ? new Date(job.scheduledStart).toLocaleString('en-PH', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : undefined,
      phone: customer?.phone,
    }),
    [settings?.shopName, customer, bike, job, estimate?.ref, estimate?.total],
  );
  const generated = messageFor(trigger, vars);
  const body = edited ?? generated;

  const rows = history.filter((h) => h.workOrderId === workOrderId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const send = async () => {
    if (!customer) throw new Error('Customer not found');
    if (!body.trim()) throw new Error('Write a message first');
    if (ch === 'sms' && !customer.phone) throw new Error('This customer has no phone number');
    if (ch === 'viber' && !customer.phone) throw new Error('This customer has no phone number');
    if (ch === 'messenger') {
      try {
        await navigator.clipboard.writeText(body);
        toast.info('Message copied. Paste it in Messenger.');
      } catch {
        toast.info('Could not copy automatically. Copy the text by hand.');
      }
      window.open(channelLink('messenger', customer.messenger, body), '_blank', 'noopener');
    } else if (ch === 'sms') {
      window.location.href = channelLink('sms', customer.phone, body);
    } else {
      window.location.href = channelLink('viber', customer.phone, body);
    }
    await logNotification(customer.id, workOrderId, ch, trigger, body);
    setEdited(null);
    onSent?.();
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(TRIGGERS) as NotifyTrigger[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTrigger(t);
              setEdited(null);
            }}
            className={`min-h-[40px] rounded-xl border px-3 text-[13px] font-semibold transition ${t === trigger ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-raised text-muted hover:text-ink'}`}
          >
            {TRIGGERS[t]}
          </button>
        ))}
      </div>
      <Textarea aria-label="Message" value={body} onChange={(e) => setEdited(e.target.value)} className="min-h-[120px]" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented value={ch} onChange={setChannel} options={CHANNELS} />
        <Button variant="primary" icon={<Send className="h-4 w-4" />} disabled={!customer} onClick={() => run(send, 'Message logged')}>
          {ch === 'messenger' ? 'Copy and open Messenger' : `Open ${ch === 'sms' ? 'SMS' : 'Viber'}`}
        </Button>
      </div>
      <p className="text-xs text-faint">Your phone opens with the message ready. Press send there. We log it here once you tap the button.</p>
      <div>
        <div className="mb-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-faint">History</div>
        {rows.length ? (
          <ul className="grid gap-2">
            {rows.map((h) => (
              <li key={h.id} className="rounded-xl border border-line bg-raised p-3 text-sm">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge tone="info">{TRIGGERS[h.trigger]}</Badge>
                  <Badge>{h.channel}</Badge>
                  <span className="num text-xs text-faint">{new Date(h.createdAt).toLocaleString('en-PH')}</span>
                </div>
                <p className="text-muted">{h.body}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No messages sent yet.</p>
        )}
      </div>
    </div>
  );
}

/** Pop-up wrapper used when a job moves to waiting for parts or ready, and when a quote is sent. */
export function NotifyModal({ open, onClose, title = 'Tell the customer?', ...props }: NotifyPanelProps & { open: boolean; onClose: () => void; title?: string }) {
  return (
    <Modal open={open} onClose={onClose} title={title} wide>
      <NotifyPanel {...props} />
    </Modal>
  );
}
