// Who is using this device right now, their open cash shift, and the theme.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { db } from '@/data/db';
import { useLiveQuery } from '@/data/hooks';
import type { Role, Shift, Staff } from '@/domain/types';

interface SessionValue {
  staff: Staff | null;
  role: Role;
  shift: Shift | null;
  setStaffId: (id: string | null) => void;
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
}

const Ctx = createContext<SessionValue | null>(null);

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null) => {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* private mode */
  }
};

export function SessionProvider({ children }: { children: ReactNode }) {
  const [staffId, setStaffIdState] = useState<string | null>(() => read('bm.staff'));
  const [theme, setThemeState] = useState<'dark' | 'light'>(() => (read('bm.theme') as 'dark' | 'light') ?? 'dark');
  const staff = useLiveQuery(() => (staffId ? db.staff.get(staffId) : undefined), [staffId]) ?? null;
  const shift =
    useLiveQuery(async () => {
      if (!staffId) return null;
      const open = await db.shifts.filter((s) => s.closedAt === null).toArray();
      return open.sort((a, b) => b.openedAt.localeCompare(a.openedAt))[0] ?? null;
    }, [staffId]) ?? null;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0a0b0d' : '#f4f3f0');
  }, [theme]);

  const value: SessionValue = {
    staff,
    role: staff?.role ?? 'owner',
    shift,
    setStaffId: (id) => {
      write('bm.staff', id);
      setStaffIdState(id);
    },
    theme,
    setTheme: (t) => {
      write('bm.theme', t);
      setThemeState(t);
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error('SessionProvider missing');
  return v;
}
