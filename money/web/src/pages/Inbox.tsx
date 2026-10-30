import { BatteryCharging, BellRing, Check, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../components/Shell';
import { Badge, Card, Empty, cx } from '../components/ui';
import { dismissCapture, updateSettings } from '../lib/actions';
import { draftFromCapture } from '../lib/capture';
import { ago } from '../lib/dates';
import { native, on, platform, type CaptureStatus } from '../lib/native';
import { DEFAULT_ALLOWLIST, SOURCE_APPS } from '../lib/parse/sources';
import { takeCaptures, toast } from '../lib/session';
import { openTxn } from '../ui-state';
import { useSnap } from './Home';

function PhoneCapture() {
  const [st, setSt] = useState<CaptureStatus | null>(null);
  const [allow, setAllow] = useState<string[]>([]);
  const load = useCallback(async () => {
    try {
      const s = await native.captureStatus();
      setSt(s);
      setAllow(s.allowlist.length ? s.allowlist : DEFAULT_ALLOWLIST);
    } catch { setSt(null); }
  }, []);
  useEffect(() => { void load(); return on('resume', () => void load()); }, [load]);
  if (!st) return null;
  const apps = [
    ...SOURCE_APPS.map((a) => ({ pkg: a.pkg, label: a.name, note: a.check ? 'name not confirmed' : '' })),
    ...st.seen.filter((s) => !SOURCE_APPS.some((a) => a.pkg === s.pkg)).map((s) => ({ pkg: s.pkg, label: s.label, note: `${s.count} notifications seen` })),
  ];
  return (
    <Card title="Phone capture" action={st.access ? <Badge tone="good"><Check size={12} /> On</Badge> : <Badge tone="bad">Off</Badge>}>
      {!st.access ? (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-muted">Let Money Hub read notifications from your bank, card and e-wallet apps and bank texts. Everything else is ignored on the phone and never stored. One-time PINs are always dropped.</p>
          <button className="btn-primary w-full sm:w-auto" onClick={() => void native.captureOpenAccess()}><BellRing size={18} /> Turn on notification access</button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted">{st.queued ? `${st.queued} waiting to be added. ` : ''}Captured items are sealed on the phone until this app opens them.</p>
          <div>
            <div className="label mb-2">Apps to listen to</div>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {apps.map((a) => (
                <li key={a.pkg}>
                  <label className="flex items-center gap-3 px-3 py-2.5 text-sm">
                    <input type="checkbox" className="h-4 w-4 accent-[#FFB03A]" checked={allow.includes(a.pkg)}
                      onChange={(e) => setAllow((xs) => (e.target.checked ? [...xs, a.pkg] : xs.filter((x) => x !== a.pkg)))} />
                    <span className="flex-1">{a.label}</span>
                    {a.note && <span className="text-xs text-faint">{a.note}</span>}
                  </label>
                </li>
              ))}
            </ul>
            <button className="btn-outline mt-3" onClick={async () => { await native.captureSetAllowlist(allow); toast('Saved.'); void load(); }}>Save app list</button>
          </div>
          <button className="btn-ghost text-sm text-muted" onClick={() => void native.captureOpenBattery()}>
            <BatteryCharging size={17} /> Samsung: let Money Hub run in the background
          </button>
        </div>
      )}
    </Card>
  );
}

export function Inbox() {
  const snap = useSnap();
  const [busy, setBusy] = useState(false);
  const review = snap.captures.filter((c) => c.status === 'review');
  const recent = snap.captures.filter((c) => c.status === 'added' || c.status === 'duplicate').slice(0, 25);

  return (
    <>
      <PageHeader title="Captured" subtitle="Transactions read from your phone's notifications and bank texts" actions={
        <button className="btn-outline" disabled={busy} onClick={async () => { setBusy(true); const n = await takeCaptures(); setBusy(false); if (!n) toast('Nothing new.'); }}>
          <RefreshCw size={17} className={busy ? 'animate-spin' : ''} /> Check now
        </button>
      } />
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Card title={`To review${review.length ? ` (${review.length})` : ''}`}>
            {review.length ? (
              <ul className="space-y-3">
                {review.map((c) => (
                  <li key={c.id} className="rounded-xl border border-line bg-ink-2 p-3">
                    <div className="flex items-center justify-between gap-2 text-xs text-muted"><span>{c.app} · {c.title}</span><span>{ago(c.capturedAt)}</span></div>
                    <p className="mt-1.5 text-sm leading-relaxed">{c.text}</p>
                    {c.reason && <p className="mt-1.5 text-xs text-signal">{c.reason}</p>}
                    <div className="mt-3 flex gap-2">
                      <button className="btn-primary px-3 py-2 text-sm" onClick={() => openTxn(draftFromCapture(c))}>Add it</button>
                      <button className="btn-ghost px-3 py-2 text-sm text-muted" onClick={() => void dismissCapture(c)}>Ignore</button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <Empty icon={<ShieldCheck />} title="Nothing to check" text="When a notification is unclear (a new card, a payment from an unknown account), it waits here." />}
          </Card>
          <Card title="Recently captured">
            {recent.length ? (
              <ul className="divide-y divide-line">
                {recent.map((c) => {
                  const t = snap.txns.find((x) => x.id === c.txnId);
                  return (
                    <li key={c.id} className="flex items-start gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-muted">{c.app} · {ago(c.capturedAt)}</div>
                        <p className="truncate text-sm">{c.text}</p>
                      </div>
                      {c.status === 'duplicate' ? <Badge>Duplicate</Badge> : t ? <button className="text-xs text-current" onClick={() => openTxn(t)}>View</button> : null}
                    </li>
                  );
                })}
              </ul>
            ) : <Empty title="No captures yet" text="Once phone capture is on, payments and transfers appear here within seconds." />}
          </Card>
        </div>
        <div className="space-y-4">
          {platform === 'android' ? <PhoneCapture /> : (
            <Card title="Phone capture">
              <div className="flex gap-3 text-sm leading-relaxed text-muted">
                <Smartphone className="mt-0.5 shrink-0 text-current" size={20} />
                <p>Capture runs in the Android app on your phone. What it captures lands here and in your transactions automatically, even while the phone app is closed.</p>
              </div>
            </Card>
          )}
          <Card title="Adding automatically">
            <label className="flex items-start gap-3 text-sm leading-relaxed">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-[#FFB03A]" checked={snap.settings.autoAdd} onChange={(e) => void updateSettings({ autoAdd: e.target.checked })} />
              <span>Add clear transactions straight away (marked <span className="text-signal">New</span> until you open them). Unclear ones always wait in To review.</span>
            </label>
          </Card>
        </div>
      </div>
    </>
  );
}

export function More() {
  const review = useSnap().captures.filter((c) => c.status === 'review').length;
  const items = [
    { to: '#/debts', label: 'Debts & bills', text: 'Cards, loans and the payment schedule' },
    { to: '#/analytics', label: 'Analytics', text: 'Trends, income by client, net worth, forecast' },
    { to: '#/inbox', label: 'Captured', text: 'Phone capture and items to review', badge: review },
    { to: '#/settings', label: 'Settings & security', text: 'Fingerprint, sync, backup, PayPal, import' },
  ];
  return (
    <>
      <PageHeader title="More" />
      <Card pad={false} className="divide-y divide-line">
        {items.map((i) => (
          <a key={i.to} href={i.to} className="flex items-center gap-3 px-4 py-4 hover:bg-ink-4">
            <div className="flex-1">
              <div className="font-medium">{i.label}</div>
              <div className="text-xs text-muted">{i.text}</div>
            </div>
            {!!i.badge && <span className={cx('chip bg-signal text-ink')}>{i.badge}</span>}
          </a>
        ))}
      </Card>
    </>
  );
}
