import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, ClipboardCheck, Droplets, MapPin, Siren } from 'lucide-react';
import { Mascot } from './Mascot';

/** A button that LOOKS like the real one, so riders know what to tap. Not clickable. */
function Fake({ children, tone = 'go' }: { children: ReactNode; tone?: 'go' | 'navy' | 'danger' | 'plain' }) {
  const cls = { go: 'bg-brand-700 text-white', navy: 'bg-navy text-white', danger: 'bg-danger text-white', plain: 'border-2 border-brand-300 bg-white text-brand-800' }[tone];
  return (
    <span aria-hidden="true" className={`inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full px-5 text-lg font-bold ${cls}`}>
      {children}
    </span>
  );
}

type Slide = { emoji: string; title: string; body: ReactNode; picture?: ReactNode; mood?: 'happy' | 'calm' | 'cheer' };

const SLIDES: Slide[] = [
  {
    emoji: '👋',
    title: "Hi! I'm Wheelie!",
    mood: 'cheer',
    body: (
      <>
        <p>I help you plan a long bike ride.</p>
        <p>I will show you how in about one minute. Ready?</p>
      </>
    ),
  },
  {
    emoji: '📍',
    title: 'First, pick where to start and where to stop',
    body: (
      <>
        <p>Like a treasure map! Pick the place you start. Then pick the place you finish.</p>
        <p>Tap the big <strong>Plan My Ride</strong> button to begin.</p>
      </>
    ),
    picture: (
      <div className="flex items-center justify-center gap-3 text-3xl" aria-hidden="true">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-go text-xl font-bold text-white">S</span>
        <span className="text-slate-400">· · · · · ·</span>
        <span className="grid h-14 w-14 place-items-center rounded-full bg-navy text-xl font-bold text-white">F</span>
      </div>
    ),
  },
  {
    emoji: '🛣️',
    title: 'I find a road for bikes',
    body: (
      <>
        <p>The dark line on the map is the road we will follow. The little arrows show which way to go.</p>
        <p>I can make mistakes, so always look out for cars and follow road rules.</p>
      </>
    ),
    picture: (
      <svg aria-hidden="true" viewBox="0 0 240 90" className="mx-auto h-24 w-full max-w-xs">
        <rect width="240" height="90" rx="16" fill="#e2e8f0" />
        <path d="M15 70 C60 70 70 20 120 40 S190 70 225 20" fill="none" stroke="#fff" strokeWidth="12" strokeLinecap="round" />
        <path d="M15 70 C60 70 70 20 120 40 S190 70 225 20" fill="none" stroke="#0f1b2d" strokeWidth="6" strokeLinecap="round" />
        <circle cx="15" cy="70" r="9" fill="#15803d" />
        <circle cx="225" cy="20" r="9" fill="#0f1b2d" />
        <path d="M118 30 l12 8 l-14 4 z" fill="#0f1b2d" />
      </svg>
    ),
  },
  {
    emoji: '🥤',
    title: 'I find places to stop',
    body: (
      <>
        <p>On a long ride you need to drink water, eat a snack, and rest. I look for shops and food places on the way.</p>
        <p>The map is made by people, so a shop might be closed. When I am not sure, I say <strong>"Hours not verified"</strong>.</p>
      </>
    ),
    picture: (
      <div className="flex items-center justify-center gap-3" aria-hidden="true">
        {[
          ['S', '#7c3aed'],
          ['F', '#c2410c'],
          ['W', '#0369a1'],
        ].map(([l, c]) => (
          <span key={l} className="grid h-12 w-12 place-items-center rounded-full border-2 border-white text-lg font-bold text-white shadow" style={{ background: c }}>
            {l}
          </span>
        ))}
      </div>
    ),
  },
  {
    emoji: '⏱️',
    title: 'Stay longer? The times move!',
    body: (
      <>
        <p>Open the <strong>Stops</strong> page. Each stop says when you get there and when you leave.</p>
        <p>Tap <strong>+</strong> to rest longer. Every time after it changes by itself. No maths!</p>
      </>
    ),
    picture: (
      <div className="flex items-center justify-center gap-3" aria-hidden="true">
        <Fake tone="plain">−</Fake>
        <span className="text-2xl font-extrabold">15 min</span>
        <Fake tone="plain">+</Fake>
      </div>
    ),
  },
  {
    emoji: '🔧',
    title: 'Look at your bike first',
    body: (
      <>
        <p>Before you go, check your helmet, brakes, tires and lights. Tap <strong>OK</strong> for each one.</p>
        <p>If something is wrong, tap <strong>Problem</strong>. Do not ride until it is fixed.</p>
      </>
    ),
    picture: (
      <div className="flex items-center justify-center gap-3" aria-hidden="true">
        <Fake tone="go"><Check className="h-5 w-5" /> OK</Fake>
        <Fake tone="danger">Problem</Fake>
        <ClipboardCheck className="h-10 w-10 text-navy" />
      </div>
    ),
  },
  {
    emoji: '🏁',
    title: 'On ride day, open the Ride page',
    body: (
      <>
        <p>When you reach a stop, tap the big green button. Then rest, drink and eat.</p>
        <p>Only use your phone when you are stopped. Never while the bike is moving!</p>
      </>
    ),
    picture: (
      <div className="flex flex-col items-center gap-2" aria-hidden="true">
        <Fake tone="go"><MapPin className="h-5 w-5" /> Arrived at stop</Fake>
        <Fake tone="plain"><Droplets className="h-5 w-5" /> Start rest timer</Fake>
      </div>
    ),
  },
  {
    emoji: '❤️',
    title: 'Feeling dizzy, hurt, or very tired?',
    mood: 'calm',
    body: (
      <>
        <p>Tap <strong>How am I feeling?</strong> and tell me. Then stop in a safe place and rest. I will never ask you to hurry.</p>
        <p>If it is serious, tap the red <strong>SOS</strong> button. It shows who to call and the nearest hospitals.</p>
      </>
    ),
    picture: (
      <div className="flex items-center justify-center gap-3" aria-hidden="true">
        <Fake tone="navy">How am I feeling?</Fake>
        <Fake tone="danger"><Siren className="h-5 w-5" /> SOS</Fake>
      </div>
    ),
  },
];

