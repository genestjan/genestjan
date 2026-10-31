import { billsFor, debts, type Book } from './compute';
import { sha256Hex } from './crypto';
import { addDays, addMonths, fromISO, monthOf, shortDate, todayISO } from './dates';
import { DEFAULT_REMINDERS, type CalendarLink, type ReminderSettings } from './model';
import { formatMoney } from './money';
import { hasNative, native, platform } from './native';
import { AppError } from './problems';

// Bill reminders, N days before each due date (5 unless changed in Settings): a notification on
// the phone (and the laptop, if switched on) and, if connected, an all-day event in Google
// Calendar. Paid bills drop out, so their notifications and calendar events disappear too.

export interface Reminder {
  /** Stable for one bill in one month, so a re-send updates instead of duplicating. */
  id: string;
  name: string;
  /** What is still to pay, in pesos (0 when unknown). */
  amount: number;
  due: string;
  /** The reminder day: the due date minus N days. */
  date: string;
  /** The moment to notify, in local time. */
  at: number;
}

const MONTHS_AHEAD = 4;

export const reminderSettings = (s: { reminders?: ReminderSettings }): ReminderSettings => ({ ...DEFAULT_REMINDERS, ...s.reminders });

export function upcomingReminders(book: Book, today = todayISO(), opts: ReminderSettings = DEFAULT_REMINDERS): Reminder[] {
  const out: Reminder[] = [];
  const [hh, mm] = opts.time.split(':').map(Number);
  const add = (id: string, name: string, amount: number, due: string) => {
    const date = addDays(due, -opts.days);
    if (date < today) return; // its reminder day has passed; the Home screen still shows it as due soon
    const at = fromISO(date);
    at.setHours(hh || 0, mm || 0, 0, 0);
    out.push({ id, name, amount: Math.max(0, amount), due, date, at: at.getTime() });
  };
  const start = monthOf(today);
  for (let i = 0; i < MONTHS_AHEAD; i++) {
    const month = addMonths(start, i);
    for (const r of billsFor(book, month, today)) {
      if (r.state !== 'paid') add(`bill:${r.bill.id}:${month}`, r.bill.name, r.amount - r.paid, r.due);
    }
    // Cards and loans with a due day but no bill of their own.
    for (const d of debts(book, month, today).rows) {
      if (d.bill || !d.due || d.state === 'paid' || d.outstanding <= 0) continue;
      add(`debt:${d.account.id}:${month}`, d.account.name, d.monthly, d.due);
    }
  }
  return out.sort((a, b) => a.at - b.at || a.name.localeCompare(b.name));
}

const day = (iso: string) => shortDate(iso).replace(/, \d{4}$/, '');

export function notificationText(r: Reminder, days: number) {
  return {
    title: `${r.name} is due in ${days} day${days === 1 ? '' : 's'}`,
    body: r.amount ? `${formatMoney(r.amount)} due on ${shortDate(r.due)}. Tap to pay or check it.` : `Due on ${shortDate(r.due)}. Tap to check it.`,
  };
}

export function calendarEvent(r: Reminder, amounts: boolean) {
  return {
    key: r.id,
    date: r.date,
    title: `Pay ${r.name} by ${day(r.due)}${amounts && r.amount ? ` (${formatMoney(r.amount)})` : ''}`,
    description: `Due ${shortDate(r.due)}.\nAdded by Money Hub. When you mark the bill as paid, this reminder disappears by itself.`,
  };
}

// ---- This device -----------------------------------------------------------------------------

const NOTIFY = 'mh-notify';
const SENT = 'mh-notify-sent';

/** Notifications are per device: on for the phone by default, off for the laptop. */
export function deviceNotifications(): boolean {
  const v = localStorage.getItem(NOTIFY);
  return v ? v === '1' : platform === 'android';
}

export function setDeviceNotifications(on: boolean) {
  localStorage.setItem(NOTIFY, on ? '1' : '0');
  localStorage.removeItem(SENT);
}

