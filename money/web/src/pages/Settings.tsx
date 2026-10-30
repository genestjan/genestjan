import {
  Cloud, Download, ExternalLink, FileSpreadsheet, Fingerprint, KeyRound, Link2, Lock, LogOut, RefreshCw, ShieldCheck, Upload,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { PageHeader } from '../components/Shell';
import { Avatar, Badge, Card, ErrorText, Field, Sheet, Spinner } from '../components/ui';
import { encryptedBackup, saveTextFile, syncPayPal, transactionsCSV, updateSettings } from '../lib/actions';
import { ago } from '../lib/dates';
import { isLiability, type PayPalLink } from '../lib/model';
import { hasNative, native, platform } from '../lib/native';
import {
  changePassword, disableBio, enableBio, lock, signOutEverywhereOnThisDevice, syncNow, toast, useApp,
} from '../lib/session';
import { openImporter } from '../ui-state';
import { useSnap } from './Home';

const GUIDE = 'https://github.com/genestjan/genestjan/blob/main/money/SETUP.md';

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

export function SettingsPage() {
  const snap = useSnap();
  const meta = useApp((s) => s.meta);
  const sync = useApp((s) => s.sync);
  const bio = useApp((s) => s.bio);
  const demo = useApp((s) => s.demo);
  const [pwOpen, setPwOpen] = useState(false);
  const [ppOpen, setPpOpen] = useState(false);
  const [name, setName] = useState(snap.settings.displayName ?? '');
  const s = snap.settings;

  return (
    <>
      <PageHeader title="Settings & security" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={name || meta?.email || 'Jan'} size={56} />
            <div className="min-w-0 flex-1">
              <input className="w-full bg-transparent font-display text-lg font-bold outline-none" value={name} placeholder="Your name"
                onChange={(e) => setName(e.target.value)} onBlur={() => name !== (s.displayName ?? '') && void updateSettings({ displayName: name.trim() || undefined })} />
              <div className="truncate text-sm text-muted">{meta?.email || 'This device only'}</div>
            </div>
            <Badge tone="good"><ShieldCheck size={13} /> End-to-end encrypted</Badge>
          </div>
        </Card>

        <Card title="Connected accounts">
          <div className="divide-y divide-line">
            <Row icon={<Link2 size={18} />} title="Phone capture" text="GCash, Maya, BPI, BDO, UnionBank and other bank texts and app notifications, read on your Android phone."
              action={<a href="#/inbox" className="btn-outline px-3 py-2 text-sm">Open</a>} />
            <Row icon={<span className="font-display text-sm font-bold text-[#4d9fff]">P</span>} title="PayPal API"
              text={s.paypal ? `Connected${s.paypal.lastSync ? ` · synced ${ago(s.paypal.lastSync)}` : ''}` : 'Needs a free PayPal Business account and app keys.'}
              action={<button className="btn-outline px-3 py-2 text-sm" onClick={() => setPpOpen(true)}>{s.paypal ? 'Manage' : 'Connect'}</button>} />
            <Row icon={<span className="font-display text-sm font-bold text-[#9FE870]">W</span>} title="Wise"
              text="Wise does not let Philippine accounts read history by API. Its app notifications are captured; import CSV statements for older history." />
          </div>
        </Card>

        <Card title="Security">
          <div className="divide-y divide-line">
            {bio.available && (
              <Row icon={<Fingerprint size={18} />} title={`${bio.label || 'Fingerprint'} unlock`} text="Unlock without typing your password on this device."
                action={<button className="btn-outline px-3 py-2 text-sm" onClick={() => void (bio.enrolled ? disableBio() : enableBio())}>{bio.enrolled ? 'Turn off' : 'Turn on'}</button>} />
            )}
            <Row icon={<Lock size={18} />} title="Lock automatically" text="After this long without use."
              action={
                <select className="field w-auto py-2" value={s.lockMinutes} onChange={(e) => void updateSettings({ lockMinutes: Number(e.target.value) })}>
                  {[1, 3, 5, 10, 30].map((m) => <option key={m} value={m}>{m} min</option>)}
                </select>
              } />
            {!demo && <Row icon={<KeyRound size={18} />} title="Change password" text="Re-locks your data key; your data is not re-uploaded."
              action={<button className="btn-outline px-3 py-2 text-sm" onClick={() => setPwOpen(true)}>Change</button>} />}
            {!demo && <Row icon={<Lock size={18} />} title="Lock now" action={<button className="btn-outline px-3 py-2 text-sm" onClick={lock}>Lock</button>} />}
          </div>
        </Card>

        <Card title="Sync & backup">
          <div className="divide-y divide-line">
            <Row icon={<Cloud size={18} />} title={meta?.mode === 'cloud' ? 'Encrypted cloud sync' : 'This device only'}
              text={meta?.mode === 'cloud'
                ? sync.state === 'error' ? <span className="text-expense">{sync.detail}</span> : sync.at ? `Last synced ${ago(sync.at)}. Every change syncs within seconds.` : 'Waiting for the first sync.'
                : 'Nothing leaves this device. Export a backup now and then.'}
              action={meta?.mode === 'cloud' ? <button className="btn-outline px-3 py-2 text-sm" onClick={() => void syncNow()}>{sync.state === 'syncing' ? <Spinner size={16} /> : <RefreshCw size={16} />} Sync</button> : undefined} />
            <Row icon={<Download size={18} />} title="Export transactions" text="A CSV file for Google Sheets or your accountant."
              action={<button className="btn-outline px-3 py-2 text-sm" onClick={() => void saveTextFile(`money-hub-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv', transactionsCSV(snap))}>Export</button>} />
            {!demo && <Row icon={<ShieldCheck size={18} />} title="Encrypted backup" text="A file only your password or recovery key can open."
              action={<button className="btn-outline px-3 py-2 text-sm" onClick={async () => saveTextFile(`money-hub-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json', await encryptedBackup())}>Download</button>} />}
          </div>
        </Card>

        <Card title="Import">
          <div className="divide-y divide-line">
            <Row icon={<Upload size={18} />} title="Bank or wallet statement" text="CSV from your bank, GCash, PayPal or Wise. Duplicates are skipped."
              action={<button className="btn-outline px-3 py-2 text-sm" onClick={() => openImporter('statement')}>Import</button>} />
            <Row icon={<FileSpreadsheet size={18} />} title="Bills from Google Sheets" text="Your Budgeting tab, downloaded as CSV."
              action={<button className="btn-outline px-3 py-2 text-sm" onClick={() => openImporter('bills')}>Import</button>} />
          </div>
        </Card>

        <Card title="Money & display">
          <div className="divide-y divide-line">
            <Row icon={<span className="font-display text-sm font-bold">$</span>} title="US dollar rate" text={`Pesos per dollar for totals. ${s.ratesUpdatedAt ? `Updated ${ago(s.ratesUpdatedAt)} from the ECB.` : 'Updates daily when online.'}`}
              action={<input className="field w-24 py-2 text-right" inputMode="decimal" defaultValue={s.rates.USD ?? 58}
                onBlur={(e) => { const v = parseFloat(e.target.value); if (v > 0) void updateSettings({ rates: { ...s.rates, USD: v } }); }} />} />
            <Row icon={<ShieldCheck size={18} />} title="Hide balances" text="Show dots instead of amounts, for when someone is looking."
              action={<input type="checkbox" className="h-5 w-5 accent-[#FFB03A]" checked={s.hideBalances} onChange={(e) => void updateSettings({ hideBalances: e.target.checked })} />} />
          </div>
        </Card>

        <Card title="Help & support">
          <div className="divide-y divide-line">
            <Row icon={<ExternalLink size={18} />} title="Setup guide" text="Step by step: cloud, phone capture, PayPal, Windows."
              action={<button className="btn-outline px-3 py-2 text-sm" onClick={() => void native.openUrl(GUIDE)}>Open</button>} />
            <Row icon={<span className="text-xs font-semibold">v</span>} title="Version" text={`${__APP_VERSION__} · ${platform === 'android' ? 'Android' : platform === 'windows' ? 'Windows' : 'Browser'}`} />
            {!demo && <Row icon={<LogOut size={18} />} title="Remove from this device" text="Signs out and deletes the local copy. Your cloud copy stays."
              action={<button className="btn-danger px-3 py-2 text-sm" onClick={() => { if (confirm('Remove Money Hub data from this device?')) void signOutEverywhereOnThisDevice(); }}>Remove</button>} />}
          </div>
        </Card>
      </div>

      <PasswordSheet open={pwOpen} onClose={() => setPwOpen(false)} />
      {ppOpen && <PayPalSheet onClose={() => setPpOpen(false)} />}
    </>
  );
}

function PasswordSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const error = useApp((s) => s.error);
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const ok = next.length >= 12 && next === again && !!cur;
  return (
    <Sheet open={open} onClose={onClose} title="Change password"
      footer={<button className="btn-primary w-full" disabled={!ok} onClick={async () => { if (await changePassword(cur, next)) { setCur(''); setNext(''); setAgain(''); onClose(); } }}>Change password</button>}>
      <div className="space-y-4">
        <Field label="Current password"><input className="field" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></Field>
        <Field label="New password" hint="At least 12 characters."><input className="field" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
        <Field label="New password again"><input className="field" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} /></Field>
        <p className="text-xs text-faint">Your recovery key keeps working. Other devices ask for the new password next time they unlock.</p>
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}

function PayPalSheet({ onClose }: { onClose: () => void }) {
  const snap = useSnap();
  const link = snap.settings.paypal;
  const [v, setV] = useState<PayPalLink>(link ?? { clientId: '', secret: '', env: 'live' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const paypalAccounts = snap.accounts.filter((a) => a.institution === 'paypal' && !a.archived);
  const banks = snap.accounts.filter((a) => !isLiability(a) && a.institution !== 'paypal' && !a.archived);
  return (
    <Sheet open onClose={onClose} title="Connect PayPal"
      footer={
        <div className="flex gap-2">
          {link && <button className="btn-danger" onClick={async () => { await updateSettings({ paypal: undefined }); toast('PayPal disconnected.'); onClose(); }}>Disconnect</button>}
          <button className="btn-primary flex-1" disabled={busy || !v.clientId || !v.secret} onClick={async () => {
            setBusy(true); setErr(null);
            try {
              await updateSettings({ paypal: { ...v, clientId: v.clientId.trim(), secret: v.secret.trim() } });
              const n = await syncPayPal();
              toast(`PayPal connected. ${n} transactions added.`);
              onClose();
            } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
          }}>{busy ? <Spinner /> : null} Save and sync</button>
        </div>
      }>
      <div className="space-y-4">
        {!hasNative && <ErrorText>PayPal sync works in the phone and Windows apps, not in a browser.</ErrorText>}
        <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed text-muted">
          <li>Go to developer.paypal.com and log in with your PayPal Business account.</li>
          <li>Apps & Credentials, switch to Live, Create App.</li>
          <li>In the app's features, tick Transaction search. Save.</li>
          <li>Copy the Client ID and Secret here. They are encrypted with your other data.</li>
        </ol>
        <Field label="Client ID"><input className="field font-mono text-sm" value={v.clientId} onChange={(e) => setV({ ...v, clientId: e.target.value })} spellCheck={false} /></Field>
        <Field label="Secret"><input className="field font-mono text-sm" type="password" value={v.secret} onChange={(e) => setV({ ...v, secret: e.target.value })} spellCheck={false} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="PayPal account in Money Hub">
            <select className="field" value={v.accountId ?? ''} onChange={(e) => setV({ ...v, accountId: e.target.value || undefined })}>
              <option value="">{paypalAccounts.length ? 'Choose' : 'Add one under Accounts first'}</option>
              {paypalAccounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
            </select>
          </Field>
          <Field label="Withdrawals land in">
            <select className="field" value={v.withdrawTo ?? ''} onChange={(e) => setV({ ...v, withdrawTo: e.target.value || undefined })}>
              <option value="">Skip withdrawals</option>
              {banks.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
        </div>
        <ErrorText>{err}</ErrorText>
      </div>
    </Sheet>
  );
}
