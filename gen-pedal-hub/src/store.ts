import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import type { Bike, CheckKey, Point, Profile, Ride } from './types';

const KEY = 'gph:v1';
const ptsKey = (id: string) => `gph:pts:${id}`;

export type State = { loaded: boolean; profile: Profile; rides: Ride[]; bikes: Bike[] };

const defaultProfile: Profile = {
  onboarded: false,
  name: '',
  level: 'Beginner',
  bikeKind: 'Road',
  weeklyGoalKm: 30,
  units: 'km',
  emergencyName: '',
  emergencyPhone: '',
};

let state: State = { loaded: false, profile: defaultProfile, rides: [], bikes: [] };
const listeners = new Set<() => void>();

function set(next: Partial<State>, save = true) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
  if (save) {
    const { profile, rides, bikes } = state;
    AsyncStorage.setItem(KEY, JSON.stringify({ profile, rides, bikes })).catch(() => {});
  }
}

export function getState(): State {
  return state;
}

export function useStore<T>(pick: (s: State) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => pick(state),
    () => pick(state)
  );
}

export async function loadStore(): Promise<void> {
  if (state.loaded) return;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      set(
        {
          loaded: true,
          profile: { ...defaultProfile, ...saved.profile },
          rides: saved.rides ?? [],
          bikes: saved.bikes ?? [],
        },
        false
      );
      return;
    }
  } catch {
    // A broken save must never stop the app from opening.
  }
  set({ loaded: true }, false);
}

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function updateProfile(patch: Partial<Profile>) {
  set({ profile: { ...state.profile, ...patch } });
}

export async function addRide(ride: Ride, points: Point[]) {
  await AsyncStorage.setItem(ptsKey(ride.id), JSON.stringify(points)).catch(() => {});
  set({ rides: [ride, ...state.rides] });
}

export function updateRide(id: string, patch: Partial<Ride>) {
  set({ rides: state.rides.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
}

export function deleteRide(id: string) {
  AsyncStorage.removeItem(ptsKey(id)).catch(() => {});
  set({ rides: state.rides.filter((r) => r.id !== id) });
}

export async function loadPoints(id: string): Promise<Point[]> {
  try {
    const raw = await AsyncStorage.getItem(ptsKey(id));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addBike(name: string, kind: string, startKm: number): Bike {
  const bike: Bike = {
    id: newId(),
    name,
    kind,
    startKm,
    doneAtKm: { chain: startKm, tyres: startKm, service: startKm },
  };
  set({ bikes: [...state.bikes, bike] });
  return bike;
}

export function markCheckDone(bikeId: string, key: CheckKey, atKm: number) {
  set({
    bikes: state.bikes.map((b) =>
      b.id === bikeId ? { ...b, doneAtKm: { ...b.doneAtKm, [key]: atKm } } : b
    ),
  });
}

export function deleteBike(id: string) {
  set({
    bikes: state.bikes.filter((b) => b.id !== id),
    rides: state.rides.map((r) => (r.bikeId === id ? { ...r, bikeId: null } : r)),
  });
}

export async function eraseEverything() {
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith('gph:')));
  set({ profile: defaultProfile, rides: [], bikes: [] }, false);
}