/**
 * First-time walkthrough. Full screen, one idea per page, big buttons.
 * onFinish(true) means "start the sample ride".
 */
export function Tutorial({ onFinish }: { onFinish: (trySample: boolean) => void }) {
  const [i, setI] = useState(0);
  const last = SLIDES.length; // one extra "you're ready" page
  const heading = useRef<HTMLHeadingElement>(null);
  const isReady = i === last;
  const slide = SLIDES[Math.min(i, last - 1)];

  // Move focus to the new heading so screen readers read each page.
  useEffect(() => {
    heading.current?.focus();
  }, [i]);

  return (
    <div className="fixed inset-0 z-[4000] flex flex-col bg-gradient-to-b from-brand-100 via-brand-50 to-page text-navy" role="dialog" aria-modal="true" aria-label="How to use RideWise">
      <div className="flex items-center justify-between px-4 pt-4">
        <p className="text-sm font-semibold text-slate-600">
          {isReady ? 'All done!' : `Page ${i + 1} of ${last}`}
        </p>
        {!isReady && (
          <button type="button" onClick={() => onFinish(false)} className="min-h-[44px] rounded-full px-4 text-base font-semibold text-brand-800 underline">
            Skip
          </button>
        )}
      </div>
      <div className="flex flex-1 flex-col items-center overflow-y-auto px-5 pb-4 pt-2">
        <Mascot size={isReady ? 140 : 96} mood={isReady ? 'cheer' : slide.mood ?? 'happy'} />
        <div className="mt-3 w-full max-w-md rounded-4xl bg-white p-6 shadow-lift">
          <p aria-hidden="true" className="text-5xl">{isReady ? '🎉' : slide.emoji}</p>
          <h2 ref={heading} tabIndex={-1} className="mt-2 text-2xl font-extrabold leading-snug text-navy outline-none">
            {isReady ? "You're ready!" : slide.title}
          </h2>
          {isReady ? (
            <div className="mt-2 space-y-3 text-lg leading-relaxed">
              <p>Want to try a pretend ride first? It is the real road from General Santos to Davao, with real shops.</p>
              <p>You can see this lesson again any time. Tap <strong>More</strong>, then <strong>Help</strong>.</p>
            </div>
          ) : (
            <div className="mt-2 space-y-3 text-lg leading-relaxed">{slide.body}</div>
          )}
          {!isReady && slide.picture && <div className="mt-4 rounded-3xl bg-brand-50 p-4">{slide.picture}</div>}
        </div>
      </div>
      <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto max-w-md">
          <div className="mb-3 flex justify-center gap-2" aria-hidden="true">
            {Array.from({ length: last + 1 }).map((_, n) => (
              <span key={n} className={`h-2.5 rounded-full transition-all ${n === i ? 'w-8 bg-brand-700' : 'w-2.5 bg-brand-200'}`} />
            ))}
          </div>
          {isReady ? (
            <div className="space-y-2">
              <button type="button" className="btn-go w-full text-lg" onClick={() => onFinish(true)}>
                Try a pretend ride
              </button>
              <button type="button" className="btn-secondary w-full text-lg" onClick={() => onFinish(false)}>
                I will plan my own ride
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button type="button" className="btn-secondary min-w-[110px] text-lg disabled:opacity-30" onClick={() => setI((n) => n - 1)} disabled={i === 0}>
                <ArrowLeft aria-hidden className="h-5 w-5" /> Back
              </button>
              <button type="button" className="btn-go flex-1 text-lg" onClick={() => setI((n) => n + 1)}>
                {i === 0 ? "Let's go!" : 'Next'} <ArrowRight aria-hidden className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
