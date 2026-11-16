/**
 * Everything that talks to the shared server (Supabase): sign-in, community,
 * rankings, clubs, events, shared routes and danger reports.
 *
 * The app works without it. When SUPABASE_URL is empty, `hasBackend` is false
 * and the screens that need it explain that instead of breaking.
 */
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import { getState } from './store';
import type { Point } from './types';

export const hasBackend = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const PHOTOS = 'ph-photos';

let client: SupabaseClient | null = null;

/** Created on first use, never while the web pages are being pre-built. */
function db(): SupabaseClient {
  if (!hasBackend) throw new Error('Community features are not switched on yet.');
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
    });
  }
  return client;
}

// ------------------------------------------------------------------ session

export type Session = { ready: boolean; userId: string | null; email: string | null };

let session: Session = { ready: !hasBackend, userId: null, email: null };
const listeners = new Set<() => void>();

function setSession(next: Session) {
  session = next;
  listeners.forEach((l) => l());
}

export function useSession(): Session {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => session,
    () => session
  );
}

export function currentUserId(): string | null {
  return session.userId;
}

let started = false;

/** Call once when the app opens. Restores a saved sign-in. */
export async function startBackend() {
  if (!hasBackend || started) return;
  started = true;
  try {
    const { data } = await db().auth.getSession();
    setSession({ ready: true, userId: data.session?.user.id ?? null, email: data.session?.user.email ?? null });
    db().auth.onAuthStateChange((_event, s) => {
      setSession({ ready: true, userId: s?.user.id ?? null, email: s?.user.email ?? null });
    });
    if (data.session) afterSignIn().catch(() => {});
  } catch {
    setSession({ ready: true, userId: null, email: null });
  }
}

/** Turns a server error into words a rider can act on. */
function friendly(e: { message?: string; code?: string } | null | undefined, fallback: string): Error {
  const m = (e?.message ?? '').toLowerCase();
  if (m.includes('invalid login')) return new Error('That email or password is not right.');
  if (m.includes('already registered') || m.includes('already been registered')) {
    return new Error('That email already has an account. Press Sign in instead.');
  }
  if (m.includes('email not confirmed')) return new Error('Open the email we sent you and press the link first.');
  if (m.includes('password')) return new Error('Use a password with at least 6 letters or numbers.');
  if (m.includes('failed to fetch') || m.includes('network')) return new Error('No internet. Check your connection and try again.');
  if (e?.code === '23505') return new Error('That already exists. Try a different name.');
  if (e?.code === '42501' || m.includes('row-level security')) return new Error('You are not allowed to do that.');
  return new Error(fallback);
}

async function afterSignIn() {
  await saveMyProfile();
  await uploadRides();
}

/** Returns 'in' when signed in straight away, 'confirm' when an email link must be pressed first. */
export async function signUp(email: string, password: string): Promise<'in' | 'confirm'> {
  const { data, error } = await db().auth.signUp({ email: email.trim(), password });
  if (error) throw friendly(error, 'Could not create the account. Try again.');
  if (!data.session) return 'confirm';
  await afterSignIn().catch(() => {});
  return 'in';
}

export async function signIn(email: string, password: string) {
  const { error } = await db().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw friendly(error, 'Could not sign in. Try again.');
  await afterSignIn().catch(() => {});
}

export async function signOut() {
  await db().auth.signOut();
}

function me(): string {
  if (!session.userId) throw new Error('Sign in first.');
  return session.userId;
}

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T[]> {
  const { data, error } = await db().rpc(name, args);
  if (error) throw friendly(error, 'Could not load this. Pull down or try again.');
  return (data ?? []) as T[];
}

function check(error: { message?: string; code?: string } | null, fallback: string) {
  if (error) throw friendly(error, fallback);
}

// ------------------------------------------------------------------ my profile and rides

/** Copies the rider's name and details from the phone to their public page. */
export async function saveMyProfile() {
  const p = getState().profile;
  const { error } = await db()
    .from('ph_profiles')
    .upsert({ id: me(), name: p.name.trim() || 'Rider', city: p.city.trim(), bike_kind: p.bikeKind, level: p.level });
  check(error, 'Could not save your profile.');
}

/** Sends ride summaries (never the GPS line) so rankings and challenges can count them. */
export async function uploadRides() {
  const rides = getState().rides;
  if (!session.userId || rides.length === 0) return;
  const rows = rides.map((r) => ({
    user_id: session.userId,
    local_id: r.id,
    title: r.title.slice(0, 80) || 'Ride',
    started_at: new Date(r.startedAt).toISOString(),
    distance_m: Math.round(r.distanceM),
    moving_s: Math.round(r.movingMs / 1000),
    elev_gain_m: Math.round(r.elevGainM),
    max_speed_ms: Math.min(35, Math.round(r.maxSpeedMs * 10) / 10),
  }));
  const { error } = await db().from('ph_rides').upsert(rows, { onConflict: 'user_id,local_id' });
  check(error, 'Could not upload your rides.');
}

