// End-to-end encryption. Everything is encrypted on the device before it is stored or synced;
// the server only ever holds ciphertext.
//
// password + email --PBKDF2-SHA256 (600k)--> master
//   master --HKDF "auth"--> the password Supabase sees (so Supabase never sees the real one)
//   master --HKDF "vault"--> key that wraps the data key
// data key (random, 256-bit) --AES-GCM--> every record
// recovery key (random, 160-bit) wraps the same data key, for a forgotten password
// capture key pair (ECDH P-256): the phone seals captured notifications with the public half
//   while the app is closed; only an unlocked app holds the private half.

export const ITER = 600_000;
const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const b64url = (bytes: Uint8Array) => b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export interface Box { iv: string; ct: string }

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const base = await crypto.subtle.importKey('raw', enc.encode(password.normalize('NFKC')), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, 256));
}

async function hkdf(ikm: Uint8Array, info: string, salt: Uint8Array = new Uint8Array(32)): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode(info) }, k, 256));
}

const aesKey = (raw: Uint8Array, usages: KeyUsage[] = ['encrypt', 'decrypt']) =>
  crypto.subtle.importKey('raw', raw, 'AES-GCM', false, usages);

export async function seal(key: CryptoKey, data: Uint8Array): Promise<Box> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
  return { iv: b64(iv), ct: b64(ct) };
}

export async function open(key: CryptoKey, box: Box): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, key, unb64(box.ct)));
}

export async function sha256Hex(s: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)));
  return Array.from(h, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ---- Account secrets ------------------------------------------------------------------------

export interface Master { auth: string; kek: CryptoKey }

export const saltFor = (email: string) => enc.encode('money-hub:' + email.trim().toLowerCase());

export async function deriveMaster(password: string, email: string, iterations = ITER): Promise<Master> {
  const m = await pbkdf2(password, saltFor(email), iterations);
  const auth = b64url(await hkdf(m, 'money-hub auth v1'));
  const kek = await aesKey(await hkdf(m, 'money-hub vault v1'));
  m.fill(0);
  return { auth, kek };
}

// ---- Recovery key ---------------------------------------------------------------------------

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function base32(bytes: Uint8Array): string {
  let bits = 0, value = 0, out = '';
  for (const b of bytes) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += CROCKFORD[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += CROCKFORD[(value << (5 - bits)) & 31];
  return out;
}

function unbase32(s: string): Uint8Array {
  const clean = s.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const v = CROCKFORD.indexOf(ch);
    if (v < 0) throw new Error('That recovery key has a character that does not belong in one.');
    value = (value << 5) | v; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out);
}

export function newRecoveryKey(): string {
  return base32(crypto.getRandomValues(new Uint8Array(20))).match(/.{4}/g)!.join('-');
}

async function recoveryParts(recoveryKey: string) {
  const raw = unbase32(recoveryKey);
  if (raw.length !== 20) throw new Error('A recovery key is 32 letters and numbers. Check it and try again.');
  return {
    wrap: await aesKey(await hkdf(raw, 'money-hub recovery wrap v1')),
    proof: b64url(await hkdf(raw, 'money-hub recovery auth v1')),
  };
}

/** Sent to the server once, to prove the recovery key when resetting a forgotten password. */
export const recoveryProof = async (recoveryKey: string) => (await recoveryParts(recoveryKey)).proof;

// ---- The vault ------------------------------------------------------------------------------

export interface VaultBoxes { v: 1; iter: number; pw: Box; rk: Box; rkCheck: string }

export async function createVault(master: Master) {
  const dek = crypto.getRandomValues(new Uint8Array(32));
  const recoveryKey = newRecoveryKey();
  const r = await recoveryParts(recoveryKey);
  const boxes: VaultBoxes = {
    v: 1,
    iter: ITER,
    pw: await seal(master.kek, dek),
    rk: await seal(r.wrap, dek),
    rkCheck: await sha256Hex(r.proof),
  };
  return { dek, boxes, recoveryKey };
}

export async function openWithPassword(master: Master, boxes: VaultBoxes): Promise<Uint8Array> {
  try {
    return await open(master.kek, boxes.pw);
  } catch {
    throw new Error('That password does not open this vault.');
  }
}

export async function openWithRecovery(recoveryKey: string, boxes: VaultBoxes): Promise<Uint8Array> {
  const r = await recoveryParts(recoveryKey);
  try {
    return await open(r.wrap, boxes.rk);
  } catch {
    throw new Error('That recovery key does not open this vault.');
  }
}

export const rewrap = (dek: Uint8Array, master: Master) => seal(master.kek, dek);

// ---- Records --------------------------------------------------------------------------------

export const dataKey = (dek: Uint8Array) => aesKey(dek);

export const encryptJSON = (key: CryptoKey, value: unknown) => seal(key, enc.encode(JSON.stringify(value)));

export async function decryptJSON<T>(key: CryptoKey, box: Box): Promise<T> {
  return JSON.parse(dec.decode(await open(key, box))) as T;
}

// ---- Captured notifications (sealed on the phone while the app is closed) -------------------

export interface CaptureBox { v: 1; epk: string; iv: string; ct: string }

const P256 = { name: 'ECDH', namedCurve: 'P-256' } as const;

export async function newCaptureKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const kp = (await crypto.subtle.generateKey(P256, true, ['deriveBits'])) as CryptoKeyPair;
  return {
    publicKey: b64(new Uint8Array(await crypto.subtle.exportKey('spki', kp.publicKey))),
    privateKey: b64(new Uint8Array(await crypto.subtle.exportKey('pkcs8', kp.privateKey))),
  };
}

async function captureKey(shared: Uint8Array, epkRaw: Uint8Array, usage: KeyUsage) {
  return aesKey(await hkdf(shared, 'money-hub capture v1', epkRaw), [usage]);
}

export async function openCapture(privateKey: string, box: CaptureBox): Promise<string> {
  const priv = await crypto.subtle.importKey('pkcs8', unb64(privateKey), P256, false, ['deriveBits']);
  const epkRaw = unb64(box.epk);
  const epk = await crypto.subtle.importKey('raw', epkRaw, P256, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: epk }, priv, 256));
  return dec.decode(await open(await captureKey(shared, epkRaw, 'decrypt'), box));
}

/** The same sealing the Android app does in Java (CaptureCrypto.java); used by tests. */
export async function sealCapture(publicKey: string, text: string): Promise<CaptureBox> {
  const pub = await crypto.subtle.importKey('spki', unb64(publicKey), P256, false, []);
  const eph = (await crypto.subtle.generateKey(P256, true, ['deriveBits'])) as CryptoKeyPair;
  const epkRaw = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: pub }, eph.privateKey, 256));
  const box = await seal(await captureKey(shared, epkRaw, 'encrypt'), enc.encode(text));
  return { v: 1, epk: b64(epkRaw), ...box };
}
