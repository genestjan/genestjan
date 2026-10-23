// Fatigue status is a planning prompt built from what the rider reports and
// how long they have been riding. It is never a medical assessment, and it
// never tells a rider to keep going to protect the schedule.

import type { FatigueAnswer, FatigueStatus, RideSession } from '../types';

export const FATIGUE_OPTIONS: { value: FatigueAnswer; label: string }[] = [
  { value: 'good', label: 'Feeling good' },
  { value: 'little-tired', label: 'A little tired' },
  { value: 'very-tired', label: 'Very tired' },
  { value: 'unwell', label: 'Dizzy or unwell' },
  { value: 'pain', label: 'Experiencing pain' },
  { value: 'unsafe', label: 'Unsafe to continue' },
];

export type FatigueAdvice = {
  status: FatigueStatus;
  title: string;
  advice: string;
  pauseRide: boolean;
  showEmergency: boolean;
};

export function adviceFor(answer: FatigueAnswer): FatigueAdvice {
  switch (answer) {
    case 'good':
      return { status: 'ready', title: 'Good to go', advice: 'Carry on with the plan and keep drinking regularly.', pauseRide: false, showEmergency: false };
    case 'little-tired':
      return {
        status: 'consider-break',
        title: 'Consider a short break',
        advice: 'Pull over somewhere safe for a few minutes, drink water, have a snack, then check in again before continuing.',
        pauseRide: false,
        showEmergency: false,
      };
    case 'very-tired':
      return {
        status: 'rest-recommended',
        title: 'Rest recommended',
        advice: 'Stop at a safe place and rest properly. Eat, drink and reassess before riding again. The schedule will adjust; it can wait.',
        pauseRide: true,
        showEmergency: false,
      };
    case 'unwell':
      return {
        status: 'stop-and-assess',
        title: 'Stop and assess',
        advice: 'Stop in a safe, shaded place and do not ride while you feel dizzy or unwell. If symptoms are severe or not improving, get medical help.',
        pauseRide: true,
        showEmergency: true,
      };
    case 'pain':
      return {
        status: 'stop-and-assess',
        title: 'Stop and assess',
        advice: 'Stop and check what hurts rather than riding through pain. Continue only if you are confident it is safe.',
        pauseRide: true,
        showEmergency: true,
      };
    case 'unsafe':
      return {
        status: 'stop-and-assess',
        title: 'Ride paused for safety',
        advice: 'The ride plan is paused. Find a safe place off the road, tell the group, and arrange help or a pickup if you need it.',
        pauseRide: true,
        showEmergency: true,
      };
  }
}

const RANK: Record<FatigueStatus, number> = { ready: 0, 'consider-break': 1, 'rest-recommended': 2, 'stop-and-assess': 3 };

/**
 * Combined status: the latest check-in (valid for 45 min) and continuous
 * riding time against the plan's own threshold. Higher concern wins.
 */
export function fatigueStatus(session: RideSession | null, now: number, maxRideMin: number): { status: FatigueStatus; reasons: string[] } {
  if (!session) return { status: 'ready', reasons: [] };
  const reasons: string[] = [];
  let status: FatigueStatus = 'ready';
  const bump = (s: FatigueStatus, why: string) => {
    if (RANK[s] > RANK[status]) status = s;
    reasons.push(why);
  };
  const last = session.checkins[session.checkins.length - 1];
  if (last) {
    const age = (now - Date.parse(last.at)) / 60000;
    const a = adviceFor(last.answer);
    // Serious answers persist until the rider checks in again.
    if (a.status === 'stop-and-assess' || age <= 45) bump(a.status, `You reported: ${labelOf(last.answer)}`);
  }
  if (session.state === 'riding' && session.lastRideResumeAt) {
    const riding = (now - Date.parse(session.lastRideResumeAt)) / 60000;
    if (riding >= maxRideMin * 1.5) bump('rest-recommended', `Riding ${Math.round(riding)} min without a break`);
    else if (riding >= maxRideMin) bump('consider-break', `Riding ${Math.round(riding)} min since the last break`);
  }
  if (session.state === 'safety-pause') bump('stop-and-assess', 'Ride paused for safety');
  return { status, reasons };
}

export function labelOf(a: FatigueAnswer) {
  return FATIGUE_OPTIONS.find((o) => o.value === a)?.label ?? a;
}

export const STATUS_LABEL: Record<FatigueStatus, string> = {
  ready: 'Ready',
  'consider-break': 'Consider a break',
  'rest-recommended': 'Rest recommended',
  'stop-and-assess': 'Stop and assess',
};
