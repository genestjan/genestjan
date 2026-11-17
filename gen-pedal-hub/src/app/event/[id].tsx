import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  addEventNews,
  deleteEvent,
  loadEventNews,
  loadEvents,
  loadParticipants,
  markPaid,
  savePayRef,
  setRegistered,
  useSession,
} from '@/backend';
import { BackTitle, Button, Card, Field, H2, P, Screen } from '@/components/ui';
import { confirm, notify } from '@/lib/confirm';
import { fmtAgo, fmtDateTime } from '@/lib/format';
import { useAsync } from '@/lib/use-async';
import { fmtFee } from '@/screens/community/events';
import { radius, space, useTheme } from '@/theme';

export default function EventPage() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession();
  const on = !!session.userId;
  const events = useAsync(loadEvents, [session.userId], on);
  const people = useAsync(() => loadParticipants(id), [id, session.userId], on);
  const news = useAsync(() => loadEventNews(id), [id, session.userId], on);
  const [payRef, setPayRef] = useState<string | null>(null);
  const [post, setPost] = useState('');
  const e = events.data?.find((x) => x.id === id);

  if (!on || !e) {
    return (
      <Screen>
        <BackTitle title="Event" />
        <P muted>{!on ? 'Sign in (Profile, then Settings) to see events.' : events.loading ? 'Loading…' : 'This event could not be found.'}</P>
      </Screen>
    );
  }

  const organiser = e.organiser_id === session.userId;
  const registered = e.my_race_no != null;
  const reload = () => {
    events.reload();
    people.reload();
  };
  const guard = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      reload();
    } catch (err) {
      notify('That did not work', err instanceof Error ? err.message : 'Try again.');
    }
  };

  return (
    <Screen>
      <BackTitle title={e.title} />

      <Card>
        <Text style={{ color: t.text, fontSize: 18, fontWeight: '700' }}>{fmtDateTime(e.starts_at)}</Text>
        {e.place ? <P>Starts at: {e.place}</P> : null}
        <P muted>
          {[e.distance_km > 0 ? `${e.distance_km} km` : '', `Fee: ${fmtFee(e.fee)}`, `Organised by ${e.organiser}`].filter(Boolean).join(' · ')}
        </P>
        {e.about ? <P>{e.about}</P> : null}
      </Card>

      {registered ? (
        <Card style={{ borderColor: t.accent }}>
          <H2>Your race number</H2>
          <View accessibilityLabel={`Race number ${e.my_race_no}`} style={[styles.bib, { borderColor: t.text, backgroundColor: '#FFFFFF' }]}>
            <Text style={styles.bibTop}>{e.title.toUpperCase()}</Text>
            <Text style={styles.bibNo}>{e.my_race_no}</Text>
            <Text style={styles.bibTop}>GEN PEDAL HUB</Text>
          </View>
          <P muted>Show this screen at the start. Take a screenshot in case you have no signal on the day.</P>

          {e.fee > 0 ? (
            <View style={{ gap: space.sm }}>
              <H2>Pay the fee: {fmtFee(e.fee)}</H2>
              {e.my_paid ? (
                <Text style={{ color: t.accentText, fontSize: 16, fontWeight: '700' }}>Paid. The organiser has confirmed it.</Text>
              ) : (
                <>
                  <P>{e.pay_info || 'Ask the organiser how to pay.'}</P>
                  <P muted>After you pay, type the reference number from your receipt here. The organiser checks it and marks you as paid.</P>
                  <Field label="Payment reference number" value={payRef ?? e.my_pay_ref ?? ''} onChangeText={setPayRef} placeholder="For example: 1234 567 890" maxLength={80} />
                  <Button label="Save reference number" icon="checkmark" disabled={payRef === null || !payRef.trim()} onPress={() => guard(() => savePayRef(e.id, payRef ?? '').then(() => setPayRef(null)))} />
                  {e.my_pay_ref ? <P muted>Saved. Waiting for the organiser to confirm.</P> : null}
                </>
              )}
            </View>
          ) : null}

          <Button
            label="Take me off the list"
            kind="danger"
            onPress={async () => {
              if (await confirm('Leave this event?', 'You will lose your race number.', 'Leave', true)) guard(() => setRegistered(e.id, false));
            }}
          />
        </Card>
      ) : (
        <Button label="Sign me up" icon="add" kind="accent" big onPress={() => guard(() => setRegistered(e.id, true))} />
      )}

      <View style={{ gap: space.sm }}>
        <H2>Announcements</H2>
        {organiser ? (
          <Card>
            <Field label="Tell everyone something" value={post} onChangeText={setPost} placeholder="For example: start moved to 5 am" multiline maxLength={1000} />
            <Button
              label="Post announcement"
              icon="megaphone-outline"
              disabled={!post.trim()}
              onPress={async () => {
                await addEventNews(e.id, post).catch(() => {});
                setPost('');
                news.reload();
              }}
            />
          </Card>
        ) : null}
        {(news.data ?? []).length === 0 ? (
          <P muted>{news.loading ? 'Loading…' : 'Nothing from the organiser yet.'}</P>
        ) : (
          (news.data ?? []).map((n) => (
            <Card key={n.id}>
              <Text style={{ color: t.text, fontSize: 16, lineHeight: 23 }}>{n.body}</Text>
              <Text style={{ color: t.muted, fontSize: 14 }}>{fmtAgo(n.created_at)}</Text>
            </Card>
          ))
        )}
      </View>

      <View style={{ gap: space.sm }}>
        <H2>
          Riders signed up ({(people.data ?? []).length})
        </H2>
        {(people.data ?? []).length === 0 ? <P muted>{people.loading ? 'Loading…' : 'Nobody yet. Be the first.'}</P> : null}
        {(people.data ?? []).map((p) => (
          <View key={p.user_id} style={[styles.person, { backgroundColor: t.card, borderColor: t.line }]}>
            <View style={[styles.no, { backgroundColor: t.soft }]}>
              <Text style={{ color: t.text, fontSize: 15, fontWeight: '800' }}>{p.race_no}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>
                {p.name}
                {p.user_id === session.userId ? ' (you)' : ''}
              </Text>
              {organiser && e.fee > 0 ? (
                <Text style={{ color: p.paid ? t.accentText : t.muted, fontSize: 14 }}>
                  {p.paid ? 'Paid' : p.pay_ref ? `Says they paid. Reference: ${p.pay_ref}` : 'Not paid yet'}
                </Text>
              ) : null}
            </View>
            {organiser && e.fee > 0 ? <Button label={p.paid ? 'Undo' : 'Mark paid'} kind="plain" onPress={() => guard(() => markPaid(e.id, p.user_id, !p.paid))} /> : null}
          </View>
        ))}
      </View>

      {organiser ? (
        <Button
          label="Delete this event"
          icon="trash-outline"
          kind="danger"
          onPress={async () => {
            if (await confirm('Delete this event?', 'Everyone signed up will lose their place. This cannot be undone.', 'Delete', true)) {
              await deleteEvent(e.id).catch(() => {});
              router.replace('/community');
            }
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bib: { borderWidth: 3, borderRadius: radius.sm, alignItems: 'center', paddingVertical: space.md, gap: 2 },
  bibTop: { color: '#171C1B', fontSize: 13, fontWeight: '800', letterSpacing: 1.5 },
  bibNo: { color: '#171C1B', fontSize: 96, fontWeight: '900', lineHeight: 104, fontVariant: ['tabular-nums'] },
  person: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1, minHeight: 60 },
  no: { minWidth: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
});
