import type { Assessment, Recognition } from './model';
import type { Skill } from '../content/rubric';

/** Own-history only: nothing here ever takes more than one child's data. */
export function summarise(skills: Skill[], current: Assessment, previous?: Assessment) {
  const rated = skills.filter((s) => (current.ratings[s.id] ?? 0) > 0);
  const gain = (s: Skill) => (current.ratings[s.id] ?? 0) - (previous?.ratings[s.id] ?? 0);
  const byLevel = [...rated].sort((a, b) => (current.ratings[b.id] - current.ratings[a.id]) || (gain(b) - gain(a)));
  // With only a few skills rated, keep one as a strength so there is always something to work on too.
  const strengths = byLevel.slice(0, rated.length >= 4 ? 2 : 1);
  const working = [...rated].sort((a, b) => (current.ratings[a.id] - current.ratings[b.id]))
    .filter((s) => !strengths.includes(s)).slice(0, 2);
  let fastest: Skill | undefined;
  if (previous) { const best = [...rated].sort((a, b) => gain(b) - gain(a))[0]; if (best && gain(best) > 0) fastest = best; }
  return { strengths, working, fastest };
}

/** Children with no recognition in the last `days` days, longest gap first. Coach-only. */
export function needRecognition(playerIds: string[], recs: Recognition[], now: number, days = 42) {
  const last = new Map<string, number>();
  for (const r of recs) last.set(r.playerId, Math.max(last.get(r.playerId) ?? 0, Date.parse(r.at)));
  return playerIds.map((id) => ({ id, last: last.get(id) ?? 0 }))
    .filter((x) => now - x.last > days * 86400000).sort((a, b) => a.last - b.last).map((x) => x.id);
}

import { DRILLS, type Drill } from '../content/drills';
const SKILL_THEME: Record<string, string> = { close: 'ball-mastery', feet: 'ball-mastery', stop: 'ball-mastery', touch: 'receiving', pass: 'passing', moves: '1v1', weak: 'ball-mastery', finish: 'finishing', space: 'possession', goalside: 'defending', shape: 'possession', decide: '1v1', units: 'pressing', trans: 'transition', receive: 'receiving', press: 'pressing', cross: 'wide', head: 'heading', forward: 'dribbling', agility: 'fun', speed: 'fun', turns: 'fun', retry: 'fun', effort: 'fun', talk: 'game', focus: 'game', team: 'game' };
/** A drill the child can try at home for a skill they are working on. */
export function drillFor(skillId: string, age: number): Drill | undefined {
  const theme = SKILL_THEME[skillId] ?? 'ball-mastery';
  return DRILLS.find((d) => d.theme === theme && d.equipment.every((e) => e === 'ball' || e === 'cones') && age >= d.minAge && age <= d.maxAge + 2 && !d.heading) ?? DRILLS.find((d) => d.id === 'D02');
}
