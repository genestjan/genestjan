import { describe, expect, it } from 'vitest';
import { icsFor } from './util';

describe('Add to calendar', () => {
  it('makes a valid calendar entry in UTC with a 2-hour reminder', () => {
    const ics = icsFor({ id: 'e1', title: 'District Meet; Boys, U12', startsAt: '2026-11-10T00:00:00Z', endsAt: '2026-11-10T08:30:00Z', venue: 'GSCNSSAT', bring: 'Water' }, 'https://rangersfc.net/app/#/event/e1');
    const lines = ics.split('\r\n');
    expect(lines[0]).toBe('BEGIN:VCALENDAR'); expect(lines.at(-1)).toBe('END:VCALENDAR');
    expect(lines).toContain('DTSTART:20261110T000000Z'); expect(lines).toContain('DTEND:20261110T083000Z');
    expect(lines).toContain(String.raw`SUMMARY:District Meet\; Boys\, U12`);
    expect(lines).toContain('LOCATION:GSCNSSAT'); expect(lines).toContain('TRIGGER:-PT2H');
    expect(ics).toContain('UID:e1@rangersfc.net');
  });
});
