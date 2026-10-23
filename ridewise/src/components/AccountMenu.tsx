import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleHelp, Lock, Settings, Users } from 'lucide-react';
import { useAuth } from '../store/auth';
import { Avatar } from './auth/parts';

export function AccountMenu() {
  const { current, lock, switchRider, accounts } = useAuth();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', away);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', away);
    };
  }, [open]);
  if (!current) return null;
  const item = 'flex min-h-[48px] w-full items-center gap-3 rounded-full px-4 text-left text-base font-semibold text-navy hover:bg-brand-50';
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" aria-label={`${current.name}'s menu`} className="flex min-h-[44px] items-center gap-2 rounded-full bg-white/80 py-1 pl-1 pr-3 text-navy shadow-sm">
        <Avatar account={current} size={34} />
        <span className="hidden max-w-[6rem] truncate text-sm font-bold min-[400px]:block">{current.name}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-[1100] mt-2 w-60 rounded-3xl bg-white p-2 shadow-lift">
          <Link role="menuitem" to="/help" className={item} onClick={() => setOpen(false)}>
            <CircleHelp aria-hidden className="h-5 w-5" /> Help
          </Link>
          <Link role="menuitem" to="/settings" className={item} onClick={() => setOpen(false)}>
            <Settings aria-hidden className="h-5 w-5" /> My settings
          </Link>
          <button role="menuitem" type="button" className={item} onClick={() => { setOpen(false); void lock(); }}>
            <Lock aria-hidden className="h-5 w-5" /> Lock for now
          </button>
          <button role="menuitem" type="button" className={item} onClick={() => { setOpen(false); void switchRider(); }}>
            <Users aria-hidden className="h-5 w-5" /> {accounts.length > 1 ? 'Switch rider' : 'Add or switch rider'}
          </button>
        </div>
      )}
    </div>
  );
}
