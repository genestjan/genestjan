import type { Drill } from '../content/drills';
import type { CustomDrill } from './model';

/** Drills coaches make for the club (coaches only). Same parts as the built-in drills, plus photos, a video and a board. */
export const THEMES = ['ball-mastery', 'dribbling', 'turning', '1v1', 'passing', 'receiving', 'possession', 'finishing', 'defending', 'pressing', 'switching', 'wide', 'build-out', 'transition', 'game', 'fun', 'goalkeeping'];
export const MAX_DRILL_PHOTOS = 4;
/** Heading the ball is only for age 12 and up (playbook). */
export const HEADING_MIN_AGE = 12;

/** A new drill; "make our own version" copies the words of another drill (not its photos or video, which stay with that drill). */
export function emptyDrill(id: string, by: string, base?: Drill): CustomDrill {
  const b = base ? { name: `${base.name} (our version)`, theme: base.theme, minAge: base.minAge, maxAge: base.maxAge, players: [...base.players] as [number, number], area: base.area, minutes: base.minutes, equipment: [...base.equipment], setup: base.setup, how: base.how, points: [...base.points] as [string, string, string], easier: base.easier, harder: base.harder, heading: base.heading }
    : { name: '', theme: 'ball-mastery', minAge: 6, maxAge: 12, players: [2, 20] as [number, number], area: '', minutes: 10, equipment: ['ball' as const], setup: '', how: '', points: ['', '', ''] as [string, string, string], easier: '', harder: '' };
  return { id, ...b, by, at: '', photos: [] };
}

/** What is missing or wrong, in plain words (empty when the drill can be saved). */
export function checkDrill(d: CustomDrill): string {
  if (!d.name.trim()) return 'Give the drill a name.';
  if (!d.how.trim()) return 'Write how the drill works, so other coaches can run it.';
  if (!(d.minAge >= 5 && d.maxAge <= 18 && d.minAge <= d.maxAge)) return 'Check the ages: "from" must be the same as or lower than "to" (5 to 18).';
  if (d.heading && d.minAge < HEADING_MIN_AGE) return `Drills with heading are for age ${HEADING_MIN_AGE} and up.`;
  if (!(d.players[0] >= 1 && d.players[0] <= d.players[1])) return 'Check the number of children: fewest must be the same as or lower than most.';
  if (!(d.minutes >= 2 && d.minutes <= 60)) return 'Minutes: between 2 and 60.';
  if (d.photos.length > MAX_DRILL_PHOTOS) return `Up to ${MAX_DRILL_PHOTOS} photos.`;
  return '';
}
