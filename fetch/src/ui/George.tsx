import { useEffect, useRef, useState } from 'react';
import { Mic, Send, X } from 'lucide-react';
import { canListen, listen, parse, speak, musicUrl, HELP_TEXT, type Intent } from '../lib/assistant';

type Line = { who: 'you' | 'george'; text: string };

/**
 * George, the voice assistant. The app supplies `handle`, which acts on an intent and
 * returns what George should say. Music and time are handled here for both apps.
 */
export function George({ handle, greeting }: { handle: (i: Intent) => Promise<string | null>; greeting: string }) {
  const [open, setOpen] = useState(false);
  const [live, setLive] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [text, setText] = useState('');
  const stop = useRef<() => void>();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.scrollTo(0, 1e6); }, [lines]);

  const say = (t: string) => { setLines((l) => [...l, { who: 'george', text: t }]); speak(t); };

  const run = async (raw: string) => {
    if (!raw.trim()) return;
    setLines((l) => [...l, { who: 'you', text: raw }]);
    const i = parse(raw);
    if (i.kind === 'music') { window.open(musicUrl(i.query, i.app), '_blank', 'noopener'); return say(`Opening ${i.query} on ${i.app === 'spotify' ? 'Spotify' : 'YouTube Music'}. Enjoy the ride.`); }
    if (i.kind === 'stopMusic') return say('Music plays in your music app. Pause it there, or press pause on your phone or earphones.');
    if (i.kind === 'time') return say('It is ' + new Date().toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }) + '.');
    if (i.kind === 'help') return say(HELP_TEXT);
    const reply = await handle(i);
    say(reply ?? "Sorry, I didn't catch that. Say \"help\" to hear what I can do.");
  };

  const mic = () => {
    if (live) { stop.current?.(); return; }
    setLive(true);
    stop.current = listen((t) => run(t), (err) => { setLive(false); if (err) say(err); });
  };

  return (
    <>
      <button onClick={() => { setOpen(true); if (!lines.length) say(greeting); }} aria-label="Talk to George"
        className="george-orb fixed right-4 top-24 z-[700] grid h-14 w-14 place-items-center rounded-full text-ink shadow-glow">
        <Mic className="h-6 w-6" />
      </button>
      {open && (
        <div className="fixed inset-x-0 bottom-0 z-[1000] rounded-t-3xl border-t border-neon/40 bg-ink/95 p-4 pb-safe backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-brand text-lg">GEORGE <span className="text-xs font-sans text-white/50">your Fetch assistant</span></p>
            <button onClick={() => { setOpen(false); stop.current?.(); speechSynthesis?.cancel(); }} aria-label="Close George" className="rounded-full bg-white/10 p-2"><X className="h-4 w-4" /></button>
          </div>
          <div ref={box} className="max-h-60 space-y-2 overflow-y-auto">
            {lines.map((l, k) => <p key={k} className={'rounded-2xl px-3 py-2 text-sm ' + (l.who === 'you' ? 'ml-10 bg-white/10' : 'mr-10 bg-neon/15 text-lime')}>{l.text}</p>)}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button onClick={mic} aria-label={live ? 'Stop listening' : 'Speak'} className={'george-orb grid h-12 w-12 shrink-0 place-items-center rounded-full text-ink ' + (live ? 'live' : '')}><Mic /></button>
            <form className="flex flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); run(text); setText(''); }}>
              <input className="input !py-3" placeholder={canListen() ? 'Tap the mic or type' : 'Type a command'} value={text} onChange={(e) => setText(e.target.value)} aria-label="Command" />
              <button className="btn-ghost !px-3" aria-label="Send command"><Send className="h-5 w-5" /></button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
