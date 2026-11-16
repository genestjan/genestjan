import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { useSyncExternalStore } from 'react';
import { Platform, Vibration } from 'react-native';

import { hasBackend, loadHazards, currentUserId, uploadRides, type Hazard } from './backend';
import { rideTitle } from './lib/format';
import { addFix, breakTrack, emptyTrack, haversineM, thin, type Fix, type Track } from './lib/track';
import { startDrinkReminders, stopDrinkReminders } from './notify';
import { addRide, getState, newId } from './store';
import type { Ride } from './types';

const TASK = 'gph-ride-location';
const ACTIVE_KEY = 'gph:active';
const MAX_SAVED_POINTS = 2000;

export type Status = 'idle' | 'recording' | 'paused';

export type Snapshot = {
  status: Status;
  track: Track;
  startedAt: number;
  /** Total time spent paused, in ms. */
  pausedMs: number;
  pausedAt: number | null;
  /** Shown when location could not be started. */
  error: string | null;
  /** True when an unfinished ride was found after the app was closed. */
  restored: boolean;
  /** True when it is time to drink. Cleared when the rider says they drank. */
  drinkDue: boolean;
  /** A danger reported close by, in words, or null. */
  alert: string | null;
  tick: number;
};

let snap: Snapshot = {
  status: 'idle',
  track: emptyTrack(),
  startedAt: 0,
  pausedMs: 0,
  pausedAt: null,
  error: null,
  restored: false,
  drinkDue: false,
  alert: null,
  tick: 0,
};

const listeners = new Set<() => void>();

// Drink reminders and danger alerts for the ride in progress.
let nextDrinkMs = 0;
let hazards: Hazard[] | null = null;
const warned = new Set<string>();
const HAZARD_WORDS: Record<string, string> = {
  pothole: 'a pothole',
  traffic: 'heavy traffic',
  flood: 'flooding',
  dogs: 'loose dogs',
  roadworks: 'roadworks',
  other: 'a danger',
};

function buzz() {
  try {
    Vibration.vibrate([0, 400, 200, 400]);
  } catch {
    // Some browsers have no vibration.
  }
}

function drinkGapMs(): number {
  return Math.max(0, getState().profile.drinkEveryMin) * 60000;
}

/** Warns once about each reported danger within 250 m of the rider. */
function checkHazards(lat: number, lon: number) {
  if (hazards === null) {
    hazards = [];
    if (hasBackend && currentUserId()) {
      loadHazards(lat, lon, 80)
        .then((list) => {
          hazards = list;
        })
        .catch(() => {});
    }
    return;
  }
  for (const h of hazards) {
    if (warned.has(h.id) || haversineM(lat, lon, h.lat, h.lon) > 250) continue;
    warned.add(h.id);
    buzz();
    emit({ alert: `Careful: ${HAZARD_WORDS[h.kind] ?? 'a danger'} reported near here.${h.note ? ` ${h.note}` : ''}` });
    return;
  }
}

export function drankWater() {
  emit({ drinkDue: false });
}

export function clearAlert() {
  emit({ alert: null });
}

let webWatch: Location.LocationSubscription | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let lastSave = 0;

function emit(patch: Partial<Snapshot> = {}) {
  snap = { ...snap, ...patch, tick: snap.tick + 1 };
  listeners.forEach((l) => l());
}

export function useRecorder(): Snapshot {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snap,
    () => snap
  );
}

export function elapsedMs(s: Snapshot, now = Date.now()): number {
  if (s.status === 'idle') return 0;
  const end = s.pausedAt ?? now;
  return Math.max(0, end - s.startedAt - s.pausedMs);
}

function saveActive(force = false) {
  const now = Date.now();
  if (!force && now - lastSave < 15000) return;
  lastSave = now;
  const { status, track, startedAt, pausedMs, pausedAt } = snap;
  AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify({ status, track, startedAt, pausedMs, pausedAt })).catch(
    () => {}
  );
}

function onLocations(locations: Location.LocationObject[]) {
  if (snap.status !== 'recording') return;
  for (const l of locations) {
    const fix: Fix = {
      t: l.timestamp,
      lat: l.coords.latitude,
      lon: l.coords.longitude,
      alt: l.coords.altitude ?? null,
      acc: l.coords.accuracy ?? null,
    };
    addFix(snap.track, fix);
  }
  const here = snap.track.last;
  if (here) checkHazards(here.lat, here.lon);
  saveActive();
  emit();
}

// On Android the readings arrive through a background task, so the ride keeps
// recording with the screen off. It must be defined when the app starts.
if (Platform.OS !== 'web') {
  TaskManager.defineTask(TASK, async ({ data, error }) => {
    if (error || !data) return;
    onLocations((data as { locations: Location.LocationObject[] }).locations);
  });
}

async function startLocation(): Promise<string | null> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') {
      return 'Location is switched off for this app. Allow location, then press Start again.';
    }
    if (Platform.OS === 'web') {
      webWatch?.remove();
      webWatch = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
        (l) => onLocations([l])
      );
    } else {
      await Location.startLocationUpdatesAsync(TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 0,
        activityType: Location.ActivityType.Fitness,
        pausesUpdatesAutomatically: false,
        foregroundService: {
          notificationTitle: 'Gen Pedal Hub is recording your ride',
          notificationBody: 'Open the app to pause or finish.',
          notificationColor: '#173B32',
        },
      });
    }
    return null;
  } catch {
    return 'Could not start GPS. Check that location is switched on, then press Start again.';
  }
}

