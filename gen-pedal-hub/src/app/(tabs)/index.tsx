import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RideRow } from '@/components/ride-row';
import { Avatar, Bar, Button, Card, H2, Hero, P, Ring, Screen, Shortcut } from '@/components/ui';
import { rideCalories } from '@/lib/calories';
import { distValue, fmtDist, fmtHours } from '@/lib/format';
import { monthChallenges, monthName } from '@/lib/challenges';
import { bikeChecks, streakWeeks, weekOf, weekStart } from '@/lib/stats';
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

  const since = weekStart(now);
  const weekKcal = rides.filter((r) => r.startedAt >= since).reduce((n, r) => n + rideCalories(r, profile.weightKg), 0);
  const activeDays = week.days.filter((m) => m > 0).length;

  return (
    <Screen>
      <View style={styles.header}>
        <Avatar name={profile.name} />
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={[styles.name, { color: t.text }]} numberOfLines={1}>
            Hi, {profile.name || 'Rider'}!
          </Text>
          <Text style={{ color: t.muted, fontSize: 15 }}>Let's ride today.</Text>
        </View>
        {streak > 0 ? (
          <View style={[styles.pill, { backgroundColor: t.soft, borderColor: t.line }]}>
            <Ionicons name="flame" size={16} color={t.warn} />
            <Text style={{ color: t.text, fontWeight: '700', fontSize: 14 }}>
              {streak} wk{streak === 1 ? '' : 's'}
            </Text>
          </View>
        ) : null}
      </View>

      <Hero>
        <View style={styles.rowBetween}>
          <View style={styles.heroTag}>
            <Ionicons name={rec.status !== 'idle' ? 'radio-button-on' : 'calendar'} size={16} color="#FFFFFF" />
            <Text style={styles.heroTagText}>{rec.status !== 'idle' ? 'Live ride' : today ? "Today's training" : 'This week'}</Text>
          </View>
          <Text style={styles.heroTagText}>{new Date(now).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
        </View>
        <Text style={styles.heroTitle} numberOfLines={2}>
          {rec.status === 'recording' ? 'Ride in progress' : rec.status === 'paused' ? 'Ride paused' : today ? today.workout.title : 'Ready to ride?'}
        </Text>
        <Text style={styles.heroSub}>
          {fmtDist(week.distanceM, units)} of {distValue(goalM, units).toFixed(0)} {units} this week
          {today && today.workout.minutes > 0 && rec.status === 'idle' ? ` · ${today.workout.minutes} min today` : ''}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={rec.status === 'idle' ? 'Start a ride' : 'Open my ride'}
          onPress={() => router.push('/record')}
          style={({ pressed }) => [styles.heroButton, { opacity: pressed ? 0.85 : 1 }]}>
          <Ionicons name={rec.status === 'idle' ? 'bicycle' : 'chevron-forward'} size={24} color={t.brand} />
          <Text style={[styles.heroButtonText, { color: t.brand }]}>{rec.status === 'idle' ? 'Start a ride' : rec.status === 'recording' ? 'Open my ride' : 'Carry on'}</Text>
        </Pressable>
      </Hero>

      <View style={styles.grid}>
        <Shortcut icon="map" label="Routes" onPress={() => router.push('/explore')} />
        <Shortcut icon="calendar" label="Training" onPress={() => router.push('/training')} />
        <Shortcut icon="stats-chart" label="Stats" onPress={() => router.push('/progress')} />
        <Shortcut icon="people" label="Community" onPress={() => router.push('/community')} />
      </View>

      <View style={{ gap: space.md }}>
        <View style={styles.rowBetween}>
          <H2>Your stats this week</H2>
          <Pressable accessibilityRole="button" accessibilityLabel="See all my stats" hitSlop={10} onPress={() => router.push('/progress')} style={styles.seeAll}>
            <Text style={{ color: t.accentText, fontSize: 15, fontWeight: '700' }}>See all</Text>
            <Ionicons name="chevron-forward" size={16} color={t.accentText} />
          </Pressable>
        </View>
        <View style={styles.grid}>
          <Ring fraction={goalM > 0 ? week.distanceM / goalM : 0} color={t.good} icon="speedometer" value={`${fmtDist(week.distanceM, units)} ${units}`} label="Distance" />
          <Ring fraction={activeDays / 7} color={t.brandLight} icon="stopwatch" value={fmtHours(week.movingMs)} label="Ride time" />
          <Ring fraction={week.rides > 0 ? 1 : 0} color={t.warn} icon="flame" value={Math.round(weekKcal).toLocaleString('en-GB')} label="Calories" />
        </View>
      </View>

      <View style={{ gap: space.md }}>
        <H2>Quick tools</H2>
        <View style={styles.grid}>
          <Shortcut icon="construct" label="Bike care" color={due.length > 0 ? t.warn : undefined} onPress={() => router.push('/garage')} />
          <Shortcut icon="trophy" label="Challenges" color={t.warn} onPress={() => router.push('/challenges')} />
          <Shortcut icon="ribbon" label="Badges" onPress={() => router.push('/badges')} />
          <Shortcut icon="medkit" label="SOS setup" color={t.danger} onPress={() => router.push('/settings')} />
        </View>
      </View>

      <Card>
        <H2>This week, day by day</H2>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  name: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  grid: { flexDirection: 'row', gap: space.sm },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  heroTag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroTagText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  heroTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  heroSub: { color: '#FFFFFF', fontSize: 15, opacity: 0.92 },
  heroButton: { alignSelf: 'flex-start', minHeight: 52, borderRadius: radius.pill, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.xl, marginTop: space.xs },
  heroButtonText: { fontSize: 18, fontWeight: '800' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: { borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  days: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  day: { flex: 1, alignItems: 'center', gap: 4 },
  dayBarBox: { height: 56, width: '100%', justifyContent: 'flex-end' },
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
