import { type ReactNode } from 'react';
import { Bell, CalendarDays, ChevronLeft, ChevronRight, HelpCircle, Home, ListChecks, MessageCircle, Moon, MoreHorizontal, Sun, Users, type LucideIcon } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { update, useAppState } from '../lib/store';
import { useCloud } from '../lib/cloud';
import { useRole } from '../lib/role';
import { unreadCount } from '../lib/inbox';

export function Page({ title, children, back, actions, bare }: { title: string; children: ReactNode; back?: ReactNode; actions?: ReactNode; bare?: boolean }) {
  const { mode } = useAppState();
  const cloud = useCloud();
  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-4" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
      {!bare && <header className="mb-4 flex min-h-[48px] items-center gap-2">
        {back}
        <h1 className={`line-clamp-2 min-w-0 flex-1 leading-tight ${back ? 'text-center' : ''} ${title.length > 16 ? 'text-xl' : 'text-2xl'}`}>{title}</h1>
        <div className="flex shrink-0 items-center gap-2">{actions}
          <Link to="/help" className="btn ghost h-11 min-h-[44px] w-11 px-0" data-tour="help-button" aria-label="Help" title="Help"><HelpCircle size={20} /></Link>
          <button className="btn ghost h-11 min-h-[44px] w-11 px-0" aria-label="Toggle sun mode" title={mode === 'club' ? 'Bright screen for sunshine' : 'Club colours'} onClick={() => update((s) => ({ ...s, mode: s.mode === 'club' ? 'sun' : 'club' }))}>{mode === 'club' ? <Sun size={20} /> : <Moon size={20} />}</button>
        </div>
      </header>}
      {bare && <h1 className="sr-only">{title}</h1>}
      {cloud.error && <p className="mb-3 rounded-xl border border-red p-2 text-sm">Sync problem: {cloud.error}. Your changes are saved on this phone and will send when it works.</p>}
      {children}
    </div>
  );
}
/** Club crests, served next to the app (relative paths work under /app/). */
export const CREST = { rangers: 'crest.png', newmabu: 'new-mabu-mark.png', gila: 'gila-mark.png' } as const;
export const Back = ({ to = '/' }: { to?: string }) => <Link to={to} className="btn ghost h-11 min-h-[44px] w-11 shrink-0 px-0" aria-label="Back"><ChevronLeft size={22} /></Link>;
export const Card = ({ children, className = '', tour }: { children: ReactNode; className?: string; tour?: string }) => <div className={`card p-4 ${className}`} data-tour={tour}>{children}</div>;
export const H2 = ({ children }: { children: ReactNode }) => <h2 className="mb-2 mt-6 text-xl">{children}</h2>;
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

const COACH_TABS = [['/', 'Home', Home], ['/schedule', 'Schedule', CalendarDays], ['/squad', 'Team', Users], ['/inbox', 'Inbox', MessageCircle], ['/more', 'More', MoreHorizontal]] as const;
const PARENT_TABS = [['/', 'Home', Home], ['/schedule', 'Schedule', CalendarDays], ['/tasks', 'Tasks', ListChecks], ['/inbox', 'Inbox', MessageCircle], ['/more', 'More', MoreHorizontal]] as const;
export function TabBar() {
  const role = useRole();
  const tabs = role === 'parent' ? PARENT_TABS : COACH_TABS;
  const s = useAppState();
  const unread = unreadCount(s, role === 'parent' ? 'parent' : 'staff', role === 'parent' ? 'parent' : 'coach');
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t" style={{ background: 'var(--tab)', borderColor: 'var(--line)', paddingBottom: 'env(safe-area-inset-bottom)' }} aria-label="Main">
      {tabs.map(([to, label, Icon]) => (
        <NavLink key={to} to={to} end={to === '/'} data-tour={to === '/' ? 'tab-home' : `tab-${to.slice(1)}`} className={({ isActive }) => `relative flex min-h-[60px] flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${isActive ? 'text-gold' : 'muted'}`}>
          <Icon size={22} strokeWidth={2.2} aria-hidden="true" />{label}{label === 'Inbox' && unread > 0 && <span className="absolute right-[22%] top-1.5 rounded-full bg-red px-1.5 text-[11px] leading-4 text-white">{unread}</span>}
        </NavLink>
      ))}
    </nav>
  );
}

