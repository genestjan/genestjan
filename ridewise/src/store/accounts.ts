// Rider accounts that live on this phone. Each one has its own encrypted
// data, so two people can share a phone without seeing each other's rides.

import { del, get, set } from 'idb-keyval';
import { deviceStorage } from './storage';
import {
  KDF_ITERATIONS, deriveKek, newDataKey, newDeviceKey, open, randomBytes, seal, toB64, unwrapDataKey, wrapDataKey, type Sealed,
} from '../lib/vault';

export type AccountRecord = {
  id: string;
  name: string;
  color: string; // avatar colour
  createdAt: string;
  kdf: { salt: string; iterations: number };
  wrapped: Sealed; // data key, wrapped by the password
  cloudEmail?: string;
};

/** How this phone opens the account without typing the password. */
export type UnlockMode = 'password' | 'open' | 'fingerprint';
export type UnlockRecord = { mode: UnlockMode; wrapped?: Sealed; credentialId?: string };

type Index = { accounts: AccountRecord[]; lastId?: string };

const INDEX_KEY = 'ridewise:accounts';
const unlockKey = (id: string) => `ridewise:unlock:${id}`;
const devKey = (id: string) => `ridewise:devkey:${id}`;
export const dataKey = (id: string) => `ridewise:data:${id}`;
export const LEGACY_KEY = 'ridewise:v1';

export const AVATAR_COLORS = ['#0369a1', '#15803d', '#b45309', '#7c3aed', '#be123c', '#0f766e'];

async function readIndex(): Promise<Index> {
  const raw = await deviceStorage.getItem(INDEX_KEY);
  if (!raw) return { accounts: [] };
  try {
    const j = JSON.parse(raw) as Index;
    return { accounts: Array.isArray(j.accounts) ? j.accounts : [], lastId: j.lastId };
  } catch {
    return { accounts: [] };
  }
}
const writeIndex = (i: Index) => deviceStorage.setItem(INDEX_KEY, JSON.stringify(i));

export async function listAccounts(): Promise<Index> {
  return readIndex();
}

export async function setLastAccount(id: string | undefined) {
  const i = await readIndex();
  await writeIndex({ ...i, lastId: id });
}

export async function createAccount(input: { name: string; password: string; color: string; cloudEmail?: string }): Promise<{ account: AccountRecord; dk: CryptoKey; firstAccount: boolean }> {
  const idx = await readIndex();
  const salt = toB64(randomBytes(16));
  const dk = await newDataKey();
  const kek = await deriveKek(input.password, salt, KDF_ITERATIONS);
  const account: AccountRecord = {
    id: `acct_${toB64(randomBytes(9)).replace(/[+/=]/g, '')}`,
    name: input.name.trim(),
    color: input.color,
    createdAt: new Date().toISOString(),
    kdf: { salt, iterations: KDF_ITERATIONS },
    wrapped: await wrapDataKey(dk, kek),
    cloudEmail: input.cloudEmail,
  };
  await writeIndex({ accounts: [...idx.accounts, account], lastId: account.id });
  return { account, dk, firstAccount: idx.accounts.length === 0 };
}

/** Throws a friendly Error when the password is wrong. */
export async function unlockWithPassword(account: AccountRecord, password: string): Promise<CryptoKey> {
  try {
    return await unwrapDataKey(account.wrapped, await deriveKek(password, account.kdf.salt, account.kdf.iterations));
  } catch {
    throw new Error('That password does not match. Check it and try again.');
  }
}

export async function changePassword(account: AccountRecord, oldPassword: string, newPassword: string): Promise<AccountRecord> {
  const dk = await unlockWithPassword(account, oldPassword);
  const salt = toB64(randomBytes(16));
  const next: AccountRecord = { ...account, kdf: { salt, iterations: KDF_ITERATIONS }, wrapped: await wrapDataKey(dk, await deriveKek(newPassword, salt, KDF_ITERATIONS)) };
  const idx = await readIndex();
  await writeIndex({ ...idx, accounts: idx.accounts.map((a) => (a.id === account.id ? next : a)) });
  return next;
}

export async function renameAccount(id: string, name: string, color?: string): Promise<AccountRecord | null> {
  const idx = await readIndex();
  let out: AccountRecord | null = null;
  const accounts = idx.accounts.map((a) => (a.id === id ? (out = { ...a, name: name.trim(), color: color ?? a.color }) : a));
  await writeIndex({ ...idx, accounts });
  return out;
}

export async function deleteAccount(id: string) {
  const idx = await readIndex();
  await writeIndex({ accounts: idx.accounts.filter((a) => a.id !== id), lastId: idx.lastId === id ? undefined : idx.lastId });
  await deviceStorage.removeItem(dataKey(id));
  await deviceStorage.removeItem(unlockKey(id));
  await del(devKey(id)).catch(() => undefined);
}

// ---- Per-phone unlock (so riders do not retype the password every time) ----

export async function getUnlock(id: string): Promise<UnlockRecord> {
  const raw = await deviceStorage.getItem(unlockKey(id));
  if (!raw) return { mode: 'password' };
  try {
    return JSON.parse(raw) as UnlockRecord;
  } catch {
    return { mode: 'password' };
  }
}

/** Remember the account on this phone. Needs the data key, so call it while unlocked. */
export async function setUnlock(id: string, dk: CryptoKey, mode: UnlockMode, credentialId?: string): Promise<boolean> {
  if (mode === 'password') {
    await deviceStorage.removeItem(unlockKey(id));
    await del(devKey(id)).catch(() => undefined);
    return true;
  }
  try {
    const device = await newDeviceKey();
    await set(devKey(id), device); // CryptoKey is stored by the browser; it cannot be read back out
    const rec: UnlockRecord = { mode, wrapped: await wrapDataKey(dk, device), credentialId };
    await deviceStorage.setItem(unlockKey(id), JSON.stringify(rec));
    return true;
  } catch {
    // Private windows and some old browsers cannot store keys. Password still works.
    await deviceStorage.removeItem(unlockKey(id));
    return false;
  }
}

export async function unlockWithDevice(id: string): Promise<CryptoKey> {
  const rec = await getUnlock(id);
  const device = await get<CryptoKey>(devKey(id)).catch(() => undefined);
  if (!rec.wrapped || !device) throw new Error('This phone forgot how to open it. Please type your password.');
  try {
    return await unwrapDataKey(rec.wrapped, device);
  } catch {
    throw new Error('This phone forgot how to open it. Please type your password.');
  }
}

export async function adoptLegacyData(id: string, dk: CryptoKey): Promise<boolean> {
  const legacy = await deviceStorage.getItem(LEGACY_KEY);
  if (!legacy) return false;
  await deviceStorage.setItem(dataKey(id), JSON.stringify(await seal(dk, legacy)));
  await deviceStorage.removeItem(LEGACY_KEY);
  return true;
}

export { open };
