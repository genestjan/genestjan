import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { loadFeed, loadRider, setFollow, useSession } from '@/backend';
import { BackTitle, Button, Card, H2, P, Screen, Stat } from '@/components/ui';
import { fmtAgo, fmtDist, fmtHours } from '@/lib/format';
import { useAsync } from '@/lib/use-async';
import { useStore } from '@/store';
import { space, useTheme } from '@/theme';

export default function RiderPage() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession();
  const units = useStore((s) => s.profile.units);
  const rider = useAsync(() => loadRider(id), [id, session.userId], !!session.userId);
  const posts = useAsync(() => loadFeed(id), [id, session.userId], !!session.userId);
  const r = rider.data;

  if (!session.userId) {
    return (
      <Screen>
        <BackTitle title="Rider" />
        <P muted>Sign in (Profile, then Settings) to see other riders.</P>
      </Screen>
    );
  }
  if (!r) {
    return (
      <Screen>
        <BackTitle title="Rider" />
        <P muted>{rider.loading ? 'Loading…' : (rider.error ?? 'This rider could not be found.')}</P>
      </Screen>
    );
  }

  const isMe = r.id === session.userId;

  return (
    <Screen>
      <BackTitle title={r.name} />
      <P muted>{[r.city, r.bike_kind ? `${r.bike_kind} bike` : '', r.level].filter(Boolean).join(' · ') || 'Rider'}</P>

      <Card style={{ gap: space.lg }}>
        <View style={{ flexDirection: 'row' }}>
          <Stat value={fmtDist(r.distance_km * 1000, units)} unit={units} label="in total" />
          <Stat value={String(r.rides)} label={r.rides === 1 ? 'ride' : 'rides'} />
          <Stat value={String(Math.round(r.climb_m))} unit="m" label="climbed" />
        </View>
        <View style={{ flexDirection: 'row' }}>
          <Stat value={String(r.followers)} label={r.followers === 1 ? 'follower' : 'followers'} />
          <Stat value={String(r.following)} label="following" />
          <View style={{ flex: 1 }} />
        </View>
      </Card>

      {isMe ? (
        <P muted>This is your own page. Other riders see it like this.</P>
      ) : (
        <Button
          label={r.i_follow ? 'Following. Tap to stop' : `Follow ${r.name}`}
          icon={r.i_follow ? 'checkmark' : 'person-add-outline'}
          kind={r.i_follow ? 'plain' : 'primary'}
          onPress={async () => {
            await setFollow(r.id, !r.i_follow).catch(() => {});
            rider.reload();
          }}
        />
      )}

      <H2>Posts</H2>
      {(posts.data ?? []).length === 0 ? (
        <P muted>{posts.loading ? 'Loading…' : 'No posts yet.'}</P>
      ) : (
        (posts.data ?? []).map((p) => (
          <Card key={p.id}>
            <Text style={{ color: t.muted, fontSize: 14 }}>{fmtAgo(p.created_at)}</Text>
            {p.body ? <Text style={{ color: t.text, fontSize: 16, lineHeight: 23 }}>{p.body}</Text> : null}
            {p.ride_distance_m != null ? (
              <Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }}>
                {p.ride_title ?? 'Ride'}: {fmtDist(p.ride_distance_m, units)} {units} in {fmtHours((p.ride_moving_s ?? 0) * 1000)}
              </Text>
            ) : null}
            <Text style={{ color: t.muted, fontSize: 14 }}>
              {p.likes} like{p.likes === 1 ? '' : 's'} · {p.comments} comment{p.comments === 1 ? '' : 's'}
            </Text>
          </Card>
        ))
      )}
    </Screen>
  );
}
