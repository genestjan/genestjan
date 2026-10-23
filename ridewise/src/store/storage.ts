import { get, set, del } from 'idb-keyval';
import type { StateStorage } from 'zustand/middleware';

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
