import { buildProfile, gradeColor, samplePoints } from './elevation';
import { parseElevation } from '../services/elevation';
import route from '../data/gensan-davao-route.json';
import realElevation from '../data/gensan-davao-elevation.json';
import { straightRoute } from '../test/fixtures';

const coords = (route.coordinates as [number, number][]).map(([lng, lat]) => [lat, lng] as [number, number]);

describe('hills', () => {
  it('samples evenly from start to finish', () => {
    const pts = samplePoints(straightRoute(100), 11);
    expect(pts).toHaveLength(11);
    expect(pts[0].km).toBe(0);
    expect(pts[10].km).toBeCloseTo(100, 0);
    expect(pts[5].km).toBeCloseTo(50, 0);
  });

  it('counts climbing and descending, ignoring terrain-grid wobble', () => {
    const p = buildProfile(straightRoute(10), { elevationM: [0, 1, 0, 1, 0, 50, 100, 60, 0, 0, 0], retrievedAt: 't', source: 's' });
    expect(p.ascentM).toBe(100); // the 0-1 wobble is ignored
    expect(p.descentM).toBe(100);
    expect(p.highestM).toBe(100);
    expect(p.steepestUpPct).toBeCloseTo((50 / 1000) * 100, 1); // 50 m over 1 km = 5%
  });

  it('colours stretches from easy to hard', () => {
    expect([1, 3, 5, 8].map(gradeColor)).toEqual(['#4caf7d', '#f2c94c', '#f2994a', '#e0483e']);
    expect(gradeColor(-8)).toBe('#e0483e'); // steep downhills count too
  });

  it('rejects a damaged terrain answer instead of drawing something', () => {
    expect(() => parseElevation({ elevation: [1, 2, 'x'] }, 3)).toThrow();
    expect(() => parseElevation({ elevation: [1, 2] }, 3)).toThrow();
    expect(parseElevation({ elevation: [1, 2, 3] }, 3)).toEqual([1, 2, 3]);
  });

  it('REAL data: GenSan to Davao is mostly flat with one ridge near 370 m', () => {
    const p = buildProfile(coords, realElevation as never);
    expect(p.profile).toHaveLength(100);
    expect(p.highestM).toBe(367);
    expect(p.lowestM).toBe(5);
    expect(p.ascentM).toBeGreaterThan(300);
    expect(p.ascentM).toBeLessThan(700);
    // The ridge is in the first half of the ride.
    const top = p.profile.reduce((m, q) => (q.ele > m.ele ? q : m));
    expect(top.km).toBeGreaterThan(40);
    expect(top.km).toBeLessThan(70);
    console.log(`Real hills: climb about ${p.ascentM} m, highest ${p.highestM} m at km ${top.km.toFixed(0)}, steepest climb ${p.steepestUpPct.toFixed(1)}%`);
  });
});
