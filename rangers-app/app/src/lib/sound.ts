import { useEffect, useRef } from 'react';
import { useAppState } from './store';
import { isStaff, useRole } from './role';

/** The club song ("We move as one") as the alert sound while the app is open. Each phone can turn it off. */
const KEY = 'rangers-sound';
export const TONE = 'sounds/rangers-alert.mp3';
export const soundOn = () => { try { return localStorage.getItem(KEY) !== '0'; } catch { return true; } };
export const setSoundOn = (on: boolean) => { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* ignore */ } };
let last = 0; let audio: HTMLAudioElement | null = null;
/** Plays the tone (at most once every 4 seconds). Phones only allow sound after the person has tapped the app once. */
export function playAlert(force = false) {
  if (!force && (!soundOn() || Date.now() - last < 4000)) return; last = Date.now();
  try { audio ??= new Audio(TONE); audio.currentTime = 0; void audio.play().catch(() => undefined); (window as unknown as { __rangersAlerts?: number }).__rangersAlerts = ((window as unknown as { __rangersAlerts?: number }).__rangersAlerts ?? 0) + 1; } catch { /* no sound on this phone */ }
}
/** Plays the song for new announcements and messages from other people, and for push alerts that arrive while the app is open. */
export function useAlertSounds() {
  const s = useAppState(); const staff = isStaff(useRole());
  const known = useRef<Set<string> | null>(null); const was = useRef(staff);
  if (was.current !== staff) { was.current = staff; known.current = null; }   // a coach previewing the family view: nothing is new
  const fresh = [...s.announcements.filter((a) => a.by !== s.me.name).map((a) => a.id), ...s.messages.filter((m) => (staff ? m.from === 'parent' : m.from === 'coach')).map((m) => m.id)];
  useEffect(() => {
    if (!known.current) { known.current = new Set(fresh); return; }   // what was there when the app opened is not new
    const added = fresh.filter((id) => !known.current!.has(id)); added.forEach((id) => known.current!.add(id));
    if (added.length) playAlert();
  });
  useEffect(() => {
    const on = (e: MessageEvent) => { if ((e.data as { type?: string })?.type === 'rangers-push' && document.visibilityState === 'visible') playAlert(); };
    navigator.serviceWorker?.addEventListener('message', on);
    return () => navigator.serviceWorker?.removeEventListener('message', on);
  }, []);
}