export async function removeUploadedRide(localId: string) {
  if (!hasBackend || !session.userId) return;
  await db().from('ph_rides').delete().eq('user_id', session.userId).eq('local_id', localId);
}

// ------------------------------------------------------------------ feed

export type FeedPost = {
  id: string;
  user_id: string;
  name: string;
  body: string;
  photo_path: string | null;
  created_at: string;
  ride_title: string | null;
  ride_distance_m: number | null;
  ride_moving_s: number | null;
  ride_elev_gain_m: number | null;
  likes: number;
  comments: number;
  liked: boolean;
  following: boolean;
};

export const loadFeed = (userId?: string) => rpc<FeedPost>('ph_feed', userId ? { p_user: userId } : undefined);

export function photoUrl(path: string): string {
  return db().storage.from(PHOTOS).getPublicUrl(path).data.publicUrl;
}

/** Uploads a picked photo and returns where it was stored. */
export async function uploadPhoto(uri: string, mimeType = 'image/jpeg'): Promise<string> {
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
  const path = `${me()}/${Date.now()}.${ext}`;
  const bytes = await (await fetch(uri)).arrayBuffer();
  const { error } = await db().storage.from(PHOTOS).upload(path, bytes, { contentType: mimeType });
  check(error, 'Could not upload the photo. Try a smaller one.');
  return path;
}

/** `rideLocalId` attaches one of the rider's own rides to the post. */
export async function addPost(body: string, photoPath: string | null, rideLocalId: string | null) {
  let rideId: string | null = null;
  if (rideLocalId) {
    await uploadRides();
    const { data } = await db().from('ph_rides').select('id').eq('user_id', me()).eq('local_id', rideLocalId).maybeSingle();
    rideId = data?.id ?? null;
  }
  const { error } = await db().from('ph_posts').insert({ body: body.trim(), photo_path: photoPath, ride_id: rideId });
  check(error, 'Could not share your post.');
}

export async function deletePost(id: string) {
  const { error } = await db().from('ph_posts').delete().eq('id', id);
  check(error, 'Could not delete the post.');
}

export async function setLike(postId: string, on: boolean) {
  const q = on
    ? db().from('ph_likes').upsert({ post_id: postId, user_id: me() })
    : db().from('ph_likes').delete().eq('post_id', postId).eq('user_id', me());
  const { error } = await q;
  check(error, 'Could not save your like.');
}

export type Comment = { id: string; user_id: string; body: string; created_at: string; author: { name: string } | null };

export async function loadComments(postId: string): Promise<Comment[]> {
  const { data, error } = await db()
    .from('ph_comments')
    .select('id, user_id, body, created_at, author:ph_profiles(name)')
    .eq('post_id', postId)
    .order('created_at');
  check(error, 'Could not load the comments.');
  return (data ?? []) as unknown as Comment[];
}

export async function addComment(postId: string, body: string) {
  const { error } = await db().from('ph_comments').insert({ post_id: postId, body: body.trim() });
  check(error, 'Could not add your comment.');
}

// ------------------------------------------------------------------ riders and follows

export type Rider = {
  id: string;
  name: string;
  city: string;
  bike_kind: string;
  level: string;
  created_at: string;
  followers: number;
  following: number;
  i_follow: boolean;
  rides: number;
  distance_km: number;
  climb_m: number;
};

export async function loadRider(id: string): Promise<Rider | null> {
  return (await rpc<Rider>('ph_rider', { p_user: id }))[0] ?? null;
}

export async function setFollow(userId: string, on: boolean) {
  const q = on
    ? db().from('ph_follows').upsert({ follower: me(), followee: userId })
    : db().from('ph_follows').delete().eq('follower', me()).eq('followee', userId);
  const { error } = await q;
  check(error, 'Could not save that.');
}

export async function findRiders(text: string): Promise<{ id: string; name: string; city: string }[]> {
  const { data, error } = await db()
    .from('ph_profiles')
    .select('id, name, city')
    .ilike('name', `%${text.trim().replace(/[%_]/g, '')}%`)
    .limit(30);
  check(error, 'Could not search.');
  return data ?? [];
}

// ------------------------------------------------------------------ rankings

export type Period = 'week' | 'month';
export type RankMetric = 'distance' | 'climb' | 'speed' | 'longest';
export type RankRow = { user_id: string; name: string; city: string; value: number };

