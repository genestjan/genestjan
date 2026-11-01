import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Phone, Send, X } from 'lucide-react';
import type { Backend } from '../lib/backend';
import { uid } from '../lib/backend';
import type { Message, Role } from '../lib/types';
import { useLive } from './useData';

const QUICK: Record<Role, string[]> = {
  customer: ['Nandito na po ako sa labas', 'Asa na ka?', 'Pwede po ba hintayin ko?', 'Salamat!'],
  driver: ['Papunta na po ako', 'Andito na po ako', 'Traffic po, 5 mins', 'Wala po stock, palitan?'],
};

export function CallButton({ phone, className = '' }: { phone: string; className?: string }) {
  return <a href={'tel:' + phone} className={'btn-ghost !px-4 ' + className} aria-label="Call"><Phone className="h-5 w-5 text-neon" /></a>;
}

export function Chat({ be, tripId, me, otherName, otherPhone, onClose }: { be: Backend; tripId: string; me: Role; otherName: string; otherPhone: string; onClose: () => void }) {
  const [msgs] = useLive<Message[]>(be, ['messages'], async () => (await be.list<Message>('messages', 'tripId', tripId)).sort((a, b) => a.at - b.at), [tripId]);
  const [text, setText] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs?.length]);
  const send = async (t: string) => { if (!t.trim()) return; setText(''); await be.put('messages', { id: uid(), tripId, from: me, text: t.trim(), at: Date.now() }); };
  return (
    <div className="fixed inset-0 z-[1000] flex flex-col bg-ink">
      <header className="flex items-center gap-3 border-b border-white/10 p-4 pt-safe">
        <button onClick={onClose} aria-label="Close chat" className="rounded-full bg-white/10 p-2"><X className="h-5 w-5" /></button>
        <div className="flex-1"><p className="font-bold">{otherName}</p><p className="text-xs text-lime">In-app chat. Your number stays private unless you call.</p></div>
        <CallButton phone={otherPhone} />
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {!msgs?.length && <p className="mt-10 text-center text-white/50"><MessageCircle className="mx-auto mb-2" />Say hello and agree on the details.</p>}
        {msgs?.map((m) => (
          <div key={m.id} className={'max-w-[80%] rounded-2xl px-4 py-2.5 ' + (m.from === me ? 'ml-auto bg-neon text-ink' : 'bg-white/10')}>
            <p>{m.text}</p><p className={'mt-0.5 text-[10px] ' + (m.from === me ? 'text-ink/60' : 'text-white/40')}>{new Date(m.at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}</p>
          </div>
        ))}
        <div ref={end} />
      </div>
      <div className="flex gap-2 overflow-x-auto px-4 pb-2">{QUICK[me].map((q) => <button key={q} className="chip shrink-0 bg-white/10" onClick={() => send(q)}>{q}</button>)}</div>
      <form className="flex gap-2 border-t border-white/10 p-3 pb-safe" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <input className="input" placeholder="Type a message" value={text} onChange={(e) => setText(e.target.value)} aria-label="Message" />
        <button className="btn-neon !px-4" aria-label="Send"><Send className="h-5 w-5" /></button>
      </form>
    </div>
  );
}
