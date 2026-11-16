import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RideRow } from '@/components/ride-row';
import { Bar, Button, Card, H2, P, Screen, Stat } from '@/components/ui';
import { distValue, fmtDist, fmtHours } from '@/lib/format';
import { monthChallenges, monthName } from '@/lib/challenges';
import { bikeChecks, streakWeeks, weekOf } from '@/lib/stats';
import { todayWorkout } from '@/lib/training';
import { useRecorder } from '@/recorder';
import { useStore } from '@/store';
import { radius, space, useTheme } from '@/theme';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function Home() {
  const t = useTheme();
  const router = useRouter();
  const profile = useStore((s) => s.profile);
  const rides = useStore((s) => s.rides);
  const bikes = useStore((s) => s.bikes);
  const training = useStore((s) => s.training);
  const rec = useRecorder();
  const loaded = useStore((s) => s.loaded);

  const now = Date.now();
  const week = weekOf(rides, now);
  const streak = streakWeeks(rides, now);
  const units = profile.units;
  const goalM = profile.weeklyGoalKm * 1000;
  const leftM = Math.max(0, goalM - week.distanceM);
  const weekday = (new Date(now).getDay() + 6) % 7;
  const maxDay = Math.max(...week.days, 1);
  const due = bikes.flatMap((b) => bikeChecks(b, rides).filter((c) => c.due).map((c) => ({ bike: b.name, ...c })));

  // The greeting and dates depend on the clock, so wait until the app has started.
  if (!loaded) return <Screen>{null}</Screen>;

  const today = todayWorkout(training, rides, now);
  const month = monthChallenges(rides, profile.monthlyGoalKm, now);
  const monthDone = month.filter((c) => c.done).length;

  const hour = new Date(now).getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <Screen>
      <View>
        <Text style={{ color: t.muted, fontSize: 16 }}>{hello}</Text>
        <Text accessibilityRole="header" style={[styles.name, { color: t.text }]}>
          {profile.name || 'Rider'}
        </Text>
      </View>

      {rec.status !== 'idle' ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/record')}
          style={[styles.live, { backgroundColor: t.accent }]}>
          <Ionicons name="radio-button-on" size={22} color={t.onAccent} />
          <Text style={[styles.liveText, { color: t.onAccent }]}>
            {rec.status === 'recording' ? 'Ride in progress. Tap to open.' : 'Ride paused. Tap to carry on.'}
          </Text>
        </Pressable>
      ) : (
        <Button label="Start a ride" icon="bicycle" kind="accent" big onPress={() => router.push('/record')} />
      )}

      <Card>
        <View style={styles.rowBetween}>
          <H2>This week</H2>
          {streak > 0 ? (
            <View style={[styles.pill, { backgroundColor: t.soft }]}>
              <Ionicons name="flame" size={16} color={t.warn} />
              <Text style={{ color: t.text, fontWeight: '700', fontSize: 14 }}>
                {streak} week{streak === 1 ? '' : 's'} in a row
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={[styles.bigNumber, { color: t.text }]}>
          {fmtDist(week.distanceM, units)}
          <Text style={[styles.bigUnit, { color: t.muted }]}>
            {' '}
            of {distValue(goalM, units).toFixed(0)} {units}
          </Text>
        </Text>
        <Bar fraction={goalM > 0 ? week.distanceM / goalM : 0} />
        <P muted style={{ fontSize: 15 }}>
          {week.rides === 0
            ? 'No rides yet this week. A short one counts.'
            : leftM > 0
              ? `${fmtDist(leftM, units)} ${units} to go to reach your weekly goal.`
              : 'Weekly goal reached. Well done.'}
        </P>

        <View style={styles.days}>
          {week.days.map((m, i) => (
            <View key={i} style={styles.day}>
              <View style={styles.dayBarBox}>
                <View
                  style={{
                    width: '100%',
                    borderRadius: 6,
                    height: m > 0 ? Math.max(8, (m / maxDay) * 56) : 4,
                    backgroundColor: m > 0 ? t.accent : t.soft,
                  }}
                />
              </View>
              <Text style={{ fontSize: 13, color: i === weekday ? t.text : t.muted, fontWeight: i === weekday ? '800' : '500' }}>
                {DAY_LETTERS[i]}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.statsRow}>
          <Stat value={String(week.rides)} label={week.rides === 1 ? 'ride' : 'rides'} />
          <Stat value={fmtHours(week.movingMs)} label="riding time" />
        </View>
      </Card>

      {today ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Open my training plan" onPress={() => router.push('/training')}>
          <Card>
            <View style={styles.dueRow}>
              <Ionicons name={today.workout.kind === 'rest' ? 'bed' : today.done ? 'checkmark-circle' : 'calendar'} size={24} color={t.accentText} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.muted, fontSize: 14, fontWeight: '600' }}>Today's training</Text>
                <Text style={{ color: t.text, fontSize: 17, fontWeight: '700' }}>
                  {today.workout.title}
                  {today.workout.minutes > 0 ? ` · ${today.workout.minutes} min` : ''}
                </Text>
                <Text style={{ color: t.muted, fontSize: 15 }}>
                  {today.workout.kind === 'rest' ? 'No ride planned. Resting is part of the plan.' : today.done ? 'Done. Nice work.' : today.workout.how}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={t.muted} />
            </View>
          </Card>
        </Pressable>
      ) : null}

      <Pressable accessibilityRole="button" accessibilityLabel="Open this month's challenges" onPress={() => router.push('/challenges')}>
        <Card>
          <View style={styles.rowBetween}>
            <H2>{monthName(now)} challenges</H2>
            <Text style={{ color: t.muted, fontSize: 15, fontWeight: '600' }}>
              {monthDone} of {month.length} done
            </Text>
          </View>
          <Text style={{ color: t.text, fontSize: 16 }}>{month[0].title}</Text>
          <Bar fraction={month[0].value / month[0].target} />
          <Text style={{ color: t.muted, fontSize: 15 }}>
            {month[0].done ? 'Done. Tap to see the others.' : `${month[0].value.toFixed(1)} of ${month[0].target} km. Tap to see all four.`}
          </Text>
        </Card>
      </Pressable>

      {due.length > 0 ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/garage')}>
          <Card style={{ borderColor: t.warn }}>
            <View style={styles.dueRow}>
              <Ionicons name="construct" size={22} color={t.warn} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontSize: 16, fontWeight: '700' }}>Bike care due</Text>
                <Text style={{ color: t.muted, fontSize: 15 }}>
                  {due[0].title} ({due[0].bike}){due.length > 1 ? ` and ${due.length - 1} more` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={t.muted} />
            </View>
          </Card>
        </Pressable>
      ) : null}

      <View style={{ gap: space.md }}>
        <H2>Latest rides</H2>
        {rides.length === 0 ? (
          <Card>
            <P muted>Your rides will show here. Press Start a ride when you are on your bike.</P>
          </Card>
        ) : (
          rides.slice(0, 3).map((r) => <RideRow key={r.id} ride={r} units={units} />)
        )}
        {rides.length > 3 ? <Button label="See all my rides" kind="plain" onPress={() => router.push('/rides')} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  bigNumber: { fontSize: 44, fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  bigUnit: { fontSize: 17, fontWeight: '600', letterSpacing: 0 },
  days: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  day: { flex: 1, alignItems: 'center', gap: 4 },
  dayBarBox: { height: 56, width: '100%', justifyContent: 'flex-end' },
  statsRow: { flexDirection: 'row', gap: space.lg },
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  live: { minHeight: 68, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingHorizontal: space.xl },
  liveText: { fontSize: 18, fontWeight: '700' },
});
