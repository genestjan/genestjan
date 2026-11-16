import { Text, View } from 'react-native';

import { MenuRow } from '@/components/menu-row';
import { Card, Screen, Stat } from '@/components/ui';
import { hasBackend, useSession } from '@/backend';
import { totalCalories } from '@/lib/calories';
import { fmtDist, fmtHours } from '@/lib/format';
import { badges, bikeChecks, totals } from '@/lib/stats';
import { getPlan } from '@/lib/training';
import { useStore } from '@/store';
import { space, useTheme } from '@/theme';

export default function Me() {
  const t = useTheme();
  const profile = useStore((s) => s.profile);
  const rides = useStore((s) => s.rides);
  const bikes = useStore((s) => s.bikes);
  const training = useStore((s) => s.training);
  const session = useSession();
  const all = totals(rides);
  const earned = badges(rides, Date.now()).filter((b) => b.earned).length;
  const due = bikes.reduce((n, b) => n + bikeChecks(b, rides).filter((c) => c.due).length, 0);
  const plan = getPlan(training.planId);

  return (
    <Screen>
      <View>
        <Text accessibilityRole="header" style={{ color: t.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 }}>
          {profile.name || 'Rider'}
        </Text>
        <Text style={{ color: t.muted, fontSize: 16 }}>
          {[profile.city, `${profile.bikeKind} bike`, profile.level].filter(Boolean).join(' · ')}
        </Text>
      </View>

      <Card style={{ gap: space.lg }}>
        <View style={{ flexDirection: 'row' }}>
          <Stat value={fmtDist(all.distanceM, profile.units)} unit={profile.units} label="in total" />
          <Stat value={String(all.rides)} label={all.rides === 1 ? 'ride' : 'rides'} />
        </View>
        <View style={{ flexDirection: 'row' }}>
          <Stat value={fmtHours(all.movingMs)} label="riding time" />
          <Stat value={totalCalories(rides, profile.weightKg).toLocaleString('en-GB')} unit="kcal" label="burned (estimate)" />
        </View>
      </Card>

      <View style={{ gap: space.sm }}>
        <MenuRow icon="list" title="My rides" hint="Every ride you have recorded" to="/rides" />
        <MenuRow icon="stats-chart" title="My progress" hint="Charts, calories and records" to="/progress" />
        <MenuRow icon="calendar" title="Training plan" hint={plan ? `You are on: ${plan.name}` : 'Pick a plan and get a workout each day'} to="/training" />
        <MenuRow icon="flag" title="This month's challenges" hint="Small targets to keep you riding" to="/challenges" />
        <MenuRow icon="ribbon" title="Badges" hint={`${earned} earned so far`} to="/badges" />
        <MenuRow icon="construct" title="My bikes" hint="Distance, care and repairs" to="/garage" badge={due > 0 ? `${due} due` : undefined} />
        <MenuRow
          icon="settings"
          title="Settings"
          hint={hasBackend ? (session.userId ? 'Signed in' : 'Not signed in') : 'Your details, reminders and safety'}
          to="/settings"
        />
      </View>
    </Screen>
  );
}
