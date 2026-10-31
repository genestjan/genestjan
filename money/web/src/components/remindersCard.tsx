import { BellRing, CalendarDays, Clock } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { ago } from '../lib/dates';
import { hasNative, native, on, platform } from '../lib/native';
import { deviceNotifications, reminderSettings, setDeviceNotifications } from '../lib/reminders';
import { refreshReminders, save, toast, useApp } from '../lib/session';
import { CalendarSheet } from './calendar';
import { Badge, Card, cx } from './ui';

const DAYS = [1, 2, 3, 5, 7, 10, 14];
const TIMES = ['06:00', '07:00', '08:00', '09:00', '10:00', '12:00', '15:00', '18:00', '20:00'];
const label = (t: string) => { const h = Number(t.slice(0, 2)); return `${h % 12 || 12}:00 ${h < 12 ? 'AM' : 'PM'}`; };

function Row({ icon, title, text, action }: { icon: ReactNode; title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink-5 text-muted">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-medium">{title}</div>
        {text && <div className="text-xs leading-relaxed text-muted">{text}</div>}
      </div>
      {action}
    </div>
  );
}

export function RemindersCard() {
  const snap = useApp((s) => s.snap)!;
  const demo = useApp((s) => s.demo);
  const calendarError = useApp((s) => s.calendarError);
  const opts = reminderSettings(snap.settings);
  const [calOpen, setCalOpen] = useState(false);
  const [onDevice, setOnDevice] = useState(deviceNotifications());
  const [granted, setGranted] = useState<boolean | null>(null);
  const [scheduled, setScheduled] = useState(0);

  useEffect(() => {
    if (!hasNative) return;
    const load = () => native.notifyStatus().then((s) => { setGranted(s.granted); setScheduled(s.scheduled); }).catch(() => setGranted(false));
    void load();
    return on('resume', () => void load());
  }, []);

  const change = async (patch: Partial<typeof opts>) => {
    await save([{ ...snap.settings, reminders: { ...opts, ...patch } }]);
    await refreshReminders();
  };

  async function toggleDevice() {
    const next = !onDevice;
    if (next && hasNative) {
      const { granted: ok } = await native.notifyPermission().catch(() => ({ granted: false }));
      setGranted(ok);
      if (!ok) {
        toast(platform === 'android' ? 'Allow notifications for Money Hub in your phone settings first.' : 'Turn on notifications for Money Hub in Windows Settings first.');
        return;
      }
    }
    setDeviceNotifications(next);
    setOnDevice(next);
    await refreshReminders();
    if (hasNative) native.notifyStatus().then((s) => setScheduled(s.scheduled)).catch(() => undefined);
  }

  const device = platform === 'android' ? 'this phone' : platform === 'windows' ? 'this laptop' : 'this browser';

  return (
    <Card title="Bill reminders">
      <div className="divide-y divide-line">
        <Row icon={<Clock size={18} />} title="When" text="How long before each bill's due date, and at what time."
          action={
            <div className="flex items-center gap-1.5">
              <select className="field w-auto py-2" value={opts.days} onChange={(e) => void change({ days: Number(e.target.value) })} aria-label="Days before">
                {DAYS.map((d) => <option key={d} value={d}>{d} day{d > 1 ? 's' : ''} before</option>)}
              </select>
              <select className="field w-auto py-2" value={opts.time} onChange={(e) => void change({ time: e.target.value })} aria-label="Time">
                {TIMES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
              </select>
            </div>
          } />
        <Row icon={<BellRing size={18} />} title={`Notifications on ${device}`}
          text={!hasNative ? 'Works in the phone and Windows apps.'
            : granted === false && onDevice ? <span className="text-expense">Notifications are blocked for Money Hub. Allow them in your {platform === 'android' ? 'phone' : 'Windows'} settings.</span>
              : onDevice ? `${scheduled} reminder${scheduled === 1 ? '' : 's'} scheduled. They arrive even when Money Hub is closed.`
                : 'Off on this device.'}
          action={hasNative && !demo ? (
            <div className="flex gap-1.5">
              {onDevice && <button className="btn-ghost px-3 py-2 text-sm" onClick={() => void native.notifyTest().catch((e: Error) => toast(e.message))}>Test</button>}
              <button className={cx('px-3 py-2 text-sm', onDevice ? 'btn-outline' : 'btn-primary')} onClick={() => void toggleDevice()}>{onDevice ? 'Turn off' : 'Turn on'}</button>
            </div>
          ) : undefined} />
        <Row icon={<CalendarDays size={18} />} title="Google Calendar"
          text={opts.calendar
            ? calendarError ? <span className="text-expense">{calendarError}</span>
              : <>All-day events in your <span className="text-paper">Money Hub bills</span> calendar{opts.calendar.lastSync ? `, updated ${ago(opts.calendar.lastSync)}` : ''}.</>
            : `An all-day event on the reminder day, ${opts.days} days before each bill.`}
          action={
            <div className="flex items-center gap-2">
              {opts.calendar && !calendarError && <Badge tone="good">On</Badge>}
              <button className="btn-outline px-3 py-2 text-sm" disabled={demo} onClick={() => setCalOpen(true)}>{opts.calendar ? 'Manage' : 'Set up'}</button>
            </div>
          } />
      </div>
      {calOpen && <CalendarSheet onClose={() => setCalOpen(false)} />}
    </Card>
  );
}
