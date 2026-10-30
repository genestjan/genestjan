import { findHeader, parseBillsMatrix, parseCSV, parseDate, toDrafts } from './csv';

describe('parseCSV', () => {
  it('handles quotes, commas inside quotes and Windows line endings', () => {
    expect(parseCSV('﻿a,b\r\n"x, y","he said ""hi"""\r\n')).toEqual([['a', 'b'], ['x, y', 'he said "hi"']]);
  });
  it('finds a semicolon delimiter', () => {
    expect(parseCSV('Date;Amount\n2026-10-01;5')).toEqual([['Date', 'Amount'], ['2026-10-01', '5']]);
  });
});

describe('dates', () => {
  it('reads the formats banks use', () => {
    expect(parseDate('10/30/2026')).toBe('2026-10-30');
    expect(parseDate('30-10-2026', 'DMY')).toBe('2026-10-30');
    expect(parseDate('2026-10-30 14:05')).toBe('2026-10-30');
    expect(parseDate('Oct 30, 2026')).toBe('2026-10-30');
    expect(parseDate('30 Oct 2026')).toBe('2026-10-30');
    expect(parseDate('13/13/2026')).toBeNull();
  });
});

describe('statements', () => {
  it('reads a PayPal activity download, skipping holds and conversions', () => {
    const rows = parseCSV([
      '"Date","Time","TimeZone","Name","Type","Status","Currency","Gross","Fee","Net","Transaction ID"',
      '"10/28/2026","09:12:44","PDT","Acme Coaching Ltd","Express Checkout Payment","Completed","USD","500.00","-24.50","475.50","8AB12345CD678901E"',
      '"10/28/2026","09:13:00","PDT","","General Currency Conversion","Completed","USD","-475.50","0.00","-475.50","1"',
      '"10/29/2026","10:00:00","PDT","Canva","PreApproved Payment Bill User Payment","Completed","USD","-14.99","0.00","-14.99","2"',
      '"10/30/2026","10:00:00","PDT","Someone","Payment Received","Pending","USD","20.00","0.00","20.00","3"',
    ].join('\n'));
    const header = findHeader(rows)!;
    const { drafts, skipped } = toDrafts(rows, header);
    expect(skipped).toBe(2);
    expect(drafts).toEqual([
      { date: '2026-10-28', time: '09:12', amount: 50000, fee: 2450, currency: 'USD', description: 'Acme Coaching Ltd', ref: '8AB12345CD678901E' },
      { date: '2026-10-29', time: '10:00', amount: -1499, fee: undefined, currency: 'USD', description: 'Canva', ref: '2' },
    ]);
  });

  it('reads a bank download with separate debit and credit columns', () => {
    const rows = parseCSV([
      'Account Statement', '',
      'Transaction Date,Description,Debit,Credit,Running Balance',
      '10/01/2026,INSTAPAY TRANSFER TO GCASH,"5,000.00",,"45,000.00"',
      '10/02/2026,PAYPAL WITHDRAWAL,,"28,950.00","73,950.00"',
    ].join('\n'));
    const { drafts } = toDrafts(rows, findHeader(rows)!);
    expect(drafts.map((d) => d.amount)).toEqual([-500000, 2895000]);
  });

  it('reads a Wise statement with day-first dates', () => {
    const rows = parseCSV([
      '"TransferWise ID","Date","Amount","Currency","Description","Running Balance","Total fees"',
      '"CARD-1","30-10-2026","-1250.00","PHP","Card transaction of 1250.00 PHP issued by Jollibee","1000.00","0.00"',
      '"TRANSFER-2","13-10-2026","300.00","USD","Received money from ACME LLC","1300.00","0.00"',
    ].join('\n'));
    const { drafts } = toDrafts(rows, findHeader(rows)!);
    expect(drafts.map((d) => [d.date, d.amount])).toEqual([['2026-10-30', -125000], ['2026-10-13', 30000]]);
  });
});

describe('bills from the Budgeting tab', () => {
  // Same layout as the sheet's Budgeting tab; the figures are invented.
  const csv = [
    ',,,,,,,,,,,,,,,,',
    'Expenses,April,Due,May,Due,June,Due,,July,Due,August,Due,September,Due,October,Date,',
    'Electricity,₱0.00,,"₱5,100.00",,₱0.00,,,"₱4,800.00",,0,,0,,0,,',
    'Car,"₱20,000.00",04/20/2026,"₱20,000.00",05/20/2026,"₱20,000.00",06/20/2026,,"₱20,000.00",07/20/2026,"₱20,000.00",08/20/2026,"₱20,000.00",09/20/2026,"₱20,000.00",10/20/2026,',
    'Example Bank Classic (Visa),"₱12,000.00",04/05/2026,₱0.00,,₱0.00,,"₱9,999.00",₱0.00,,₱500.00,08/03/2026,"₱3,000.00",09/30/2026,,10/30/2026,',
    'UnionBank Rewards (Visa),"₱4,000.00",04/17/2026,"₱5,000.00",05/17/2026,"₱1,000.00",06/16/2026,,"₱6,000.00",07/13/2026,,,,,"₱2,500.00",10/13/2026,',
  ].join('\n');

  it('creates one bill per row with each month and the usual due day', () => {
    const bills = parseBillsMatrix(parseCSV(csv), 2026);
    expect(bills.map((b) => b.name)).toEqual(['Electricity', 'Car', 'Example Bank Classic (Visa)', 'UnionBank Rewards (Visa)']);
    const car = bills[1];
    expect(car).toMatchObject({ amount: 2000000, dueDay: 20, isCard: false });
    expect(Object.keys(car.amounts)).toHaveLength(7);
    const ub = bills[3];
    expect(ub).toMatchObject({ isCard: true, institution: 'unionbank', amount: 250000, dueDay: 13 });
    expect(ub.amounts['2026-05']).toBe(500000);
    expect(bills[0]).toMatchObject({ amount: 480000, amounts: { '2026-05': 510000, '2026-07': 480000 } });
  });
});
