import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { loadClubMembers, loadClubs, loadRanking, setClubMember, useSession } from '@/backend';
import { AsyncBox } from '@/components/async-box';
import { RankList } from '@/components/rank-list';
import { BackTitle, Button, Choices, H2, P, Screen } from '@/components/ui';
import { useAsync } from '@/lib/use-async';

export default function ClubPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession();
  const on = !!session.userId;
  const [period, setPeriod] = useState('This week');
  const clubs = useAsync(loadClubs, [session.userId], on);
  const members = useAsync(() => loadClubMembers(id), [id, session.userId], on);
  const ranking = useAsync(() => loadRanking(period === 'This week' ? 'week' : 'month', 'distance', id), [id, period, session.userId], on);
  const club = clubs.data?.find((c) => c.id === id);

  if (!on || !club) {
    return (
      <Screen>
        <BackTitle title="Group" />
        <P muted>{!on ? 'Sign in (Profile, then Settings) to see groups.' : clubs.loading ? 'Loading…' : 'This group could not be found.'}</P>
      </Screen>
    );
  }

  const owner = club.owner_id === session.userId;
  const toggle = async () => {
    await setClubMember(club.id, !club.joined).catch(() => {});
    clubs.reload();
    members.reload();
    ranking.reload();
  };

  return (
    <Screen>
      <BackTitle title={club.name} />
      <P muted>
        {club.members} member{club.members === 1 ? '' : 's'}
        {club.city ? ` · ${club.city}` : ''}
      </P>
      {club.about ? <P>{club.about}</P> : null}
      {owner ? (
        <P muted>You started this group.</P>
      ) : (
        <Button label={club.joined ? 'Leave this group' : 'Join this group'} icon={club.joined ? undefined : 'add'} kind={club.joined ? 'plain' : 'primary'} onPress={toggle} />
      )}

      <H2>Group ranking</H2>
      <Choices options={['This week', 'This month']} value={period} onChange={setPeriod} />
      <AsyncBox state={ranking} empty="No member has ridden yet in this period.">
        {(rows) => (
          <RankList
            rows={rows.map((r) => ({ key: r.user_id, name: r.name, value: `${r.value.toFixed(1)} km`, to: `/rider/${r.user_id}`, mine: r.user_id === session.userId }))}
          />
        )}
      </AsyncBox>

      <H2>Members</H2>
      <AsyncBox state={members} empty="No members yet.">
        {(rows) => (
          <RankList
            numbered={false}
            rows={rows.map((m) => ({
              key: m.user_id,
              name: m.rider?.name ?? 'Rider',
              hint: m.rider?.city || undefined,
              value: m.role === 'owner' ? 'Started it' : '',
              to: `/rider/${m.user_id}`,
              mine: m.user_id === session.userId,
            }))}
          />
        )}
      </AsyncBox>
    </Screen>
  );
}
