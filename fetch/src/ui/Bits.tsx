import { useState } from 'react';
import { Star } from 'lucide-react';
import type { PayMethod } from '../lib/types';

export function Stars({ value, onChange, size = 'h-8 w-8' }: { value: number; onChange?: (n: number) => void; size?: string }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onChange} onClick={() => onChange?.(n)} aria-label={n + ' stars'}>
          <Star className={size + ' ' + (n <= value ? 'fill-neon text-neon' : 'text-white/30')} />
        </button>
      ))}
    </div>
  );
}

export const PAY_LABEL: Record<PayMethod, string> = { cash: 'Cash', gcash: 'GCash', bank: 'Bank transfer' };

export function PayPicker({ value, onChange }: { value: PayMethod; onChange: (m: PayMethod) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {(['cash', 'gcash', 'bank'] as PayMethod[]).map((m) => (
        <button key={m} type="button" onClick={() => onChange(m)} className={'rounded-2xl border px-2 py-3 text-sm font-semibold ' + (value === m ? 'border-neon bg-neon/15 text-neon' : 'border-white/10 bg-white/5')}>
          {m === 'cash' ? '💵' : m === 'gcash' ? '📱' : '🏦'} {PAY_LABEL[m]}
        </button>
      ))}
    </div>
  );
}

export function Rate({ title, onSubmit, withTip }: { title: string; withTip?: boolean; onSubmit: (stars: number, comment: string, tip: number) => void }) {
  const [s, setS] = useState(5);
  const [c, setC] = useState('');
  const [tip, setTip] = useState(0);
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-extrabold">{title}</h3>
      <Stars value={s} onChange={setS} size="h-10 w-10" />
      <textarea className="input min-h-20" placeholder="Leave a comment (optional)" value={c} onChange={(e) => setC(e.target.value)} />
      {withTip && (
        <div><p className="label">Add a tip for your driver</p>
          <div className="flex gap-2">{[0, 10, 20, 50, 100].map((t) => <button key={t} type="button" onClick={() => setTip(t)} className={'chip flex-1 ' + (tip === t ? 'bg-neon text-ink' : 'bg-white/10')}>{t ? '₱' + t : 'None'}</button>)}</div></div>
      )}
      <button className="btn-neon w-full" onClick={() => onSubmit(s, c.trim(), tip)}>Submit</button>
    </div>
  );
}

export function Sheet({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={'absolute inset-x-0 bottom-0 z-[500] max-h-[78%] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-ink/95 p-4 pb-safe backdrop-blur ' + className}>{children}</div>;
}

export function registerSW() {
  // Not inside the Android app (served from https://localhost), where the files are already on the phone.
  if ('serviceWorker' in navigator && import.meta.env.PROD && location.hostname !== 'localhost') navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {});
}
