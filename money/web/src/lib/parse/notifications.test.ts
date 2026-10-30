import { parseNotification, type CaptureInput } from './notifications';

// Wording modelled on real Philippine bank, card and e-wallet alerts. Names, numbers and
// references are made up.
const SMS = 'com.samsung.android.messaging';
const at = Date.UTC(2026, 9, 30, 1, 30);
const n = (pkg: string, title: string, text: string): CaptureInput => ({ pkg, title, text, postedAt: at });

function ok(input: CaptureInput) {
  const r = parseNotification(input);
  if (!r.ok) throw new Error(`expected a transaction, got ${r.reason}: ${input.text}`);
  return r.parsed;
}

describe('GCash', () => {
  it('reads money received, with the new balance kept apart', () => {
    const p = ok(n('com.globe.gcash.android', 'GCash', 'You have received PHP 1,000.00 of GCash from JU** DE* C**Z. Your new balance is PHP 5,250.75. Ref. No. 1234567890123.'));
    expect(p).toMatchObject({ direction: 'in', amount: 100000, currency: 'PHP', institution: 'gcash', balanceAfter: 525075, ref: '1234567890123' });
    expect(p.counterparty).toBe('JU** DE* C**Z');
  });

  it('reads money sent to a person', () => {
    const p = ok(n('com.globe.gcash.android', 'GCash', 'You have sent PHP 500.00 of GCash to MA*** ST*** S. 09171234567 on 10-30-2026 10:15 AM. Your new balance is PHP 4,750.75. Ref. No. 9876543210987.'));
    expect(p).toMatchObject({ direction: 'out', amount: 50000, institution: 'gcash' });
    expect(p.counterparty).toBe('MA*** ST*** S');
  });

  it('reads a bill payment written with a bare P', () => {
    const p = ok(n('com.globe.gcash.android', 'GCash', 'You have paid P1,250.00 to MERALCO via GCash. Ref. No. 5555123456. Your new balance is P3,500.75.'));
    expect(p).toMatchObject({ direction: 'out', amount: 125000, counterparty: 'MERALCO' });
  });

  it('spots a cash-in from your own bank as a transfer', () => {
    const p = ok(n('com.globe.gcash.android', 'GCash', 'You have received PHP 5,000.00 from BPI via InstaPay. Your new balance is PHP 10,250.75. Ref No. 778899001122.'));
    expect(p).toMatchObject({ direction: 'in', amount: 500000, institution: 'gcash', counterInstitution: 'bpi', transferHint: true });
  });
});

describe('Maya', () => {
  it('reads a payment with the peso sign', () => {
    const p = ok(n('com.paymaya', 'Maya', "Payment of ₱320.00 to Starbucks Coffee was successful. Ref no. MAYA12345678"));
    expect(p).toMatchObject({ direction: 'out', amount: 32000, institution: 'maya', counterparty: 'Starbucks Coffee' });
  });
});

