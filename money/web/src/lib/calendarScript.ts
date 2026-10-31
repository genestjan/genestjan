// The Google Apps Script that puts bill reminders into Google Calendar. Money Hub fills in a
// secret, you paste it at script.google.com and deploy it as a web app (money/SETUP.md, part 10).
// It runs as you, so no Google Cloud project or sign-in token is needed, and nothing expires.

export function calendarScript(secret: string): string {
  return `// Money Hub: bill reminders in Google Calendar.
// Paste all of this at script.google.com, run "setup" once, then deploy as a web app
// (Execute as: Me; Who has access: Anyone). Only a request carrying the secret below can
// change anything, and it can only touch the "Money Hub bills" calendar.

const SECRET = '${secret}';
const CALENDAR_NAME = 'Money Hub bills';

function setup() {
  const cal = calendar_();
  Logger.log('Ready: ' + cal.getName());
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply_({ ok: false, error: 'bad request' });
  }
  if (!body || body.secret !== SECRET) return reply_({ ok: false, error: 'wrong secret' });
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const cal = calendar_();
    if (body.action === 'test') return reply_({ ok: true, calendar: cal.getName() });
    const from = day_(body.from);
    const to = day_(body.to);
    const items = body.items || [];
    const existing = {};
    cal.getEvents(from, new Date(to.getTime() + 86400000)).forEach(function (ev) {
      const key = ev.getTag('moneyhub');
      if (key) existing[key] = ev;
    });
    let created = 0, updated = 0, removed = 0;
    items.forEach(function (it) {
      const date = day_(it.date);
      const ev = existing[it.key];
      if (ev) {
        delete existing[it.key];
        const same = ev.getTitle() === it.title && ev.getDescription() === it.description
          && ev.isAllDayEvent() && ev.getAllDayStartDate().getTime() === date.getTime();
        if (!same) {
          ev.setTitle(it.title);
          ev.setDescription(it.description);
          ev.setAllDayDate(date);
          updated++;
        }
      } else {
        const made = cal.createAllDayEvent(it.title, date, { description: it.description });
        made.setTag('moneyhub', it.key);
        made.setVisibility(CalendarApp.Visibility.PRIVATE);
        created++;
      }
    });
    Object.keys(existing).forEach(function (key) {
      existing[key].deleteEvent();
      removed++;
    });
    return reply_({ ok: true, created: created, updated: updated, removed: removed });
  } finally {
    lock.releaseLock();
  }
}

function calendar_() {
  const found = CalendarApp.getCalendarsByName(CALENDAR_NAME);
  if (found.length) return found[0];
  return CalendarApp.createCalendar(CALENDAR_NAME, {
    color: CalendarApp.Color.YELLOW,
    summary: 'Bill reminders from Money Hub. Paid bills disappear by themselves.',
  });
}

function day_(iso) {
  const p = String(iso).split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
}

function reply_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
`;
}

export const newCalendarSecret = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('');
