import type { Currency, Rates } from './money';

// Every record syncs as one encrypted blob. The server never sees any of these fields.

export type Kind = 'account' | 'txn' | 'category' | 'budget' | 'bill' | 'rule' | 'capture' | 'settings';

export interface Base {
  id: string;
  kind: Kind;
  updatedAt: number;
  deleted?: boolean;
}

export type AccountType = 'bank' | 'ewallet' | 'cash' | 'online' | 'credit' | 'loan';
export const LIABILITY: AccountType[] = ['credit', 'loan'];
export const isLiability = (a: { type: AccountType }) => LIABILITY.includes(a.type);

export interface Account extends Base {
  kind: 'account';
  name: string;
  type: AccountType;
  institution: InstitutionId;
  currency: Currency;
  /** Balance on `openingDate` (owed amounts on cards and loans are negative). */
  openingBalance: number;
  openingDate?: string;
  last4?: string;
  creditLimit?: number;
  dueDay?: number;
  monthlyPayment?: number;
  termMonths?: number;
  startMonth?: string;
  /** Interest in percent; credit cards in the Philippines quote it per month. */
  rate?: number;
  ratePer?: 'month' | 'year';
  archived?: boolean;
  note?: string;
}

export type TxnType = 'expense' | 'income' | 'transfer';
export type TxnSource = 'manual' | 'capture' | 'import' | 'paypal';

export interface Txn extends Base {
  kind: 'txn';
  type: TxnType;
  date: string;
  time?: string;
  /** Positive, in the account's currency. */
  amount: number;
  accountId: string;
  toAccountId?: string;
  /** What arrived in the other account when its currency differs. */
  toAmount?: number;
  /** Transfer or service fee charged on top, in the account's currency. */
  fee?: number;
  categoryId?: string;
  payee?: string;
  note?: string;
  billId?: string;
  billMonth?: string;
  source: TxnSource;
  ref?: string;
  captureId?: string;
  reviewed?: boolean;
}

export interface Category extends Base {
  kind: 'category';
  name: string;
  type: 'expense' | 'income';
  icon: string;
  color: string;
  order: number;
}

export interface Budget extends Base {
  kind: 'budget';
  categoryId: string;
  /** Monthly limit in pesos (centavos). */
  amount: number;
  /** Absent: every month. Set: this month only, overriding the default. */
  month?: string;
}

export interface Bill extends Base {
  kind: 'bill';
  name: string;
  /** Usual amount; months that differ are in `amounts`. */
  amount: number;
  amounts?: Record<string, number>;
  dueDay: number;
  categoryId?: string;
  /** A card or loan this bill pays down: paying it is a transfer, not spending. */
  accountId?: string;
  payFromId?: string;
  active: boolean;
  /** Words that identify a payment for this bill in captured notifications. */
  match?: string;
}

export interface Rule extends Base {
  kind: 'rule';
  match: string;
  categoryId?: string;
  payee?: string;
}

export type CaptureStatus = 'added' | 'review' | 'ignored' | 'duplicate';

export interface Capture extends Base {
  kind: 'capture';
  capturedAt: number;
  app: string;
  pkg: string;
  title: string;
  text: string;
  status: CaptureStatus;
  reason?: string;
  txnId?: string;
}

export interface PayPalLink {
  clientId: string;
  secret: string;
  accountId?: string;
  env: 'live' | 'sandbox';
  /** Where PayPal withdrawals land (your bank), so they count as transfers, not spending. */
  withdrawTo?: string;
  lastSync?: number;
  syncedUntil?: string;
}

export interface CalendarLink {
  /** The Apps Script web app address (https://script.google.com/macros/s/.../exec). */
  url: string;
  secret: string;
  amounts: boolean;
  /** Fingerprint of what was last sent, so an unchanged list is not sent again. */
  hash?: string;
  lastSync?: number;
}

export interface ReminderSettings {
  /** Days before the due date. */
  days: number;
  /** Time of day, "09:00". */
  time: string;
  calendar?: CalendarLink;
  /** The secret inside the copied calendar script, kept so it still matches after the app locks. */
  scriptSecret?: string;
}

export const DEFAULT_REMINDERS: ReminderSettings = { days: 5, time: '09:00' };

export interface Settings extends Base {
  kind: 'settings';
  displayName?: string;
  baseCurrency: Currency;
  rates: Rates;
  ratesUpdatedAt?: number;
  autoAdd: boolean;
  hideBalances: boolean;
  /** Stops screenshots and screen recording of the unlocked app (off by default, so problems can be sent). */
  blockScreenshots?: boolean;
  lockMinutes: number;
  capturePublicKey?: string;
  capturePrivateKey?: string;
  paypal?: PayPalLink;
  reminders?: ReminderSettings;
}

