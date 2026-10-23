import { DRILLS, SESSION_SLOTS, type Drill } from '../content/drills';
import { CURRICULUM } from '../content/curriculum';
import type { AgeBand, SessionBlock } from './model';

export const BAND_AGE: Record<AgeBand, number> = { U8: 8, U10: 10, U12: 12, U14: 14, U16: 16 };
const SPLIT: Record<AgeBand, number[]> = { // minutes in the six slots for a 60-minute base, scaled
  U8: [10, 15, 10, 10, 12, 3], U10: [10, 15, 12, 15, 20, 3], U12: [8, 15, 12, 20, 22, 3], U14: [5, 20, 15, 25, 20, 5], U16: [0, 20, 15, 25, 25, 5],
};
export interface BuildInput { band: AgeBand; players: number; minutes: number; theme: string; equipment: Set<string>; allDrills?: Drill[]; seed?: number; swap?: Record<string, string[]> }
const WARMUP: Record<string, string> = { U8: 'D02', U10: 'D02', U12: 'D02', U14: 'D02', U16: 'D02' };

export function currentTheme(band: AgeBand, weeksSinceStart: number) {
  const list = CURRICULUM[band]; return list[Math.min(list.length - 1, Math.floor(Math.max(0, weeksSinceStart) / 2))];
}
export function eligible(d: Drill, i: BuildInput) {
  const age = BAND_AGE[i.band];
  if (d.heading && age < 12) return false;
  if (age < d.minAge || age > d.maxAge + 2) return false;
  if (i.players < d.players[0] && d.players[0] > 2) return false;
  return d.equipment.every((e) => i.equipment.has(e));
}
/** Fills the six slots. Never invents drills: returns what the library allows and flags gaps. */
export function buildSession(i: BuildInput): { blocks: SessionBlock[]; gaps: string[] } {
  const all = i.allDrills ?? DRILLS;
  const pool = all.filter((d) => eligible(d, i));
  const scale = i.minutes / 60;
  const mins = SPLIT[i.band].map((m) => Math.round(m * scale));
  const used = new Set<string>(); const gaps: string[] = []; const blocks: SessionBlock[] = [];
  const pick = (cands: Drill[], salt: number) => {
    const fresh = cands.filter((d) => !used.has(d.id)); const list = fresh.length ? fresh : cands;
    return list.length ? list[(salt + (i.seed ?? 0)) % list.length] : undefined;
  };
  SESSION_SLOTS.forEach((slot, idx) => {
    if (!mins[idx]) return;
    let d: Drill | undefined;
    if (slot === 'Warm-up') d = pool.find((x) => x.id === WARMUP[i.band]) ?? pick(pool.filter((x) => x.theme === 'ball-mastery' || x.theme === 'fun'), idx);
    else if (slot === 'Skill') d = pick(pool.filter((x) => x.theme === i.theme && x.minutes <= mins[idx] + 4), idx) ?? pick(pool.filter((x) => x.theme === i.theme), idx);
    else if (slot === 'Game-like practice') d = pick(pool.filter((x) => x.theme === i.theme && !used.has(x.id)), idx + 1) ?? pick(pool.filter((x) => ['1v1', 'passing', 'possession', 'defending', 'finishing'].includes(x.theme)), idx);
    else if (slot === 'Play') d = pick(pool.filter((x) => x.theme === 'game'), idx);
    else if (slot === 'Arrival play') d = pick(pool.filter((x) => x.theme === 'fun' || x.theme === 'dribbling'), idx);
    if (slot === 'Huddle') { blocks.push({ slot, drillId: 'huddle', minutes: mins[idx] }); return; }
    if (!d) { gaps.push(`${slot}: no drill fits ${i.band}, ${i.players} players and your equipment`); return; }
    used.add(d.id); blocks.push({ slot, drillId: d.id, minutes: mins[idx] });
  });
  return { blocks, gaps };
}
export const waterBreaks = (minutes: number, every: number | null) => (every ? Math.floor(minutes / every) : 0);
