import { describe, it, expect } from 'vitest';
import {
  snapMins, minsToPx, pxToMins, movedStart, resizedDuration, rowAfterDrag, slotFromClick,
  blockRect, minsOnDay, isoAt, minsOfDay, startOfWeek, hhmm, parseHhmm,
} from './timeline';

describe('timeline maths', () => {
  it('snaps to 15 minutes', () => {
    expect(snapMins(7)).toBe(0);
    expect(snapMins(8)).toBe(15);
    expect(snapMins(22)).toBe(15);
    expect(snapMins(23)).toBe(30);
  });
  it('converts time to pixels and back', () => {
    expect(minsToPx(9 * 60, 8, 100)).toBe(100);
    expect(minsToPx(8 * 60 + 30, 8, 100)).toBe(50);
    expect(pxToMins(150, 8, 100)).toBe(9 * 60 + 30);
    expect(pxToMins(minsToPx(615, 8, 96), 8, 96)).toBeCloseTo(615);
  });
  it('builds block rects', () => {
    expect(blockRect(9 * 60, 10 * 60 + 30, 8, 100)).toEqual({ left: 100, width: 150 });
  });
  it('moves with snap and clamps to opening hours', () => {
    expect(movedStart(9 * 60, 60, 25, 100, 8, 18)).toBe(9 * 60 + 15);
    expect(movedStart(9 * 60, 60, -1000, 100, 8, 18)).toBe(8 * 60);
    expect(movedStart(9 * 60, 120, 5000, 100, 8, 18)).toBe(16 * 60);
  });
  it('resizes with snap, minimum and closing limit', () => {
    expect(resizedDuration(9 * 60, 60, 50, 100, 18)).toBe(90);
    expect(resizedDuration(9 * 60, 60, -500, 100, 18)).toBe(15);
    expect(resizedDuration(17 * 60, 60, 900, 100, 18)).toBe(60);
  });
  it('picks rows from vertical drag', () => {
    expect(rowAfterDrag(1, 80, 72, 4)).toBe(2);
    expect(rowAfterDrag(1, -500, 72, 4)).toBe(0);
    expect(rowAfterDrag(1, 900, 72, 4)).toBe(3);
  });
  it('slots snap to half hours inside hours', () => {
    expect(slotFromClick(110, 100, 8, 18)).toBe(9 * 60);
    expect(slotFromClick(-50, 100, 8, 18)).toBe(8 * 60);
    expect(slotFromClick(99999, 100, 8, 18)).toBe(17 * 60 + 30);
  });
  it('round-trips iso and minutes of day', () => {
    const day = new Date(2026, 5, 10, 15, 0);
    expect(minsOfDay(isoAt(day, 9 * 60 + 15), day)).toBe(9 * 60 + 15);
  });
  it('counts minutes on a day', () => {
    const day = new Date(2026, 5, 10);
    const j = { scheduledStart: isoAt(day, 600), scheduledEnd: isoAt(day, 690) };
    expect(minsOnDay(j, day)).toBe(90);
    expect(minsOnDay(j, new Date(2026, 5, 11))).toBe(0);
  });
  it('week starts on Monday', () => {
    expect(startOfWeek(new Date(2026, 5, 10)).getDay()).toBe(1);
    expect(startOfWeek(new Date(2026, 5, 14)).getDate()).toBe(8);
  });
  it('formats hh:mm', () => {
    expect(hhmm(545)).toBe('09:05');
    expect(parseHhmm('09:05')).toBe(545);
  });
});
