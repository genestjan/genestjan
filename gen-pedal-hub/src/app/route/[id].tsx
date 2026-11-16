import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import {
  deleteSharedRoute,
  hasBackend,
  loadHazards,
  loadSharedRoutePoints,
  loadSharedRoutes,
  setRouteSaved,
  shareRoute,
  useSession,
  type Hazard,
  type SharedRoute,
} from '@/backend';
import { PlaceList, placeMarkers } from '@/components/place-list';
import { DifficultyTag } from '@/components/route-row';
import { TileMap } from '@/components/tile-map';
import { BackTitle, Button, Card, P, Screen, Stat } from '@/components/ui';
import { OVERPASS_URLS } from '@/config';
import { confirm, notify } from '@/lib/confirm';
import { difficulty, difficultyHint } from '@/lib/difficulty';
import { fmtDist } from '@/lib/format';
import { fetchPlaces, sampleRoute, type Place } from '@/lib/places';
import { haversineM } from '@/lib/track';
import { deleteRoute, loadPoints, useStore } from '@/store';
import { useTheme } from '@/theme';
import type { Point } from '@/types';

type Info = { name: string; by: string | null; distanceM: number; elevGainM: number; shared: SharedRoute | null };

export default function RouteDetail() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession();
  const units = useStore((s) => s.profile.units);
  const isLocal = (id ?? '').startsWith('local-');
  const local = useStore((s) => s.routes.find((r) => `local-${r.id}` === id));
  const signedIn = hasBackend && !!session.userId;

  const [info, setInfo] = useState<Info | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [missing, setMissing] = useState(false);
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    if (isLocal) {
      if (!local) return setMissing(true);
      setInfo({ name: local.name, by: null, distanceM: local.distanceM, elevGainM: local.elevGainM, shared: null });
      loadPoints(local.id).then(setPoints);
      return;
    }
    if (!signedIn) return;
    Promise.all([loadSharedRoutes(), loadSharedRoutePoints(id)])
      .then(([list, pts]) => {
        const r = list.find((x) => x.id === id);
        if (!r) return setMissing(true);
        setInfo({ name: r.name, by: r.rider, distanceM: r.distance_m, elevGainM: r.elev_gain_m, shared: r });
        setPoints(pts);
      })
      .catch(() => setMissing(true));
  }, [id, isLocal, local, signedIn]);

  if (missing || (!isLocal && !signedIn)) {
    return (
      <Screen>
        <BackTitle title="Route" />
        <P muted>{missing ? 'This route could not be found.' : 'Sign in (Me, then Settings) to see shared routes.'}</P>
      </Screen>
    );
  }
  if (!info) {
    return (
      <Screen>
        <BackTitle title="Route" />
        <P muted>Loading…</P>
      </Screen>
    );
  }

  const level = difficulty(info.distanceM, info.elevGainM);

  const findStops = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const centres = sampleRoute(points, 2500);
      const [found, reports] = await Promise.allSettled([
        fetchPlaces(OVERPASS_URLS, centres, 700),
        signedIn && points.length > 0 ? loadHazards(points[0].lat, points[0].lon, Math.max(20, info.distanceM / 1000)) : Promise.resolve([] as Hazard[]),
      ]);
      if (found.status === 'rejected') setProblem('Could not load water stops and bike shops. Check your internet and try again.');
      setPlaces(found.status === 'fulfilled' ? found.value : []);
      if (reports.status === 'fulfilled') {
        // Keep only reports within 300 m of the route itself.
        const dense = sampleRoute(points, 150, 400);
        setHazards(reports.value.filter((h) => dense.some((p) => haversineM(p.lat, p.lon, h.lat, h.lon) <= 300)));
      }
    } finally {
      setBusy(false);
    }
  };

  const toggleSaved = async () => {
    if (!info.shared) return;
    const on = !info.shared.saved;
    try {
      await setRouteSaved(info.shared.id, on);
      setInfo({ ...info, shared: { ...info.shared, saved: on, saves: info.shared.saves + (on ? 1 : -1) } });
    } catch (e) {
      notify('Could not save', e instanceof Error ? e.message : 'Try again.');
    }
  };

  return (
    <Screen>
      <BackTitle title={info.name} />
      {info.by ? <P muted>Shared by {info.by}</P> : null}

      {points.length > 1 ? <TileMap points={points} markers={placeMarkers(places ?? [], hazards)} height={260} controls /> : null}

      <Card>
        <Card style={{ flexDirection: 'row', borderWidth: 0, padding: 0 }}>
          <Stat value={fmtDist(info.distanceM, units)} unit={units} label="distance" />
          <Stat value={String(Math.round(info.elevGainM))} unit="m" label="climbing" />
        </Card>
        <DifficultyTag level={level} />
        <Text style={{ color: t.muted, fontSize: 15 }}>{difficultyHint(level)}</Text>
      </Card>

      {problem ? (
        <Text accessibilityRole="alert" style={{ color: t.danger, fontSize: 15 }}>
          {problem}
        </Text>
      ) : null}
      {places === null ? (
        <Button label={busy ? 'Looking…' : 'Find water, bike shops and dangers on this route'} icon="search" disabled={busy || points.length < 2} onPress={findStops} />
      ) : (
        <PlaceList places={places} hazards={hazards} />
      )}

      {info.shared ? (
        <Button label={info.shared.saved ? 'Saved. Tap to remove' : 'Save this route'} icon={info.shared.saved ? 'bookmark' : 'bookmark-outline'} kind={info.shared.saved ? 'plain' : 'primary'} onPress={toggleSaved} />
      ) : null}
      {isLocal && signedIn && points.length > 1 ? (
        <Button
          label="Share this route with other riders"
          icon="people-outline"
          onPress={async () => {
            if (!(await confirm('Share this route?', 'Other riders will see the line of this route on the map. If it starts at your home, think twice.', 'Share'))) return;
            try {
              await shareRoute(info.name, '', info.distanceM, info.elevGainM, points);
              notify('Shared', 'Other riders can now find this route under Explore.');
            } catch (e) {
              notify('Could not share', e instanceof Error ? e.message : 'Try again.');
            }
          }}
        />
      ) : null}
      {isLocal || info.shared?.user_id === session.userId ? (
        <Button
          label="Delete this route"
          icon="trash-outline"
          kind="danger"
          onPress={async () => {
            if (!(await confirm('Delete this route?', 'This cannot be undone.', 'Delete', true))) return;
            if (isLocal && local) deleteRoute(local.id);
            else if (info.shared) await deleteSharedRoute(info.shared.id).catch(() => {});
            router.replace('/explore');
          }}
        />
      ) : null}
    </Screen>
  );
}
