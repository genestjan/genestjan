/** "Wheelie", the friendly bike wheel who explains things. Decorative: always hidden from screen readers. */
export function Mascot({ size = 96, mood = 'happy' }: { size?: number; mood?: 'happy' | 'calm' | 'cheer' }) {
  const mouth = mood === 'calm' ? 'M48 78 Q60 82 72 78' : mood === 'cheer' ? 'M44 74 Q60 96 76 74 Z' : 'M46 76 Q60 90 74 76';
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 120 120" className="shrink-0">
      <defs>
        <linearGradient id="mrim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b95a0" />
          <stop offset="1" stopColor="#1d5b6c" />
        </linearGradient>
      </defs>
      {/* tyre and rim, in the logo's teal */}
      <circle cx="60" cy="66" r="42" fill="#ffffff" stroke="url(#mrim)" strokeWidth="9" />
      <circle cx="60" cy="66" r="33" fill="none" stroke="#f4a97a" strokeWidth="2" strokeDasharray="3 5" />
      {/* helmet */}
      <path d="M22 50 Q60 -2 98 50 Z" fill="#f4a97a" stroke="#1d5b6c" strokeWidth="5" strokeLinejoin="round" />
      <path d="M60 20 L60 50" stroke="#1d5b6c" strokeWidth="4" />
      <rect x="20" y="48" width="80" height="8" rx="4" fill="#1d5b6c" />
      {/* face */}
      <circle cx="46" cy="68" r="5.5" fill="#243447" />
      <circle cx="74" cy="68" r="5.5" fill="#243447" />
      <circle cx="48" cy="66" r="1.8" fill="#fff" />
      <circle cx="76" cy="66" r="1.8" fill="#fff" />
      <path d={mouth} fill={mood === 'cheer' ? '#d32f2f' : 'none'} stroke="#243447" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="38" cy="80" r="5" fill="#fda4af" opacity=".7" />
      <circle cx="82" cy="80" r="5" fill="#fda4af" opacity=".7" />
    </svg>
  );
}
