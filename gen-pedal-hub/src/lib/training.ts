import type { Ride, TrainingState } from '../types.ts';
import { weekStart } from './stats.ts';

export type Workout = {
  kind: 'rest' | 'easy' | 'endurance' | 'hills' | 'speed' | 'long';
  title: string;
  minutes: number;
  how: string;
};

export type Plan = {
  id: string;
  name: string;
  forWho: string;
  weeks: number;
  /** weeks * 7 workouts, Monday first. */
  days: Workout[];
  /** Distance target in km for each week. */
  weeklyKm: number[];
};

type Kind = Workout['kind'];

const TITLES: Record<Kind, string> = {
  rest: 'Rest day',
  easy: 'Easy ride',
  endurance: 'Steady ride',
  hills: 'Hill ride',
  speed: 'Fast bursts',
  long: 'Long ride',
};

const HOW: Record<Kind, string> = {
  rest: 'No riding today. Your legs get stronger while you rest.',
  easy: 'Ride gently the whole time. You should be able to chat without puffing.',
  endurance: 'Ride at a steady speed that feels comfortable. You can still talk, but you breathe a bit harder.',
  hills: 'Find a hill and ride up it at a steady push, then roll down gently. Do this a few times.',
  speed: 'Ride gently for 10 minutes to warm up. Then go fast for 1 minute and slow for 2 minutes, again and again.',
  long: 'This is your longest ride of the week. Go at an easy speed, take a snack and drink often.',
};

/**
 * Size of each week compared with week 1. Week 4 is an easier week and week 8
 * is a lighter week before the end, so the body has time to recover.
 * No step up is more than 15 percent.
 */
const LOAD = [1, 1.1, 1.2, 1.05, 1.2, 1.3, 1.4, 0.9];

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

function makePlan(
  id: string,
  name: string,
  forWho: string,
  week: [Kind, number][],
  firstWeekKm: number
): Plan {
  const days: Workout[] = [];
  const weeklyKm: number[] = [];
  for (const f of LOAD) {
    for (const [kind, minutes] of week) {
      days.push({ kind, title: TITLES[kind], minutes: kind === 'rest' ? 0 : round5(minutes * f), how: HOW[kind] });
    }
    weeklyKm.push(round5(firstWeekKm * f));
  }
  return { id, name, forWho, weeks: LOAD.length, days, weeklyKm };
}

export const PLANS: Plan[] = [
  makePlan(
    'beginner',
    'Getting started',
    'For new riders. Three short rides and one longer ride each week.',
    [
      ['rest', 0],
      ['easy', 30],
      ['rest', 0],
      ['easy', 30],
      ['rest', 0],
      ['endurance', 40],
      ['long', 60],
    ],
    35
  ),
  makePlan(
    'regular',
    'Getting fitter',
    'For people who already ride most weeks and want to go further.',
    [
      ['rest', 0],
      ['endurance', 45],
      ['hills', 40],
      ['easy', 30],
      ['rest', 0],
      ['endurance', 60],
      ['long', 90],
    ],
    80
  ),
  makePlan(
    'experienced',
    'Going strong',
    'For strong riders who ride a lot and want a harder challenge.',
    [
      ['rest', 0],
      ['speed', 60],
      ['endurance', 75],
      ['hills', 60],
      ['easy', 45],
      ['endurance', 90],
      ['long', 150],
    ],
    160
  ),
];

export function getPlan(id: string | null): Plan | null {
  return PLANS.find((p) => p.id === id) ?? null;
}

/** A plan always starts on the Monday of the week it was started. */
export function planStart(now: number): number {
  return weekStart(now);
}

/** Start of the local calendar day that is `n` days after the day containing `t`. */
export function dayStartAt(t: number, n: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime();
}

// Comparing calendar dates in UTC avoids the 23 or 25 hour days at clock changes.
const dayNumber = (t: number) => {
  const d = new Date(t);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
};

export function dayIndexAt(training: TrainingState, now: number): number {
  return dayNumber(now) - dayNumber(training.startedAt);
}

function ridesBetween(rides: Ride[], from: number, to: number): Ride[] {
  return rides.filter((r) => r.startedAt >= from && r.startedAt < to);
}

/**
 * `now` decides whether a rest day has already passed. It defaults to the
 * current time so the four-argument form still works.
 */
export function isDone(plan: Plan, training: TrainingState, rides: Ride[], dayIndex: number, now: number = Date.now()): boolean {
  if (training.done[dayIndex]) return true;
  const workout = plan.days[dayIndex];
  if (!workout) return false;
  const from = dayStartAt(training.startedAt, dayIndex);
  const that = ridesBetween(rides, from, dayStartAt(training.startedAt, dayIndex + 1));
  if (workout.kind === 'rest') return dayIndex < dayIndexAt(training, now) && that.length === 0;
  const movingMs = that.reduce((s, r) => s + r.movingMs, 0);
  return movingMs >= workout.minutes * 60000 * 0.8;
}

export function todayWorkout(
  training: TrainingState,
  rides: Ride[],
  now: number
): { plan: Plan; dayIndex: number; workout: Workout; done: boolean } | null {
  const plan = getPlan(training.planId);
  if (!plan) return null;
  const dayIndex = dayIndexAt(training, now);
  const workout = plan.days[dayIndex];
  if (dayIndex < 0 || !workout) return null;
  return { plan, dayIndex, workout, done: isDone(plan, training, rides, dayIndex, now) };
}

export function planProgress(
  plan: Plan,
  training: TrainingState,
  rides: Ride[],
  now: number
): { weekIndex: number; finished: boolean; doneWorkouts: number; totalWorkouts: number; weekKmTarget: number; weekKmDone: number } {
  const today = dayIndexAt(training, now);
  const finished = today >= plan.days.length;
  const weekIndex = Math.max(0, Math.min(plan.weeks - 1, Math.floor(today / 7)));
  let doneWorkouts = 0;
  let totalWorkouts = 0;
  plan.days.forEach((w, i) => {
    if (w.kind === 'rest') return;
    totalWorkouts += 1;
    if (isDone(plan, training, rides, i, now)) doneWorkouts += 1;
  });
  const from = dayStartAt(training.startedAt, weekIndex * 7);
  const to = dayStartAt(training.startedAt, weekIndex * 7 + 7);
  const weekKmDone = ridesBetween(rides, from, to).reduce((s, r) => s + r.distanceM, 0) / 1000;
  return { weekIndex, finished, doneWorkouts, totalWorkouts, weekKmTarget: plan.weeklyKm[weekIndex], weekKmDone };
}
