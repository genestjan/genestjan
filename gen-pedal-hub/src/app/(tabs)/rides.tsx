import { useRouter } from 'expo-router';

import { RideRow } from '@/components/ride-row';
import { Button, Card, P, Screen, Stat } from '@/components/ui';
import { fmtDist, fmtHours } from '@/lib/format';
import { totals } from '@/lib/stats';
import { useStore } from '@/store';

export default function Rides() {
  const router = useRouter();
  const rides = useStore((s) => s.rides);
  const units = useStore((s) => s.profile.units);
  const all = totals(rides);

  return (
    <Screen title="My rides">
      {rides.length === 0 ? (
        <Card>
          <P>You have not recorded a ride yet.</P>
          <P muted>Press the button below when you are on your bike. Every ride you finish is saved here.</P>
          <Button label="Start a ride" icon="bicycle" kind="accent" onPress={() => router.push('/record')} />
        </Card>
      ) : (
        <>
          <Card style={{ flexDirection: 'row' }}>
            <Stat value={fmtDist(all.distanceM, units)} unit={units} label="in total" />
            <Stat value={String(all.rides)} label={all.rides === 1 ? 'ride' : 'rides'} />
            <Stat value={fmtHours(all.movingMs)} label="riding time" />
          </Card>
          {rides.map((r) => (
            <RideRow key={r.id} ride={r} units={units} />
          ))}
        </>
      )}
    </Screen>
  );
}
