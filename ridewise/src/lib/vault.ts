// Encryption for a rider's saved data. Plain Web Crypto, no libraries.
//
//   password --PBKDF2--> key-encryption key (KEK)
//   KEK wraps a random data key (DK); DK encrypts the rider's data (AES-GCM)
//
// Changing the password only re-wraps DK, so the data is never re-encrypted.
// A wrong password makes unwrapping fail, so there is no separate "hash" to attack.
// A forgotten password cannot be recovered: that is the point of the lock.

export type Sealed = { iv: string; data: string };

export const KDF_ITERATIONS = 250_000;

const enc = new TextEncoder();
const dec = new TextDecoder();
const subtle = () => globalThis.crypto.subtle;

export function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
export function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export function randomBytes(n: number): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(n));
}

export async function deriveKek(password: string, saltB64: string, iterations = KDF_ITERATIONS): Promise<CryptoKey> {
  const base = await subtle().importKey('raw', enc.encode(password.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(saltB64), iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  );
}

export function newDataKey(): Promise<CryptoKey> {
  return subtle().generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

/** A key that can never be read back out of the browser (used to remember a login on one phone). */
export function newDeviceKey(): Promise<CryptoKey> {
  return subtle().generateKey({ name: 'AES-GCM', length: 256 }, false, ['wrapKey', 'unwrapKey']);
}

export async function wrapDataKey(dk: CryptoKey, wrappingKey: CryptoKey): Promise<Sealed> {
  const iv = randomBytes(12);
  const data = await subtle().wrapKey('raw', dk, wrappingKey, { name: 'AES-GCM', iv });
  return { iv: toB64(iv), data: toB64(data) };
}

/** Throws if the wrapping key is wrong (that is how a wrong password is detected). */
export async function unwrapDataKey(sealed: Sealed, wrappingKey: CryptoKey): Promise<CryptoKey> {
  return subtle().unwrapKey(
    'raw',
    fromB64(sealed.data),
    wrappingKey,
    { name: 'AES-GCM', iv: fromB64(sealed.iv) },
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

export async function seal(dk: CryptoKey, text: string): Promise<Sealed> {
  const iv = randomBytes(12);
  const data = await subtle().encrypt({ name: 'AES-GCM', iv }, dk, enc.encode(text));
  return { iv: toB64(iv), data: toB64(data) };
}

export async function open(dk: CryptoKey, sealed: Sealed): Promise<string> {
  const plain = await subtle().decrypt({ name: 'AES-GCM', iv: fromB64(sealed.iv) }, dk, fromB64(sealed.data));
  return dec.decode(plain);
}

/** Simple, friendly password check. Length matters more than symbols. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return 'Use at least 8 letters or numbers.';
  if (/^(.)\1+$/.test(pw)) return 'Try mixing it up. "aaaaaaaa" is too easy to guess.';
  if (['password', '12345678', '123456789', 'qwertyui', 'password1'].includes(pw.toLowerCase())) return 'That one is too common. Pick something only you know.';
  return null;
}
