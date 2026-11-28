import { BRAND } from './brand';

// Bikemoko badge: white gear with crossed wrench and screwdriver on black.
// Drawn as vector from the official logo so it stays sharp at every size.
const GEAR = 'M228.0,88.9 L231.2,66.2 L268.8,66.2 L272.0,88.9 L323.6,110.3 L341.9,96.5 L368.5,123.1 L354.7,141.4 L376.1,193.0 L398.8,196.2 L398.8,233.8 L376.1,237.0 L354.7,288.6 L368.5,306.9 L341.9,333.5 L323.6,319.7 L272.0,341.1 L268.8,363.8 L231.2,363.8 L228.0,341.1 L176.4,319.7 L158.1,333.5 L131.5,306.9 L145.3,288.6 L123.9,237.0 L101.2,233.8 L101.2,196.2 L123.9,193.0 L145.3,141.4 L131.5,123.1 L158.1,96.5 L176.4,110.3 Z M342,215 A92,92 0 1,0 158,215 A92,92 0 1,0 342,215 Z';

export function Mark({ size = 32 }: { size?: number }) {
  if (BRAND.logoUrl) return <img src={BRAND.logoUrl} alt={BRAND.name} width={size} height={size} className="rounded-full object-contain" />;
  return (
    <svg width={size} height={size} viewBox="70 35 360 360" aria-hidden className="shrink-0 text-white">
      <circle cx="250" cy="215" r="176" fill="#000" strokeWidth="8" style={{ stroke: "rgb(var(--line))" }} />
      <path fill="currentColor" fillRule="evenodd" d={GEAR} />
      <g transform="translate(250 215)" fill="currentColor">
  <g transform="rotate(-45)">
    <rect x="-6" y="-58" width="12" height="62" rx="3"/>
    <rect x="-10" y="4" width="20" height="52" rx="7"/>
  </g>
  <g transform="rotate(45)">
    <rect x="-6" y="-40" width="12" height="96" rx="5"/>
    <path d="M-17,-62 a18,18 0 1,0 34,0 l-8,-6 v14 h-18 v-14 z"/>
  </g>
</g>
    </svg>
  );
}

/** Full lockup: badge, BIKEMOKO in brand orange, PARTS AND ACCESSORIES. */
export function Wordmark({ size = 32, sub = true }: { size?: number; sub?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <Mark size={size} />
      <div className="leading-none">
        <div className="font-brand text-[1.35rem] font-bold uppercase tracking-[0.02em] text-brand">{BRAND.name}</div>
        {sub && <div className="mt-0.5 font-brand text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted">{BRAND.tagline}</div>}
      </div>
    </div>
  );
}
