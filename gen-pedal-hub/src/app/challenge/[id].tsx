import { useLocalSearchParams } from 'expo-router';

import { loadChallengeBoard, loadChallenges, setChallengeJoined, useSession } from '@/backend';
import { AsyncBox } from '@/components/async-box';
import { RankList } from '@/components/rank-list';
import { BackTitle, Button, P, Screen } from '@/components/ui';
import { fmtDate } from '@/lib/format';
import { useAsync } from '@/lib/use-async';
import { fmtValue, kindUnit } from '@/screens/community/rankings';

export default function ChallengePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession();
  const on = !!session.userId;
  const list = useAsync(loadChallenges, [session.userId], on);
  const board = useAsync(() => loadChallengeBoard(id), [id, session.userId], on);
  const c = list.data?.find((x) => x.id === id);

  if (!on || !c) {
    return (
      <Screen>
        <BackTitle title="Ranking" />
        <P muted>{!on ? 'Sign in (Profile, then Settings) to see this.' : list.loading ? 'Loading…' : 'This one has ended or could not be found.'}</P>
      </Screen>
    );
  }

  const unit = kindUnit(c.kind);

  return (
    <Screen>
      <BackTitle title={c.title} />
      {c.about ? <P>{c.about}</P> : null}
      <P muted>
        {fmtDate(new Date(c.starts_at).getTime())} to {fmtDate(new Date(c.ends_at).getTime() - 1000)}
        {c.target > 0 ? ` · Target: ${c.target.toLocaleString('en-GB')} ${unit}` : ' · Whoever does the most wins'}
      </P>
      <Button
        label={c.joined ? 'Leave' : 'Join'}
        icon={c.joined ? undefined : 'add'}
        kind={c.joined ? 'plain' : 'primary'}
        onPress={async () => {
          await setChallengeJoined(c.id, !c.joined).catch(() => {});
          list.reload();
          board.reload();
        }}
      />
      <AsyncBox state={board} empty="Nobody has joined yet. Be the first.">
        {(rows) => (
          <RankList
            rows={rows.map((r) => ({ key: r.user_id, name: r.name, value: `${fmtValue(r.value, c.kind)} ${unit}`, to: `/rider/${r.user_id}`, mine: r.user_id === session.userId }))}
          />
        )}
      </AsyncBox>
    </Screen>
  );
}
