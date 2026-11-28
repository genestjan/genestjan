// Pure helpers for the repair calendar timeline: time <-> pixel maths and snapping.
import type { WorkOrder } from '@/domain/types';

export const SNAP_MINS = 15;

/** Round minutes to the nearest snap step. */
export const snapMins = (mins: number, step = SNAP_MINS) => Math.round(mins / step) * step;

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Minutes after local midnight for an ISO timestamp, relative to the given day (can exceed 1440). */
export function minsOfDay(iso: string, day: Date): number {
  const d0 = new Date(day);
  d0.setHours(0, 0, 0, 0);
  return Math.round((new Date(iso).getTime() - d0.getTime()) / 60_000);
}

/** ISO string for `mins` after local midnight of `day`. */
export function isoAt(day: Date, mins: number): string {
  const d0 = new Date(day);
  d0.setHours(0, 0, 0, 0);
  return new Date(d0.getTime() + mins * 60_000).toISOString();
}

/** Pixel x for a minutes-of-day value when the timeline starts at openHour. */
export const minsToPx = (mins: number, openHour: number, pxPerHour: number) => ((mins - openHour * 60) / 60) * pxPerHour;

/** Minutes-of-day for a pixel x on the timeline. */
export const pxToMins = (px: number, openHour: number, pxPerHour: number) => openHour * 60 + (px / pxPerHour) * 60;

/** Width in px of a duration. */
export const durToPx = (durMins: number, pxPerHour: number) => (durMins / 60) * pxPerHour;

/** Left and width of a block in px. */
export function blockRect(startMins: number, endMins: number, openHour: number, pxPerHour: number) {
  return { left: minsToPx(startMins, openHour, pxPerHour), width: durToPx(endMins - startMins, pxPerHour) };
}

/** New start (snapped, kept inside opening hours) after dragging by dx px. */
export function movedStart(startMins: number, durMins: number, dxPx: number, pxPerHour: number, openHour: number, closeHour: number) {
  const raw = startMins + (dxPx / pxPerHour) * 60;
  const lo = openHour * 60;
  const hi = Math.max(lo, closeHour * 60 - durMins);
  return clamp(snapMins(raw), lo, hi);
}

/** New duration (snapped, at least one step, ending by closing time) after resizing by dx px. */
export function resizedDuration(startMins: number, durMins: number, dxPx: number, pxPerHour: number, closeHour: number) {
  const raw = durMins + (dxPx / pxPerHour) * 60;
  const max = Math.max(SNAP_MINS, closeHour * 60 - startMins);
  return clamp(snapMins(raw), SNAP_MINS, max);
}

/** Row index after dragging dy px from a row, clamped to the rows available. */
export const rowAfterDrag = (rowIndex: number, dyPx: number, rowH: number, rowCount: number) =>
  clamp(rowIndex + Math.round(dyPx / rowH), 0, Math.max(0, rowCount - 1));

/** Slot minutes for a click at x px, snapped to half hours and kept inside opening hours. */
export function slotFromClick(xPx: number, pxPerHour: number, openHour: number, closeHour: number) {
  return clamp(snapMins(pxToMins(xPx, openHour, pxPerHour), 30), openHour * 60, closeHour * 60 - 30);
}

export const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const startOfWeek = (d: Date) => {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7; // Monday first
  return addDays(x, -dow);
};
export const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();

/** Minutes of a job that fall inside the given day. */
export function minsOnDay(j: Pick<WorkOrder, 'scheduledStart' | 'scheduledEnd'>, day: Date): number {
  const d0 = startOfDay(day).getTime();
  const s = Math.max(new Date(j.scheduledStart).getTime(), d0);
  const e = Math.min(new Date(j.scheduledEnd).getTime(), d0 + 86_400_000);
  return Math.max(0, (e - s) / 60_000);
}

export const jobOnDay = (j: Pick<WorkOrder, 'scheduledStart' | 'scheduledEnd'>, day: Date) => minsOnDay(j, day) > 0;

export const hhmm = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
export const parseHhmm = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
