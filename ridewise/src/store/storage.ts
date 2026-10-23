import { get, set, del } from 'idb-keyval';
import type { StateStorage } from 'zustand/middleware';
import { seal, open, type Sealed } from '../lib/vault';

// IndexedDB holds full route geometry comfortably; localStorage is the
// fallback (private browsing, old WebViews, tests).
const hasIDB = () => {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
};

export const deviceStorage: StateStorage = {
  async getItem(name) {
    if (hasIDB()) {
      try {
        return (await get<string>(name)) ?? null;
      } catch {
        /* fall through */
      }
    }
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  async setItem(name, value) {
    if (hasIDB()) {
      try {
        await set(name, value);
        return;
      } catch {
        /* fall through */
      }
    }
    try {
      localStorage.setItem(name, value);
    } catch {
      /* storage full or blocked: state stays in memory for this session */
    }
  },
  async removeItem(name) {
    if (hasIDB()) await del(name).catch(() => undefined);
    try {
      localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

// ---- Encrypted, per-rider storage ------------------------------------------
// The app store saves through this. Nothing is written unless a rider is
// unlocked, and everything written is encrypted with that rider's data key.


let active: { id: string; dk: CryptoKey; readOnly: boolean } | null = null;
let chain: Promise<unknown> = Promise.resolve();
const keyFor = (id: string) => `ridewise:data:${id}`;

export function activateVault(id: string, dk: CryptoKey) {
  active = { id, dk, readOnly: false };
}
export function deactivateVault() {
  active = null;
}
/** Wait for pending saves (used before locking so nothing is lost). */
export function flushVault(): Promise<unknown> {
  return chain;
}
export function vaultReadFailed(): boolean {
  return !!active?.readOnly;
}

export const vaultStorage: StateStorage = {
  async getItem() {
    const a = active;
    if (!a) return null;
    const raw = await deviceStorage.getItem(keyFor(a.id));
    if (!raw) return null;
    try {
      return await open(a.dk, JSON.parse(raw) as Sealed);
    } catch {
      // Never overwrite data we could not read.
      a.readOnly = true;
      return null;
    }
  },
  setItem(_name, value) {
    const a = active;
    if (!a) return;
    chain = chain.then(async () => {
      if (a.readOnly || active?.id !== a.id) return;
      const sealed = await seal(a.dk, value);
      if (active?.id !== a.id) return;
      await deviceStorage.setItem(keyFor(a.id), JSON.stringify(sealed));
    });
    return chain as Promise<void>;
  },
  removeItem() {
    return;
  },
};
