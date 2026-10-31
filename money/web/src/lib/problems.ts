import { useSyncExternalStore } from 'react';
import { platform } from './native';

// Problems this device ran into, kept on this device only so they can be screenshotted or
// copied and sent for help. Error messages and technical details only: never amounts, names,
// notification text, passwords or keys.

/** An error with a plain message for the screen and the exact technical detail behind it. */
export class AppError extends Error {
  constructor(message: string, readonly detail?: string) {
    super(message);
  }
}

export interface Problem { at: number; where: string; message: string; detail?: string; count: number }

const STORE = 'mh-problems';
const KEEP = 30;
const listeners = new Set<() => void>();
let cached: Problem[] | null = null;

export const appTag = () => `Money Hub ${__APP_VERSION__} ${platform}`;

// Stack lines name the app's own files, without the long page address in front.
const shorten = (s: string) => s.replace(/https:\/\/(appassets\.androidplatform\.net\/assets\/web|money\.hub)\//g, '');

/**
 * The message to show and the detail to keep. A plain Error is a message written for people, so
 * it has no detail; anything else (TypeError, DOMException, a Supabase error) keeps where it broke.
 */
export function describeError(e: unknown): { message: string; detail?: string } {
  if (e instanceof AppError) return { message: e.message, detail: e.detail };
  if (e instanceof Error) {
    if (e.name === 'Error') return { message: e.message || 'Something went wrong.' };
    const frame = e.stack?.split('\n').find((l) => l.trim().startsWith('at '))?.trim();
    return { message: e.message || e.name, detail: shorten([e.name, frame].filter(Boolean).join(' ')) };
  }
  if (typeof e === 'string' && e) return { message: e };
  let raw = String(e);
  try { raw = JSON.stringify(e) ?? raw; } catch { /* keep String(e) */ }
  return { message: 'Something went wrong.', detail: raw.slice(0, 300) };
}

function read(): Problem[] {
  if (cached) return cached;
  try {
    const v: unknown = JSON.parse(localStorage.getItem(STORE) || '[]');
    cached = Array.isArray(v) ? (v as Problem[]) : [];
  } catch {
    cached = [];
  }
  return cached;
}

function write(list: Problem[]) {
  cached = list;
  try { localStorage.setItem(STORE, JSON.stringify(list)); } catch { /* storage blocked: keep them for this session */ }
  listeners.forEach((fn) => fn());
}

export const problems = read;

/** Writes a problem down (the same one again just counts up) and returns what to show. */
export function logProblem(where: string, e: unknown): Problem {
  const { message, detail } = describeError(e);
  const list = read();
  const last = list[0];
  const same = !!last && last.where === where && last.message === message && last.detail === detail;
  const p: Problem = same ? { ...last, at: Date.now(), count: last.count + 1 } : { at: Date.now(), where, message, detail, count: 1 };
  write([p, ...list.slice(same ? 1 : 0)].slice(0, KEEP));
  return p;
}

export function clearProblems() {
  write([]);
}

export function useProblems(): Problem[] {
  return useSyncExternalStore((fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, read);
}

const when = (ts: number) => new Date(ts).toLocaleString('en-GB', { timeZoneName: 'short' });

/** Plain text to paste into a message: app version, device, cloud address and the latest problems. */
export function problemReport(list: Problem[], cloud?: string): string {
  const lines = [
    'Money Hub problem report',
    `${appTag()}, copied ${when(Date.now())}`,
    `Device: ${navigator.userAgent}`,
    `Cloud: ${cloud ?? 'none (this device only)'}`,
    '',
  ];
  for (const p of list.slice(0, 15)) {
    lines.push(`${when(p.at)} · ${p.where}${p.count > 1 ? ` · ${p.count} times` : ''}`, `  ${p.message}`);
    if (p.detail) lines.push(`  ${p.detail}`);
  }
  if (!list.length) lines.push('No problems recorded.');
  return lines.join('\n');
}

/** Copies text, falling back to the old way when the clipboard is not allowed. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const t = document.createElement('textarea');
    t.value = text;
    t.setAttribute('readonly', '');
    t.style.position = 'fixed';
    t.style.opacity = '0';
    document.body.appendChild(t);
    t.select();
    const ok = document.execCommand('copy');
    t.remove();
    return ok;
  }
}
