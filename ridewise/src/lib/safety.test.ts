import { adviceFor, fatigueStatus } from './fatigue';
import { remindersDue, supplyWarning } from './reminders';
import { CHECKLISTS, progress } from './checklists';
import { googleDirectionsUrl } from './navlinks';
import type { RideSession } from '../types';

const session = (over: Partial<RideSession> = {}): RideSession => ({
  id: 's',
  planId: 'p',
  state: 'riding',
  startedAt: '2026-11-07T00:00:00Z',
  pauses: [],
  checkins: [],
  supplies: { water: 'full', food: 'full', electrolytes: 'unknown' },
  reminders: {},
  lastRideResumeAt: '2026-11-07T00:00:00Z',
  gpsEnabled: false,
  ...over,
});
const T0 = Date.parse('2026-11-07T00:00:00Z');

describe('fatigue', () => {
  it('maps every answer to advice without pressuring the rider', () => {
    expect(adviceFor('good').status).toBe('ready');
    expect(adviceFor('little-tired').status).toBe('consider-break');
    expect(adviceFor('very-tired')).toMatchObject({ status: 'rest-recommended', pauseRide: true });
    for (const a of ['unwell', 'pain', 'unsafe'] as const) {
      const adv = adviceFor(a);
      expect(adv.status).toBe('stop-and-assess');
      expect(adv.pauseRide).toBe(true);
      expect(adv.showEmergency).toBe(true);
      expect(adv.advice).not.toMatch(/keep going|push on|stay on schedule/i);
    }
  });

  it('suggests breaks from continuous riding time, not age', () => {
    expect(fatigueStatus(session(), T0 + 30 * 60000, 45).status).toBe('ready');
    expect(fatigueStatus(session(), T0 + 50 * 60000, 45).status).toBe('consider-break');
    expect(fatigueStatus(session(), T0 + 70 * 60000, 45).status).toBe('rest-recommended');
  });

  it('keeps serious check-ins active until the rider checks in again', () => {
    const s = session({ checkins: [{ at: '2026-11-07T00:00:00Z', answer: 'unwell' }] });
    expect(fatigueStatus(s, T0 + 3 * 3600000, 45).status).toBe('stop-and-assess');
    s.checkins.push({ at: '2026-11-07T03:00:00Z', answer: 'good' });
    expect(fatigueStatus({ ...s, state: 'at-stop' }, T0 + 3 * 3600000 + 60000, 45).status).toBe('ready');
  });

  it('shows stop-and-assess while paused for safety', () => {
    expect(fatigueStatus(session({ state: 'safety-pause' }), T0, 45).status).toBe('stop-and-assess');
  });
});

describe('reminders', () => {
  it('schedules, acknowledges, snoozes and disables', () => {
    const s = session();
    const due = remindersDue(s, T0 + 21 * 60000);
    expect(due[0]).toMatchObject({ id: 'hydrate', overdue: true });
    s.reminders.hydrate = { lastAck: new Date(T0 + 21 * 60000).toISOString() };
    expect(remindersDue(s, T0 + 30 * 60000).find((r) => r.id === 'hydrate')!.overdue).toBe(false);
    s.reminders.snack = { snoozedUntil: new Date(T0 + 60 * 60000).toISOString() };
    expect(remindersDue(s, T0 + 50 * 60000).find((r) => r.id === 'snack')!.overdue).toBe(false);
    s.reminders.supplies = { disabled: true };
    expect(remindersDue(s, T0).some((r) => r.id === 'supplies')).toBe(false);
  });

  it('warns when supplies are low before a long stretch', () => {
    expect(supplyWarning({ water: 'low', food: 'full', electrolytes: 'unknown' }, 20, 18)).toMatch(/20.0 km/);
    expect(supplyWarning({ water: 'full', food: 'full', electrolytes: 'unknown' }, 20, 18)).toBeNull();
    expect(supplyWarning({ water: 'empty', food: 'full', electrolytes: 'unknown' }, null, 18)).toMatch(/no mapped/);
  });
});

describe('checklists', () => {
  it('tracks completion and critical problems', () => {
    const items = CHECKLISTS['pre-ride'].items;
    const p = progress(items, { helmet: 'ok', brakes: 'problem', bottles: 'ok' });
    expect(p.done).toBe(3);
    expect(p.criticalProblems.map((i) => i.id)).toEqual(['brakes']);
    expect(progress(items, {}).pct).toBe(0);
  });
});

describe('navigation links', () => {
  it('builds Google Maps cycling directions from real coordinates', () => {
    const url = googleDirectionsUrl({ lat: 7.0555737, lng: 125.601089 });
    expect(url).toContain('destination=7.055574%2C125.601089');
    expect(url).toContain('travelmode=bicycling');
  });
});
