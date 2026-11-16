import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { createEvent, loadEvents, type EventRow } from '@/backend';
import { AsyncBox } from '@/components/async-box';
import { Button, Card, Field, H2, P } from '@/components/ui';
import { fmtDateTime } from '@/lib/format';
import { useAsync } from '@/lib/use-async';
import { radius, space, useTheme } from '@/theme';

export const fmtFee = (fee: number) => (fee > 0 ? `₱${Number(fee).toLocaleString('en-GB')}` : 'Free');

function EventCard({ e }: { e: EventRow }) {
  const t = useTheme();
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${e.title}, ${fmtDateTime(e.starts_at)}`}
      onPress={() => router.push(`/event/${e.id}`)}
      style={({ pressed }) => [styles.card, { backgroundColor: t.card, borderColor: e.my_race_no ? t.accent : t.line, opacity: pressed ? 0.8 : 1 }]}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: t.text, fontSize: 18, fontWeight: '700' }}>{e.title}</Text>
        <Text style={{ color: t.text, fontSize: 15 }}>{fmtDateTime(e.starts_at)}</Text>
        <Text style={{ color: t.muted, fontSize: 14 }}>
          {[e.place, e.distance_km > 0 ? `${e.distance_km} km` : '', fmtFee(e.fee)].filter(Boolean).join(' · ')}
        </Text>
        <Text style={{ color: t.muted, fontSize: 14 }}>
          {e.riders} rider{e.riders === 1 ? '' : 's'} signed up
        </Text>
        {e.my_race_no ? <Text style={{ color: t.accentText, fontSize: 15, fontWeight: '700' }}>You are in. Your race number is {e.my_race_no}.</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={t.muted} />
    </Pressable>
  );
}

/** Reads "2026-12-25" and "05:30" as a local date and time. Returns null when either is not valid. */
export function parseWhen(date: string, time: string): Date | null {
  const d = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(date.trim());
  const tm = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!d || !tm) return null;
  const when = new Date(+d[1], +d[2] - 1, +d[3], +tm[1], +tm[2]);
  const ok = when.getMonth() === +d[2] - 1 && when.getDate() === +d[3] && +tm[1] < 24 && +tm[2] < 60;
  return ok ? when : null;
}

export function Events() {
  const t = useTheme();
  const events = useAsync(loadEvents, []);
  const [making, setMaking] = useState(false);
  const [title, setTitle] = useState('');
  const [place, setPlace] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('05:00');
  const [km, setKm] = useState('');
  const [fee, setFee] = useState('');
  const [payInfo, setPayInfo] = useState('');
  const [about, setAbout] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const when = parseWhen(date, time);
  const hasFee = (Number(fee) || 0) > 0;

  const create = async () => {
    setProblem(null);
    if (!when) return setProblem('Write the date like 2026-12-25 and the time like 05:30.');
    if (when.getTime() < Date.now()) return setProblem('That date has already passed.');
    if (hasFee && !payInfo.trim()) return setProblem('Tell riders how to pay the fee.');
    try {
      await createEvent({ title, about, place, startsAt: when, distanceKm: Math.max(0, Number(km) || 0), fee: Math.max(0, Number(fee) || 0), payInfo });
      setMaking(false);
      setTitle('');
      setPlace('');
      setDate('');
      setKm('');
      setFee('');
      setPayInfo('');
      setAbout('');
      events.reload();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Could not create the event.');
    }
  };

  return (
    <View style={{ gap: space.lg }}>
      <P muted>Fun rides, races and group rides. Sign up and you get a race number straight away.</P>
      {making ? (
        <Card>
          <H2>Create an event</H2>
          <Field label="Event name" value={title} onChangeText={setTitle} placeholder="For example: GenSan Fun Ride" maxLength={80} />
          <Field label="Where does it start?" value={place} onChangeText={setPlace} placeholder="For example: Plaza Heneral Santos" maxLength={120} />
          <Field label="Date (year-month-day)" value={date} onChangeText={setDate} placeholder="2026-12-25" keyboardType="numbers-and-punctuation" />
          <Field label="Start time (24 hour clock)" value={time} onChangeText={setTime} placeholder="05:30" keyboardType="numbers-and-punctuation" />
          <Field label="Distance in km" value={km} onChangeText={setKm} placeholder="50" keyboardType="numeric" />
          <Field label="Fee in pesos (leave empty if free)" value={fee} onChangeText={setFee} placeholder="0" keyboardType="numeric" />
          {hasFee ? <Field label="How do riders pay?" value={payInfo} onChangeText={setPayInfo} placeholder="For example: GCash 0917 123 4567, Juan Cruz" multiline maxLength={500} /> : null}
          <Field label="Anything else riders should know? (you can leave this empty)" value={about} onChangeText={setAbout} placeholder="Bring a helmet and two bottles" multiline maxLength={2000} />
          {problem ? (
            <Text accessibilityRole="alert" style={{ color: t.danger, fontSize: 15 }}>
              {problem}
            </Text>
          ) : null}
          <Button label="Create the event" icon="checkmark" disabled={title.trim().length < 3} onPress={create} />
          <Button label="Cancel" kind="plain" onPress={() => setMaking(false)} />
        </Card>
      ) : (
        <Button label="Create an event" icon="add" kind="plain" onPress={() => setMaking(true)} />
      )}
      <AsyncBox state={events} empty="No events are coming up. Create one and invite your friends.">
        {(rows) => rows.map((e) => <EventCard key={e.id} e={e} />)}
      </AsyncBox>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.md, borderWidth: 1, padding: space.md },
});
