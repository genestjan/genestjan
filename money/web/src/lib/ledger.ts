import { decryptJSON, encryptJSON } from './crypto';
import type { LocalDB, StoredRecord } from './db';
import type { Book } from './compute';
import {
  defaultSettings, type Account, type AnyRecord, type Bill, type Budget, type Capture, type Category,
  type Kind, type Rule, type Settings, type Txn,
} from './model';

// The unlocked ledger: decrypted records in memory, encrypted copies on disk, and the sync
// rules that keep two devices in step (the newer edit of each record wins).

export interface RemoteRow { id: string; iv: string; ct: string; seq: number }

export interface Remote {
  pull(after: number, limit: number): Promise<RemoteRow[]>;
  push(rows: { id: string; iv: string; ct: string }[]): Promise<void>;
}

export interface Snapshot extends Book {
  captures: Capture[];
  rules: Rule[];
  version: number;
}

const PAGE = 500;

export class Ledger {
  private records = new Map<string, AnyRecord>();
  private stored = new Map<string, StoredRecord>();
  private listeners = new Set<() => void>();
  private snap: Snapshot | null = null;
  version = 0;

  constructor(private db: LocalDB, private key: CryptoKey) {}

  async load(): Promise<{ unreadable: number }> {
    let unreadable = 0;
    for (const row of await this.db.all()) {
      try {
        const rec = await decryptJSON<AnyRecord>(this.key, row);
        this.records.set(rec.id, rec);
        this.stored.set(row.id, row);
      } catch {
        unreadable++;
      }
    }
    this.changed();
    return { unreadable };
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private changed() {
    this.version++;
    this.snap = null;
    for (const fn of this.listeners) fn();
  }

  get<T extends AnyRecord>(id: string): T | undefined {
    const r = this.records.get(id);
    return r && !r.deleted ? (r as T) : undefined;
  }

  has(id: string) { return this.records.has(id); }

  /** Save new or changed records. They are encrypted, written to disk and queued for sync. */
  async put(recs: AnyRecord[], now = Date.now()): Promise<void> {
    if (!recs.length) return;
    const rows: StoredRecord[] = [];
    for (const r of recs) {
      const at = Math.max(now, (this.records.get(r.id)?.updatedAt ?? 0) + 1);
      const rec = { ...r, updatedAt: at } as AnyRecord;
      const box = await encryptJSON(this.key, rec);
      const row: StoredRecord = { id: rec.id, ...box, at, dirty: 1 };
      rows.push(row);
      this.records.set(rec.id, rec);
      this.stored.set(rec.id, row);
    }
    await this.db.put(rows);
    this.changed();
  }

  async remove(ids: string[], now = Date.now()) {
    const recs: AnyRecord[] = [];
    for (const id of ids) {
      const r = this.records.get(id);
      if (r) recs.push({ id, kind: r.kind, updatedAt: now, deleted: true } as AnyRecord);
    }
    await this.put(recs, now);
  }

  /** The encrypted rows exactly as stored, for an offline backup. */
  encryptedRows() {
    return [...this.stored.values()].map(({ id, iv, ct, at }) => ({ id, iv, ct, at }));
  }

  dirty(): StoredRecord[] {
    return [...this.stored.values()].filter((r) => r.dirty);
  }

  /** Bring in rows from the server. The newer copy of each record wins; when ours is newer,
   *  it is queued to go back up so the server ends up with it too. */
  async applyRemote(rows: RemoteRow[]): Promise<number> {
    const write: StoredRecord[] = [];
    let applied = 0;
    for (const row of rows) {
      let rec: AnyRecord;
      try {
        rec = await decryptJSON<AnyRecord>(this.key, row);
      } catch {
        continue; // not ours to read (another key); leave it
      }
      const mine = this.stored.get(rec.id);
      if (!mine || rec.updatedAt > mine.at) {
        const s: StoredRecord = { id: rec.id, iv: row.iv, ct: row.ct, at: rec.updatedAt, dirty: 0 };
        this.records.set(rec.id, rec);
        this.stored.set(rec.id, s);
        write.push(s);
        applied++;
      } else if (mine.at > rec.updatedAt && !mine.dirty) {
        const s = { ...mine, dirty: 1 as const };
        this.stored.set(rec.id, s);
        write.push(s);
      }
    }
    if (write.length) await this.db.put(write);
    if (applied) this.changed();
    return applied;
  }

  async sync(remote: Remote): Promise<{ pulled: number; pushed: number }> {
    let cursor = (await this.db.meta<number>('cursor')) ?? 0;
    let pulled = 0;
    for (;;) {
      const page = await remote.pull(cursor, PAGE);
      if (!page.length) break;
      pulled += await this.applyRemote(page);
      cursor = Math.max(cursor, ...page.map((r) => r.seq));
      await this.db.setMeta('cursor', cursor);
      if (page.length < PAGE) break;
    }
    const out = this.dirty();
    for (let i = 0; i < out.length; i += PAGE) {
      const chunk = out.slice(i, i + PAGE);
      await remote.push(chunk.map(({ id, iv, ct }) => ({ id, iv, ct })));
      const clean: StoredRecord[] = [];
      for (const sent of chunk) {
        const now = this.stored.get(sent.id);
        // Only mark clean if nothing changed while the upload was in flight.
        if (now && now.at === sent.at && now.ct === sent.ct) {
          const s = { ...now, dirty: 0 as const };
          this.stored.set(s.id, s);
          clean.push(s);
        }
      }
      await this.db.put(clean);
    }
    return { pulled, pushed: out.length };
  }

  snapshot(): Snapshot {
    if (this.snap) return this.snap;
    const by = <T extends AnyRecord>(kind: Kind) =>
      [...this.records.values()].filter((r) => r.kind === kind && !r.deleted) as T[];
    this.snap = {
      accounts: by<Account>('account'),
      txns: by<Txn>('txn').sort((a, b) => (b.date + (b.time ?? '')).localeCompare(a.date + (a.time ?? ''))),
      categories: by<Category>('category').sort((a, b) => a.order - b.order),
      budgets: by<Budget>('budget'),
      bills: by<Bill>('bill'),
      rules: by<Rule>('rule'),
      captures: by<Capture>('capture').sort((a, b) => b.capturedAt - a.capturedAt),
      settings: this.get<Settings>('settings') ?? defaultSettings(0),
      version: this.version,
    };
    return this.snap;
  }

  /** Forget everything in memory (locking). The encrypted copies stay on disk. */
  close() {
    this.records.clear();
    this.stored.clear();
    this.listeners.clear();
    this.snap = null;
  }
}
