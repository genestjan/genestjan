import { Text, View } from 'react-native';

import { MenuRow } from '@/components/menu-row';
import { Avatar, Card, Screen } from '@/components/ui';
import { hasBackend, useSession } from '@/backend';
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
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <Avatar name={profile.name} size={104} />
        <Text accessibilityRole="header" style={{ color: t.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginTop: space.sm }}>
          {profile.name || 'Rider'}
        </Text>
        <Text style={{ color: t.muted, fontSize: 15, textAlign: 'center' }}>
          {[profile.city, `${profile.bikeKind} bike`, profile.level].filter(Boolean).join(' · ')}
        </Text>
      </View>

      <Card style={{ flexDirection: 'row', gap: 0, paddingHorizontal: space.sm }}>
        {[
          [fmtDist(all.distanceM, profile.units), `${profile.units} in total`],
          [fmtHours(all.movingMs), 'riding time'],
          [String(all.rides), all.rides === 1 ? 'ride' : 'rides'],
          [String(earned), earned === 1 ? 'badge' : 'badges'],
        ].map(([value, label], i) => (
          <View key={label} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i ? 1 : 0, borderLeftColor: t.line }}>
            <Text style={{ color: t.text, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] }} numberOfLines={1} adjustsFontSizeToFit>
              {value}
            </Text>
            <Text style={{ color: t.muted, fontSize: 13 }} numberOfLines={1}>
              {label}
            </Text>
          </View>
        ))}
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
