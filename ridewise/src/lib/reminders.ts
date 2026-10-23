// Hydration and nutrition reminders. Intervals are editable defaults, not
// prescriptions: riders drink and eat to their own needs and conditions.

import type { RideSession } from '../types';

export type ReminderDef = { id: string; label: string; message: string; everyMin: number };

export const DEFAULT_REMINDERS: ReminderDef[] = [
  { id: 'hydrate', label: 'Hydration', message: 'Quick hydration check. Your future self will thank you.', everyMin: 20 },
  { id: 'snack', label: 'Snack', message: 'Snack time. Small and often beats one big bonk.', everyMin: 45 },
  { id: 'supplies', label: 'Supplies', message: 'Check your water and food before the next stretch.', everyMin: 90 },
];

export type DueReminder = ReminderDef & { dueAt: number; overdue: boolean };

/** Next due time for each enabled reminder; counting starts at ride start. */
export function remindersDue(session: RideSession, now: number, defs: ReminderDef[] = DEFAULT_REMINDERS): DueReminder[] {
  const start = Date.parse(session.startedAt);
  const out: DueReminder[] = [];
  for (const d of defs) {
    const st = session.reminders[d.id] ?? {};
    if (st.disabled) continue;
    const from = st.lastAck ? Date.parse(st.lastAck) : start;
    let dueAt = from + d.everyMin * 60000;
    if (st.snoozedUntil) dueAt = Math.max(dueAt, Date.parse(st.snoozedUntil));
    out.push({ ...d, dueAt, overdue: now >= dueAt });
  }
  return out.sort((a, b) => a.dueAt - b.dueAt);
}

export function supplyWarning(levels: RideSession['supplies'], nextSupplyKm: number | null, speedKmh: number): string | null {
  const low = (l: string) => l === 'low' || l === 'empty';
  if (nextSupplyKm === null) {
    if (low(levels.water) || low(levels.food)) return 'Supplies are low and there is no mapped supply stop ahead. Refill at the next safe opportunity.';
    return null;
  }
  const min = (nextSupplyKm / Math.max(1, speedKmh)) * 60;
  if ((low(levels.water) || low(levels.food)) && min > 30) {
    return `Supplies are low and the next mapped water/food stop is ${nextSupplyKm.toFixed(1)} km away (about ${Math.round(min)} min). Consider refilling sooner.`;
  }
  return null;
}
