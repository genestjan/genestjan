import { useCallback, useEffect, useState } from 'react';
import type { Backend, Table } from '../lib/backend';

/** Loads data and reloads it whenever one of the watched tables changes anywhere. */
export function useLive<T>(be: Backend, tables: Table[], load: () => Promise<T>, deps: unknown[]): [T | undefined, () => void] {
  const [v, setV] = useState<T>();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(() => { load().then(setV).catch(console.error); }, deps);
  useEffect(() => {
    run();
    const off = be.subscribe((t) => { if (tables.includes(t)) run(); });
    const iv = be.mode === 'live' ? setInterval(run, 15000) : undefined; // safety net if realtime drops
    return () => { off(); if (iv) clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);
  return [v, run];
}

/** Watches the phone's GPS. Returns null until a fix arrives or if permission is refused. */
export function useGps(enabled = true) {
  const [pos, setPos] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [err, setErr] = useState<string>();
  useEffect(() => {
    if (!enabled || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
      (e) => setErr(e.code === 1 ? 'Location is off. Allow location so drivers can find you.' : 'Finding your location...'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);
  return { pos, err };
}
