import { useEffect, useState } from 'react';
import { SlideView, SLIDES, type SlideData } from '../components/Slides';
import { cloudEnabled, sb } from '../lib/cloud';

/** Open on the TV's browser, type the code shown on the coach's phone. Shows kid-facing slides only. */
export default function Tv() {
  const [code, setCode] = useState(''); const [joined, setJoined] = useState(''); const [msg, setMsg] = useState<{ i: number; data: SlideData } | null>(null);
  useEffect(() => {
    if (!joined) return; let ch: { unsubscribe: () => unknown } | undefined;
    sb().then((c) => { ch = c.channel('tv-' + joined).on('broadcast', { event: 'slide' }, (p) => setMsg(p.payload as never)).subscribe(); });
    return () => { void ch?.unsubscribe(); };
  }, [joined]);
  if (!cloudEnabled) return <div className="p-8 text-2xl">TV link needs the club's online account. Use an HDMI cable or screen mirroring instead.</div>;
  if (!joined) return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-6" style={{ background: 'var(--bg)' }}>
      <h1 className="display text-8xl">Rangers FC</h1><p className="text-3xl">Type the code from the coach's phone</p>
      <input className="field max-w-md text-center text-6xl uppercase tracking-widest" style={{ minHeight: 100 }} maxLength={6} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} aria-label="TV code" />
      <button className="btn h-16 px-12 text-2xl" disabled={code.length < 6} onClick={() => setJoined(code)}>Show</button></div>);
  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="px-6 py-3 text-center"><span className="display text-4xl">{msg ? SLIDES[msg.i] : 'Waiting for the coach...'}</span></div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4">{msg && <SlideView d={msg.data} i={msg.i} />}</div>
    </div>);
}
