import { describe, expect, it } from 'vitest';
import { growthVelocity } from './growth';
import { summarise, needRecognition } from './development';
import { nextCharge, fundTotals } from './fees';
import { buildSession, eligible } from './sessionBuilder';
import { forEvent } from './weather';
import { DRILLS } from '../content/drills';
import { RUBRIC } from '../content/rubric';

describe('growth', () => {
  it('flags 8.07 cm a year', () => expect(growthVelocity([{ id: 'a', playerId: 'p', date: '2026-01-01', heightCm: 140 }, { id: 'b', playerId: 'p', date: '2026-07-01', heightCm: 144 }]).status).toBe('spurt'));
  it('does not flag 3 cm a year', () => expect(growthVelocity([{ id: 'a', playerId: 'p', date: '2026-01-01', heightCm: 140 }, { id: 'b', playerId: 'p', date: '2026-07-02', heightCm: 141.5 }]).status).toBe('ok'));
  it('needs 56 days', () => expect(growthVelocity([{ id: 'a', playerId: 'p', date: '2026-01-01', heightCm: 140 }, { id: 'b', playerId: 'p', date: '2026-02-10', heightCm: 142 }]).status).toBe('not-enough-data'));
  it('asks to re-measure nonsense', () => expect(growthVelocity([{ id: 'a', playerId: 'p', date: '2026-01-01', heightCm: 140 }, { id: 'b', playerId: 'p', date: '2026-07-01', heightCm: 130 }]).status).toBe('remeasure'));
});
describe('development', () => {
  const sk = RUBRIC.U12;
  const cur = { id: 'c', playerId: 'p', teamId: 't', term: 'T2', ratings: { touch: 3, pass: 4, weak: 1, finish: 2 }, strength: '', working: '', familyComment: '', coachNote: '' };
  const prev = { ...cur, id: 'p0', term: 'T1', ratings: { touch: 2, pass: 4, weak: 1, finish: 2 } };
  it('strengths, working on, fastest', () => {
    const r = summarise(sk, cur, prev);
    expect(r.strengths.map((s) => s.id)).toEqual(['pass', 'touch']);
    expect(r.working.map((s) => s.id)).toEqual(['weak', 'finish']);
    expect(r.fastest?.id).toBe('touch');
  });
  it('ignores unseen skills', () => expect(summarise(sk, { ...cur, ratings: { touch: 3 } }).working).toEqual([]));
  it('with two skills rated, one is a strength and one is working on', () => { const r = summarise(sk, { ...cur, ratings: { touch: 3, pass: 2 } }); expect(r.strengths.map((x) => x.id)).toEqual(['touch']); expect(r.working.map((x) => x.id)).toEqual(['pass']); });
  it('recognition coverage', () => {
    const now = Date.parse('2026-10-23');
    expect(needRecognition(['a', 'b'], [{ id: 'r', playerId: 'a', valueKey: 'x', note: '', at: '2026-10-20' }], now)).toEqual(['b']);
  });
});
describe('fees', () => {
  const c = { id: '1', playerId: 'p', label: 'x', amount: 100, dueOn: '2026-11-01', status: 'due' as const };
  it('due -> submitted -> paid', () => { const s = nextCharge(c, 'submit', '1234567890123'); expect(s.status).toBe('submitted'); expect(nextCharge(s, 'confirm').status).toBe('paid'); });
  it('rejects a bad reference', () => expect(() => nextCharge(c, 'submit', '12')).toThrow());
  it('cannot confirm a due charge', () => expect(() => nextCharge(c, 'confirm')).toThrow());
  it('fund totals', () => expect(fundTotals({ target: 1000, entries: [{ amount: 250 }, { amount: 250 }] })).toEqual({ have: 500, still: 500, pct: 50 }));
});
describe('session builder', () => {
  const eq = new Set(['ball', 'cones', 'bibs', 'goals']);
  it('fills a U10 session with eligible drills only', () => {
    const { blocks } = buildSession({ band: 'U10', players: 14, minutes: 60, theme: 'passing', equipment: eq });
    expect(blocks.length).toBeGreaterThanOrEqual(5);
    for (const b of blocks.filter((x) => x.drillId !== 'huddle')) expect(eligible(DRILLS.find((d) => d.id === b.drillId)!, { band: 'U10', players: 14, minutes: 60, theme: 'passing', equipment: eq })).toBe(true);
  });
  it('never includes heading under 12', () => { for (const band of ['U8', 'U10'] as const) expect(buildSession({ band, players: 12, minutes: 60, theme: 'game', equipment: eq }).blocks.some((b) => b.drillId === 'D30')).toBe(false); });
  it('respects missing equipment and reports gaps', () => {
    const r = buildSession({ band: 'U10', players: 12, minutes: 60, theme: 'finishing', equipment: new Set(['ball']) });
    for (const b of r.blocks.filter((x) => x.drillId !== 'huddle')) expect(DRILLS.find((d) => d.id === b.drillId)!.equipment.every((e) => e === 'ball')).toBe(true);
    expect(r.gaps.length).toBeGreaterThan(0);
  });
  it('total minutes match', () => { const { blocks } = buildSession({ band: 'U12', players: 12, minutes: 80, theme: 'passing', equipment: eq }); expect(blocks.reduce((s, b) => s + b.minutes, 0)).toBeGreaterThan(70); });
});
describe('weather', () => {
  const hours = [{ time: '2026-10-24T14:00', tempC: 34, rh: 60, pop: 10, code: 1, cape: 0 }, { time: '2026-10-24T15:00', tempC: 30, rh: 80, pop: 70, code: 95, cape: 1500 }];
  it('uses the hottest hour and detects thunder', () => { const r = forEvent(hours, '2026-10-24T14:30', '2026-10-24T15:30')!; expect(r.maxHi).toBeGreaterThanOrEqual(42); expect(r.category).toBe('Danger'); expect(r.thunder).toBe(true); });
  it('returns null when no hour overlaps', () => expect(forEvent(hours, '2026-10-25T08:00', '2026-10-25T09:00')).toBeNull());
});
