import { BRAND } from './brand';

/** Bikemoko mark: two wheels joined by a chainline, in the brand orange. Placeholder until the official logo is supplied. */
export function Mark({ size = 32 }: { size?: number }) {
  if (BRAND.logoUrl) return <img src={BRAND.logoUrl} alt={BRAND.name} width={size} height={size} className="rounded-xl object-contain" />;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0">
      <rect width="64" height="64" rx="16" fill="rgb(var(--brand))" />
      <circle cx="19" cy="38" r="10" fill="none" stroke="white" strokeWidth="5" />
      <circle cx="45" cy="38" r="10" fill="none" stroke="white" strokeWidth="5" />
      <path d="M19 38 L29 20 H40 L45 38 M29 20 L35 38 H19" fill="none" stroke="white" strokeWidth="4.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ size = 32, sub = true }: { size?: number; sub?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <Mark size={size} />
      <div className="leading-none">
        <div className="font-display text-[1.15rem] font-bold tracking-tight">
          bike<span className="text-brand">moko</span>
        </div>
        {sub && <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-faint">{BRAND.tagline}</div>}
      </div>
    </div>
  );
}
