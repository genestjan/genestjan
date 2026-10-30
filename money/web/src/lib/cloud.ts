import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { b64url, sha256Hex, type CaptureBox, type VaultBoxes } from './crypto';
import type { Remote, RemoteRow } from './ledger';

// Supabase holds the encrypted copies so every device stays in step. Tables and rules are in
// money/supabase/schema.sql. The URL and publishable key are public by design: Row Level
// Security lets a signed-in person reach only their own rows, and those rows are ciphertext.

export interface CloudConfig { url: string; key: string }

const STORE = 'mh-cloud';

export function cloudConfig(): CloudConfig | null {
  const env = import.meta.env;
  if (env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY) return { url: env.VITE_SUPABASE_URL, key: env.VITE_SUPABASE_ANON_KEY };
  try {
    const v = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (v && typeof v.url === 'string' && typeof v.key === 'string') return v;
  } catch { /* none saved */ }
  return null;
}

export function saveCloudConfig(cfg: CloudConfig | null) {
  if (cfg) localStorage.setItem(STORE, JSON.stringify(cfg));
  else localStorage.removeItem(STORE);
  client = null;
}

export function checkCloudConfig(url: string, key: string): string | null {
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url.trim())) return 'The Project URL looks like https://abcdefgh.supabase.co';
  if (!/^(sb_publishable_[A-Za-z0-9_-]{10,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.test(key.trim()))
    return 'Paste the publishable key (it starts with sb_publishable_). Never paste the secret key.';
  return null;
}

let client: { cfg: string; sb: SupabaseClient } | null = null;

export function sb(): SupabaseClient | null {
  const cfg = cloudConfig();
  if (!cfg) return null;
  const sig = cfg.url + cfg.key;
  if (!client || client.cfg !== sig) {
    client = { cfg: sig, sb: createClient(cfg.url.replace(/\/$/, ''), cfg.key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'mh-auth' } }) };
  }
  return client.sb;
}

const friendly = (msg: string) =>
  /invalid login credentials/i.test(msg) ? 'That email and password do not match an account.'
    : /email not confirmed/i.test(msg) ? 'Confirm your email first: open the link Supabase sent you, then sign in.'
      : /signups not allowed|signup is disabled/i.test(msg) ? 'New accounts are switched off for this cloud. Sign in instead.'
        : /already registered/i.test(msg) ? 'That email already has an account. Sign in instead.'
          : /failed to fetch|network/i.test(msg) ? 'No internet connection. Try again when you are online.'
            : msg;

function fail(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(friendly(error.message));
}

export async function signUp(c: SupabaseClient, email: string, auth: string): Promise<{ userId: string } | 'confirm-email'> {
  const { data, error } = await c.auth.signUp({ email: email.trim(), password: auth });
  fail(error);
  if (!data.session || !data.user) return 'confirm-email';
  return { userId: data.user.id };
}

export async function signIn(c: SupabaseClient, email: string, auth: string): Promise<string> {
  const { data, error } = await c.auth.signInWithPassword({ email: email.trim(), password: auth });
  fail(error);
  return data.user.id;
}

export async function currentUserId(c: SupabaseClient): Promise<string | null> {
  const { data } = await c.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function changeLogin(c: SupabaseClient, auth: string) {
  const { error } = await c.auth.updateUser({ password: auth });
  fail(error);
  // A lost or stolen device loses its cloud access the moment the password changes.
  await c.auth.signOut({ scope: 'others' });
}

export async function signOut(c: SupabaseClient) {
  await c.auth.signOut({ scope: 'local' });
}

/** Resets a forgotten password using the recovery key (checked by the server against a hash). */
export async function resetWithRecovery(c: SupabaseClient, email: string, proof: string, auth: string) {
  const { error } = await c.rpc('money_recover', { p_email: email.trim().toLowerCase(), p_proof: proof, p_new_password: auth });
  if (error) throw new Error(/recovery/i.test(error.message) ? 'That email and recovery key do not match.' : friendly(error.message));
}

export async function fetchVault(c: SupabaseClient): Promise<VaultBoxes | null> {
  const { data, error } = await c.from('money_vault').select('boxes, rk_check').maybeSingle();
  fail(error);
  return data ? ({ ...(data.boxes as Omit<VaultBoxes, 'rkCheck'>), rkCheck: data.rk_check as string }) : null;
}

export async function saveVault(c: SupabaseClient, userId: string, boxes: VaultBoxes) {
  const { rkCheck, ...rest } = boxes;
  const { error } = await c.from('money_vault').upsert({ user_id: userId, boxes: rest, rk_check: rkCheck });
  fail(error);
}

export function remoteFor(c: SupabaseClient, userId: string): Remote {
  return {
    async pull(after, limit) {
      const { data, error } = await c.from('money_records').select('id, iv, ct, seq').gt('seq', after).order('seq', { ascending: true }).limit(limit);
      fail(error);
      return (data ?? []) as RemoteRow[];
    },
    async push(rows) {
      const { error } = await c.from('money_records').upsert(rows.map((r) => ({ user_id: userId, ...r })), { onConflict: 'user_id,id' });
      fail(error);
    },
  };
}

// ---- Captured notifications dropped off by the phone while the app was closed --------------

export interface InboxRow { id: string; payload: CaptureBox; created_at: string }

export async function fetchInbox(c: SupabaseClient): Promise<InboxRow[]> {
  const { data, error } = await c.from('money_inbox').select('id, payload, created_at').order('created_at').limit(200);
  fail(error);
  return (data ?? []) as InboxRow[];
}

export async function clearInbox(c: SupabaseClient, ids: string[]) {
  if (!ids.length) return;
  const { error } = await c.from('money_inbox').delete().in('id', ids);
  fail(error);
}

/** A write-only token for the phone: it can add sealed captures and do nothing else. */
export async function newDropToken(c: SupabaseClient, userId: string, label: string): Promise<string> {
  const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const { error } = await c.from('money_drop_tokens').insert({ token_hash: await sha256Hex(token), user_id: userId, label });
  fail(error);
  return token;
}

export function watch(c: SupabaseClient, userId: string, onRecords: () => void, onInbox: () => void): () => void {
  const ch = c.channel(`money-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'money_records', filter: `user_id=eq.${userId}` }, onRecords)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'money_inbox', filter: `user_id=eq.${userId}` }, onInbox)
    .subscribe();
  return () => { void c.removeChannel(ch); };
}