export const loadRanking = (period: Period, metric: RankMetric, clubId?: string) =>
  rpc<RankRow>('ph_leaderboard', { p_period: period, p_metric: metric, p_club: clubId ?? null });

export type ClubRank = { club_id: string; name: string; city: string; members: number; value: number };
export const loadClubRanking = (period: Period) => rpc<ClubRank>('ph_club_ranking', { p_period: period });

// ------------------------------------------------------------------ clubs

export type Club = { id: string; name: string; about: string; city: string; owner_id: string; members: number; joined: boolean };

export const loadClubs = () => rpc<Club>('ph_clubs_list');

export async function createClub(name: string, about: string, city: string) {
  const { error } = await db().from('ph_clubs').insert({ name: name.trim(), about: about.trim(), city: city.trim() });
  check(error, 'Could not create the group. The name needs 2 to 50 letters.');
}

export async function setClubMember(clubId: string, on: boolean) {
  const q = on
    ? db().from('ph_club_members').upsert({ club_id: clubId, user_id: me() })
    : db().from('ph_club_members').delete().eq('club_id', clubId).eq('user_id', me());
  const { error } = await q;
  check(error, 'Could not save that.');
}

export async function loadClubMembers(clubId: string): Promise<{ user_id: string; role: string; rider: { name: string; city: string } | null }[]> {
  const { data, error } = await db()
    .from('ph_club_members')
    .select('user_id, role, rider:ph_profiles(name, city)')
    .eq('club_id', clubId)
    .order('joined_at');
  check(error, 'Could not load the members.');
  return (data ?? []) as never;
}

// ------------------------------------------------------------------ events

export type EventRow = {
  id: string;
  organiser_id: string;
  organiser: string;
  title: string;
  about: string;
  place: string;
  starts_at: string;
  distance_km: number;
  fee: number;
  pay_info: string;
  riders: number;
  my_race_no: number | null;
  my_paid: boolean | null;
  my_pay_ref: string | null;
};

export const loadEvents = () => rpc<EventRow>('ph_events_list');

export type NewEvent = { title: string; about: string; place: string; startsAt: Date; distanceKm: number; fee: number; payInfo: string };

export async function createEvent(e: NewEvent) {
  const { error } = await db().from('ph_events').insert({
    title: e.title.trim(),
    about: e.about.trim(),
    place: e.place.trim(),
    starts_at: e.startsAt.toISOString(),
    distance_km: e.distanceKm,
    fee: e.fee,
    pay_info: e.payInfo.trim(),
  });
  check(error, 'Could not create the event. Check the name and the date.');
}

export async function deleteEvent(id: string) {
  const { error } = await db().from('ph_events').delete().eq('id', id);
  check(error, 'Could not delete the event.');
}

export async function setRegistered(eventId: string, on: boolean) {
  const q = on
    ? db().from('ph_event_regs').insert({ event_id: eventId })
    : db().from('ph_event_regs').delete().eq('event_id', eventId).eq('user_id', me());
  const { error } = await q;
  check(error, on ? 'Could not sign you up.' : 'Could not take you off the list.');
}

export async function savePayRef(eventId: string, payRef: string) {
  const { error } = await db().from('ph_event_regs').update({ pay_ref: payRef.trim() }).eq('event_id', eventId).eq('user_id', me());
  check(error, 'Could not save your payment number.');
}

/** Organiser only. */
export async function markPaid(eventId: string, userId: string, paid: boolean) {
  const { error } = await db().from('ph_event_regs').update({ paid }).eq('event_id', eventId).eq('user_id', userId);
  check(error, 'Could not save that.');
}

export type Participant = { user_id: string; name: string; race_no: number; paid: boolean | null; pay_ref: string | null };
export const loadParticipants = (eventId: string) => rpc<Participant>('ph_event_participants', { p_event: eventId });

export type EventNews = { id: string; body: string; created_at: string };

