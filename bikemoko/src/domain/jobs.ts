// Repair estimates, work orders and scheduling rules.
import type { JobLine, JobStatus, WorkOrder, Centavos } from './types';

export interface JobTotals {
  parts: Centavos;
  labor: Centavos;
  total: Centavos;
  durationMins: number;
}

export function jobTotals(lines: JobLine[]): JobTotals {
  let parts = 0;
  let labor = 0;
  let durationMins = 0;
  for (const l of lines) {
    const amt = l.qty * l.unitPrice;
    if (l.kind === 'part') parts += amt;
    else {
      labor += amt;
      durationMins += l.qty * l.durationMins;
    }
  }
  return { parts, labor, total: parts + labor, durationMins };
}

export const JOB_STATUS: Record<JobStatus, { label: string; tone: string }> = {
  scheduled: { label: 'Scheduled', tone: 'slate' },
  checked_in: { label: 'Checked in', tone: 'sky' },
  in_repair: { label: 'In repair', tone: 'brand' },
  waiting_parts: { label: 'Waiting for parts', tone: 'amber' },
  quality_check: { label: 'Quality check', tone: 'violet' },
  ready: { label: 'Ready for pickup', tone: 'emerald' },
  completed: { label: 'Completed', tone: 'zinc' },
  cancelled: { label: 'Cancelled', tone: 'rose' },
};

// Which status a job may move to next. Keeps the workshop flow honest.
export const NEXT_STATUS: Record<JobStatus, JobStatus[]> = {
  scheduled: ['checked_in', 'cancelled'],
  checked_in: ['in_repair', 'waiting_parts', 'cancelled'],
  in_repair: ['waiting_parts', 'quality_check'],
  waiting_parts: ['in_repair', 'cancelled'],
  quality_check: ['in_repair', 'ready'],
  ready: ['completed'],
  completed: [],
  cancelled: [],
};

export const canMove = (from: JobStatus, to: JobStatus) => NEXT_STATUS[from].includes(to);

const OPEN: JobStatus[] = ['scheduled', 'checked_in', 'in_repair', 'waiting_parts', 'quality_check'];

/** Overlapping jobs for the same mechanic (or same bay) in the given window. */
export function findConflicts(
  jobs: WorkOrder[],
  candidate: { id?: string; mechanicId: string | null; bay: string; start: string; end: string },
): WorkOrder[] {
  const s = new Date(candidate.start).getTime();
  const e = new Date(candidate.end).getTime();
  if (!(e > s)) throw new Error('End time must be after start time');
  return jobs.filter((j) => {
    if (j.id === candidate.id || !OPEN.includes(j.status)) return false;
    const sameLane = (candidate.mechanicId && j.mechanicId === candidate.mechanicId) || j.bay === candidate.bay;
    if (!sameLane) return false;
    const js = new Date(j.scheduledStart).getTime();
    const je = new Date(j.scheduledEnd).getTime();
    return s < je && js < e;
  });
}

/** Minutes a mechanic is booked on a given day. */
export function bookedMins(jobs: WorkOrder[], mechanicId: string, day: Date): number {
  const d0 = new Date(day);
  d0.setHours(0, 0, 0, 0);
  const d1 = d0.getTime() + 86_400_000;
  return jobs
    .filter((j) => j.mechanicId === mechanicId && OPEN.includes(j.status))
    .reduce((sum, j) => {
      const s = Math.max(new Date(j.scheduledStart).getTime(), d0.getTime());
      const e = Math.min(new Date(j.scheduledEnd).getTime(), d1);
      return sum + Math.max(0, (e - s) / 60_000);
    }, 0);
}

/** Total worked minutes including a running timer. */
export function workedMins(j: Pick<WorkOrder, 'workedMins' | 'timerSince'>, now = Date.now()): number {
  return j.workedMins + (j.timerSince ? Math.floor((now - new Date(j.timerSince).getTime()) / 60_000) : 0);
}
