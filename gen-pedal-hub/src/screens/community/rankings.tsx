import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import {
  createCompetition,
  loadChallenges,
  loadClubRanking,
  loadRanking,
  setChallengeJoined,
  useSession,
  type Challenge,
  type ChallengeKind,
  type RankMetric,
} from '@/backend';
import { AsyncBox } from '@/components/async-box';
import { RankList } from '@/components/rank-list';
import { Bar, Button, Card, Choices, Field, H2, P } from '@/components/ui';
import { fmtDate } from '@/lib/format';
import { useAsync } from '@/lib/use-async';
import { space, useTheme } from '@/theme';

const METRICS: { label: string; metric: RankMetric; unit: string; digits: number }[] = [
  { label: 'Distance', metric: 'distance', unit: 'km', digits: 1 },
  { label: 'Climbing', metric: 'climb', unit: 'm', digits: 0 },
  { label: 'Speed', metric: 'speed', unit: 'km/h', digits: 1 },
  { label: 'Longest ride', metric: 'longest', unit: 'km', digits: 1 },
];
const KINDS: { label: string; kind: ChallengeKind; unit: string }[] = [
  { label: 'Most distance', kind: 'distance', unit: 'km' },
  { label: 'Most climbing', kind: 'climb', unit: 'm' },
  { label: 'Most rides', kind: 'rides', unit: 'rides' },
];

export const kindUnit = (k: ChallengeKind) => KINDS.find((x) => x.kind === k)?.unit ?? '';
export const fmtValue = (v: number, k: ChallengeKind) => (k === 'distance' ? v.toFixed(1) : String(Math.round(v)));

