import { describe, expect, it } from 'vitest';
import { distToLine, fromView, nearestPiece, resolveAt, setup, simplify, strokeLength, toView, totalMs, type BoardDoc } from './board';
import { PRESETS } from './presets';

describe('tactics board', () => {
  it('maps pitch metres to the upright and sideways drawings and back', () => {
    for (const o of ['v', 'h'] as const) for (const p of [{ x: 10, y: 5 }, { x: 32, y: 22.5 }, { x: 60, y: 40 }]) {
      const back = fromView(toView(p, o), o); expect(back.x).toBeCloseTo(p.x); expect(back.y).toBeCloseTo(p.y);
    }
    expect(toView({ x: 2, y: 22.5 }, 'v').y).toBeGreaterThan(150);   // upright: our goal is at the bottom
    expect(fromView({ x: -50, y: 999 }, 'v')).toEqual({ x: 1, y: 1 });  // a finger off the pitch stays on it
  });
  it('thins a finger line but keeps where it starts and ends', () => {
    const raw = Array.from({ length: 50 }, (_, i) => ({ x: 10 + i * 0.1, y: 20 + i * 0.05 }));
    const s = simplify(raw);
    expect(s.length).toBeLessThan(12); expect(s[0]).toEqual({ x: 10, y: 20 }); expect(s[s.length - 1]).toEqual({ x: 14.9, y: 22.5 });
    expect(strokeLength(s)).toBeCloseTo(strokeLength(raw), 0);
  });
  it('finds the line or player under a finger', () => {
    expect(distToLine({ x: 5, y: 1 }, [{ x: 0, y: 0 }, { x: 10, y: 0 }])).toBeCloseTo(1);
    expect(distToLine({ x: 13, y: 4 }, [{ x: 0, y: 0 }, { x: 10, y: 0 }])).toBeCloseTo(5);
    const step = { positions: { a: { x: 10, y: 10 }, b: { x: 13, y: 10 } }, arrows: [] };
    expect(nearestPiece(step, { x: 12, y: 10 })).toBe('b');
    expect(nearestPiece(step, { x: 30, y: 30 })).toBeNull();
  });
  it('sets up ready pictures, with each team in its own half and a ball', () => {
    const full = setup('full', '8v8');
    expect(full.pieces.filter((p) => p.kind === 'us')).toHaveLength(8); expect(full.pieces.filter((p) => p.kind === 'them')).toHaveLength(8);
    expect(full.pieces.filter((p) => p.gk)).toHaveLength(2);
    for (const p of full.pieces) { const at = full.step.positions[p.id]; expect(p.kind === 'us' ? at.x < 32 : at.x > 32).toBe(true); }
    expect(full.step.ballWith).toMatch(/^u/);
    expect(setup('4v4').pieces.filter((p) => p.gk)).toHaveLength(0);
    expect(setup('empty').pieces).toHaveLength(0);
    expect(setup('full', 'no-such-format').pieces).toHaveLength(16);   // unknown format: falls back to 8v8
  });
  it('plays a move: players walk between steps and the lines of each step show', () => {
    const d: BoardDoc = { ...PRESETS[0], steps: PRESETS[0].steps.map((s, i) => ({ ...s, strokes: i === 2 ? [{ pts: [{ x: 1, y: 1 }, { x: 5, y: 5 }], ink: 'yellow', kind: 'run' }] : [] })) };
    expect(resolveAt(d, 0).index).toBe(0);
    const mid = resolveAt(d, d.holdMs + d.moveMs + d.holdMs + d.moveMs / 2);
    expect(mid.index).toBe(2); expect(mid.positions.u1.x).toBeGreaterThan(20); expect(mid.positions.u1.x).toBeLessThan(38);
    expect(resolveAt(d, totalMs(d)).strokes).toHaveLength(1);
  });
});
