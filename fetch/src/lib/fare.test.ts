import { computeFare, DEFAULT_RATES } from './fare';
import { settle, tierFor, pointsEarned, maxRedeemable } from './points';
import { haversineKm, inMindanao, GENSAN } from './geo';

test('fare respects minimum and adds per km and per minute', () => {
  const r = DEFAULT_RATES.motorcycle;
  expect(computeFare(r, 0, 0)).toBe(50);
  expect(computeFare(r, 5, 10)).toBe(40 + 50 + 10);
});
test('suki tiers', () => {
  expect(tierFor(0).name).toBe('Bago');
  expect(tierFor(5).name).toBe('Suki');
  expect(tierFor(100).discount).toBe(0.1);
});
test('settle applies discount, caps points at half, adds tip', () => {
  const s = settle(200, 5, 500, 20);
  expect(s.discount).toBe(10);
  expect(s.pointsUsed).toBe(95);
  expect(s.total).toBe(200 - 10 - 95 + 20);
  expect(pointsEarned(99)).toBe(9);
  expect(maxRedeemable(3, 100)).toBe(3);
});
test('geo', () => {
  expect(inMindanao(GENSAN)).toBe(true);
  expect(inMindanao({ lat: 14.6, lng: 121 })).toBe(false);
  expect(haversineKm(GENSAN, { lat: 7.056, lng: 125.593 })).toBeGreaterThan(100);
});
