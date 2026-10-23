import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Bike, CalendarClock, CircleHelp, ClipboardCheck, History, Home, Map, MoreHorizontal, Route, Settings, WifiOff, X } from 'lucide-react';
import { useOnline } from '../lib/hooks';
import { EmergencyButton } from './Emergency';
import { AccountMenu } from './AccountMenu';
import { Logo } from './Logo';

const NAV = [
  { to: '/', label: 'Home', short: 'Home', Icon: Home, primary: true },
  { to: '/plan', label: 'Plan a Ride', short: 'Plan', Icon: Route, primary: true },
  { to: '/map', label: 'Route Map', short: 'Map', Icon: Map, primary: true },
  { to: '/schedule', label: 'Pit Stop Schedule', short: 'Stops', Icon: CalendarClock, primary: true },
  { to: '/ride', label: 'Live Ride', short: 'Ride', Icon: Bike, primary: true },
  { to: '/checklists', label: 'Bike Checklists', short: 'Checks', Icon: ClipboardCheck, primary: false },
  { to: '/history', label: 'Ride History', short: 'History', Icon: History, primary: false },
  { to: '/help', label: 'Help', short: 'Help', Icon: CircleHelp, primary: false },
  { to: '/settings', label: 'Settings', short: 'Settings', Icon: Settings, primary: false },
];

export function Layout({ children }: { children: ReactNode }) {
  const online = useOnline();
  const [more, setMore] = useState(false);
  const loc = useLocation();
  const moreActive = NAV.some((n) => !n.primary && loc.pathname.startsWith(n.to));
  const navRef = useRef<HTMLElement>(null);

  // Close the "More" menu on an outside tap, Escape, or when the page changes.
  useEffect(() => setMore(false), [loc.pathname]);
  useEffect(() => {
    if (!more) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !navRef.current?.contains(e.target as Node)) setMore(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [more]);

  return (
    <div className="min-h-dvh md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[2000] focus:rounded-full focus:bg-white focus:px-4 focus:py-2">
        Skip to content
      </a>

      {/* Side menu on tablets and computers */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex" aria-label="Main navigation">
        <div className="px-5 py-6">
          <Logo size={46} tagline />
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex min-h-[48px] items-center gap-3 rounded-full px-4 text-base font-semibold ${isActive ? 'bg-brand-100 text-brand-800' : 'text-slate-600 hover:bg-slate-100'}`
              }
            >
              <Icon aria-hidden className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[1000] flex items-center justify-between gap-2 bg-band px-4 py-2.5">
          <Link to="/" aria-label="RideWise home" className="md:hidden">
            <Logo size={38} />
          </Link>
          <span className="hidden text-sm text-slate-500 md:block">Plan the ride, respect the rider, make every stop count.</span>
          <div className="flex items-center gap-2">
            <AccountMenu />
            <EmergencyButton compact />
          </div>
        </header>
        {!online && (
          <p className="sticky top-[62px] z-[999] flex items-center justify-center gap-2 bg-caution-soft px-4 py-1.5 text-sm font-semibold text-amber-900" role="status">
            <WifiOff aria-hidden className="h-4 w-4" /> Offline: saved plans only
          </p>
        )}

        <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 pb-32 pt-5 md:pb-10">
          {children}
        </main>
      </div>

      {/* Bottom bar on phones */}
      <nav ref={navRef} className="fixed inset-x-0 bottom-0 z-[1000] rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_24px_rgba(36,52,71,0.10)] md:hidden" aria-label="Main navigation">
        <ul className="grid grid-cols-6">
          {NAV.filter((n) => n.primary).map(({ to, short, Icon }) => (
            <li key={to}>
              <NavLink to={to} end={to === '/'} className={({ isActive }) => `flex min-h-[62px] flex-col items-center justify-center gap-0.5 text-xs font-semibold ${isActive ? 'text-brand-700' : 'text-slate-500'}`}>
                {({ isActive }) => (
                  <>
                    <span className={`grid h-8 w-14 place-items-center rounded-full ${isActive ? 'bg-brand-100' : ''}`}>
                      <Icon aria-hidden className={`h-6 w-6 ${isActive ? 'stroke-[2.4]' : ''}`} />
                    </span>
                    {short}
                  </>
                )}
              </NavLink>
            </li>
          ))}
          <li>
            <button
              type="button"
              aria-expanded={more}
              aria-controls="more-menu"
              onClick={() => setMore((m) => !m)}
              className={`flex min-h-[62px] w-full flex-col items-center justify-center gap-0.5 text-xs font-semibold ${moreActive || more ? 'text-brand-700' : 'text-slate-500'}`}
            >
              <span className={`grid h-8 w-14 place-items-center rounded-full ${moreActive || more ? 'bg-brand-100' : ''}`}>
                {more ? <X aria-hidden className="h-6 w-6" /> : <MoreHorizontal aria-hidden className="h-6 w-6" />}
              </span>
              More
            </button>
          </li>
        </ul>
        {more && (
          <div id="more-menu" className="absolute bottom-full right-3 mb-3 w-60 rounded-3xl bg-white p-2 shadow-lift">
            {NAV.filter((n) => !n.primary).map(({ to, label, Icon }) => (
              <NavLink key={to} to={to} className="flex min-h-[48px] items-center gap-3 rounded-full px-4 text-base font-semibold text-navy hover:bg-brand-50">
                <Icon aria-hidden className="h-5 w-5" /> {label}
              </NavLink>
            ))}
          </div>
        )}
      </nav>
    </div>
  );
}
