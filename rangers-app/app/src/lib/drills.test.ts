import { describe, expect, it } from 'vitest';
import { checkDrill, emptyDrill, HEADING_MIN_AGE } from './drills';
import { DRILLS } from '../content/drills';
import { buildSession, eligible } from './sessionBuilder';

describe('coaches\' drills', () => {
  const ok = () => ({ ...emptyDrill('30000000-0000-4000-8000-0000000000d1', 'Coach Ana'), name: 'Rondo 4v1', how: 'Four keep the ball from one.', theme: 'possession', minAge: 9, maxAge: 14 });
  it('a new drill needs a name and instructions', () => {
    expect(checkDrill(emptyDrill('x', 'A'))).toMatch(/name/);
    expect(checkDrill({ ...ok(), how: ' ' })).toMatch(/how the drill works/);
    expect(checkDrill(ok())).toBe('');
  });
  it('catches impossible ages and numbers, and keeps heading for 12 and up', () => {
    expect(checkDrill({ ...ok(), minAge: 14, maxAge: 9 })).toMatch(/ages/);
    expect(checkDrill({ ...ok(), players: [10, 4] })).toMatch(/children/);
    expect(checkDrill({ ...ok(), heading: true, minAge: 10 })).toMatch(String(HEADING_MIN_AGE));
  });
  it('"our own version" copies the words, never the photos or video of the original', () => {
    const c = emptyDrill('n', 'Coach Ben', { ...ok(), photos: ['d/a/b.jpg'], video: { drive: 'abc' } } as never);
    expect(c.name).toMatch(/our version/); expect(c.photos).toEqual([]); expect(c.video).toBeUndefined(); expect(c.by).toBe('Coach Ben');
    const fromBuiltIn = emptyDrill('n', 'B', DRILLS[0]); expect(fromBuiltIn.how).toBe(DRILLS[0].how); expect(fromBuiltIn.points).not.toBe(DRILLS[0].points);
  });
  it('session plans can use coaches\' drills', () => {
    const mine = { ...ok(), theme: 'possession', equipment: ['ball' as const], minutes: 12, players: [4, 20] as [number, number] };
    const input = { band: 'U12' as const, players: 12, minutes: 75, theme: 'possession', equipment: new Set(['ball', 'cones']), seed: 0 };
    expect(eligible(mine, input)).toBe(true);
    const all = [...DRILLS.filter((d) => d.theme !== 'possession'), mine];
    expect(buildSession({ ...input, allDrills: all }).blocks.some((b) => b.drillId === mine.id)).toBe(true);
  });
});
