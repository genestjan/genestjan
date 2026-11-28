import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Moon, Sun, LogOut, MoreHorizontal, Wifi, WifiOff, ChevronsUpDown } from 'lucide-react';
import { Wordmark, Mark } from '@/brand/Logo';
import { NAV, MOBILE_TABS, SCAN_ICON, navFor } from './nav';
import { useSession } from './session';
import { useStaff } from '@/data/hooks';
import { cx, Modal, Button, toast } from '@/ui/kit';
import type { Staff } from '@/domain/types';

const ROLE_LABEL: Record<Staff['role'], string> = {
  owner: 'Owner',
  cashier: 'Cashier',
  advisor: 'Service advisor',
  mechanic: 'Mekaniko',
  warehouse: 'Warehouse',
};

function useOnline() {
  const [on, setOn] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const a = () => setOn(true);
    const b = () => setOn(false);
    window.addEventListener('online', a);
    window.addEventListener('offline', b);
    return () => {
      window.removeEventListener('online', a);
      window.removeEventListener('offline', b);
    };
  }, []);
  return on;
}

export function Avatar({ staff, size = 36 }: { staff: Pick<Staff, 'name' | 'color'> | null; size?: number }) {
  const initials = (staff?.name ?? '?').replace(/\(.*\)/, '').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span className="grid shrink-0 place-items-center rounded-full font-display text-sm font-bold text-white" style={{ width: size, height: size, background: staff?.color ?? '#555' }}>
      {initials}
    </span>
  );
}