export type AnyRecord = Account | Txn | Category | Budget | Bill | Rule | Capture | Settings;

// ---- Institutions ---------------------------------------------------------------------------

export type InstitutionId =
  | 'gcash' | 'maya' | 'bpi' | 'bdo' | 'unionbank' | 'metrobank' | 'securitybank' | 'rcbc' | 'pnb'
  | 'landbank' | 'eastwest' | 'chinabank' | 'gotyme' | 'seabank' | 'cimb' | 'citi' | 'homecredit'
  | 'pagibig' | 'wise' | 'paypal' | 'cash' | 'other';

export interface Institution {
  id: InstitutionId;
  name: string;
  short: string;
  bg: string;
  fg: string;
  /** Words in a notification or SMS sender name that point at this institution. */
  words: RegExp;
}

export const INSTITUTIONS: Institution[] = [
  { id: 'gcash', name: 'GCash', short: 'G', bg: '#0A6CFF', fg: '#FFFFFF', words: /\bg-?cash\b/i },
  { id: 'maya', name: 'Maya', short: 'M', bg: '#0E8A5F', fg: '#FFFFFF', words: /\b(maya|paymaya)\b/i },
  { id: 'bpi', name: 'BPI', short: 'BPI', bg: '#B11116', fg: '#FFFFFF', words: /\bbpi\b|bank of the philippine islands/i },
  { id: 'bdo', name: 'BDO', short: 'BDO', bg: '#0B3A8F', fg: '#FFD43B', words: /\bbdo\b|banco de oro/i },
  { id: 'unionbank', name: 'UnionBank', short: 'UB', bg: '#E8641B', fg: '#FFFFFF', words: /\bunion\s?bank|\bubp\b|unionbankph/i },
  { id: 'metrobank', name: 'Metrobank', short: 'MB', bg: '#1C3F94', fg: '#FFFFFF', words: /\bmetro\s?bank\b/i },
  { id: 'securitybank', name: 'Security Bank', short: 'SB', bg: '#0077C8', fg: '#FFFFFF', words: /\bsecurity\s?bank\b/i },
  { id: 'rcbc', name: 'RCBC', short: 'RC', bg: '#1D4E9E', fg: '#FFFFFF', words: /\brcbc\b/i },
  { id: 'pnb', name: 'PNB', short: 'PNB', bg: '#0A2F5A', fg: '#FFFFFF', words: /\bpnb\b|philippine national bank/i },
  { id: 'landbank', name: 'Landbank', short: 'LB', bg: '#00843D', fg: '#FFFFFF', words: /\bland\s?bank\b/i },
  { id: 'eastwest', name: 'EastWest', short: 'EW', bg: '#6B2C91', fg: '#FFFFFF', words: /\beast\s?west\b/i },
  { id: 'chinabank', name: 'Chinabank', short: 'CB', bg: '#B5121B', fg: '#FFFFFF', words: /\bchina\s?bank\b/i },
  { id: 'gotyme', name: 'GoTyme', short: 'GT', bg: '#00A6A6', fg: '#FFFFFF', words: /\bgo\s?tyme\b/i },
  { id: 'seabank', name: 'SeaBank', short: 'SB', bg: '#EE4D2D', fg: '#FFFFFF', words: /\bsea\s?bank\b/i },
  { id: 'cimb', name: 'CIMB', short: 'CI', bg: '#B5121B', fg: '#FFFFFF', words: /\bcimb\b/i },
  { id: 'citi', name: 'Citi', short: 'Ci', bg: '#056DAE', fg: '#FFFFFF', words: /\bciti(bank)?\b/i },
  { id: 'homecredit', name: 'Home Credit', short: 'HC', bg: '#E11B22', fg: '#FFFFFF', words: /\bhome\s?credit\b/i },
  { id: 'pagibig', name: 'Pag-IBIG', short: 'PI', bg: '#1F5FA8', fg: '#FFFFFF', words: /\bpag-?ibig\b|\bhdmf\b/i },
  { id: 'wise', name: 'Wise', short: 'W', bg: '#9FE870', fg: '#163300', words: /\bwise\b|transferwise/i },
  { id: 'paypal', name: 'PayPal', short: 'P', bg: '#0070E0', fg: '#FFFFFF', words: /\bpaypal\b/i },
  { id: 'cash', name: 'Cash', short: '₱', bg: '#3F4A5C', fg: '#FFFFFF', words: /^$/ },
  { id: 'other', name: 'Other', short: '•', bg: '#2A3345', fg: '#E8EDF2', words: /^$/ },
];

