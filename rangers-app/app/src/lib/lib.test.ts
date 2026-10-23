import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { fairSeconds, owedSeconds, playedSeconds } from './fairShare';
import { heatIndexC, heatCategory } from './heatIndex';
import { planRotation } from './rotation';
import { FORMATS } from './types';

const squad = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, gkWilling: i < 3 }));

describe('fair share', () => {
  it('8v8, 12 present, 10 min: fair = 400 s', () => {
    expect(fairSeconds(600, 8, 12)).toBe(400);
    expect(owedSeconds(0, 600, 8, 12)).toBe(400);
    expect(owedSeconds(600, 600, 8, 12)).toBe(-200);
  });
  it('sums intervals', () => {
    expect(playedSeconds([{ on: 0, off: 60000 }, { on: 120000 }], 180000)).toBe(120);
  });
});

describe('heat index', () => {
  const v: [number, number, number, string][] = [
    [25, 60, 25, 'Normal'], [28, 70, 31, 'Caution'], [30, 60, 33, 'Extreme caution'],
    [30, 75, 36, 'Extreme caution'], [32, 65, 39, 'Extreme caution'], [34, 60, 42, 'Danger'],
    [31, 90, 45, 'Danger'], [36, 60, 48, 'Danger'], [38, 10, 35, 'Extreme caution'],
  ];
  it.each(v)('%i C %i%% -> %i', (t, rh, hi, cat) => {
    expect(heatIndexC(t, rh)).toBe(hi);
    expect(heatCategory(hi)).toBe(cat);
  });
});

describe('rotation', () => {
  const base = { format: FORMATS['8v8'], periods: 2, periodMinutes: 25, windowMinutes: 5 };
  it('12 players, 8v8, spread at most 5 minutes', () => {
    const plan = planRotation({ ...base, players: squad(12) });
    expect(plan.spread).toBeLessThanOrEqual(5 + 25 * 0); // keeper plays a whole period
  });
  it('keeper is fixed in a period and alternates', () => {
    const plan = planRotation({ ...base, players: squad(12) });
    const gk = (w: number) => Object.entries(plan.windows[w].roles).find(([, r]) => r === 'GK')![0];
    expect(gk(0)).toBe(gk(4));
    expect(gk(0)).not.toBe(gk(5));
  });
  it('respects off and gk locks', () => {
    const plan = planRotation({ ...base, players: squad(12), locks: { off: ['p5'], gk: { 0: 'p2', 1: 'p2' } } });
    expect(plan.minutes.p5).toBe(0);
    expect(plan.windows.every((w) => w.roles.p2 === 'GK')).toBe(true);
  });
  it('properties: exact slots, one keeper, deterministic, nobody benched twice when the bench fits in the outfield slots', () => {
    fc.assert(fc.property(fc.integer({ min: 9, max: 16 }), fc.constantFrom('8v8', '7v7') as fc.Arbitrary<'8v8' | '7v7'>, (n, f) => {
      const input = { ...base, format: FORMATS[f], players: squad(n) };
      const a = planRotation(input), b = planRotation(input);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      for (const w of a.windows) {
        const roles = Object.values(w.roles);
        expect(roles.filter((r) => r !== 'BENCH').length).toBe(input.format.slots);
        expect(roles.filter((r) => r === 'GK').length).toBe(1);
      }
      if (n - input.format.slots <= input.format.slots - 1) {
        for (let i = 1; i < a.windows.length; i++)
          for (const p of input.players)
            expect(a.windows[i - 1].roles[p.id] === 'BENCH' && a.windows[i].roles[p.id] === 'BENCH').toBe(false);
      }
    }));
  });
  it('4v4 no keepers, 6 kids: spread at most one window', () => {
    const plan = planRotation({ players: squad(6), format: FORMATS['4v4'], periods: 2, periodMinutes: 10, windowMinutes: 5 });
    expect(plan.spread).toBeLessThanOrEqual(5);
  });
});
