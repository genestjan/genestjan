import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Ride, TrainingState } from '../types.ts';
import { PLANS, dayIndexAt, getPlan, isDone, planProgress, planStart, todayWorkout } from './training.ts';

// A zone with clock changes, so the daylight-saving test means something.
process.env.TZ = 'Europe/London';

const at = (y: number, m: number, d: number, h = 8) => new Date(y, m - 1, d, h).getTime();
let n = 0;
const ride = (startedAt: number, km: number, minutes: number): Ride => ({
  id: String(++n),
  title: 'Ride',
  startedAt,
  endedAt: startedAt + minutes * 60000,
  distanceM: km * 1000,
  movingMs: minutes * 60000,
  elapsedMs: minutes * 60000,
  elevGainM: 0,
  maxSpeedMs: 10,
  bikeId: null,
});

// 16 November 2026 is a Monday.
const MON = at(2026, 11, 16, 0);
const training = (planId: string | null, done: Record<number, boolean> = {}): TrainingState => ({
  planId,
  startedAt: MON,
  done,
});

test('every plan has a full set of days and weekly targets', () => {
  assert.deepEqual(
    PLANS.map((p) => p.id),
    ['beginner', 'regular', 'experienced']
  );
  for (const p of PLANS) {
    assert.equal(p.weeks, 8);
    assert.equal(p.days.length, p.weeks * 7);
    assert.equal(p.weeklyKm.length, p.weeks);
    for (const w of p.days) assert.equal(w.kind === 'rest', w.minutes === 0);
  }
  assert.equal(getPlan('regular')?.id, 'regular');
  assert.equal(getPlan(null), null);
  assert.equal(getPlan('nope'), null);
});

test('enough rest days every week, long ride at the weekend', () => {
  for (const p of PLANS) {
    const min = p.id === 'beginner' ? 2 : 1;
    for (let w = 0; w < p.weeks; w++) {
      const week = p.days.slice(w * 7, w * 7 + 7);
      assert.ok(week.filter((d) => d.kind === 'rest').length >= min, `${p.id} week ${w + 1}`);
      const longIdx = week.findIndex((d) => d.kind === 'long');
      assert.ok(longIdx >= 5, `${p.id} week ${w + 1} long ride`);
    }
  }
});

test('weekly targets never jump more than 20 percent, and the last week is lighter', () => {
  for (const p of PLANS) {
    for (let i = 1; i < p.weeklyKm.length; i++) {
      assert.ok(p.weeklyKm[i] <= p.weeklyKm[i - 1] * 1.2, `${p.id} week ${i + 1}`);
    }
    assert.ok(p.weeklyKm[7] < p.weeklyKm[6]);
  }
});

test('a plan starts on the Monday of its week', () => {
  assert.equal(planStart(at(2026, 11, 19, 15)), MON);
  assert.equal(planStart(MON), MON);
});

test('dayIndexAt counts calendar days, even across a clock change', () => {
  assert.equal(dayIndexAt(training('beginner'), MON), 0);
  assert.equal(dayIndexAt(training('beginner'), at(2026, 11, 16, 23)), 0);
  assert.equal(dayIndexAt(training('beginner'), at(2026, 11, 17, 0)), 1);
  assert.equal(dayIndexAt(training('beginner'), at(2026, 11, 23, 9)), 7);
  // British clocks go forward on 29 March 2026: that day has only 23 hours.
  const spring: TrainingState = { planId: 'beginner', startedAt: at(2026, 3, 23, 0), done: {} };
  assert.equal(dayIndexAt(spring, at(2026, 3, 30, 0)), 7);
  assert.equal(dayIndexAt(spring, at(2026, 3, 29, 23)), 6);
});

test('isDone by ride time, by hand, and not when the ride is too short', () => {
  const plan = getPlan('beginner')!;
  // Day 1 (Tuesday) is a 30 minute easy ride.
  assert.equal(plan.days[1].minutes, 30);
  const tue = at(2026, 11, 17, 18);
  const now = at(2026, 11, 18, 12);
  assert.equal(isDone(plan, training('beginner'), [ride(tue, 8, 25)], 1, now), true); // 25 is over 80 percent of 30
  assert.equal(isDone(plan, training('beginner'), [ride(tue, 3, 10), ride(tue + 3600000, 3, 15)], 1, now), true);
  assert.equal(isDone(plan, training('beginner'), [ride(tue, 5, 20)], 1, now), false);
  assert.equal(isDone(plan, training('beginner'), [ride(at(2026, 11, 18), 20, 60)], 1, now), false); // wrong day
  assert.equal(isDone(plan, training('beginner', { 1: true }), [], 1, now), true);
});

test('rest days are done once passed with no ride, or when ticked', () => {
  const plan = getPlan('beginner')!;
  assert.equal(plan.days[0].kind, 'rest');
  assert.equal(isDone(plan, training('beginner'), [], 0, at(2026, 11, 16, 20)), false); // still today
  assert.equal(isDone(plan, training('beginner'), [], 0, at(2026, 11, 17, 9)), true);
  assert.equal(isDone(plan, training('beginner'), [ride(MON + 3600000 * 9, 10, 30)], 0, at(2026, 11, 17, 9)), false);
  assert.equal(isDone(plan, training('beginner', { 0: true }), [], 0, at(2026, 11, 16, 9)), true);
});

test('todayWorkout is null without a plan and after the plan ends', () => {
  assert.equal(todayWorkout(training(null), [], MON), null);
  const today = todayWorkout(training('regular'), [], at(2026, 11, 22, 10));
  assert.equal(today?.dayIndex, 6);
  assert.equal(today?.workout.kind, 'long');
  assert.equal(today?.done, false);
  assert.equal(todayWorkout(training('regular'), [], at(2027, 1, 10, 10))?.dayIndex, 55); // last day
  assert.equal(todayWorkout(training('regular'), [], at(2027, 1, 11, 10)), null);
});

test('planProgress counts workouts and this week’s distance', () => {
  const plan = getPlan('beginner')!;
  const rides = [
    ride(at(2026, 11, 17), 10, 30), // week 1 Tuesday: done
    ride(at(2026, 11, 24), 12, 30), // week 2 Tuesday: done
    ride(at(2026, 11, 26), 5, 10), // week 2 Thursday: too short
    ride(at(2026, 11, 30), 99, 300), // week 3: not counted yet in week 2 distance
  ];
  const p = planProgress(plan, training('beginner', { 5: true }), rides, at(2026, 11, 27, 12));
  assert.equal(p.weekIndex, 1);
  assert.equal(p.finished, false);
  assert.equal(p.totalWorkouts, 32); // four rides a week for eight weeks
  // Tue week 1, Sat week 1 by hand, Tue week 2, and Mon week 3 ride does not match a rest day.
  assert.equal(p.doneWorkouts, 3);
  assert.equal(p.weekKmTarget, plan.weeklyKm[1]);
  assert.equal(p.weekKmDone, 17);

  const end = planProgress(plan, training('beginner'), [], at(2027, 2, 1));
  assert.equal(end.finished, true);
  assert.equal(end.weekIndex, 7);
});