/** Quick user switch with a 4-digit PIN. */
export function StaffSwitcher({ open, onClose }: { open: boolean; onClose: () => void }) {
  const staff = useStaff().filter((s) => s.active);
  const { setStaffId } = useSession();
  const [pick, setPick] = useState<Staff | null>(null);
  const [pin, setPin] = useState('');
  useEffect(() => {
    if (!open) {
      setPick(null);
      setPin('');
    }
  }, [open]);
  useEffect(() => {
    if (pick && pin.length === 4) {
      if (pin === pick.pin) {
        setStaffId(pick.id);
        toast.ok(`Welcome, ${pick.name.split(' ')[0]}`);
        onClose();
      } else {
        toast.bad('Wrong PIN');
        setPin('');
      }
    }
  }, [pin, pick, setStaffId, onClose]);

  return (
    <Modal open={open} onClose={onClose} title={pick ? `Enter PIN for ${pick.name}` : 'Who is using this device?'}>
      {!pick ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {staff.map((s) => (
            <button key={s.id} onClick={() => setPick(s)} className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-raised p-4 transition hover:border-brand/50">
              <Avatar staff={s} size={48} />
              <div className="text-center">
                <div className="text-sm font-semibold leading-tight">{s.name}</div>
                <div className="text-xs text-faint">{ROLE_LABEL[s.role]}</div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="mx-auto max-w-[280px] pb-2">
          <div className="mb-5 flex justify-center gap-3">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={cx('h-3.5 w-3.5 rounded-full transition', i < pin.length ? 'scale-110 bg-brand' : 'bg-line')} />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'ok'].map((k) =>
              k === 'ok' ? (
                <span key={k} />
              ) : (
                <button
                  key={k}
                  onClick={() => (k === 'back' ? (pin ? setPin(pin.slice(0, -1)) : setPick(null)) : setPin((p) => (p + k).slice(0, 4)))}
                  className="num h-16 rounded-2xl border border-line bg-raised font-display text-2xl font-semibold transition active:scale-95 active:bg-brand-soft"
                >
                  {k === 'back' ? '⌫' : k}
                </button>
              ),
            )}
          </div>
          <p className="mt-4 text-center text-xs text-faint">Starter PINs are in Settings. Change them before going live.</p>
        </div>
      )}
    </Modal>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { staff, role, theme, setTheme } = useSession();
  const [switching, setSwitching] = useState(false);
  const [more, setMore] = useState(false);
  const online = useOnline();
  const nav = useNavigate();
  const loc = useLocation();
  const items = navFor(role);

  useEffect(() => {
    if (!staff) setSwitching(true);
  }, [staff]);

  // Alt+1..9 jumps between sections on the counter PC.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const it = items.find((i) => i.key === e.key);
      if (it) {
        e.preventDefault();
        nav(it.to);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [items, nav]);

  useEffect(() => setMore(false), [loc.pathname]);

  const groups = ['Sell', 'Workshop', 'Stock', 'Shop'] as const;
  const tabs = MOBILE_TABS[role].map((to) => NAV.find((n) => n.to === to)!).filter(Boolean);

  return (
    <div className="grain flex h-full">
      {/* Desktop sidebar */}
      <aside className="no-print hidden w-[248px] shrink-0 flex-col border-r border-line bg-surface/70 backdrop-blur lg:flex">
        <div className="px-5 pb-4 pt-5">
          <Wordmark />
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-3">
          {groups.map((g) => {
            const gi = items.filter((i) => i.group === g);
            if (!gi.length) return null;
            return (
              <div key={g} className="mb-4">
                <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">{g}</div>
                {gi.map((i) => (
                  <NavLink
                    key={i.to}
                    to={i.to}
                    end={i.to === '/'}
                    className={({ isActive }) =>
                      cx(
                        'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition',
                        isActive ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-raised hover:text-ink',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <span className="absolute -left-3 top-2 h-[calc(100%-16px)] w-1 rounded-r-full bg-brand" />}
                        <i.icon className="h-[18px] w-[18px]" />
                        <span className="flex-1">{i.label}</span>
                        {i.key && <span className="text-[10px] font-semibold text-faint opacity-0 transition group-hover:opacity-100">Alt {i.key}</span>}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="border-t border-line p-3">
          <div className="mb-2 flex items-center justify-between px-2 text-xs text-faint">
            <span className="flex items-center gap-1.5">
              {online ? <Wifi className="h-3.5 w-3.5 text-ok" /> : <WifiOff className="h-3.5 w-3.5 text-warn" />}
              {online ? 'Online' : 'Offline: saving locally'}
            </span>
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="rounded-lg p-1.5 hover:bg-raised hover:text-ink" aria-label="Toggle theme">
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
          <button onClick={() => setSwitching(true)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-raised">
            <Avatar staff={staff} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{staff?.name ?? 'Sign in'}</div>
              <div className="text-xs text-faint">{staff ? ROLE_LABEL[staff.role] : 'Tap to choose'}</div>
            </div>
            <ChevronsUpDown className="h-4 w-4 text-faint" />
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print safe-t sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/80 px-4 py-2.5 backdrop-blur-xl lg:hidden">
          <Wordmark size={30} sub={false} />
          <div className="flex items-center gap-1">
            {!online && <WifiOff className="mr-1 h-4 w-4 text-warn" />}
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="rounded-lg p-2 text-muted" aria-label="Toggle theme">
              {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </button>
            <button onClick={() => setSwitching(true)} aria-label="Switch user">
              <Avatar staff={staff} size={32} />
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1480px] px-4 pb-28 pt-5 md:px-6 lg:px-8 lg:pb-10 lg:pt-7">{children}</div>
        </main>
      </div>

      {/* Phone bottom bar */}
      <nav className="no-print safe-b fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/90 backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2 pt-1.5">
          {[tabs[0], tabs[1], null, tabs[2]].map((t, i) =>
            t ? (
              <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => cx('flex flex-col items-center gap-1 pb-2 pt-1 text-[11px] font-semibold', isActive ? 'text-brand' : 'text-faint')}>
                <t.icon className="h-[22px] w-[22px]" />
                {t.label.split(' ')[0]}
              </NavLink>
            ) : (
              <div key={'scan' + i} className="flex justify-center">
                <button onClick={() => nav('/scan')} className="-mt-6 mb-1.5 grid h-16 w-16 place-items-center rounded-[22px] bg-brand text-white shadow-glow transition active:scale-95" aria-label="Scan">
                  <SCAN_ICON className="h-7 w-7" />
                </button>
              </div>
            ),
          )}
          <button onClick={() => setMore(true)} className={cx('flex flex-col items-center gap-1 pb-2 pt-1 text-[11px] font-semibold', more ? 'text-brand' : 'text-faint')}>
            <MoreHorizontal className="h-[22px] w-[22px]" />
            More
          </button>
        </div>
      </nav>

      <Modal open={more} onClose={() => setMore(false)} title="Menu">
        <div className="grid grid-cols-3 gap-2.5">
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.to === '/'} className={({ isActive }) => cx('flex flex-col items-center gap-2 rounded-2xl border p-3.5 text-center text-xs font-semibold transition', isActive ? 'border-brand/40 bg-brand-soft text-brand' : 'border-line bg-raised text-muted')}>
              <i.icon className="h-6 w-6" />
              {i.label}
            </NavLink>
          ))}
        </div>
        <Button className="mt-4" block icon={<LogOut className="h-4 w-4" />} onClick={() => { setMore(false); setSwitching(true); }}>
          Switch user
        </Button>
      </Modal>

      <StaffSwitcher open={switching} onClose={() => setSwitching(false)} />
    </div>
  );
}

export function Splash() {
  return (
    <div className="grid h-full place-items-center">
      <div className="flex animate-in flex-col items-center gap-3">
        <Mark size={56} />
        <div className="text-sm text-muted">Getting the shop ready…</div>
      </div>
    </div>
  );
}