function ChallengeCard({ c, onChanged }: { c: Challenge; onChanged: () => void }) {
  const t = useTheme();
  const router = useRouter();
  const unit = kindUnit(c.kind);
  const toggle = async () => {
    await setChallengeJoined(c.id, !c.joined).catch(() => {});
    onChanged();
  };
  return (
    <Card style={c.joined ? { borderColor: t.accent } : undefined}>
      <Text style={{ color: t.text, fontSize: 18, fontWeight: '700' }}>{c.title}</Text>
      {c.about ? <Text style={{ color: t.muted, fontSize: 15 }}>{c.about}</Text> : null}
      <Text style={{ color: t.muted, fontSize: 14 }}>
        Ends {fmtDate(new Date(c.ends_at).getTime() - 1000)} · {c.riders} rider{c.riders === 1 ? '' : 's'} in
      </Text>
      {c.joined && c.target > 0 ? (
        <>
          <Bar fraction={c.my_value / c.target} />
          <Text style={{ color: t.text, fontSize: 15 }}>
            {c.my_value >= c.target ? 'Done. Well ridden.' : `${fmtValue(c.my_value, c.kind)} of ${c.target.toLocaleString('en-GB')} ${unit}`}
          </Text>
        </>
      ) : null}
      {c.joined && c.target === 0 ? (
        <Text style={{ color: t.text, fontSize: 15 }}>
          You so far: {fmtValue(c.my_value, c.kind)} {unit}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        <Button label={c.joined ? 'Leave' : 'Join'} icon={c.joined ? undefined : 'add'} kind={c.joined ? 'plain' : 'primary'} onPress={toggle} />
        <Button label="See the ranking" icon="podium-outline" kind="plain" onPress={() => router.push(`/challenge/${c.id}`)} />
      </View>
    </Card>
  );
}

export function Rankings() {
  const t = useTheme();
  const session = useSession();
  const [period, setPeriod] = useState('This week');
  const [metricLabel, setMetricLabel] = useState('Distance');
  const [who, setWho] = useState('Riders');
  const p = period === 'This week' ? 'week' : 'month';
  const m = METRICS.find((x) => x.label === metricLabel) ?? METRICS[0];

  const riders = useAsync(() => loadRanking(p, m.metric), [p, m.metric], who === 'Riders');
  const clubs = useAsync(() => loadClubRanking(p), [p], who === 'Groups');
  const challenges = useAsync(loadChallenges, []);

  const [making, setMaking] = useState(false);
  const [title, setTitle] = useState('');
  const [kindLabel, setKindLabel] = useState('Most distance');
  const [days, setDays] = useState('7 days');
  const [problem, setProblem] = useState<string | null>(null);

  const create = async () => {
    setProblem(null);
    try {
      await createCompetition(title, '', KINDS.find((k) => k.label === kindLabel)?.kind ?? 'distance', parseInt(days, 10));
      setMaking(false);
      setTitle('');
      challenges.reload();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Could not create it.');
    }
  };

  const list = challenges.data ?? [];

  return (
    <View style={{ gap: space.lg }}>
      <View style={{ gap: space.sm }}>
        <H2>Top riders</H2>
        <Choices options={['This week', 'This month']} value={period} onChange={setPeriod} />
        <Choices options={['Riders', 'Groups']} value={who} onChange={setWho} />
        {who === 'Riders' ? <Choices options={METRICS.map((x) => x.label)} value={metricLabel} onChange={setMetricLabel} /> : null}
        {who === 'Riders' && m.metric === 'speed' ? <P muted style={{ fontSize: 14 }}>Average speed, for riders with 20 km or more in this period.</P> : null}
      </View>

      {who === 'Riders' ? (
        <AsyncBox state={riders} empty="Nobody has ridden yet in this period. Go for a ride and you will be first.">
          {(rows) => (
            <RankList
              rows={rows.map((r) => ({
                key: r.user_id,
                name: r.name,
                hint: r.city || undefined,
                value: `${r.value.toFixed(m.digits)} ${m.unit}`,
                to: `/rider/${r.user_id}`,
                mine: r.user_id === session.userId,
              }))}
            />
          )}
        </AsyncBox>
      ) : (
        <AsyncBox state={clubs} empty="There are no groups yet. Start one under Groups.">
          {(rows) => (
            <RankList
              rows={rows.map((r) => ({
                key: r.club_id,
                name: r.name,
                hint: `${r.members} member${r.members === 1 ? '' : 's'}${r.city ? ` · ${r.city}` : ''}`,
                value: `${r.value.toFixed(0)} km`,
                to: `/club/${r.club_id}`,
              }))}
            />
          )}
        </AsyncBox>
      )}

      <View style={{ gap: space.sm }}>
        <H2>Monthly challenges</H2>
        <P muted style={{ fontSize: 15 }}>The same targets for everyone. Join one and your rides this month count towards it.</P>
        {challenges.error ? <P muted>{challenges.error}</P> : null}
        {list.filter((c) => !c.competition).map((c) => (
          <ChallengeCard key={c.id} c={c} onChanged={challenges.reload} />
        ))}
      </View>

      <View style={{ gap: space.sm }}>
        <H2>Competitions</H2>
        <P muted style={{ fontSize: 15 }}>Race other riders from wherever you are. Everyone rides their own roads, and the ranking adds it up.</P>
        {list.filter((c) => c.competition).length === 0 && !challenges.loading ? <P muted>No competitions are running. Start one below.</P> : null}
        {list.filter((c) => c.competition).map((c) => (
          <ChallengeCard key={c.id} c={c} onChanged={challenges.reload} />
        ))}
        {making ? (
          <Card>
            <H2>Start a competition</H2>
            <Field label="Name" value={title} onChangeText={setTitle} placeholder="For example: GenSan weekend race" maxLength={80} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: t.muted }}>Who wins?</Text>
            <Choices options={KINDS.map((k) => k.label)} value={kindLabel} onChange={setKindLabel} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: t.muted }}>How long? It starts now.</Text>
            <Choices options={['3 days', '7 days', '14 days', '30 days']} value={days} onChange={setDays} />
            {problem ? <P muted>{problem}</P> : null}
            <Button label="Start it" icon="flag" disabled={title.trim().length < 3} onPress={create} />
            <Button label="Cancel" kind="plain" onPress={() => setMaking(false)} />
          </Card>
        ) : (
          <Button label="Start a competition" icon="add" kind="plain" onPress={() => setMaking(true)} />
        )}
      </View>
    </View>
  );
}
