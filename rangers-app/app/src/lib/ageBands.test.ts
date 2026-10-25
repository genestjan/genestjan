import { describe, expect, it } from 'vitest';
import { AGE_BANDS, bandAge, bandsLabel, contentBand, sortBands, teamBands, withBands, type Team } from './model';
import { bandForAge } from './school';
import { buildSession, BAND_AGE } from './sessionBuilder';
import { DRILLS } from '../content/drills';

const t: Team = { id: 't', name: 'Rangers', programme: 'rangers', ageBand: 'U10', defaultFormat: '8v8' };
const input = (band: (typeof AGE_BANDS)[number]) => ({ band, players: 14, minutes: 75, theme: 'passing', equipment: new Set(['ball', 'cones', 'bibs', 'goals']), seed: 0 });

describe('age groups', () => {
  it('has every age group from U6 to U19, then 20+, 30+ and 40+', () => {
    expect(AGE_BANDS).toEqual(['U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'U19', '20+', '30+', '40+']);
    expect(bandAge('U9')).toBe(9); expect(bandAge('30+')).toBe(30);
  });
  it('each age group uses the nearest coaching plan', () => {
    expect(['U6', 'U7', 'U8'].map((b) => contentBand(b as never))).toEqual(['U8', 'U8', 'U8']);
    expect(contentBand('U9')).toBe('U10'); expect(contentBand('U11')).toBe('U12'); expect(contentBand('U13')).toBe('U14');
    expect(['U15', 'U17', 'U19', '20+', '40+'].every((b) => contentBand(b as never) === 'U16')).toBe(true);
  });
  it('a child\'s own age group from their age', () => {
    expect([5, 6, 9, 13, 19, 20, 29, 30, 41].map(bandForAge)).toEqual(['U6', 'U6', 'U9', 'U13', 'U19', '20+', '20+', '30+', '40+']);
  });
  it('a team can mix age groups; the youngest leads', () => {
    const m = withBands(t, ['U11', 'U9', 'U10', 'U9']);
    expect(m.ageBand).toBe('U9'); expect(m.ageBands).toEqual(['U9', 'U10', 'U11']); expect(bandsLabel(teamBands(m))).toBe('U9 + U10 + U11');
    const single = withBands(m, ['U12']); expect(single.ageBand).toBe('U12'); expect(single.ageBands).toBeUndefined();
    expect(teamBands(t)).toEqual(['U10']); expect(sortBands(['40+', 'U6', '20+'])).toEqual(['U6', '20+', '40+']);
  });
  it('every age group gets a full session plan, adults included', () => {
    for (const b of AGE_BANDS) { const s = buildSession(input(b)); expect(s.blocks.length, b).toBeGreaterThanOrEqual(5); }
    expect(BAND_AGE['40+']).toBe(16);
  });
  it('no heading drills for under 12s, also when they train with older players', () => {
    const heading = new Set(DRILLS.filter((d) => d.heading).map((d) => d.id));
    for (const b of ['U6', 'U9', 'U11'] as const) for (let seed = 0; seed < 6; seed++) for (const theme of ['finishing', 'wide', 'switching'])
      expect(buildSession({ ...input(b), theme, seed }).blocks.some((x) => heading.has(x.drillId)), `${b} ${theme}`).toBe(false);
  });
});
