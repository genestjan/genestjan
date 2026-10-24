import { useMemo } from 'react';
import type { Match } from './store';
import type { Player } from './types';
import { FORMATS } from './types';
import { planRotation, type RotationPlan } from './rotation';
import { FORMATIONS } from './presets';

export function planFor(m: Match, players: Player[], owed: Record<string, number> = {}): RotationPlan {
  const squad = players.filter((p) => m.availableIds.includes(p.id));
  return planRotation({
    players: squad.map((p) => ({ id: p.id, gkWilling: p.gkWilling, owedMin: owed[p.id] })),
    format: FORMATS[m.format], periods: m.periods, periodMinutes: m.periodMinutes,
    windowMinutes: m.windowMinutes, locks: m.locks, carryOver: m.carryOver, seed: m.id,
  });
}

export interface Placed { player: Player; code: string; x: number; y: number }

/** Put on-pitch players into formation slots. GK takes the first slot if the format has keepers. */
export function placeLineup(m: Match, on: Player[], gkId?: string): Placed[] {
  const slots = FORMATIONS[m.format];
  const gk = FORMATS[m.format].hasKeeper ? on.find((p) => p.id === gkId) ?? on[0] : undefined;
  const rest = on.filter((p) => p !== gk);
  const out: Placed[] = [];
  let si = 0;
  if (gk) { out.push({ player: gk, ...slots[0] }); si = 1; }
  for (const p of rest) { const s = slots[si++]; if (s) out.push({ player: p, ...s }); }
  return out;
}

/** The minutes plan only depends on the match settings and who is available, not on the clock or the event log,
 *  so it is worked out once per change instead of every second (it can take ~100 ms for big squads). */
export function usePlan(m: Match | undefined, players: Player[], blocked: string[]) {
  const squadIds = m ? players.filter((p) => m.availableIds.includes(p.id) && !blocked.includes(p.id)).map((p) => p.id) : [];
  const key = m ? JSON.stringify([m.id, m.format, m.periods, m.periodMinutes, m.windowMinutes, m.locks, m.carryOver, squadIds, players.filter((p) => squadIds.includes(p.id)).map((p) => p.gkWilling)]) : '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (m ? planFor({ ...m, availableIds: squadIds }, players) : null), [key]);
}
