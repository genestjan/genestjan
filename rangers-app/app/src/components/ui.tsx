import { type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { update, useAppState } from '../lib/store';
import { useCloud } from '../lib/cloud';
import { useRole } from '../lib/role';
import { unreadCount } from '../lib/inbox';

export function Page({ title, children, back, actions }: { title: string; children: ReactNode; back?: ReactNode; actions?: ReactNode }) {
  const { mode } = useAppState();
  const cloud = useCloud();
  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-4" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">{back}<h1 className="truncate text-4xl leading-none">{title}</h1></div>
        <div className="flex shrink-0 items-center gap-2">{actions}
          <button className="btn ghost px-3" aria-label="Toggle sun mode" onClick={() => update((s) => ({ ...s, mode: s.mode === 'club' ? 'sun' : 'club' }))}>{mode === 'club' ? 'Sun' : 'Club'}</button>
        </div>
      </header>
      {cloud.error && <p className="mb-3 rounded-xl border border-red p-2 text-sm">Sync problem: {cloud.error}. Your changes are saved on this phone and will send when it works.</p>}
      {children}
    </div>
  );
}
/** Club crests, served next to the app (relative paths work under /app/). */
export const CREST = { rangers: 'crest.png', newmabu: 'new-mabu-mark.png', gila: 'gila-mark.png' } as const;
export const Back = ({ to = '/' }: { to?: string }) => <Link to={to} className="btn ghost px-4" aria-label="Back">Back</Link>;
export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => <div className={`card p-4 ${className}`}>{children}</div>;
export const H2 = ({ children }: { children: ReactNode }) => <h2 className="mb-2 mt-5 text-3xl">{children}</h2>;
export const Empty = ({ children }: { children: ReactNode }) => <p className="muted card p-4">{children}</p>;
export function Chip({ on, children, onClick }: { on?: boolean; children: ReactNode; onClick?: () => void }) {
  return <button onClick={onClick} className={`btn px-4 ${on ? '' : 'ghost'}`} aria-pressed={on}>{children}</button>;
}
export function Tone({ tone, children }: { tone: 'ok' | 'warn' | 'bad'; children: ReactNode }) {
  const c = tone === 'ok' ? '#2e8b57' : tone === 'warn' ? '#d98a00' : '#C31E24';
  return <div className="rounded-2xl p-3 font-semibold" style={{ background: c + '22', border: `1px solid ${c}` }}>{children}</div>;
}

export function Pitch({ format, children, className = 'w-full', svgRef, ...rest }: { format: 'v' | 'h'; children?: ReactNode; className?: string; svgRef?: React.Ref<SVGSVGElement> } & React.SVGProps<SVGSVGElement>) {
  const w = format === 'v' ? 100 : 160, h = format === 'v' ? 160 : 100;
  return (
    <svg ref={svgRef} viewBox={`0 0 ${w} ${h}`} className={`${className} rounded-card`} style={{ background: 'var(--pitch)', touchAction: 'none' }} role="img" {...rest}>
      <g fill="none" stroke="var(--text)" strokeOpacity=".45" strokeWidth=".6">
        <rect x="2" y="2" width={w - 4} height={h - 4} rx="2" />
        {format === 'v' ? (<><line x1="2" y1={h / 2} x2={w - 2} y2={h / 2} /><circle cx={w / 2} cy={h / 2} r="12" /><rect x="28" y="2" width="44" height="18" /><rect x="28" y={h - 20} width="44" height="18" /></>)
          : (<><line x1={w / 2} y1="2" x2={w / 2} y2={h - 2} /><circle cx={w / 2} cy={h / 2} r="12" /><rect x="2" y="28" width="18" height="44" /><rect x={w - 20} y="28" width="18" height="44" /></>)}
      </g>
      {children}
    </svg>
  );
}

const COACH_TABS = [['/', 'Today'], ['/schedule', 'Schedule'], ['/inbox', 'Inbox'], ['/train', 'Train'], ['/squad', 'Squad'], ['/more', 'More']] as const;
const PARENT_TABS = [['/', 'Home'], ['/schedule', 'Schedule'], ['/tasks', 'Tasks'], ['/inbox', 'Inbox'], ['/progress', 'Progress'], ['/more', 'More']] as const;
export function TabBar() {
  const role = useRole();
  const tabs = role === 'parent' ? PARENT_TABS : COACH_TABS;
  const s = useAppState();
  const unread = unreadCount(s, role === 'parent' ? 'parent' : 'staff', role === 'parent' ? 'parent' : 'coach');
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t" style={{ background: 'var(--card)', borderColor: 'var(--line)', paddingBottom: 'env(safe-area-inset-bottom)' }} aria-label="Main">
      {tabs.map(([to, label]) => (
        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `relative flex min-h-[56px] flex-1 items-center justify-center text-sm font-semibold ${isActive ? 'text-red' : 'muted'}`}>
          {label}{label === 'Inbox' && unread > 0 && <span className="absolute right-2 top-1 rounded-full bg-red px-1.5 text-xs text-white">{unread}</span>}
        </NavLink>
      ))}
    </nav>
  );
}
