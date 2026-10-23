import type { Match, MatchEvent } from './store';
import { playedSeconds, type Interval } from './fairShare';

/** Match clock in seconds, derived from the log; follows wall time while running. */
export function clockSeconds(log: MatchEvent[], now: number): number {
  let total = 0, since: number | null = null;
  for (const e of log) {
    if (e.type === 'start' || e.type === 'resume') since = e.t;
    else if ((e.type === 'pause' || e.type === 'end') && since !== null) { total += (e.t - since) / 1000; since = null; }
  }
  return since !== null ? total + Math.max(0, now - since) / 1000 : total;
}
export const isRunning = (log: MatchEvent[]) => { const l = [...log].reverse().find((e) => ['start','pause','resume','end'].includes(e.type)); return !!l && (l.type === 'start' || l.type === 'resume'); };
export const isEnded = (log: MatchEvent[]) => log.some((e) => e.type === 'end');

/** Players currently on the pitch. */
export function onField(log: MatchEvent[]): Set<string> {
  const s = new Set<string>();
  for (const e of log) { if (e.type === 'on') s.add(e.playerId); if (e.type === 'off') s.delete(e.playerId); }
  return s;
}

/** On-pitch intervals in *match-clock* terms are approximated with wall time minus paused spans. */
export function playedFor(log: MatchEvent[], playerId: string, now: number): number {
  // Convert wall-clock stamps to match-clock seconds by replaying the log.
  const clockAt = (t: number) => clockSeconds(log.filter((e) => e.t <= t), t);
  const ivs: Interval[] = []; let open: number | null = null;
  for (const e of log) {
    if ('playerId' in e && e.playerId === playerId) {
      if (e.type === 'on') open = clockAt(e.t) * 1000;
      if (e.type === 'off' && open !== null) { ivs.push({ on: open, off: clockAt(e.t) * 1000 }); open = null; }
    }
    if (e.type === 'end' && open !== null) { ivs.push({ on: open, off: clockAt(e.t) * 1000 }); open = null; }
  }
  if (open !== null) ivs.push({ on: open });
  return playedSeconds(ivs, clockSeconds(log, now) * 1000);
}

export function windowIndexAt(m: Match, clockSec: number): number {
  return Math.min(Math.max(0, Math.floor(clockSec / 60 / m.windowMinutes)), Math.max(0, Math.ceil((m.periods * m.periodMinutes) / m.windowMinutes) - 1));
}
