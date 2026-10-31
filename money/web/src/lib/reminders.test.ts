import type { Book } from './compute';
import { catId, defaultCategories, defaultSettings, type Account, type Bill, type Txn } from './model';
import { calendarEvent, notificationText, upcomingReminders, syncCalendar } from './reminders';

const acct = (id: string, extra: Partial<Account> = {}): Account => ({
  id, kind: 'account', updatedAt: 1, name: id, type: 'bank', institution: 'bpi', currency: 'PHP', openingBalance: 0, ...extra,
});
const bill = (id: string, extra: Partial<Bill>): Bill => ({
  id, kind: 'bill', updatedAt: 1, name: id, amount: 0, dueDay: 1, active: true, ...extra,
});

function book(txns: Txn[] = [], bills: Bill[] = []): Book {
  return {
    accounts: [
      acct('bpi', { openingBalance: 5_000_000 }),
      acct('card', { name: 'UnionBank Visa', institution: 'unionbank', type: 'credit', openingBalance: -2_000_000, dueDay: 13 }),
    ],
    txns,
    categories: defaultCategories(),
    budgets: [],
    bills: bills.length ? bills : [
      bill('globe', { name: 'Globe postpaid', amount: 149_900, dueDay: 21, categoryId: catId('bills') }),
      bill('power', { name: 'Electricity', amount: 380_000, dueDay: 3, categoryId: catId('bills') }),
    ],
    settings: defaultSettings(),
  };
}

const TODAY = '2026-10-31';

describe('upcomingReminders', () => {
  it('reminds five days before each due date at nine in the morning', () => {
    const list = upcomingReminders(book(), TODAY);
    const globeNov = list.find((r) => r.id === 'bill:globe:2026-11')!;
    expect(globeNov).toMatchObject({ name: 'Globe postpaid', due: '2026-11-21', date: '2026-11-16', amount: 149_900 });
    expect(new Date(globeNov.at).getHours()).toBe(9);
    expect(new Date(globeNov.at).getDate()).toBe(16);
    // Electricity on 3 November: its reminder day (29 October) has passed, so it is not scheduled.
    expect(list.find((r) => r.id === 'bill:power:2026-11')).toBeUndefined();
    expect(list.find((r) => r.id === 'bill:power:2026-12')?.date).toBe('2026-11-28');
    expect(list.map((r) => r.at)).toEqual([...list.map((r) => r.at)].sort((a, b) => a - b));
  });

  it('drops a bill once it is paid, so its notification and calendar event go away', () => {
    const paid: Txn = { id: 'p', kind: 'txn', updatedAt: 1, type: 'expense', date: '2026-11-10', amount: 149_900, accountId: 'bpi', billId: 'globe', billMonth: '2026-11', source: 'manual' };
    const list = upcomingReminders(book([paid]), TODAY);
    expect(list.find((r) => r.id === 'bill:globe:2026-11')).toBeUndefined();
    expect(list.find((r) => r.id === 'bill:globe:2026-12')).toBeDefined();
  });

  it('also reminds for a card with a due day and no bill', () => {
    const list = upcomingReminders(book(), TODAY);
    expect(list.find((r) => r.id === 'debt:card:2026-11')).toMatchObject({ name: 'UnionBank Visa', due: '2026-11-13', date: '2026-11-08' });
  });

  it('follows the number of days and the time chosen in Settings', () => {
    const list = upcomingReminders(book(), TODAY, { days: 2, time: '18:30' });
    const r = list.find((x) => x.id === 'bill:globe:2026-11')!;
    expect(r.date).toBe('2026-11-19');
    expect(new Date(r.at).getHours()).toBe(18);
    expect(new Date(r.at).getMinutes()).toBe(30);
  });
});

describe('reminder wording', () => {
  const r = { id: 'bill:globe:2026-11', name: 'Globe postpaid', amount: 149_900, due: '2026-11-21', date: '2026-11-16', at: 0 };
  it('says what is due, how much and when', () => {
    expect(notificationText(r, 5)).toEqual({ title: 'Globe postpaid is due in 5 days', body: '₱1,499.00 due on Nov 21, 2026. Tap to pay or check it.' });
  });
  it('can leave amounts out of the calendar', () => {
    expect(calendarEvent(r, true).title).toBe('Pay Globe postpaid by Nov 21 (₱1,499.00)');
    expect(calendarEvent(r, false).title).toBe('Pay Globe postpaid by Nov 21');
    expect(calendarEvent(r, true)).toMatchObject({ key: 'bill:globe:2026-11', date: '2026-11-16' });
  });
  it('does not resend an unchanged list to Google Calendar', async () => {
    const link = { url: 'https://script.google.com/macros/s/x/exec', secret: 's', amounts: true };
    const list = upcomingReminders(book(), TODAY);
    // First send needs the network: stub fetch.
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: { body: string }) => { calls.push(init.body); return new Response('{"ok":true,"created":3}'); }));
    const first = await syncCalendar(link, list, TODAY);
    expect(first?.reply.created).toBe(3);
    expect(JSON.parse(calls[0])).toMatchObject({ secret: 's', action: 'sync', from: TODAY });
    expect(await syncCalendar({ ...link, hash: first!.hash }, list, TODAY)).toBeNull();
    expect(calls).toHaveLength(1);
    vi.unstubAllGlobals();
  });
});
