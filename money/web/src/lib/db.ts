import { createStore, entries, get, set, setMany, clear, type UseStore } from 'idb-keyval';

// What is kept on the device: every record still encrypted (exactly as the server holds it), plus
// a few settings such as the sync position. Nothing readable is written to disk.

export interface StoredRecord {
  id: string;
  iv: string;
  ct: string;
  /** updatedAt of the record inside, kept beside it so merges need no decryption. */
  at: number;
  dirty: 0 | 1;
}

export interface LocalDB {
  all(): Promise<StoredRecord[]>;
  put(rows: StoredRecord[]): Promise<void>;
  meta<T>(key: string): Promise<T | undefined>;
  setMeta(key: string, value: unknown): Promise<void>;
  wipe(): Promise<void>;
}

export function idbDB(name = 'money-hub'): LocalDB {
  const records: UseStore = createStore(`${name}-records`, 'r');
  const meta: UseStore = createStore(`${name}-meta`, 'm');
  return {
    all: async () => (await entries<string, StoredRecord>(records)).map(([, v]) => v),
    put: (rows) => setMany(rows.map((r) => [r.id, r]), records),
    meta: (key) => get(key, meta),
    setMeta: (key, value) => set(key, value, meta),
    wipe: async () => { await clear(records); await clear(meta); },
  };
}

export function memoryDB(): LocalDB {
  const records = new Map<string, StoredRecord>();
  const meta = new Map<string, unknown>();
  return {
    all: async () => [...records.values()],
    put: async (rows) => { for (const r of rows) records.set(r.id, { ...r }); },
    meta: async <T,>(key: string) => meta.get(key) as T | undefined,
    setMeta: async (key, value) => { meta.set(key, value); },
    wipe: async () => { records.clear(); meta.clear(); },
  };
}
