import {
  ArrowLeftRight, BarChart3, Bell, Home, Inbox, Landmark, LayoutDashboard, Lock, MoreHorizontal, PieChart, Plus,
  RefreshCw, Settings, Wallet, type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { ago } from '../lib/dates';
import { lock, syncNow, useApp } from '../lib/session';
import { navigate, useRoute, type Route } from '../router';
import { openTxn } from '../ui-state';
import { Avatar, Brand, cx } from './ui';

const SIDE: { to: Route; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/tx', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/budgets', label: 'Budgets', icon: PieChart },
  { to: '/debts', label: 'Debts & bills', icon: Landmark },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/inbox', label: 'Captured', icon: Inbox },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const BOTTOM: { to: Route; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/tx', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/budgets', label: 'Budgets', icon: PieChart },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/more', label: 'More', icon: MoreHorizontal },
];

export function useReviewCount() {
  return useApp((s) => s.snap?.captures.filter((c) => c.status === 'review').length ?? 0);
}

function SyncPill() {
  const sync = useApp((s) => s.sync);
  const mode = useApp((s) => s.meta?.mode);
  const demo = useApp((s) => s.demo);
  if (demo) return <span className="chip bg-signal/15 text-signal">Demo data</span>;
  if (mode !== 'cloud') return <span className="chip bg-ink-5 text-muted">This device only</span>;
  const tone = sync.state === 'error' ? 'bg-expense/15 text-expense' : sync.state === 'offline' ? 'bg-signal/15 text-signal' : 'bg-income/15 text-income';
  const text = sync.state === 'syncing' ? 'Syncing…' : sync.state === 'error' ? 'Sync problem' : sync.state === 'offline' ? 'Offline' : sync.at ? `Synced ${ago(sync.at)}` : 'Encrypted sync';
  return (
    <button onClick={() => void syncNow()} title={sync.detail} className={cx('chip', tone)}>
      <RefreshCw size={12} className={sync.state === 'syncing' ? 'animate-spin' : ''} /> {text}
    </button>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const route = useRoute();
  const review = useReviewCount();
  const demo = useApp((s) => s.demo);
  const email = useApp((s) => s.meta?.email ?? '');
  const name = useApp((s) => s.snap?.settings.displayName) || email || 'Jan';
  const showFab = ['/', '/tx', '/accounts'].includes(route);
  return (
    <div className="flex h-full bg-ink">
      <aside className="hidden w-[248px] shrink-0 flex-col border-r border-line bg-ink-2 lg:flex">
        <div className="px-5 pb-6 pt-6"><Brand /></div>
        <nav className="flex-1 space-y-1 px-3">
          {SIDE.map((n) => (
            <a key={n.to} href={`#${n.to}`} className={cx(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition',
              route === n.to ? 'bg-current/10 font-medium text-current shadow-[inset_2px_0_0_#4FD1E0]' : 'text-muted hover:bg-ink-4 hover:text-paper',
            )}>
              <n.icon size={18} /> <span className="flex-1">{n.label}</span>
              {n.to === '/inbox' && review > 0 && <span className="chip bg-signal text-ink">{review}</span>}
            </a>
          ))}
        </nav>
        <div className="space-y-3 border-t border-line p-4">
          <SyncPill />
          {!demo && (
            <button onClick={lock} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted hover:bg-ink-4 hover:text-paper">
              <Lock size={16} /> Lock now
            </button>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-line bg-ink/90 px-4 pb-3 backdrop-blur lg:hidden"
          style={{ paddingTop: 'calc(0.75rem + var(--safe-top))' }}>
          <Brand size={30} />
          <div className="flex items-center gap-1.5">
            <SyncPill />
            <button onClick={() => navigate('/inbox')} className="relative rounded-full p-2 text-muted hover:text-paper" aria-label="Captured notifications">
              <Bell size={20} />
              {review > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-signal" />}
            </button>
            <button onClick={() => navigate('/settings')} aria-label="Settings"><Avatar name={name} size={32} /></button>
          </div>
        </header>

        <main className="relative flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1240px] px-4 pb-32 pt-4 sm:px-6 lg:px-8 lg:pb-12 lg:pt-7">{children}</div>
        </main>

        {showFab && (
          <button onClick={() => openTxn()} aria-label="Add a transaction"
            className="fixed right-5 z-40 grid h-14 w-14 place-items-center rounded-2xl bg-signal text-ink shadow-glow transition active:scale-95 lg:hidden"
            style={{ bottom: 'calc(84px + var(--safe-bottom))' }}>
            <Plus size={26} strokeWidth={2.5} />
          </button>
        )}

        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-ink-2/95 backdrop-blur lg:hidden"
          style={{ paddingBottom: 'var(--safe-bottom)' }}>
          {BOTTOM.map((n) => {
            const on = route === n.to || (n.to === '/more' && ['/debts', '/analytics', '/inbox', '/settings', '/more'].includes(route));
            return (
              <a key={n.to} href={`#${n.to}`} className={cx('flex flex-col items-center gap-1 py-2.5 text-[11px]', on ? 'text-signal' : 'text-muted')}>
                <n.icon size={21} strokeWidth={on ? 2.4 : 2} />
                {n.label}
              </a>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-[24px] font-bold tracking-tight lg:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
