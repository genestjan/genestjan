import { catId, type Rule, type Txn } from './model';

// Picks a category for a new transaction: your own rules first, then what you chose last time
// for the same payee, then a starter list of common Philippine merchants.

const STARTER: [RegExp, string][] = [
  [/jollibee|mcdo|mcdonald|kfc|chowking|greenwich|mang inasal|starbucks|coffee|caf[eé]|bakery|bakeshop|pizza|shakey|max'?s|foodpanda|grab\s?food|restaurant|resto|lechon|bbq|milk\s?tea|dunkin|krispy|tim hortons|jco|army navy|bonchon|samgyup/i, 'food'],
  [/puregold|(sm|savemore)\s?(super|hyper)?market|savemore|robinsons\s?(super|easy)|gaisano|\bkcc\b|metro\s?mart|landers|s&r|walter\s?mart|grocery|palengke|7-?eleven|alfamart|ministop/i, 'groceries'],
  [/meralco|socoteco|electric|water district|gscwd|maynilad|manila water|globe|smart|pldt|converge|sky\s?cable|\bdito\b|\btnt\b|\bload\b|internet|postpaid|prepaid/i, 'bills'],
  [/petron|\bshell\b|caltex|seaoil|phoenix|cleanfuel|unioil|jetti|totalenergies|toll|autosweep|easytrip|\bgrab\b|angkas|joyride|move\s?it|\blto\b|parking|fuel/i, 'transport'],
  [/citi\s?hardware|wilcon|ace hardware|handyman|cement|hardware|construction|plumbing|furniture|ikea|mandaue foam/i, 'home'],
  [/shopee|lazada|zalora|tiktok\s?shop|sm store|uniqlo|h&m|department store|temu|amazon/i, 'shopping'],
  [/mercury drug|watsons|rose pharmacy|south\s?star|generika|pharmacy|botika|hospital|clinic|medical|laborator|dental|doctor|maxicare|intellicare|medicard/i, 'health'],
  [/canva|descript|kajabi|gohighlevel|highlevel|monday\.com|calendly|slack|adobe|openai|chatgpt|anthropic|claude|zoom|notion|google\s?(workspace|one)|microsoft|dropbox|github|zapier|upwork|fiverr|onlinejobs/i, 'work'],
  [/netflix|spotify|disney|youtube|apple\.com|icloud|prime video|\bhbo\b|\bviu\b/i, 'subscriptions'],
  [/\bsss\b|pag-?ibig|hdmf|philhealth|\bbir\b|\bnbi\b|\blgu\b|barangay/i, 'gov'],
  [/school|tuition|university|college|academy|deped|bookstore|national book/i, 'school'],
  [/\bfee\b|fees|service charge|finance charge|interest|late payment|penalty|annual fee/i, 'fees'],
  [/cebu pacific|philippine airlines|airasia|hotel|agoda|booking\.com|airbnb|resort|cinema|movie/i, 'leisure'],
];

const INCOME: [RegExp, string][] = [
  [/refund|cashback|reversal|rebate/i, 'refunds'],
  [/interest/i, 'interest'],
  [/salary|payroll|sahod/i, 'salary'],
];

export const normalisePayee = (s: string) =>
  s.toLowerCase().replace(/[*•]+/g, '').replace(/[^a-z0-9& ]+/g, ' ').replace(/\s+/g, ' ').trim();

export interface CategoryContext { rules: Rule[]; txns: Txn[] }

export function guessCategory(
  type: 'expense' | 'income',
  text: string,
  payee: string | undefined,
  ctx: CategoryContext,
  fromInstitution?: string,
): string | undefined {
  const hay = `${payee ?? ''} ${text}`;
  for (const r of ctx.rules) {
    if (!r.deleted && r.categoryId && r.match.trim() && hay.toLowerCase().includes(r.match.trim().toLowerCase())) return r.categoryId;
  }
  if (payee) {
    const key = normalisePayee(payee);
    let best: Txn | undefined;
    for (const t of ctx.txns) {
      if (t.deleted || t.type !== type || !t.categoryId || !t.payee) continue;
      if (normalisePayee(t.payee) === key && (!best || t.updatedAt > best.updatedAt)) best = t;
    }
    if (best) return best.categoryId;
  }
  if (type === 'income') {
    for (const [re, slug] of INCOME) if (re.test(hay)) return catId(slug);
    // Money arriving through PayPal or Wise is almost always a client paying.
    if (fromInstitution === 'paypal' || fromInstitution === 'wise') return catId('clients');
    return undefined;
  }
  for (const [re, slug] of STARTER) if (re.test(hay)) return catId(slug);
  return undefined;
}

/** "LAZADA PH" -> "Lazada PH"; masked names ("JU** DE* C**Z") are left as they are. */
export function tidyPayee(s: string | undefined): string | undefined {
  if (!s) return s;
  if (/\*/.test(s) || s !== s.toUpperCase()) return s;
  return s
    .toLowerCase()
    .replace(/\b([a-z])([a-z]*)/g, (_, a: string, b: string) => (b.length <= 1 && /^(ph|ok)$/.test(a + b) ? (a + b).toUpperCase() : a.toUpperCase() + b))
    .replace(/\b(Kcc|Sm|Bdo|Bpi|Gscwd|Sss|Ph)\b/g, (w) => w.toUpperCase());
}
