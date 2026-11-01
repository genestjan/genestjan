/**
 * Data layer with two interchangeable implementations:
 *  - DemoBackend: everything in this browser (localStorage). Customer and driver apps
 *    open in two tabs of the same browser talk to each other through BroadcastChannel.
 *    Good for trying the app, recording tutorials and testing. Not for real customers.
 *  - SupabaseBackend: real accounts (email one-time code), Postgres with Row Level
 *    Security, live updates over Supabase Realtime. Enabled when VITE_SUPABASE_URL and
 *    VITE_SUPABASE_ANON_KEY are set at build time. Schema: supabase/schema.sql.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Driver, Message, Profile, Role, Trip, Wallet } from './types';

export type Table = 'profiles' | 'drivers' | 'trips' | 'messages' | 'wallets';
type Row = { id: string } & Record<string, unknown>;

export interface Backend {
  mode: 'demo' | 'live';
  role: Role;
  sendCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<string>;
  session(): Promise<string | null>;
  signOut(): Promise<void>;
  get<T>(t: Table, id: string): Promise<T | null>;
  list<T>(t: Table, field?: string, value?: string): Promise<T[]>;
  put<T extends { id: string }>(t: Table, row: T): Promise<void>;
  subscribe(cb: (t: Table) => void): () => void;
}

export const uid = () =>
  (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36));

/* ------------------------------- Demo ------------------------------- */

class DemoBackend implements Backend {
  mode = 'demo' as const;
  private ch = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('fetch-gensan') : null;
  private listeners = new Set<(t: Table) => void>();
  constructor(public role: Role) {
    this.ch?.addEventListener('message', (e) => this.emit(e.data as Table, false));
    window.addEventListener('storage', (e) => {
      const t = e.key?.startsWith('fetch:t:') ? (e.key.slice(8) as Table) : null;
      if (t) this.emit(t, false);
    });
  }
  private read(t: Table): Record<string, Row> {
    try { return JSON.parse(localStorage.getItem('fetch:t:' + t) || '{}'); } catch { return {}; }
  }
  private emit(t: Table, broadcast = true) {
    if (broadcast) this.ch?.postMessage(t);
    this.listeners.forEach((l) => l(t));
  }
  async sendCode() { /* demo: any 6 digits work */ }
  async verifyCode(email: string, code: string) {
    if (!/^\d{6,10}$/.test(code)) throw new Error('Enter the code from your email.');
    const id = this.role + ':' + email.trim().toLowerCase();
    localStorage.setItem('fetch:session:' + this.role, id);
    return id;
  }
  async session() { return localStorage.getItem('fetch:session:' + this.role); }
  async signOut() { localStorage.removeItem('fetch:session:' + this.role); }
  async get<T>(t: Table, id: string) { return (this.read(t)[id] as T) ?? null; }
  async list<T>(t: Table, field?: string, value?: string) {
    const rows = Object.values(this.read(t));
    return (field ? rows.filter((r) => r[field] === value) : rows) as T[];
  }
  async put<T extends { id: string }>(t: Table, row: T) {
    const all = this.read(t);
    all[row.id] = { ...all[row.id], ...(row as unknown as Row) };
    try {
      localStorage.setItem('fetch:t:' + t, JSON.stringify(all));
    } catch {
      throw new Error('Phone storage is full. Use smaller photos.');
    }
    this.emit(t);
  }
  subscribe(cb: (t: Table) => void) { this.listeners.add(cb); return () => { this.listeners.delete(cb); }; }
}

/* ----------------------------- Supabase ----------------------------- */

// Columns kept outside the JSON so Row Level Security and filters can use them.
const COLS: Record<Table, string[]> = {
  profiles: ['role'],
  drivers: ['online'],
  trips: ['customerId', 'driverId', 'status'],
  messages: ['tripId'],
  wallets: [],
};
const snake = (s: string) => s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());

class SupabaseBackend implements Backend {
  mode = 'live' as const;
  sb: SupabaseClient;
  constructor(public role: Role, url: string, key: string) {
    this.sb = createClient(url, key, { auth: { persistSession: true, storageKey: 'fetch-auth-' + role } });
  }
  async sendCode(email: string) {
    const { error } = await this.sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) throw error;
  }
  async verifyCode(email: string, code: string) {
    const { data, error } = await this.sb.auth.verifyOtp({ email, token: code, type: 'email' });
    if (error || !data.user) throw new Error(
      error?.message === 'Token has expired or is invalid'
        ? 'That code did not work. Use the newest email only (each new email cancels the older codes), and type every number.'
        : (error?.message ?? 'Wrong code'),
    );
    return data.user.id;
  }
  async session() { return (await this.sb.auth.getSession()).data.session?.user.id ?? null; }
  async signOut() { await this.sb.auth.signOut(); }
  async get<T>(t: Table, id: string) {
    const { data, error } = await this.sb.from(t).select('data').eq('id', id).maybeSingle();
    if (error) throw error;
    return (data?.data as T) ?? null;
  }
  async list<T>(t: Table, field?: string, value?: string) {
    let q = this.sb.from(t).select('data');
    if (field) q = q.eq(snake(field), value as string);
    const { data, error } = await q.limit(500);
    if (error) throw error;
    return (data ?? []).map((r) => r.data as T);
  }
  async put<T extends { id: string }>(t: Table, row: T) {
    const prev = await this.get<Row>(t, row.id);
    const merged: Row = { ...(prev ?? {}), ...(row as unknown as Row) };
    const rec: Record<string, unknown> = { id: row.id, data: merged };
    for (const c of COLS[t]) rec[snake(c)] = merged[c];
    // Separate insert and update: an upsert would also need the INSERT policy, which only
    // the trip's customer passes, so drivers could never update a trip.
    const { error } = prev ? await this.sb.from(t).update(rec).eq('id', row.id) : await this.sb.from(t).insert(rec);
    if (error) throw error;
  }
  subscribe(cb: (t: Table) => void) {
    const ch = this.sb.channel('fetch-' + Math.random().toString(36).slice(2));
    (Object.keys(COLS) as Table[]).forEach((t) =>
      ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => cb(t)),
    );
    ch.subscribe();
    return () => { this.sb.removeChannel(ch); };
  }
}

export function makeBackend(role: Role): Backend {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  return url && key ? new SupabaseBackend(role, url, key) : new DemoBackend(role);
}

export type { Driver, Message, Profile, Trip, Wallet };