export async function loadEventNews(eventId: string): Promise<EventNews[]> {
  const { data, error } = await db()
    .from('ph_event_news')
    .select('id, body, created_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  check(error, 'Could not load the announcements.');
  return data ?? [];
}

export async function addEventNews(eventId: string, body: string) {
  const { error } = await db().from('ph_event_news').insert({ event_id: eventId, body: body.trim() });
  check(error, 'Could not post the announcement.');
}

// ------------------------------------------------------------------ challenges and competitions

export type ChallengeKind = 'distance' | 'climb' | 'rides';
export type Challenge = {
  id: string;
  title: string;
  about: string;
  kind: ChallengeKind;
  target: number;
  starts_at: string;
  ends_at: string;
  competition: boolean;
  created_by: string | null;
  riders: number;
  joined: boolean;
  my_value: number;
};

export async function loadChallenges(): Promise<Challenge[]> {
  await db().rpc('ph_ensure_monthly');
  return rpc<Challenge>('ph_challenges_list');
}

export async function setChallengeJoined(id: string, on: boolean) {
  const q = on
    ? db().from('ph_challenge_members').upsert({ challenge_id: id, user_id: me() })
    : db().from('ph_challenge_members').delete().eq('challenge_id', id).eq('user_id', me());
  const { error } = await q;
  check(error, 'Could not save that.');
}

export async function createCompetition(title: string, about: string, kind: ChallengeKind, days: number) {
  const now = new Date();
  const { data, error } = await db()
    .from('ph_challenges')
    .insert({
      title: title.trim(),
      about: about.trim(),
      kind,
      target: 0,
      starts_at: now.toISOString(),
      ends_at: new Date(now.getTime() + days * 86400000).toISOString(),
      competition: true,
    })
    .select('id')
    .single();
  check(error, 'Could not create the competition. The name needs 3 to 80 letters.');
  if (data) await setChallengeJoined(data.id, true);
}

export type BoardRow = { user_id: string; name: string; value: number };
export const loadChallengeBoard = (id: string) => rpc<BoardRow>('ph_challenge_board', { p_challenge: id });

// ------------------------------------------------------------------ shared routes

export type SharedRoute = {
  id: string;
  user_id: string;
  rider: string;
  name: string;
  about: string;
  distance_m: number;
  elev_gain_m: number;
  start_lat: number;
  start_lon: number;
  created_at: string;
  saves: number;
  saved: boolean;
};

export const loadSharedRoutes = () => rpc<SharedRoute>('ph_routes_list');

export async function loadSharedRoutePoints(id: string): Promise<Point[]> {
  const { data, error } = await db().from('ph_routes').select('points').eq('id', id).maybeSingle();
  check(error, 'Could not load the route.');
  const pts = (data?.points ?? []) as [number, number][];
  return pts.map(([lat, lon], i) => ({ t: i, lat, lon, alt: null }));
}

export async function shareRoute(name: string, about: string, distanceM: number, elevGainM: number, points: Point[]) {
  const step = Math.max(1, Math.ceil(points.length / 500));
  const line = points.filter((_, i) => i % step === 0 || i === points.length - 1).map((p) => [+p.lat.toFixed(5), +p.lon.toFixed(5)]);
  const { error } = await db().from('ph_routes').insert({
    name: name.trim(),
    about: about.trim(),
    distance_m: Math.round(distanceM),
    elev_gain_m: Math.round(elevGainM),
    start_lat: line[0][0],
    start_lon: line[0][1],
    points: line,
  });
  check(error, 'Could not share the route.');
}

export async function setRouteSaved(id: string, on: boolean) {
  const q = on
    ? db().from('ph_route_saves').upsert({ route_id: id, user_id: me() })
    : db().from('ph_route_saves').delete().eq('route_id', id).eq('user_id', me());
  const { error } = await q;
  check(error, 'Could not save that.');
}

export async function deleteSharedRoute(id: string) {
  const { error } = await db().from('ph_routes').delete().eq('id', id);
  check(error, 'Could not delete the route.');
}

// ------------------------------------------------------------------ danger reports

export type HazardKind = 'pothole' | 'traffic' | 'flood' | 'dogs' | 'roadworks' | 'other';
export type Hazard = { id: string; user_id: string; lat: number; lon: number; kind: HazardKind; note: string; created_at: string };

/** Reports from the last 30 days inside a box around a point. `reachKm` is half the box's width. */
export async function loadHazards(lat: number, lon: number, reachKm = 60): Promise<Hazard[]> {
  const dLat = reachKm / 111;
  const dLon = reachKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const { data, error } = await db()
    .from('ph_hazards')
    .select('id, user_id, lat, lon, kind, note, created_at')
    .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString())
    .gte('lat', lat - dLat)
    .lte('lat', lat + dLat)
    .gte('lon', lon - dLon)
    .lte('lon', lon + dLon)
    .order('created_at', { ascending: false })
    .limit(300);
  check(error, 'Could not load the danger reports.');
  return (data ?? []) as Hazard[];
}

export async function reportHazard(lat: number, lon: number, kind: HazardKind, note: string) {
  const { error } = await db().from('ph_hazards').insert({ lat, lon, kind, note: note.trim() });
  check(error, 'Could not send your report.');
}

export async function deleteHazard(id: string) {
  const { error } = await db().from('ph_hazards').delete().eq('id', id);
  check(error, 'Could not remove the report.');
}
