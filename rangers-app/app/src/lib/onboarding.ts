import { useSyncExternalStore } from 'react';

/** Per-phone flags: has this phone seen the welcome screen, and the tour for each role? */
const key = (k: string) => `rangers-${k}`;
const read = (k: string) => { try { return localStorage.getItem(key(k)) === '1'; } catch { return false; } };
const write = (k: string, v: boolean) => { try { v ? localStorage.setItem(key(k), '1') : localStorage.removeItem(key(k)); } catch { /* private mode: it will show again, which is harmless */ } };

const subs = new Set<() => void>(); let tick = 0;
const bump = () => { tick++; subs.forEach((f) => f()); };
const use = () => useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => tick);

export type TourRole = 'coach' | 'parent';
export const tourRole = (role: string): TourRole => (role === 'parent' ? 'parent' : 'coach');
export function useWelcome() { use(); return { seen: read('welcome'), done: () => { write('welcome', true); bump(); } }; }
export function useTour(role: TourRole) {
  use();
  return { open: !read(`tour-${role}`), done: () => { write(`tour-${role}`, true); bump(); }, replay: () => { write(`tour-${role}`, false); bump(); } };
}
