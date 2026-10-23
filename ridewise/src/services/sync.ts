// Optional account sync through Supabase. Without VITE_SUPABASE_URL the app
// is local-only and says so. Sync payloads never include the rider profile
// (emergency contacts, medical notes), which stays on the device.

import type { RidePlan } from '../types';
import { config } from '../config';

export const syncConfigured = () => !!(config.supabaseUrl && config.supabaseAnonKey);

/** Last-write-wins per plan by updatedAt; plans only on one side are kept. */
export function mergePlans(local: RidePlan[], remote: RidePlan[]): { merged: RidePlan[]; toUpload: RidePlan[] } {
  const byId = new Map<string, RidePlan>();
  const toUpload: RidePlan[] = [];
  for (const r of remote) byId.set(r.id, r);
  for (const l of local) {
    const r = byId.get(l.id);
    if (!r || l.updatedAt > r.updatedAt) {
      byId.set(l.id, l);
      toUpload.push(l);
    }
  }
  return { merged: [...byId.values()], toUpload };
}

async function client() {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: { persistSession: true } });
}

export async function sendMagicLink(email: string) {
  const sb = await client();
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href.split('#')[0] } });
  if (error) throw new Error(error.message);
}

export async function currentUserEmail(): Promise<string | null> {
  if (!syncConfigured()) return null;
  const sb = await client();
  const { data } = await sb.auth.getUser();
  return data.user?.email ?? null;
}

export async function signOut() {
  const sb = await client();
  await sb.auth.signOut();
}

export async function syncNow(local: RidePlan[]): Promise<RidePlan[]> {
  const sb = await client();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error('Sign in first.');
  const { data, error } = await sb.from('ride_plans').select('id, payload, updated_at');
  if (error) throw new Error(error.message);
  const remote = (data ?? []).map((r) => r.payload as RidePlan);
  const { merged, toUpload } = mergePlans(local.filter((p) => !p.isSample), remote);
  if (toUpload.length) {
    const rows = toUpload.map((p) => ({
      id: p.id,
      owner_id: auth.user!.id,
      name: p.name,
      departure_local: p.departureLocal,
      time_zone: p.timeZone,
      distance_m: p.route?.distanceM ?? null,
      status: p.status,
      payload: p,
      updated_at: p.updatedAt,
    }));
    const { error: upErr } = await sb.from('ride_plans').upsert(rows);
    if (upErr) throw new Error(upErr.message);
  }
  return merged;
}