describe('bank SMS', () => {
  it('reads a BPI transfer out, with the card ending and the receiving wallet', () => {
    const p = ok(n(SMS, 'BPI', 'BPI: You have successfully transferred PHP 5,000.00 from your account ending in 1234 to GCash 09171234567 via InstaPay on 10/30/2026 09:41 AM. Ref No. 123456789'));
    expect(p).toMatchObject({ direction: 'out', amount: 500000, institution: 'bpi', last4: '1234', counterInstitution: 'gcash', transferHint: true });
  });

  it('reads a BPI deposit', () => {
    const p = ok(n(SMS, 'BPI', 'BPI: Your account ending 1234 has been credited with PHP 40,000.00 on 10/30/2026.'));
    expect(p).toMatchObject({ direction: 'in', amount: 4000000, institution: 'bpi', last4: '1234' });
  });

  it('reads a UnionBank card purchase and ignores the credit limit figure', () => {
    const p = ok(n(SMS, 'UnionBankPH', 'Your credit card ending in 4321 was used for a PHP 1,234.56 transaction at LAZADA PH on Oct 30, 2026 12:34 PM. Avail. credit limit: PHP 45,000.00'));
    expect(p).toMatchObject({ direction: 'out', amount: 123456, institution: 'unionbank', last4: '4321', counterparty: 'LAZADA PH' });
  });

  it('reads a card payment received as money going into the card', () => {
    const p = ok(n(SMS, 'UnionBankPH', 'We received your payment of PHP 10,000.00 for your credit card ending in 4321. Thank you!'));
    expect(p).toMatchObject({ direction: 'in', amount: 1000000, institution: 'unionbank', last4: '4321' });
  });

  it('reads a BDO card charge', () => {
    const p = ok(n(SMS, 'BDO', 'BDO: Your BDO Credit Card ending 9876 was charged PHP 3,500.00 at PUREGOLD GENSAN on 10/30/2026.'));
    expect(p).toMatchObject({ direction: 'out', amount: 350000, institution: 'bdo', last4: '9876', counterparty: 'PUREGOLD GENSAN' });
  });

  it('reads a BDO payment thank-you as money into the card', () => {
    const p = ok(n(SMS, 'BDO', 'Thank you for your payment of PHP 4,525.36 to your BDO Credit Card ending 9876.'));
    expect(p).toMatchObject({ direction: 'in', amount: 452536, institution: 'bdo', last4: '9876' });
  });
});

describe('PayPal and Wise', () => {
  it('reads PayPal money received in dollars', () => {
    const p = ok(n('com.paypal.android.p2pmobile', "You've got money", 'You received $500.00 USD from Acme Coaching Ltd.'));
    expect(p).toMatchObject({ direction: 'in', amount: 50000, currency: 'USD', institution: 'paypal', counterparty: 'Acme Coaching Ltd' });
  });

  it('reads a Wise card spend written amount-first', () => {
    const p = ok(n('com.transferwise.android', 'Wise', 'You spent 1,250.00 PHP at JOLLIBEE KCC MALL'));
    expect(p).toMatchObject({ direction: 'out', amount: 125000, currency: 'PHP', institution: 'wise', counterparty: 'JOLLIBEE KCC MALL' });
  });

  it('reads Wise money received', () => {
    const p = ok(n('com.transferwise.android', 'Wise', 'You received 300 USD from ACME LLC'));
    expect(p).toMatchObject({ direction: 'in', amount: 30000, currency: 'USD', counterparty: 'ACME LLC' });
  });
});

describe('things that are not transactions', () => {
  it('drops one-time PINs, even ones that mention an amount', () => {
    expect(parseNotification(n(SMS, 'BPI', 'Your OTP is 123456 for your PHP 2,499.00 purchase at SHOPEE. Do not share this with anyone.'))).toEqual({ ok: false, reason: 'otp' });
    expect(parseNotification(n(SMS, 'BPI', 'Use 654321 as your one-time PIN to log in. Never share it.'))).toEqual({ ok: false, reason: 'otp' });
  });

  it('drops promos', () => {
    expect(parseNotification(n('com.globe.gcash.android', 'GCash', 'Get up to PHP 500 cashback when you pay with GCash! Promo until Nov 30.'))).toEqual({ ok: false, reason: 'promo' });
  });

  it('drops declined cards', () => {
    expect(parseNotification(n(SMS, 'BDO', 'Your transaction of PHP 5,000.00 at ABC STORE was declined due to insufficient funds.'))).toEqual({ ok: false, reason: 'declined' });
  });

  it('drops balance-only messages', () => {
    expect(parseNotification(n(SMS, 'BPI', 'Your available balance is PHP 12,000.00 as of 10/30/2026.'))).toEqual({ ok: false, reason: 'not-money' });
  });

  it('never reads a reference or phone number as money', () => {
    expect(parseNotification(n(SMS, 'BPI', 'Ref No. 123456789 for 09171234567 has been updated.'))).toEqual({ ok: false, reason: 'no-amount' });
  });
});
