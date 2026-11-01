import { useEffect, useState } from 'react';

const logo = import.meta.env.BASE_URL + 'logo.png';

/** Animated logo intro: speed streaks, logo punch-in, headlight flash, shine sweep, wordmark. */
export function Intro({ subtitle, onDone }: { subtitle: string; onDone: () => void }) {
  const [out, setOut] = useState(false);
  useEffect(() => {
    const a = setTimeout(() => setOut(true), 3200);
    const b = setTimeout(onDone, 3700);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [onDone]);
  return (
    <div className={'intro' + (out ? ' out' : '')} onClick={() => { setOut(true); setTimeout(onDone, 400); }} role="presentation" data-testid="intro">
      {[12, 26, 38, 55, 63, 74, 88].map((top, i) => (
        <span key={i} className="streak" style={{ top: top + '%', animationDelay: i * 0.07 + 's', width: 20 + (i % 3) * 15 + 'vw' }} />
      ))}
      <span className="ring" />
      <div className="logo-wrap">
        <img src={logo} alt="Fetch GenSan" />
        <span className="flare" />
        <span className="shine" />
      </div>
      <div className="word">
        <h1><span className="text-white">Fetch </span><span className="text-neon">GenSan</span></h1>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}