/** Big square shortcut with an icon, as on the Home screen. The first one is gold. */
export function Tile({ to, icon: Icon, title, sub, gold, tour }: { to: string; icon: LucideIcon; title: string; sub?: string; gold?: boolean; tour?: string }) {
  return (
    <Link to={to} data-tour={tour} className={`card flex min-h-[112px] flex-col justify-between p-4 ${gold ? 'tile-gold' : ''}`}>
      <span className="icon-chip"><Icon size={24} strokeWidth={2.2} aria-hidden="true" /></span>
      <span className="flex items-end justify-between gap-2"><span><span className="block text-base font-bold leading-tight">{title}</span>{sub && <span className="muted block text-xs leading-tight">{sub}</span>}</span><ChevronRight size={18} aria-hidden="true" /></span>
    </Link>
  );
}
/** One line in a list: icon or avatar, title, small text, and a chevron or badge. */
export function Row({ to, onClick, lead, title, sub, badge, tour }: { to?: string; onClick?: () => void; lead?: ReactNode; title: ReactNode; sub?: ReactNode; badge?: ReactNode; tour?: string }) {
  const body = (<>{lead}<span className="min-w-0 flex-1"><span className="line-clamp-2 block font-semibold leading-snug">{title}</span>{sub && <span className="muted block text-sm leading-snug">{sub}</span>}</span>{badge}{(to || onClick) && <ChevronRight size={20} className="muted shrink-0" aria-hidden="true" />}</>);
  const cls = 'card flex min-h-[64px] w-full items-center gap-3 p-3 text-left';
  if (to) return <Link to={to} className={cls} data-tour={tour}>{body}</Link>;
  if (onClick) return <button onClick={onClick} className={cls} data-tour={tour}>{body}</button>;
  return <div className={cls} data-tour={tour}>{body}</div>;
}
export const IconChip = ({ icon: Icon }: { icon: LucideIcon }) => <span className="icon-chip shrink-0"><Icon size={22} aria-hidden="true" /></span>;
/** Today / This week style switch. */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="mb-4 flex gap-1 rounded-full p-1" style={{ background: 'rgba(255,255,255,.07)', border: '1px solid var(--line)' }} role="group" aria-label={label}>
      {options.map(([v, t]) => <button key={v} aria-pressed={value === v} onClick={() => onChange(v)} className={`min-h-[40px] flex-1 whitespace-nowrap rounded-full px-1 text-[13px] font-semibold ${value === v ? 'bg-gold text-ink' : ''}`}>{t}</button>)}
    </div>
  );
}
/** APR / 27 / Sun block for lists of events (Manila time). */
export function DateBlock({ iso }: { iso: string }) {
  const d = new Date(iso);
  return (
    <span className="grid w-14 shrink-0 place-items-center rounded-2xl py-2 text-center" style={{ background: 'rgba(255,255,255,.07)' }}>
      <span className="text-[11px] font-bold uppercase tracking-wide">{d.toLocaleDateString('en-PH', { month: 'short' })}</span>
      <span className="text-2xl font-bold leading-none">{String(d.getDate()).padStart(2, '0')}</span>
      <span className="muted text-[11px]">{d.toLocaleDateString('en-PH', { weekday: 'short' })}</span>
    </span>
  );
}
/** Initials in a circle (photos only ever with consent, and not stored yet). */
export function Avatar({ name, number, size = 48 }: { name: string; number?: number; size?: number }) {
  const ini = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return <span className="grid shrink-0 place-items-center rounded-full font-bold" style={{ width: size, height: size, background: 'linear-gradient(160deg,#1d4fa8,#0d2a5e)', border: '2px solid var(--gold)', color: '#fff' }} aria-hidden="true">{number ?? ini}</span>;
}
/** The club's own picture behind the title, as on the website. Falls back to a pitch pattern if it cannot load. */
export function Hero({ image, children, className = '' }: { image?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-3xl ${className}`} style={{ background: 'radial-gradient(120% 90% at 70% 0%, #2457b8 0%, #0d2a5e 55%, #061633 100%)' }}>
      <svg className="absolute inset-0 h-full w-full opacity-[.10]" aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 100 60"><g fill="none" stroke="#fff" strokeWidth=".4"><rect x="4" y="4" width="92" height="52" rx="1" /><line x1="50" y1="4" x2="50" y2="56" /><circle cx="50" cy="30" r="8" /><rect x="4" y="18" width="12" height="24" /><rect x="84" y="18" width="12" height="24" /></g></svg>
      {image && <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(6,22,51,.15) 0%, rgba(6,22,51,.55) 55%, rgba(6,22,51,.95) 100%)' }} />
      <div className="relative">{children}</div>
    </div>
  );
}
/** The club's photos already published on rangersfc.net (same site, so no copy in the app code). */
export const CLUB_PHOTO: Record<string, string | undefined> = { rangers: '../assets/squad.webp', gila: '../assets/teams/gila.webp', newmabu: undefined };
export const SectionHead = ({ title, to, link = 'See all' }: { title: string; to?: string; link?: string }) => (
  <div className="mb-2 mt-6 flex items-center justify-between"><h2 className="text-xl">{title}</h2>{to && <Link to={to} className="muted text-sm font-semibold">{link}</Link>}</div>
);

const WORDMARK: Record<string, [string, string, string]> = {
  rangers: ['RANGERS', 'FOOTBALL CLUB', 'Play with your heart'], newmabu: ['NEW MABU', 'FOOTBALL CLUB', 'Mindset. Attitude. Belief. Unity.'], gila: ['GILA', 'ACADEMY', 'Grind. Improve. Learn. Achieve.'],
};
/** Home screen header: crest, club name, motto, the club photo, and quick icons (messages, help, bright mode). */
export function ClubHero({ programme, values, unread }: { programme: keyof typeof CREST; values: string[]; unread: number }) {
  const { mode } = useAppState(); const [a, b, motto] = WORDMARK[programme] ?? WORDMARK.rangers;
  const icon = 'grid h-11 w-11 place-items-center rounded-full';
  return (
    <Hero image={CLUB_PHOTO[programme]} className="mb-4 min-h-[300px]">
      <div className="flex min-h-[300px] flex-col justify-between gap-3 p-4">
        <div className="flex justify-end gap-2">
          <Link to="/inbox" className={`${icon} relative text-white`} style={{ background: 'rgba(0,0,0,.28)' }} aria-label={`Messages${unread ? `, ${unread} unread` : ''}`}><Bell size={20} />{unread > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-red px-1.5 text-[11px] leading-4 text-white">{unread}</span>}</Link>
          <Link to="/help" className={`${icon} text-white`} style={{ background: 'rgba(0,0,0,.28)' }} data-tour="help-button" aria-label="Help"><HelpCircle size={20} /></Link>
          <button className={`${icon} text-white`} style={{ background: 'rgba(0,0,0,.28)' }} aria-label="Toggle sun mode" onClick={() => update((s) => ({ ...s, mode: s.mode === 'club' ? 'sun' : 'club' }))}>{mode === 'club' ? <Sun size={20} /> : <Moon size={20} />}</button>
        </div>
        <div className="flex items-center gap-3">
          <img src={CREST[programme]} alt="" width={76} height={76} className="h-[76px] w-[76px] shrink-0 rounded-full bg-white object-contain p-1 shadow-lg" />
          <div className="min-w-0"><div className="display text-[40px] leading-none text-white">{a}</div><div className="text-sm font-semibold tracking-[.2em] text-white">{b}</div><div className="text-sm italic text-gold">{motto}</div></div>
        </div>
        <div className="text-white"><div className="text-[28px] font-bold leading-tight drop-shadow">Building better<br />young athletes</div><div className="mt-1 text-sm opacity-90">{values.slice(0, 5).join('  •  ')}</div></div>
      </div>
    </Hero>
  );
}

/** Football icon (the icon set has none). */
export function Ball({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" /><path d="M12 7.2l3.6 2.6-1.4 4.2H9.8L8.4 9.8z" fill="currentColor" fillOpacity=".9" /><path d="M12 7.2V3M15.6 9.8l4-1.3M14.2 14l2.5 3.5M9.8 14l-2.5 3.5M8.4 9.8l-4-1.3" />
    </svg>
  );
}
