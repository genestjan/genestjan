import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BarChart } from '@/components/bar-chart';
import { BackTitle, Card, Choices, H2, P, Screen, Stat } from '@/components/ui';
import { change, metricValue, monthlySeries, records, weeklySeries, type Metric } from '@/lib/analytics';
import { totalCalories } from '@/lib/calories';
import { fmtDate, fmtDist, fmtHours, fmtSpeed, speedUnit } from '@/lib/format';
import { weekStart } from '@/lib/stats';
import { useStore } from '@/store';
import { space, useTheme } from '@/theme';
import type { Ride, Units } from '@/types';

const METRICS: { name: string; key: Metric }[] = [
  { name: 'Distance', key: 'distance' },
  { name: 'Time', key: 'time' },
  { name: 'Climbing', key: 'climb' },
  { name: 'Speed', key: 'speed' },
];

function fmtMetric(v: number, m: Metric, units: Units): string {
  switch (m) {
    case 'distance':
      return `${fmtDist(v, units)} ${units}`;
    case 'time':
      return fmtHours(v);
    case 'climb':
      return `${Math.round(v)} m`;
    case 'speed':
      return `${fmtSpeed(v, units)} ${speedUnit(units)}`;
  }
}

/** Words for "more" and "less" of each thing, so the sentence reads naturally. */
const WORDS: Record<Metric, { up: string; down: string; verb: string }> = {
  distance: { up: 'further', down: 'less far', verb: 'You rode' },
  time: { up: 'longer', down: 'less time', verb: 'You rode for' },
  climb: { up: 'more climbing', down: 'less climbing', verb: 'You did' },
  speed: { up: 'faster', down: 'slower', verb: 'You rode' },
};

function compareSentence(pct: number | null, m: Metric): string {
  if (pct === null) return 'Ride for a few more weeks to see how you compare.';
  const p = Math.round(Math.abs(pct));
  if (p === 0) return 'You rode about the same as the 4 weeks before.';
  const w = WORDS[m];
  return `${w.verb} ${p}% ${pct > 0 ? w.up : w.down} than the 4 weeks before.`;
}

export default function Progress() {
  const t = useTheme();
  const rides = useStore((s) => s.rides);
  const profile = useStore((s) => s.profile);
  const units = profile.units;
  const [pick, setPick] = useState('Distance');
  const metric = METRICS.find((x) => x.name === pick)?.key ?? 'distance';

  const data = useMemo(() => {
    const now = Date.now();
    const d = new Date(now);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const thisWeek = weekStart(now);
    return {
      weeks: weeklySeries(rides, now, 12),
      months: monthlySeries(rides, now, 6),
      rec: records(rides),
      calWeek: totalCalories(rides.filter((r) => r.startedAt >= thisWeek && r.startedAt <= now), profile.weightKg),
      calMonth: totalCalories(rides.filter((r) => r.startedAt >= monthStart && r.startedAt <= now), profile.weightKg),
      calAll: totalCalories(rides, profile.weightKg),
    };
  }, [rides, profile.weightKg]);

  const fmt = (v: number) => fmtMetric(v, metric, units);
  const diff = change(data.weeks, metric);

  const recordRows: { label: string; ride: Ride | null; value: (r: Ride) => string }[] = [
    { label: 'Longest ride', ride: data.rec.longest, value: (r) => fmtMetric(r.distanceM, 'distance', units) },
    { label: 'Most climbing', ride: data.rec.mostClimb, value: (r) => fmtMetric(r.elevGainM, 'climb', units) },
    {
      label: 'Fastest average',
      ride: data.rec.fastest,
      value: (r) => fmtMetric(r.movingMs > 0 ? (r.distanceM / r.movingMs) * 1000 : 0, 'speed', units),
    },
    { label: 'Longest time', ride: data.rec.longestTime, value: (r) => fmtHours(r.movingMs) },
  ];

  return (
    <Screen>
      <BackTitle title="My progress" />

      <Choices options={METRICS.map((x) => x.name)} value={pick} onChange={setPick} />

      <Card>
        <H2>Last 12 weeks</H2>
        <BarChart
          values={data.weeks.map((b) => metricValue(b, metric))}
          labels={data.weeks.map((b) => b.label)}
          format={fmt}
        />
        <P>{compareSentence(diff.pct, metric)}</P>
      </Card>

      <Card>
        <H2>Last 6 months</H2>
        <BarChart
          values={data.months.map((b) => metricValue(b, metric))}
          labels={data.months.map((b) => b.label)}
          format={fmt}
        />
      </Card>

      <Card>
        <H2>Calories</H2>
        <View style={styles.row}>
          <Stat value={data.calWeek.toLocaleString('en-GB')} unit="kcal" label="This week" />
          <Stat value={data.calMonth.toLocaleString('en-GB')} unit="kcal" label="This month" />
          <Stat value={data.calAll.toLocaleString('en-GB')} unit="kcal" label="All time" />
        </View>
        <P muted>
          This is a guess. It uses how fast you rode, for how long, and your body weight ({profile.weightKg} kg).
        </P>
      </Card>

      <Card>
        <H2>My records</H2>
        {rides.length === 0 ? (
          <P muted>No rides yet. Go for a ride and your best ones will show up here.</P>
        ) : (
          recordRows.map((row) => (
            <View key={row.label} style={styles.record}>
              <View style={styles.recordText}>
                <Text style={[styles.recordLabel, { color: t.text }]}>{row.label}</Text>
                <Text style={[styles.recordDate, { color: t.muted }]}>
                  {row.ride ? fmtDate(row.ride.startedAt) : row.label === 'Fastest average' ? 'Ride 5 km or more to get this one' : 'Not yet'}
                </Text>
              </View>
              {row.ride ? <Text style={[styles.recordValue, { color: t.text }]}>{row.value(row.ride)}</Text> : null}
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md },
  record: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  recordText: { flex: 1, gap: 2 },
  recordLabel: { fontSize: 16, fontWeight: '600' },
  recordDate: { fontSize: 14 },
  recordValue: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
