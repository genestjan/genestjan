import { Plus, Upload } from 'lucide-react';
import { PageHeader } from '../components/Shell';
import { Badge, Card, Empty, InstitutionBadge, Money, cx } from '../components/ui';
import { balances } from '../lib/compute';
import { ago, shortDate } from '../lib/dates';
import { accountTypeLabel, institution, isLiability, type Account } from '../lib/model';
import { platform } from '../lib/native';
import { openAccount, openImporter } from '../ui-state';
import { useSnap } from './Home';

const CAPTURED: string[] = ['gcash', 'maya', 'bpi', 'bdo', 'unionbank', 'metrobank', 'securitybank', 'rcbc', 'pnb', 'landbank', 'eastwest', 'chinabank', 'gotyme', 'seabank', 'wise', 'paypal'];

function status(a: Account, paypalLinked: boolean) {
  if (a.institution === 'paypal' && paypalLinked) return { tone: 'good' as const, text: 'API connected' };
  if (a.type !== 'loan' && CAPTURED.includes(a.institution)) return { tone: 'info' as const, text: 'Auto-capture' };
  return { tone: 'neutral' as const, text: 'Manual' };
}

export function Accounts() {
  const snap = useSnap();
  const bal = balances(snap);
  const live = snap.accounts.filter((a) => !a.archived);
  const last = (id: string) => snap.txns.find((t) => t.accountId === id || t.toAccountId === id);
  const linked = !!snap.settings.paypal;

  return (
    <>
      <PageHeader title="Accounts" subtitle="All your financial accounts in one place" actions={
        <>
          <button className="btn-outline hidden sm:inline-flex" onClick={() => openImporter('statement')}><Upload size={17} /> Import</button>
          <button className="btn-primary" onClick={() => openAccount()}><Plus size={18} /> Add account</button>
        </>
      } />
      {live.length === 0 ? (
        <Card><Empty title="No accounts yet" text="Add GCash, your BPI account, each credit card, Wise and PayPal. Captured notifications are matched to these." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {live.map((a) => {
              const inst = institution(a.institution);
              const v = bal.get(a.id) ?? 0;
              const owed = isLiability(a);
              return (
                <button key={a.id} onClick={() => openAccount(a)} className="relative overflow-hidden rounded-2xl p-4 text-left shadow-card transition hover:-translate-y-0.5"
                  style={{ background: `linear-gradient(145deg, ${inst.bg}, ${inst.bg}cc)`, color: inst.fg }}>
                  <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10" />
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/20 font-display text-[11px] font-bold">{inst.short}</span>
                    <span className="truncate text-[13px] font-semibold">{a.name}</span>
                  </div>
                  <Money value={owed ? Math.abs(v) : v} currency={a.currency} className="mt-5 block font-display text-[19px] font-bold" />
                  <div className="mt-0.5 text-[11px] opacity-80">{owed ? 'Outstanding balance' : 'Available balance'}{a.last4 ? ` · ••${a.last4}` : ''}</div>
                </button>
              );
            })}
          </div>

          <Card title="Account overview" className="mt-5" pad={false}>
            <div className="overflow-x-auto px-2 pb-2 sm:px-4">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr className="border-b border-line">
                    <th className="px-2 py-2.5 font-medium">Account</th>
                    <th className="px-2 py-2.5 font-medium">Type</th>
                    <th className="px-2 py-2.5 text-right font-medium">Balance / owed</th>
                    <th className="px-2 py-2.5 font-medium">Last activity</th>
                    <th className="px-2 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {live.map((a) => {
                    const v = bal.get(a.id) ?? 0;
                    const l = last(a.id);
                    const st = status(a, linked);
                    return (
                      <tr key={a.id} onClick={() => openAccount(a)} className="cursor-pointer border-b border-line last:border-0 hover:bg-ink-4">
                        <td className="px-2 py-3"><div className="flex items-center gap-2.5"><InstitutionBadge id={a.institution} size={28} /><span className="font-medium">{a.name}</span></div></td>
                        <td className="px-2 py-3 text-muted">{accountTypeLabel(a.type)}</td>
                        <td className="px-2 py-3 text-right"><Money value={v} currency={a.currency} tone={isLiability(a) && v < 0 ? 'out' : 'plain'} /></td>
                        <td className="px-2 py-3 text-muted">{l ? `${shortDate(l.date)}${l.source === 'capture' ? ' · captured' : ''}` : '—'}</td>
                        <td className="px-2 py-3"><Badge tone={st.tone}><span className={cx('h-1.5 w-1.5 rounded-full', st.tone === 'good' ? 'bg-income' : st.tone === 'info' ? 'bg-current' : 'bg-faint')} />{st.text}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <p className="mt-3 text-xs leading-relaxed text-faint">
            Auto-capture reads the account's notifications and bank texts on your phone{platform === 'android' ? '' : ' (Android app)'}.
            {linked && snap.settings.paypal?.lastSync ? ` PayPal last synced ${ago(snap.settings.paypal.lastSync)}.` : ''}
          </p>
        </>
      )}
    </>
  );
}