export const institution = (id: InstitutionId | undefined) =>
  INSTITUTIONS.find((i) => i.id === id) ?? INSTITUTIONS[INSTITUTIONS.length - 1];

export const ACCOUNT_TYPES: { id: AccountType; label: string }[] = [
  { id: 'bank', label: 'Bank' },
  { id: 'ewallet', label: 'E-wallet' },
  { id: 'online', label: 'International' },
  { id: 'cash', label: 'Cash' },
  { id: 'credit', label: 'Credit card' },
  { id: 'loan', label: 'Loan' },
];
export const accountTypeLabel = (t: AccountType) => ACCOUNT_TYPES.find((x) => x.id === t)?.label ?? t;

// ---- Categories -----------------------------------------------------------------------------

// The first six take the validated chart colours in order (dataviz check: lightness band,
// colour-blind separation and contrast all pass on the #141B27 card surface).
export const SERIES = ['#1FA2B3', '#C98500', '#9085E9', '#E66767', '#3987E5', '#D55181'];
export const OTHER_COLOUR = '#6B7689';
const EXTRA = ['#5FA36A', '#B07A4E', '#6F8FB8', '#B86FB0', '#8C9A3C', '#4E9C9C'];

type Seed = [id: string, name: string, icon: string, colour: string];

const EXPENSE_SEEDS: Seed[] = [
  ['food', 'Food & dining', 'utensils', SERIES[0]],
  ['bills', 'Bills & utilities', 'zap', SERIES[1]],
  ['transport', 'Transport & fuel', 'fuel', SERIES[2]],
  ['shopping', 'Shopping', 'shopping-bag', SERIES[3]],
  ['health', 'Health & medical', 'heart-pulse', SERIES[4]],
  ['family', 'Family & allowance', 'users', SERIES[5]],
  ['groceries', 'Groceries', 'shopping-cart', EXTRA[0]],
  ['car', 'Car & amortisation', 'car', EXTRA[1]],
  ['home', 'Home & repairs', 'hammer', EXTRA[2]],
  ['school', 'School & education', 'graduation-cap', EXTRA[3]],
  ['gov', 'SSS, Pag-IBIG & PhilHealth', 'landmark', EXTRA[4]],
  ['work', 'Work tools & team', 'briefcase', EXTRA[5]],
  ['subscriptions', 'Subscriptions', 'repeat', EXTRA[2]],
  ['leisure', 'Leisure & travel', 'plane', EXTRA[3]],
  ['gifts', 'Gifts & giving', 'gift', EXTRA[0]],
  ['fees', 'Fees, interest & charges', 'percent', EXTRA[1]],
  ['other', 'Other spending', 'more-horizontal', OTHER_COLOUR],
];

const INCOME_SEEDS: Seed[] = [
  ['clients', 'Client income', 'briefcase', '#3DD68C'],
  ['salary', 'Salary', 'banknote', '#3DD68C'],
  ['business', 'Business', 'store', '#3DD68C'],
  ['refunds', 'Refunds & cashback', 'rotate-ccw', '#3DD68C'],
  ['interest', 'Interest earned', 'trending-up', '#3DD68C'],
  ['gifts-in', 'Gifts received', 'gift', '#3DD68C'],
  ['other-in', 'Other income', 'more-horizontal', '#3DD68C'],
];

export const catId = (slug: string) => `cat-${slug}`;
export const FEES_CATEGORY = catId('fees');
export const OTHER_CATEGORY = catId('other');
export const OTHER_INCOME = catId('other-in');

export function defaultCategories(now = Date.now()): Category[] {
  const mk = (type: 'expense' | 'income') => ([slug, name, icon, color]: Seed, i: number): Category => ({
    id: catId(slug), kind: 'category', updatedAt: now, name, type, icon, color, order: i,
  });
  return [...EXPENSE_SEEDS.map(mk('expense')), ...INCOME_SEEDS.map(mk('income'))];
}

export function defaultSettings(now = Date.now()): Settings {
  return {
    id: 'settings', kind: 'settings', updatedAt: now, baseCurrency: 'PHP',
    rates: { USD: 58 }, autoAdd: true, hideBalances: false, lockMinutes: 3,
  };
}