async function stopLocation() {
  try {
    if (Platform.OS === 'web') {
      webWatch?.remove();
      webWatch = null;
    } else if (await Location.hasStartedLocationUpdatesAsync(TASK)) {
      await Location.stopLocationUpdatesAsync(TASK);
    }
  } catch {
    // Nothing useful to do if stopping fails.
  }
}

function startTimer() {
  if (timer) return;
  timer = setInterval(() => {
    const gap = drinkGapMs();
    if (gap > 0 && elapsedMs(snap) >= nextDrinkMs && nextDrinkMs > 0) {
      nextDrinkMs += gap;
      buzz();
      emit({ drinkDue: true });
    } else {
      emit();
    }
  }, 1000);
}

function stopTimer() {
  if (timer) clearInterval(timer);
  timer = null;
}

export async function startRide() {
  const error = await startLocation();
  if (error) {
    emit({ error });
    return;
  }
  emit({
    status: 'recording',
    track: emptyTrack(),
    startedAt: Date.now(),
    pausedMs: 0,
    pausedAt: null,
    error: null,
    restored: false,
    drinkDue: false,
    alert: null,
  });
  hazards = null;
  warned.clear();
  nextDrinkMs = drinkGapMs();
  startDrinkReminders(getState().profile.drinkEveryMin);
  startTimer();
  saveActive(true);
}

export async function pauseRide() {
  if (snap.status !== 'recording') return;
  breakTrack(snap.track);
  emit({ status: 'paused', pausedAt: Date.now() });
  stopTimer();
  stopDrinkReminders();
  saveActive(true);
  await stopLocation();
}

export async function resumeRide() {
  if (snap.status !== 'paused') return;
  const error = await startLocation();
  if (error) {
    emit({ error });
    return;
  }
  emit({
    status: 'recording',
    pausedMs: snap.pausedMs + (Date.now() - (snap.pausedAt ?? Date.now())),
    pausedAt: null,
    error: null,
    restored: false,
  });
  // Count the next drink from now, not from before the pause.
  const gap = drinkGapMs();
  nextDrinkMs = gap > 0 ? elapsedMs(snap) + gap : 0;
  startDrinkReminders(getState().profile.drinkEveryMin);
  startTimer();
}

async function reset() {
  stopTimer();
  stopDrinkReminders();
  await stopLocation();
  await AsyncStorage.removeItem(ACTIVE_KEY).catch(() => {});
  emit({ status: 'idle', track: emptyTrack(), startedAt: 0, pausedMs: 0, pausedAt: null, error: null, restored: false, drinkDue: false, alert: null });
}

/** Saves the ride and returns it, or null when nothing was recorded. */
export async function finishRide(): Promise<Ride | null> {
  if (snap.status === 'idle') return null;
  const now = Date.now();
  const { track, startedAt } = snap;
  const endedAt = snap.pausedAt ?? now;
  let ride: Ride | null = null;
  if (track.distanceM >= 20) {
    const bikes = getState().bikes;
    ride = {
      id: newId(),
      title: rideTitle(startedAt),
      startedAt,
      endedAt,
      distanceM: track.distanceM,
      movingMs: track.movingMs,
      elapsedMs: elapsedMs(snap, now),
      elevGainM: track.elevGainM,
      maxSpeedMs: track.maxSpeedMs,
      bikeId: bikes.length === 1 ? bikes[0].id : null,
    };
    await addRide(ride, thin(track.points, MAX_SAVED_POINTS));
    // Send the summary to the rankings if the rider is signed in. Failing is fine: it is sent again next time.
    if (hasBackend && currentUserId()) uploadRides().catch(() => {});
  }
  await reset();
  return ride;
}

export async function discardRide() {
  await reset();
}

export function clearError() {
  emit({ error: null });
}

/** If the app was closed in the middle of a ride, bring that ride back, paused. */
export async function restoreRide() {
  if (snap.status !== 'idle') return;
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (Platform.OS !== 'web' && saved.status === 'recording' && (await Location.hasStartedLocationUpdatesAsync(TASK))) {
      // The background service is still running, so carry on recording.
      emit({ ...saved, status: 'recording', error: null, restored: false, drinkDue: false, alert: null });
      nextDrinkMs = drinkGapMs() > 0 ? elapsedMs(snap) + drinkGapMs() : 0;
      startTimer();
      return;
    }
    const lastSeen = saved.pausedAt ?? saved.track.last?.t ?? Date.now();
    breakTrack(saved.track);
    emit({
      status: 'paused',
      track: saved.track,
      startedAt: saved.startedAt,
      pausedMs: saved.pausedMs,
      pausedAt: lastSeen,
      error: null,
      restored: true,
    });
  } catch {
    await AsyncStorage.removeItem(ACTIVE_KEY).catch(() => {});
  }
}
