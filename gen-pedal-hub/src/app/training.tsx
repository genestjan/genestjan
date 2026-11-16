import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BackTitle, Bar, Button, Card, Choices, H2, P, Screen } from '@/components/ui';
import { confirm } from '@/lib/confirm';
import { fmtDist } from '@/lib/format';
import { PLANS, dayIndexAt, getPlan, isDone, planProgress, planStart } from '@/lib/training';
import { setTraining, updateProfile, useStore } from '@/store';
import { space, useTheme } from '@/theme';
import type { Units } from '@/types';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const WEEKLY = [20, 30, 50, 75, 100, 150, 200];
const MONTHLY = [80, 120, 200, 300, 400, 600, 800];

const unitLabel = (u: Units) => (u === 'mi' ? 'miles' : 'km');
const dist = (km: number, u: Units) => fmtDist(km * 1000, u);

export default function Training() {
  const t = useTheme();
  const training = useStore((s) => s.training);
  const rides = useStore((s) => s.rides);
  const profile = useStore((s) => s.profile);
  const units = profile.units;
  const now = Date.now();
  const plan = getPlan(training.planId);

  const toggle = (i: number) => {
    const done = { ...training.done };
    if (done[i]) delete done[i];
    else done[i] = true;
    setTraining({ done });
  };

  const stop = async () => {
    if (await confirm('Stop this plan?', 'Your plan and its ticks will be cleared. Your rides are kept.', 'Stop', true)) {
      setTraining({ planId: null, startedAt: 0, done: {} });
    }
  };

  const goals = (
    <Card>
      <H2>My goals</H2>
      <P muted>How far do you want to ride each week? (in km)</P>
      <Choices
        options={WEEKLY.map(String)}
        value={String(profile.weeklyGoalKm)}
        onChange={(v) => updateProfile({ weeklyGoalKm: Number(v) })}
      />
      <P muted>And each month? (in km)</P>
      <Choices
        options={MONTHLY.map(String)}
        value={String(profile.monthlyGoalKm)}
        onChange={(v) => updateProfile({ monthlyGoalKm: Number(v) })}
      />
    </Card>
  );

  if (!plan) {
    return (
      <Screen>
        <BackTitle title="Training plan" />
        <P muted>A plan tells you what to ride each day for 8 weeks. Pick the one that sounds most like you.</P>
        {PLANS.map((p) => (
          <Card key={p.id}>
            <H2>{p.name}</H2>
            <P>{p.forWho}</P>
            <P muted>
              {p.weeks} weeks. First week: {dist(p.weeklyKm[0], units)} {unitLabel(units)}.
            </P>
            <Button
              label="Start this plan"
              icon="play"
              onPress={() => setTraining({ planId: p.id, startedAt: planStart(Date.now()), done: {} })}
            />
          </Card>
        ))}
        {goals}
      </Screen>
    );
  }

  const today = dayIndexAt(training, now);
  const progress = planProgress(plan, training, rides, now);
  const weekFirst = progress.weekIndex * 7;
  const todayW = progress.finished ? null : plan.days[today];
  const todayDone = todayW ? isDone(plan, training, rides, today, now) : false;

  return (
    <Screen>
      <BackTitle title="Training plan" />

      {progress.finished || !todayW ? (
        <Card>
          <H2>You finished the plan!</H2>
          <P>Well done. You rode {progress.doneWorkouts} of {progress.totalWorkouts} rides. You can stop this plan and pick a new one.</P>
        </Card>
      ) : (
        <Card>
          <View style={styles.row}>
            <H2>Today</H2>
            <View style={styles.tickRow}>
              <Ionicons
                name={todayDone ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={todayDone ? t.accentText : t.muted}
              />
              <Text style={{ color: todayDone ? t.accentText : t.muted, fontSize: 15, fontWeight: '700' }}>
                {todayDone ? 'Done' : 'Not done yet'}
              </Text>
            </View>
          </View>
          <Text style={[styles.big, { color: t.text }]}>
            {todayW.title}
            {todayW.minutes > 0 ? <Text style={{ color: t.muted }}> · {todayW.minutes} min</Text> : null}
          </Text>
          <P>{todayW.how}</P>
          {todayW.kind === 'rest' ? <P muted>Resting is part of the plan. It helps you get stronger.</P> : null}
          <Button
            label={training.done[today] ? 'Untick today' : todayW.kind === 'rest' ? 'I rested today' : 'I did this ride'}
            icon={training.done[today] ? 'close' : 'checkmark'}
            kind="plain"
            onPress={() => toggle(today)}
          />
        </Card>
      )}

      <Card>
        <H2>This week</H2>
        {plan.days.slice(weekFirst, weekFirst + 7).map((w, k) => {
          const i = weekFirst + k;
          const done = isDone(plan, training, rides, i, now);
          const canTick = i <= today;
          return (
            <Pressable
              key={i}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: done, disabled: !canTick }}
              accessibilityLabel={`${DAY_NAMES[k]}: ${w.title}${w.minutes ? `, ${w.minutes} minutes` : ''}. ${done ? 'Done' : 'Not done'}`}
              disabled={!canTick}
              onPress={() => toggle(i)}
              style={({ pressed }) => [
                styles.day,
                { borderColor: t.line, backgroundColor: i === today ? t.soft : 'transparent', opacity: pressed ? 0.7 : 1 },
              ]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontSize: 16, fontWeight: '700' }}>{DAY_NAMES[k]}</Text>
                <Text style={{ color: t.muted, fontSize: 15 }}>
                  {w.title}
                  {w.minutes ? ` · ${w.minutes} min` : ''}
                </Text>
              </View>
              <Ionicons
                name={done ? 'checkmark-circle' : 'ellipse-outline'}
                size={28}
                color={done ? t.accentText : canTick ? t.muted : t.line}
              />
            </Pressable>
          );
        })}
        <P muted>Tap a day to tick it off by hand. Rides you record tick themselves.</P>
      </Card>

      <Card>
        <H2>Distance this week</H2>
        <Bar fraction={progress.weekKmTarget > 0 ? progress.weekKmDone / progress.weekKmTarget : 0} />
        <P>
          {dist(progress.weekKmDone, units)} of {dist(progress.weekKmTarget, units)} {unitLabel(units)}
        </P>
      </Card>

      <Card>
        <H2>
          Week {progress.weekIndex + 1} of {plan.weeks}
        </H2>
        <Bar fraction={progress.finished ? 1 : (today + 1) / plan.days.length} />
        <P muted>
          {plan.name}. You have done {progress.doneWorkouts} of {progress.totalWorkouts} rides.
        </P>
      </Card>

      <Card>
        <H2>Rest day reminders</H2>
        <P muted>Get a reminder on rest days to take it easy.</P>
        <Choices
          options={['On', 'Off']}
          value={profile.restDayReminders ? 'On' : 'Off'}
          onChange={(v) => updateProfile({ restDayReminders: v === 'On' })}
        />
      </Card>

      {goals}

      <Button label="Stop this plan" icon="stop" kind="danger" onPress={stop} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  tickRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  big: { fontSize: 22, fontWeight: '800' },
  day: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: 12,
    borderWidth: 1,
  },
});
