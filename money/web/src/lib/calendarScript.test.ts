import { calendarScript } from './calendarScript';

// Runs the Apps Script against a pretend Google Calendar, so the create / update / remove logic
// is checked without a Google account.

interface FakeEvent {
  title: string; description: string; date: Date; tags: Record<string, string>; deleted: boolean; visibility?: string;
}

function harness() {
  const events: FakeEvent[] = [];
  let calendars = 0;
  const wrap = (ev: FakeEvent) => ({
    getTag: (k: string) => ev.tags[k] ?? null,
    setTag: (k: string, v: string) => { ev.tags[k] = v; },
    getTitle: () => ev.title,
    setTitle: (t: string) => { ev.title = t; },
    getDescription: () => ev.description,
    setDescription: (d: string) => { ev.description = d; },
    isAllDayEvent: () => true,
    getAllDayStartDate: () => new Date(ev.date),
    setAllDayDate: (d: Date) => { ev.date = d; },
    setVisibility: (v: string) => { ev.visibility = v; },
    deleteEvent: () => { ev.deleted = true; },
  });
  const cal = {
    getName: () => 'Money Hub bills',
    getEvents: (from: Date, to: Date) => events.filter((e) => !e.deleted && e.date >= from && e.date < to).map(wrap),
    createAllDayEvent: (title: string, date: Date, opts: { description: string }) => {
      const ev: FakeEvent = { title, description: opts.description, date, tags: {}, deleted: false };
      events.push(ev);
      return wrap(ev);
    },
  };
  const globals = {
    CalendarApp: {
      getCalendarsByName: () => (calendars ? [cal] : []),
      createCalendar: () => { calendars++; return cal; },
      Color: { YELLOW: 'yellow' },
      Visibility: { PRIVATE: 'private' },
    },
    LockService: { getScriptLock: () => ({ waitLock: () => undefined, releaseLock: () => undefined }) },
    ContentService: { createTextOutput: (s: string) => ({ setMimeType: () => s }), MimeType: { JSON: 'json' } },
    Logger: { log: () => undefined },
  };
  const run = new Function(...Object.keys(globals), `${calendarScript('s3cret')}\nreturn { doPost, setup };`);
  const api = run(...Object.values(globals)) as { doPost: (e: unknown) => string; setup: () => void };
  const post = (body: unknown) => JSON.parse(api.doPost({ postData: { contents: JSON.stringify(body) } }));
  return { post, events, setup: api.setup, calendarsMade: () => calendars };
}

const item = (key: string, date: string, title = `Pay ${key}`) => ({ key, date, title, description: 'Due soon.' });

describe('Google Calendar script', () => {
  it('refuses a request without the right secret', () => {
    const h = harness();
    expect(h.post({ secret: 'nope', action: 'test' })).toEqual({ ok: false, error: 'wrong secret' });
    expect(h.post({ secret: 's3cret', action: 'test' })).toEqual({ ok: true, calendar: 'Money Hub bills' });
  });

  it('creates private all-day events, updates changed ones and removes paid ones', () => {
    const h = harness();
    const window = { secret: 's3cret', action: 'sync', from: '2026-10-31', to: '2027-03-01' };
    expect(h.post({ ...window, items: [item('globe', '2026-11-16'), item('power', '2026-11-28')] }))
      .toEqual({ ok: true, created: 2, updated: 0, removed: 0 });
    expect(h.events.every((e) => e.visibility === 'private' && e.tags.moneyhub)).toBe(true);
    expect(h.events[0].date.getDate()).toBe(16);

    // Same list again: nothing changes. Then Globe's amount changes and Electricity is paid.
    expect(h.post({ ...window, items: [item('globe', '2026-11-16'), item('power', '2026-11-28')] }))
      .toEqual({ ok: true, created: 0, updated: 0, removed: 0 });
    expect(h.post({ ...window, items: [item('globe', '2026-11-16', 'Pay globe (₱1,599.00)')] }))
      .toEqual({ ok: true, created: 0, updated: 1, removed: 1 });
    expect(h.events.filter((e) => !e.deleted).map((e) => e.title)).toEqual(['Pay globe (₱1,599.00)']);
    expect(h.calendarsMade()).toBe(1);
  });

  it('never touches events it did not make', () => {
    const h = harness();
    h.post({ secret: 's3cret', action: 'test' });
    h.events.push({ title: "Daughter's recital", description: '', date: new Date(2026, 10, 20), tags: {}, deleted: false });
    h.post({ secret: 's3cret', action: 'sync', from: '2026-10-31', to: '2027-03-01', items: [] });
    expect(h.events.find((e) => e.title === "Daughter's recital")?.deleted).toBe(false);
  });
});
