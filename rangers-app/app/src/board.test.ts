import { describe, expect, it } from 'vitest';
import { resolveAt, totalMs } from './lib/board';
import { PRESETS } from './lib/presets';
import { clockSeconds, onField } from './lib/matchClock';

describe('board engine', () => {
  const d = PRESETS[0];
  it('starts at step 0 and ends at the last step', () => {
    expect(resolveAt(d, 0).positions.u1).toEqual(d.steps[0].positions.u1);
    const end = resolveAt(d, totalMs(d));
    expect(end.positions.u1).toEqual(d.steps[d.steps.length - 1].positions.u1);
  });
  it('clamps and never returns NaN', () => {
    for (const t of [-5, 1e9]) for (const p of Object.values(resolveAt(d, t).positions)) { expect(Number.isFinite(p.x)).toBe(true); }
  });
  it('every preset places every piece in every step', () => {
    for (const doc of PRESETS) for (const s of doc.steps) for (const pc of doc.pieces) expect(s.positions[pc.id]).toBeDefined();
  });
});

describe('match clock', () => {
  it('follows wall time and excludes paused spans', () => {
    const log = [{ t: 0, type: 'start' as const }, { t: 60000, type: 'pause' as const }, { t: 120000, type: 'resume' as const }];
    expect(clockSeconds(log, 150000)).toBe(90);
  });
  it('never goes negative when the tick lags a tap', () => {
    expect(clockSeconds([{ t: 1000, type: 'start' }], 500)).toBe(0);
  });
  it('tracks who is on', () => {
    const s = onField([{ t: 0, type: 'on', playerId: 'a' }, { t: 1, type: 'on', playerId: 'b' }, { t: 2, type: 'off', playerId: 'a' }]);
    expect([...s]).toEqual(['b']);
  });
});
