import { NEXT_STATUS } from '@/domain/jobs';
import type { JobStatus } from '@/domain/types';

/** Shortest valid chain of statuses from `from` to `ready` (excluding `from`). Empty if already there or impossible. */
export function pathToReady(from: JobStatus): JobStatus[] {
  if (from === 'ready') return [];
  const prev = new Map<JobStatus, JobStatus | null>([[from, null]]);
  const queue: JobStatus[] = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === 'ready') break;
    for (const n of NEXT_STATUS[cur]) {
      if (n === 'cancelled' || n === 'completed' || prev.has(n)) continue;
      prev.set(n, cur);
      queue.push(n);
    }
  }
  if (!prev.has('ready')) return [];
  const out: JobStatus[] = [];
  for (let s: JobStatus | null | undefined = 'ready'; s && s !== from; s = prev.get(s)) out.unshift(s);
  return out;
}

/** Size to scale an image down to so its longest side is at most `max`. Never upscales. */
export function fitWithin(w: number, h: number, max = 1280) {
  const k = Math.min(1, max / Math.max(w, h, 1));
  return { w: Math.round(w * k), h: Math.round(h * k) };
}
