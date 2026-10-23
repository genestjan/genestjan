import { useId } from 'react';
import { APP_NAME, APP_TAGLINE } from '../brand';

/**
 * RideWise mark: a bicycle wheel (teal rim, peach spokes) with a route arrow
 * rising out of it. Drawn from scratch as plain SVG so it stays sharp at every
 * size and works offline.
 */
export function LogoMark({ size = 40, title }: { size?: number; title?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} focusable="false" className="shrink-0">
      <defs>
        <linearGradient id={`rim${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b95a0" />
          <stop offset="1" stopColor="#1d5b6c" />
        </linearGradient>
        <linearGradient id={`arrow${id}`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#1d5b6c" />
          <stop offset="0.55" stopColor="#6fb3ba" />
          <stop offset="1" stopColor="#f4a97a" />
        </linearGradient>
      </defs>
      {/* wheel */}
      <circle cx="50" cy="54" r="38" fill="#ffffff" fillOpacity="0.75" />
      <path d="M55.5 52.0L78.2 71.0 M55.5 52.0L78.2 33.0 M54.8 54.8L64.9 82.6 M54.8 54.8L83.9 49.6 M52.8 56.8L47.6 85.9 M52.8 56.8L80.6 66.9 M50.0 57.5L31.0 80.2 M50.0 57.5L69.0 80.2 M47.2 56.8L19.4 66.9 M47.2 56.8L52.4 85.9 M45.2 54.8L16.1 49.6 M45.2 54.8L35.1 82.6 M44.5 52.0L21.8 33.0 M44.5 52.0L21.8 71.0 M45.2 49.2L35.1 21.4 M45.2 49.2L16.1 54.4 M47.2 47.2L52.4 18.1 M47.2 47.2L19.4 37.1 M50.0 46.5L69.0 23.8 M50.0 46.5L31.0 23.8 M52.8 47.2L80.6 37.1 M52.8 47.2L47.6 18.1 M54.8 49.2L83.9 54.4 M54.8 49.2L64.9 21.4" fill="none" stroke="#f4a97a" strokeWidth="1.1" strokeLinecap="round" opacity="0.95" />
      <circle cx="50" cy="52" r="6" fill="#ffffff" stroke="#1d5b6c" strokeWidth="2" />
      <circle cx="50" cy="52" r="2" fill="#1d5b6c" />
      <circle cx="50" cy="54" r="38" fill="none" stroke={`url(#rim${id})`} strokeWidth="7.5" />
      {/* route arrow rising out of the wheel */}
      <path
        d="M18 80 C 34 84, 46 72, 56 62 L 62 66 L 74 44 L 80 48 L 90 20 L 62 30 L 69 34 L 60 52 L 54 48 C 46 58, 34 68, 18 72 Z"
        fill={`url(#arrow${id})`}
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Mark plus the name. `tagline` adds the small line under it, as on the splash screen. */
export function Logo({ size = 40, tagline = false, className = '' }: { size?: number; tagline?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={size} />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[1.4rem] font-semibold tracking-tight text-brand-800" style={{ fontSize: size * 0.62 }}>
          {APP_NAME}
        </span>
        {tagline && (
          <span className="mt-1 font-display text-[0.62rem] font-medium uppercase tracking-[0.28em] text-brand-700" style={{ fontSize: size * 0.2 }}>
            {APP_TAGLINE}
          </span>
        )}
      </span>
    </span>
  );
}
