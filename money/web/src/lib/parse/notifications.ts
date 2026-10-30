import { INSTITUTIONS, type InstitutionId } from '../model';
import type { Currency } from '../money';
import { sourceApp } from './sources';

// Turns a bank, card or e-wallet notification (push or SMS) into a transaction draft.
// Wording changes often, so this reads meaning (amount, direction, who, which card) rather than
// matching each bank's exact template. Anything it is unsure about goes to "To review".

export interface CaptureInput {
  pkg: string;
  app?: string;
  title: string;
  text: string;
  postedAt: number;
}

export interface Parsed {
  direction: 'in' | 'out';
  amount: number;
  currency: Currency;
  institution?: InstitutionId;
  last4?: string;
  counterparty?: string;
  counterInstitution?: InstitutionId;
  ref?: string;
  balanceAfter?: number;
  transferHint: boolean;
  confidence: number;
}

export type ParseResult =
  | { ok: true; parsed: Parsed }
  | { ok: false; reason: 'otp' | 'promo' | 'declined' | 'no-amount' | 'no-direction' | 'not-money' };

const OTP = /\b(otp|one[- ]?time\s*(pin|password|passcode|code)|verification code|authentication code|security code|passcode|do not share|never share|don'?t share)\b/i;
const PROMO = /\b(promo|voucher|get up to|win |chance to win|exclusive offer|apply now|pre-?approved|limited time|sale|discount code|cashback offer|earn up to)\b/i;
const DECLINED = /\b(declined|unsuccessful|failed|was not successful|could not be processed|insufficient|rejected|cancelled|canceled)\b/i;

// Amounts with a currency marker before or after. Bare numbers are never read as money.
const NUM = String.raw`(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)`;
const PREFIX = new RegExp(String.raw`(?<![A-Za-z0-9])(PHP|Php|php|USD|US\$|EUR|GBP|SGD|S\$|AUD|A\$|₱|\$|€|£|P)\s?` + NUM, 'g');
const SUFFIX = new RegExp(NUM + String.raw`\s?(PHP|USD|EUR|GBP|SGD|AUD)\b`, 'g');

const CODE: Record<string, Currency> = {
  PHP: 'PHP', Php: 'PHP', php: 'PHP', P: 'PHP', '₱': 'PHP', USD: 'USD', US$: 'USD', $: 'USD',
  EUR: 'EUR', '€': 'EUR', GBP: 'GBP', '£': 'GBP', SGD: 'SGD', S$: 'SGD', AUD: 'AUD', A$: 'AUD',
};

interface Hit { index: number; end: number; minor: number; currency: Currency }

function amounts(text: string): Hit[] {
  const hits: Hit[] = [];
  for (const m of text.matchAll(PREFIX)) {
    const currency = CODE[m[1]];
    if (!currency) continue;
    hits.push({ index: m.index!, end: m.index! + m[0].length, minor: toCentavos(m[2]), currency });
  }
  for (const m of text.matchAll(SUFFIX)) {
    if (hits.some((h) => Math.abs(h.index - m.index!) < 12)) continue; // "$500.00 USD" counted once
    hits.push({ index: m.index!, end: m.index! + m[0].length, minor: toCentavos(m[1]), currency: CODE[m[2]] });
  }
  return hits.filter((h) => h.minor > 0).sort((a, b) => a.index - b.index);
}

const toCentavos = (s: string) => Math.round(parseFloat(s.replace(/,/g, '')) * 100);

const NOT_THE_AMOUNT = /(balance|bal\.?|available|avail\.?|credit limit|limit|points|minimum|outstanding|total amount due)\W{0,3}(is|of|:)?\W{0,3}$/i;
const BALANCE_BEFORE = /(new balance|balance is|available balance|avail\.? bal\.?|bal(ance)?:?)\W{0,3}(is|of|:)?\W{0,3}$/i;

// Inflow phrases that would otherwise look like spending ("payment") come first.
const INFLOW_FIRST = /\b(received your payment|thank you for your payment|payment (has been )?received|payment posted|we have received)\b/i;
const INFLOW = /\b(received|credited|deposit(ed)?|cash[- ]?in|refund(ed)?|revers(al|ed)|you'?ve got money|incoming|sent you|has been added)\b/i;
const OUTFLOW = /\b(paid|sent|transferred|spent|bought|purchased?|withdr[ae]wn?|withdrawal|debited|charged|was used|used for|deducted|auto-?debit|cash[- ]?out|payment (of|to|for))\b/i;
const TRANSFER = /\b(instapay|pesonet|fund transfer|transfer(red)?|cash[- ]?in|cash[- ]?out|own account|withdr\w* (to|from)( your)? (bank|account|bpi|bdo|unionbank|metrobank|gcash|maya))\b/i;

const LAST4 = /(?:ending(?:\s+in|\s+with)?|ending:|card\s*(?:no\.?|number)?|acct\.?|account(?:\s+no\.?)?)\s*[:#]?\s*(?:[*xX•.-]+\s?)*(\d{4})\b/i;
const REF = /\bref(?:erence)?\.?\s*(?:no\.?|number|#)?\s*[:.]?\s*([A-Z0-9][A-Z0-9-]{5,})/i;
const PARTY = /\b(to|at|from|@)\s+(?!your\b|you\b|the\b|my\b)([A-Za-z0-9][\w&'.*/-]*(?:\s+(?!on\b|via\b|with\b|using\b|for\b|ref\b|and\b|has\b|was\b|is\b|at\b|from\b|to\b)[\w&'.*/-]+){0,5})/gi;

function institutionIn(text: string): InstitutionId | undefined {
  let best: { id: InstitutionId; at: number } | undefined;
  for (const inst of INSTITUTIONS) {
    const m = inst.words.exec(text);
    if (m && m[0] && (!best || m.index < best.at)) best = { id: inst.id, at: m.index };
  }
  return best?.id;
}

function cleanParty(s: string): string {
  return s
    .replace(/\.\s+(?=[A-Z][a-z]).*$/, '') // the next sentence ("C**Z. Your new balance")
    .replace(/\s+\d{10,}.*$/, '') // phone or account numbers after a name
    .replace(/\s+(?:on|via|ref)\b.*$/i, '')
    .replace(/[.,;:!]+$/, '')
    .trim();
}

export function parseNotification(input: CaptureInput): ParseResult {
  const app = sourceApp(input.pkg);
  const title = input.title.trim();
  const text = `${input.text}`.replace(/\s+/g, ' ').trim();
  const all = `${title} ${text}`;

  if (OTP.test(all)) return { ok: false, reason: 'otp' };
  if (DECLINED.test(text)) return { ok: false, reason: 'declined' };

  const hits = amounts(text);
  const txnHits = hits.filter((h) => !NOT_THE_AMOUNT.test(text.slice(Math.max(0, h.index - 40), h.index)));
  if (!txnHits.length) return { ok: false, reason: hits.length ? 'not-money' : 'no-amount' };

  const inFirst = INFLOW_FIRST.exec(text);
  const inM = INFLOW.exec(text);
  const outM = OUTFLOW.exec(text);
  let direction: 'in' | 'out' | undefined;
  if (inFirst) direction = 'in';
  else if (inM && outM) direction = inM.index <= outM.index ? 'in' : 'out';
  else if (inM) direction = 'in';
  else if (outM) direction = 'out';

  if (PROMO.test(all) && !REF.test(text)) return { ok: false, reason: 'promo' };
  if (!direction) return { ok: false, reason: 'no-direction' };

  const main = txnHits[0];
  const balHit = hits.find((h) => BALANCE_BEFORE.test(text.slice(Math.max(0, h.index - 40), h.index)));

  // Which institution this notification is about: the app, else the SMS sender, else the text.
  const institution = app?.institution ?? institutionIn(title) ?? institutionIn(text);

  // The other side: first "to/at/from X" after the amount (or anywhere, if none after).
  let counterparty: string | undefined;
  const parties = [...text.matchAll(PARTY)];
  const after = parties.filter((p) => p.index! >= main.index);
  const wanted = direction === 'in' ? /from|@/i : /to|at|@/i;
  const pick = after.find((p) => wanted.test(p[1])) ?? after[0] ?? parties.find((p) => wanted.test(p[1]));
  if (pick) {
    const c = cleanParty(pick[2]);
    if (c && !/^(your|you)\b/i.test(c) && !/^\d+(\.\d+)?$/.test(c)) counterparty = c;
  }
  // "withdrawn to your bank account BPI": the other bank can be named without "to X".
  const later = institutionIn(text.slice(main.end));
  const counterInstitution = (counterparty ? institutionIn(counterparty) : undefined) ?? (later !== institution ? later : undefined);

  let confidence = 0.55;
  if (institution) confidence += 0.2;
  if (counterparty) confidence += 0.1;
  if (REF.test(text)) confidence += 0.1;
  if (inM && outM && !inFirst) confidence -= 0.15;

  return {
    ok: true,
    parsed: {
      direction,
      amount: main.minor,
      currency: main.currency,
      institution,
      last4: LAST4.exec(text)?.[1],
      counterparty,
      counterInstitution: counterInstitution !== institution ? counterInstitution : undefined,
      ref: REF.exec(text)?.[1],
      balanceAfter: balHit && balHit !== main ? balHit.minor : undefined,
      transferHint: TRANSFER.test(text) || !!counterInstitution,
      confidence: Math.min(1, Math.max(0, confidence)),
    },
  };
}
