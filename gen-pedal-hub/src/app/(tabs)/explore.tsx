import * as Location from 'expo-location';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { hasBackend, loadHazards, loadSharedRoutes, reportHazard, useSession, type Hazard, type HazardKind } from '@/backend';
import { PlaceList, placeMarkers } from '@/components/place-list';
import { RouteRow } from '@/components/route-row';
import { TileMap } from '@/components/tile-map';
import { Button, Card, Choices, Field, H2, P, Screen } from '@/components/ui';
import { OVERPASS_URLS } from '@/config';
import { fetchPlaces, type Place } from '@/lib/places';
import { useAsync } from '@/lib/use-async';
import { useStore } from '@/store';
import { space, useTheme } from '@/theme';

const DANGERS: { kind: HazardKind; label: string }[] = [
  { kind: 'pothole', label: 'Pothole' },
  { kind: 'traffic', label: 'Heavy traffic' },
  { kind: 'flood', label: 'Flooding' },
  { kind: 'dogs', label: 'Loose dogs' },
  { kind: 'roadworks', label: 'Roadworks' },
  { kind: 'other', label: 'Something else' },
];

type Near = { lat: number; lon: number; places: Place[]; hazards: Hazard[] };

export default function Explore() {
  const t = useTheme();
  const session = useSession();
  const units = useStore((s) => s.profile.units);
  const mine = useStore((s) => s.routes);
  const signedIn = hasBackend && !!session.userId;

  const [tab, setTab] = useState('Popular');
  const shared = useAsync(loadSharedRoutes, [session.userId], signedIn && tab === 'Popular');

  const [near, setNear] = useState<Near | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [kind, setKind] = useState('Pothole');
  const [note, setNote] = useState('');

  const lookAround = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') throw new Error('Location is switched off for this app. Allow location, then try again.');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const here = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      // Show the map straight away, then fill in what the two services send back.
      setNear({ ...here, places: [], hazards: [] });
      const [places, hazards] = await Promise.allSettled([
        fetchPlaces(OVERPASS_URLS, [here], 3000),
        signedIn ? loadHazards(here.lat, here.lon, 5) : Promise.resolve([] as Hazard[]),
      ]);
      setNear({
        ...here,
        places: places.status === 'fulfilled' ? places.value : [],
        hazards: hazards.status === 'fulfilled' ? hazards.value : [],
      });
      if (places.status === 'rejected') setProblem('Could not load water stops and bike shops. Check your internet and try again.');
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Could not find where you are.');
    } finally {
      setBusy(false);
    }
  };

  const sendReport = async () => {
    if (!near) return;
    try {
      await reportHazard(near.lat, near.lon, DANGERS.find((d) => d.label === kind)?.kind ?? 'other', note);
      setReporting(false);
      setNote('');
      setNear({ ...near, hazards: await loadHazards(near.lat, near.lon, 5) });
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Could not send your report.');
    }
  };

  return (
    <Screen title="Explore">
      <Card>
        <H2>Around me</H2>
        <P muted>Find water, bike repair shops and dangers other riders reported, within 3 km of where you are.</P>
        {near ? (
          <TileMap
            center={near}
            zoom={14}
            height={240}
            controls
            markers={[{ key: 'me', lat: near.lat, lon: near.lon, color: '#173B32', label: 'You' }, ...placeMarkers(near.places, near.hazards)]}
          />
        ) : null}
        {near ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
            {[
              ['#1D6FD1', 'Water'],
              ['#D9730D', 'Bike shop'],
              ['#C2362B', 'Danger'],
            ].map(([colour, label]) => (
              <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colour }} />
                <Text style={{ color: t.muted, fontSize: 14 }}>{label}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {problem ? (
          <Text accessibilityRole="alert" style={{ color: t.danger, fontSize: 15 }}>
            {problem}
          </Text>
        ) : null}
        <Button label={busy ? 'Looking…' : near ? 'Look again' : 'Find what is around me'} icon="locate" disabled={busy} onPress={lookAround} />
        {near && !busy ? <PlaceList places={near.places} hazards={near.hazards} limit={5} /> : null}

        {near && signedIn ? (
          reporting ? (
            <View style={{ gap: space.sm }}>
              <H2>What is the danger here?</H2>
              <Choices options={DANGERS.map((d) => d.label)} value={kind} onChange={setKind} />
              <Field label="A few words to help other riders (you can leave this empty)" value={note} onChangeText={setNote} placeholder="For example: deep hole next to the bridge" maxLength={200} />
              <Button label="Send report" icon="send" onPress={sendReport} />
              <Button label="Cancel" kind="plain" onPress={() => setReporting(false)} />
            </View>
          ) : (
            <Button label="Report a danger where I am" icon="warning-outline" kind="plain" onPress={() => setReporting(true)} />
          )
        ) : null}
        {near && !signedIn ? <P muted style={{ fontSize: 14 }}>Sign in (Me, then Settings) to see and report dangers.</P> : null}
      </Card>

      <View style={{ gap: space.md }}>
        <H2>Routes</H2>
        <Choices options={['Popular', 'My routes']} value={tab} onChange={setTab} />
        {tab === 'My routes' ? (
          mine.length === 0 ? (
            <Card>
              <P muted>No routes kept yet. Open one of your rides and press "Keep as a route to ride again".</P>
            </Card>
          ) : (
            mine.map((r) => <RouteRow key={r.id} to={`/route/local-${r.id}`} name={r.name} distanceM={r.distanceM} elevGainM={r.elevGainM} units={units} />)
          )
        ) : !hasBackend ? (
          <Card>
            <P muted>Routes shared by other riders will show here once the community is switched on.</P>
          </Card>
        ) : !signedIn ? (
          <Card>
            <P muted>Sign in (Me, then Settings) to see routes other riders have shared.</P>
          </Card>
        ) : shared.error ? (
          <Card>
            <P muted>{shared.error}</P>
            <Button label="Try again" kind="plain" onPress={shared.reload} />
          </Card>
        ) : shared.loading && !shared.data ? (
          <P muted>Loading routes…</P>
        ) : (shared.data ?? []).length === 0 ? (
          <Card>
            <P muted>Nobody has shared a route yet. Be the first: keep one of your rides as a route, then share it.</P>
          </Card>
        ) : (
          (shared.data ?? []).map((r) => (
            <RouteRow key={r.id} to={`/route/${r.id}`} name={r.name} by={r.rider} distanceM={r.distance_m} elevGainM={r.elev_gain_m} saves={r.saves} units={units} />
          ))
        )}
      </View>
    </Screen>
  );
}
