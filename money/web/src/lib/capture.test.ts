import { processCapture, type CaptureContext, type CaptureItem } from './capture';
import { catId, defaultSettings, type Account, type Txn } from './model';

const SMS = 'com.samsung.android.messaging';
const GCASH = 'com.globe.gcash.android';
const T0 = new Date(2026, 9, 30, 9, 41).getTime();
const min = (n: number) => T0 + n * 60_000;

const acct = (id: string, institution: Account['institution'], extra: Partial<Account> = {}): Account => ({
  id, kind: 'account', updatedAt: 1, name: id, type: 'bank', institution, currency: 'PHP', openingBalance: 0, ...extra,
});

const ACCOUNTS: Account[] = [
  acct('bpi', 'bpi', { last4: undefined }),
  acct('gcash', 'gcash', { type: 'ewallet' }),
  acct('ub-card', 'unionbank', { type: 'credit', last4: '4321' }),
  acct('paypal', 'paypal', { type: 'online', currency: 'USD' }),
];

function ctx(txns: Txn[] = [], accounts = ACCOUNTS): CaptureContext {
  return { accounts, txns, captures: [], rules: [], bills: [], settings: defaultSettings() };
}

let seq = 0;
const item = (pkg: string, title: string, text: string, at = T0): CaptureItem => ({ id: `cap-${++seq}`, pkg, title, text, postedAt: at });

describe('processCapture', () => {
  it('adds a card purchase to the right card with a category', async () => {
    const out = await processCapture(item(SMS, 'UnionBankPH', 'Your credit card ending in 4321 was used for a PHP 1,234.56 transaction at SHOPEE PH on Oct 30, 2026.'), ctx());
    expect(out.capture?.status).toBe('added');
    expect(out.txns[0]).toMatchObject({ type: 'expense', amount: 123456, accountId: 'ub-card', payee: 'Shopee PH', categoryId: catId('shopping'), source: 'capture' });
  });

  it('gives the same id on every device for the same notification', async () => {
    const it1 = item(GCASH, 'GCash', 'You have paid P250.00 to JOLLIBEE KCC. Ref. No. 1111222233334.');
    const a = await processCapture(it1, ctx());
    const b = await processCapture(it1, ctx());
    expect(a.txns[0].id).toBe(b.txns[0].id);
  });

  it('skips the SMS copy of a purchase already captured from the app', async () => {
    const first = await processCapture(item(GCASH, 'GCash', 'You have paid P250.00 to JOLLIBEE KCC.'), ctx());
    const again = await processCapture(item(SMS, 'GCash', 'You have paid PHP 250.00 to JOLLIBEE KCC via GCash.', min(2)), ctx(first.txns));
    expect(again.capture?.status).toBe('duplicate');
    expect(again.txns).toHaveLength(0);
  });

  it('joins BPI out and GCash in into one transfer, keeping the fee', async () => {
    const out = await processCapture(item(SMS, 'BPI', 'BPI: You have successfully transferred PHP 5,015.00 from your account to a GCash wallet via InstaPay.'), ctx());
    // with a single GCash account, the BPI side alone already becomes a transfer
    expect(out.txns[0]).toMatchObject({ type: 'transfer', accountId: 'bpi', toAccountId: 'gcash', amount: 501500 });

    // Without the hint, the halves arrive as an expense and an income and are joined.
    const bpiOut = await processCapture(item(SMS, 'BPI', 'BPI: PHP 5,015.00 was debited from your account. Ref No. 99887766.'), ctx());
    expect(bpiOut.txns[0]).toMatchObject({ type: 'expense', accountId: 'bpi', amount: 501500 });
    const gIn = await processCapture(item(GCASH, 'GCash', 'You have received PHP 5,000.00 from BPI via InstaPay.', min(1)), ctx(bpiOut.txns));
    expect(gIn.capture?.status).toBe('added');
    expect(gIn.txns[0]).toMatchObject({ id: bpiOut.txns[0].id, type: 'transfer', accountId: 'bpi', toAccountId: 'gcash', amount: 500000, fee: 1500 });
  });

  it('treats a bank payment to a card as a transfer, and its card confirmation as the same payment', async () => {
    const pay = await processCapture(item(SMS, 'BPI', 'BPI: You have successfully transferred PHP 10,000.00 to UnionBank credit card via InstaPay. Ref No. 55443322'), ctx());
    expect(pay.txns[0]).toMatchObject({ type: 'transfer', accountId: 'bpi', toAccountId: 'ub-card', amount: 1000000 });
    const conf = await processCapture(item(SMS, 'UnionBankPH', 'We received your payment of PHP 10,000.00 for your credit card ending in 4321.', min(30)), ctx(pay.txns));
    expect(conf.capture?.status).toBe('duplicate');
  });

  it('asks instead of guessing when the card ending is unknown', async () => {
    const out = await processCapture(item(SMS, 'UnionBankPH', 'Your credit card ending in 9999 was used for PHP 500.00 at GRAB.'), ctx());
    expect(out.capture?.status).toBe('review');
    expect(out.txns).toHaveLength(0);
  });

  it('asks when the bank is not set up yet', async () => {
    const out = await processCapture(item(SMS, 'BDO', 'BDO: Your BDO Credit Card ending 9876 was charged PHP 3,500.00 at PUREGOLD.'), ctx());
    expect(out.capture?.status).toBe('review');
    expect(out.capture?.reason).toMatch(/ending 9876/);
  });

  it('drops one-time PINs without storing their text', async () => {
    const out = await processCapture(item(SMS, 'BPI', 'Your OTP is 123456. Do not share.'), ctx());
    expect(out.capture).toBeUndefined();
  });

  it('fills in the pesos when a PayPal dollar withdrawal reaches BPI', async () => {
    const w = await processCapture(item('com.paypal.android.p2pmobile', 'PayPal', "You've withdrawn $500.00 USD to your bank account BPI."), ctx());
    expect(w.txns[0]).toMatchObject({ type: 'transfer', accountId: 'paypal', toAccountId: 'bpi', amount: 50000 });
    const land = await processCapture(item(SMS, 'BPI', 'BPI: Your account has been credited with PHP 28,950.00 from PAYPAL.', min(60 * 26)), ctx(w.txns));
    expect(land.txns[0]).toMatchObject({ id: w.txns[0].id, toAmount: 2895000 });
  });

  it('holds everything for review when automatic adding is off', async () => {
    const c = ctx();
    c.settings = { ...c.settings, autoAdd: false };
    const out = await processCapture(item(GCASH, 'GCash', 'You have paid P99.00 to GLOBE TELECOM. Ref. No. 4455667788.'), c);
    expect(out.capture?.status).toBe('review');
  });
});