export async function scheduleOnDevice(list: Reminder[], days: number): Promise<void> {
  if (!hasNative) return;
  const items = deviceNotifications()
    ? list.filter((r) => r.at > Date.now()).slice(0, 48).map((r) => ({ id: r.id, at: r.at, ...notificationText(r, days) }))
    : [];
  const hash = await sha256Hex(JSON.stringify(items));
  if (localStorage.getItem(SENT) === hash) return;
  await native.notifySchedule(items);
  localStorage.setItem(SENT, hash);
}

// ---- Google Calendar (through a small Apps Script in your own Google account) ---------------

export const checkScriptUrl = (url: string) =>
  /^https:\/\/script\.google\.com\/macros\/s\/[\w-]{20,}\/exec$/.test(url.trim())
    ? null
    : 'Paste the Web app URL from the deployment. It starts with https://script.google.com/macros/s/ and ends with /exec.';

interface ScriptReply { ok: boolean; error?: string; created?: number; updated?: number; removed?: number; calendar?: string }

// The web app address only shortened, for error details that may be screenshotted.
const shortScriptUrl = (url: string) => url.replace(/(\/macros\/s\/[\w-]{8})[\w-]+/, '$1…');

async function postToScript(url: string, body: unknown): Promise<ScriptReply> {
  const text = JSON.stringify(body);
  let raw: string;
  let status: number;
  if (hasNative) {
    // Apps Script answers with a redirect to another Google domain, which a web page cannot
    // follow reliably; the Android and Windows apps make the call instead.
    const res = await native.http({ method: 'POST', url, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: text });
    raw = res.body;
    status = res.status;
  } else {
    const res = await fetch(url, { method: 'POST', body: text });
    raw = await res.text();
    status = res.status;
  }
  try {
    return JSON.parse(raw) as ScriptReply;
  } catch {
    const page = raw.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<[^>]+>/gi, ' ').replace(/\s+/g, ' ').trim();
    const detail = `HTTP ${status}: ${page.slice(0, 140)} · ${shortScriptUrl(url)}`;
    if (/Script function not found/i.test(page)) {
      throw new AppError('The web app runs an old copy of the script. In Apps Script click Deploy, then New deployment, then Deploy, and paste the new Web app URL here.', detail);
    }
    throw new AppError(/<html/i.test(raw)
      ? 'Google answered with a sign-in page. In the deployment, set "Who has access" to Anyone, then deploy again.'
      : 'The calendar script did not answer properly. Check the Web app URL.', detail);
  }
}

function explain(r: ScriptReply): ScriptReply {
  if (r.ok) return r;
  throw new AppError(r.error === 'wrong secret'
    ? 'The script in your Google account has a different secret from Money Hub. Tap Copy the script, paste it over the old one in Apps Script and save, then deploy again (Deploy, New deployment) and paste the new Web app URL here.'
    : r.error || 'The calendar script reported a problem.', `script answered: ${r.error ?? 'no reason given'}`);
}

export async function testCalendar(link: Pick<CalendarLink, 'url' | 'secret'>): Promise<string> {
  const r = explain(await postToScript(link.url, { secret: link.secret, action: 'test' }));
  return r.calendar ?? 'Money Hub bills';
}

/** Sends the reminder list when it changed. Returns the new fingerprint, or null if unchanged. */
export async function syncCalendar(link: CalendarLink, list: Reminder[], today = todayISO(), force = false): Promise<{ hash: string; reply: ScriptReply } | null> {
  const payload = { from: today, to: addDays(today, MONTHS_AHEAD * 31), items: list.map((r) => calendarEvent(r, link.amounts)) };
  const hash = await sha256Hex(JSON.stringify({ url: link.url, payload }));
  if (!force && hash === link.hash) return null;
  const reply = explain(await postToScript(link.url, { secret: link.secret, action: 'sync', ...payload }));
  return { hash, reply };
}

/** Removes every future Money Hub event from the calendar (used when disconnecting). */
export async function clearCalendar(link: CalendarLink, today = todayISO()) {
  explain(await postToScript(link.url, { secret: link.secret, action: 'sync', from: today, to: addDays(today, 400), items: [] }));
}
