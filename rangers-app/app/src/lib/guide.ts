import { useSyncExternalStore } from 'react';

/** Which "Show me how" guide is running, and on which step. One at a time. */
export interface GuideRun { id: string; step: number }
let run: GuideRun | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
export const startGuide = (id: string) => { run = { id, step: 0 }; emit(); };
export const goStep = (step: number) => { if (run) { run = { ...run, step }; emit(); } };
export const stopGuide = () => { run = null; emit(); };
export const useGuideRun = () => useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => run);
