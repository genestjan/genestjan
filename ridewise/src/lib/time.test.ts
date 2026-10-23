import { formatDuration, localClock, localDayKey, parseLocal, zoneOffsetMin } from './time';

describe('time', () => {
  it('parses local Manila time to UTC', () => {
    expect(new Date(parseLocal('2026-11-07T05:00', 'Asia/Manila')!).toISOString()).toBe('2026-11-06T21:00:00.000Z');
    expect(zoneOffsetMin('Asia/Manila', new Date())).toBe(480);
  });
  it('rejects invalid dates and times', () => {
    expect(parseLocal('2026-02-31T05:00', 'Asia/Manila')).toBeNull();
    expect(parseLocal('2026-11-07T25:00', 'Asia/Manila')).toBeNull();
    expect(parseLocal('', 'Asia/Manila')).toBeNull();
  });
  it('reads the local clock', () => {
    const ms = parseLocal('2026-11-07T13:30', 'Asia/Manila')!; // a Saturday
    expect(localClock(ms, 'Asia/Manila')).toEqual({ minutes: 13 * 60 + 30, weekday: 5 });
    expect(localDayKey(ms, 'Asia/Manila')).toBe('2026-11-07');
  });
  it('formats durations', () => {
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(120)).toBe('2 h');
    expect(formatDuration(135)).toBe('2 h 15 min');
  });
});
