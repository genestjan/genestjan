import { useRouter } from 'expo-router';
import { useState } from 'react';

import { hasBackend, useSession } from '@/backend';
import { Button, Card, Choices, H2, P, Screen } from '@/components/ui';
import { Clubs } from '@/screens/community/clubs';
import { Events } from '@/screens/community/events';
import { Feed } from '@/screens/community/feed';
import { Rankings } from '@/screens/community/rankings';

const TABS = ['Feed', 'Rankings', 'Groups', 'Events'];

export default function Community() {
  const router = useRouter();
  const session = useSession();
  const [tab, setTab] = useState('Feed');

  if (!hasBackend) {
    return (
      <Screen title="Community">
        <Card>
          <H2>Coming to this app soon</H2>
          <P muted>The community needs a shared server, and it has not been switched on yet. Everything else in the app works without it.</P>
          <P muted>When it is on, this is where you will find the feed, rankings, groups, events and competitions.</P>
        </Card>
      </Screen>
    );
  }
  if (!session.ready) {
    return (
      <Screen title="Community">
        <P muted>Loading…</P>
      </Screen>
    );
  }
  if (!session.userId) {
    return (
      <Screen title="Community">
        <Card>
          <H2>Ride with others</H2>
          <P muted>Share your rides and photos, follow friends, join a group, sign up for events and see who rode the furthest this week.</P>
          <P muted>It needs a free account. Recording your own rides works without one.</P>
          <Button label="Sign in or create an account" icon="person-add-outline" big onPress={() => router.push('/sign-in')} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title="Community">
      <Choices options={TABS} value={tab} onChange={setTab} />
      {tab === 'Feed' ? <Feed /> : tab === 'Rankings' ? <Rankings /> : tab === 'Groups' ? <Clubs /> : <Events />}
    </Screen>
  );
}
