import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Bike, CalendarClock, ClipboardCheck, History, Home, Map, MoreHorizontal, Route, Settings, WifiOff, X } from 'lucide-react';
import { useOnline } from '../lib/hooks';
import { EmergencyButton } from './Emergency';

const NAV = [
  { to: '/', label: 'Dashboard', short: 'Home', Icon: Home, primary: true },
  { to: '/plan', label: 'Plan a Ride', short: 'Plan', Icon: Route, primary: true },
  { to: '/map', label: 'Route Map', short: 'Map', Icon: Map, primary: true },
  { to: '/schedule', label: 'Pit Stop Schedule', short: 'Stops', Icon: CalendarClock, primary: true },
  { to: '/ride', label: 'Live Ride', short: 'Ride', Icon: Bike, primary: true },
  { to: '/checklists', label: 'Bike Checklists', short: 'Checks', Icon: ClipboardCheck, primary: false },
  { to: '/history', label: 'Ride History', short: 'History', Icon: History, primary: false },
  { to: '/settings', label: 'Settings', short: 'Settings', Icon: Settings, primary: false },
];

export function Layout({ children }: { children: ReactNode }) {
  const online = useOnline();
  const [more, setMore] = useState(false);
  const loc = useLocation();
  const moreActive = NAV.some((n) => !n.primary && loc.pathname.startsWith(n.to));

  return (
    <div className="min-h-dvh md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[2000] focus:rounded focus:bg-white focus:p-2">
        Skip to content
      </a>
      {/* Sidebar on tablets and desktops */}
      <aside className="hidden w-60 shrink-0 flex-col bg-navy text-white md:flex" aria-label="Main navigation">
        <div className="px-5 py-5">
          <p className="text-xl font-extrabold tracking-tight">RideWise</p>
          <p className="text-xs text-slate-300">Ride smart, stop smart, finish strong.</p>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-medium ${isActive ? 'bg-white text-navy' : 'text-slate-200 hover:bg-navy-3'}`
              }
            >
              <Icon aria-hidden className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[1000] flex items-center justify-between gap-2 bg-navy px-4 py-2 text-white md:bg-white md:text-navy md:shadow-sm">
          <span className="text-lg font-extrabold md:hidden">RideWise</span>
          <span className="hidden text-sm text-slate-500 md:block">Plan the ride, respect the rider, make every stop count.</span>
          <div className="flex items-center gap-2">
            {!online && (
              <span className="chip bg-caution-soft text-amber-900" role="status">
                <WifiOff aria-hidden className="h-3.5 w-3.5" /> Offline: saved plans only
              </span>
            )}
            <EmergencyButton compact />
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-4 md:pb-10">
          {children}
        </main>
      </div>

      {/* Bottom bar on phones */}
      <nav className="fixed inset-x-0 bottom-0 z-[1000] border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Main navigation">
        <ul className="grid grid-cols-6">
          {NAV.filter((n) => n.primary).map(({ to, short, Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) => `flex min-h-[56px] flex-col items-center justify-center text-[11px] font-semibold ${isActive ? 'text-navy' : 'text-slate-500'}`}
              >
                {({ isActive }) => (
                  <>
                    <Icon aria-hidden className={`h-5 w-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
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
              className={`flex min-h-[56px] w-full flex-col items-center justify-center text-[11px] font-semibold ${moreActive ? 'text-navy' : 'text-slate-500'}`}
            >
              {more ? <X aria-hidden className="h-5 w-5" /> : <MoreHorizontal aria-hidden className="h-5 w-5" />}
              More
            </button>
          </li>
        </ul>
        {more && (
          <div id="more-menu" className="absolute bottom-full right-2 mb-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
            {NAV.filter((n) => !n.primary).map(({ to, label, Icon }) => (
              <NavLink key={to} to={to} onClick={() => setMore(false)} className="flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-medium hover:bg-slate-100">
                <Icon aria-hidden className="h-5 w-5" /> {label}
              </NavLink>
            ))}
          </div>
        )}
      </nav>
    </div>
  );
}
