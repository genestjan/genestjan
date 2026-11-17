import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { addPost, hasBackend, removeUploadedRide, useSession } from '@/backend';
import { TileMap } from '@/components/tile-map';
import { Button, Card, Choices, Field, H2, P, Screen, Stat } from '@/components/ui';
import { rideCalories } from '@/lib/calories';
import { confirm, notify } from '@/lib/confirm';
import { difficulty } from '@/lib/difficulty';
import { fmtDate, fmtDist, fmtHours, fmtSpeed, fmtTime, speedUnit } from '@/lib/format';
import { toGpx } from '@/lib/gpx';
import { bests } from '@/lib/stats';
import { deleteRide, loadPoints, saveRoute, updateRide, useStore } from '@/store';
import { radius, space, useTheme } from '@/theme';
import type { Point } from '@/types';

export default function RideDetail() {
  const t = useTheme();
  const router = useRouter();
  const { id, done } = useLocalSearchParams<{ id: string; done?: string }>();
  const ride = useStore((s) => s.rides.find((r) => r.id === id));
  const rides = useStore((s) => s.rides);
  const bikes = useStore((s) => s.bikes);
  const units = useStore((s) => s.profile.units);
  const weightKg = useStore((s) => s.profile.weightKg);
  const session = useSession();
  const [points, setPoints] = useState<Point[]>([]);

  useEffect(() => {
    if (id) loadPoints(id).then(setPoints);
  }, [id]);

  const back = () => (router.canGoBack() && !done ? router.back() : router.replace('/'));

  if (!ride) {
    return (
      <Screen title="Ride">
        <P muted>This ride could not be found.</P>
        <Button label="Back to home" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  const avgMs = ride.movingMs > 0 ? ride.distanceM / (ride.movingMs / 1000) : 0;
  const best = bests(ride, rides);
  const bikeNames = ['No bike', ...bikes.map((b) => b.name)];
  const bikeName = bikes.find((b) => b.id === ride.bikeId)?.name ?? 'No bike';

  const share = async () => {
    const text = `${ride.title}: ${fmtDist(ride.distanceM, units)} ${units} in ${fmtHours(ride.movingMs)}, recorded with GenRide.`;
    if (Platform.OS === 'web') {
      // In the browser, save the route as a GPX file other apps can open.
      const url = URL.createObjectURL(new Blob([toGpx(ride, points)], { type: 'application/gpx+xml' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `ride-${new Date(ride.startedAt).toISOString().slice(0, 10)}.gpx`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      await Share.share({ message: text }).catch(() => {});
    }
  };

  return (
    <Screen>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} onPress={back} style={[styles.back, { backgroundColor: t.card, borderColor: t.line }]}>
          <Ionicons name={done ? 'close' : 'chevron-back'} size={24} color={t.text} />
        </Pressable>
        <Text style={{ color: t.muted, fontSize: 15, flex: 1 }}>
          {fmtDate(ride.startedAt)} · {fmtTime(ride.startedAt)}
        </Text>
      </View>

      {done ? (
        <View style={[styles.done, { backgroundColor: t.soft }]}>
          <Ionicons name="checkmark-circle" size={26} color={t.accentText} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontSize: 18, fontWeight: '800' }}>Ride saved. Nice work.</Text>
            {best.length > 0 ? <Text style={{ color: t.text, fontSize: 15 }}>{best.join(' · ')}</Text> : null}
          </View>
        </View>
      ) : best.length > 0 ? (
        <View style={[styles.done, { backgroundColor: t.soft }]}>
          <Ionicons name="trophy" size={22} color={t.accentText} />
          <Text style={{ color: t.text, fontSize: 15, fontWeight: '700', flex: 1 }}>{best.join(' · ')}</Text>
        </View>
      ) : null}

      <View>
        <Text style={[styles.dist, { color: t.text }]}>
          {fmtDist(ride.distanceM, units)}
          <Text style={{ fontSize: 22, color: t.muted, fontWeight: '700', letterSpacing: 0 }}> {units}</Text>
        </Text>
      </View>

      {points.length > 1 ? <TileMap points={points} height={240} controls /> : null}

      <Card>
        <View style={styles.statsRow}>
          <Stat value={fmtHours(ride.movingMs)} label="riding time" />
          <Stat value={fmtSpeed(avgMs, units)} unit={speedUnit(units)} label="average speed" />
        </View>
        <View style={styles.statsRow}>
          <Stat value={ride.elevGainM.toFixed(0)} unit="m" label="climbed" />
          <Stat value={fmtSpeed(ride.maxSpeedMs, units)} unit={speedUnit(units)} label="top speed" />
        </View>
        <View style={styles.statsRow}>
          <Stat value={rideCalories(ride, weightKg).toLocaleString('en-GB')} unit="kcal" label="burned (estimate)" />
          <Stat value={difficulty(ride.distanceM, ride.elevGainM)} label="how hard" />
        </View>
      </Card>

      <Card>
        <Field label="Ride name" value={ride.title} onChangeText={(title) => updateRide(ride.id, { title })} />
        {bikes.length > 0 ? (
          <>
            <H2>Which bike?</H2>
            <Choices
              options={bikeNames}
              value={bikeName}
              onChange={(name) => updateRide(ride.id, { bikeId: bikes.find((b) => b.name === name)?.id ?? null })}
            />
          </>
        ) : null}
      </Card>

      {hasBackend && session.userId ? (
        <Button
          label="Post this ride to the community"
          icon="people-outline"
          onPress={async () => {
            try {
              await addPost('', null, ride.id);
              notify('Posted', 'Your ride is now on the community feed.');
            } catch (e) {
              notify('Could not post', e instanceof Error ? e.message : 'Try again.');
            }
          }}
        />
      ) : null}
      {points.length > 1 ? (
        <Button
          label="Keep as a route to ride again"
          icon="bookmark-outline"
          kind="plain"
          onPress={async () => {
            const route = await saveRoute(ride.title, ride.distanceM, ride.elevGainM, points);
            router.push(`/route/local-${route.id}`);
          }}
        />
      ) : null}
      <Button label={Platform.OS === 'web' ? 'Save route file (GPX)' : 'Share this ride'} icon="share-outline" kind="plain" onPress={share} />
      <Button
        label="Delete this ride"
        icon="trash-outline"
        kind="danger"
        onPress={async () => {
          if (await confirm('Delete this ride?', 'This cannot be undone.', 'Delete', true)) {
            removeUploadedRide(ride.id).catch(() => {});
            deleteRide(ride.id);
            router.replace('/rides');
          }
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  back: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  done: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.md },
  dist: { fontSize: 64, fontWeight: '800', letterSpacing: -2, fontVariant: ['tabular-nums'] },
  statsRow: { flexDirection: 'row', gap: space.lg },
});
