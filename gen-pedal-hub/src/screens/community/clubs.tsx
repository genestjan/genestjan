import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { createClub, loadClubs, setClubMember, useSession, type Club } from '@/backend';
import { AsyncBox } from '@/components/async-box';
import { Button, Card, Field, H2, P } from '@/components/ui';
import { useAsync } from '@/lib/use-async';
import { useStore } from '@/store';
import { radius, space, useTheme } from '@/theme';

function ClubRow({ club, onChanged }: { club: Club; onChanged: () => void }) {
  const t = useTheme();
  const router = useRouter();
  const session = useSession();
  const owner = club.owner_id === session.userId;
  return (
    <View style={[styles.row, { backgroundColor: t.card, borderColor: club.joined ? t.accent : t.line }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${club.name}`} onPress={() => router.push(`/club/${club.id}`)} style={styles.rowTop}>
        <View style={[styles.icon, { backgroundColor: t.soft }]}>
          <Ionicons name="people" size={22} color={t.accentText} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontSize: 17, fontWeight: '700' }}>{club.name}</Text>
          <Text style={{ color: t.muted, fontSize: 14 }}>
            {club.members} member{club.members === 1 ? '' : 's'}
            {club.city ? ` · ${club.city}` : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={t.muted} />
      </Pressable>
      {club.about ? <Text style={{ color: t.muted, fontSize: 15 }}>{club.about}</Text> : null}
      {owner ? (
        <Text style={{ color: t.accentText, fontSize: 14, fontWeight: '700' }}>You started this group</Text>
      ) : (
        <Button
          label={club.joined ? 'Leave this group' : 'Join this group'}
          icon={club.joined ? undefined : 'add'}
          kind={club.joined ? 'plain' : 'primary'}
          onPress={async () => {
            await setClubMember(club.id, !club.joined).catch(() => {});
            onChanged();
          }}
        />
      )}
    </View>
  );
}

export function Clubs() {
  const clubs = useAsync(loadClubs, []);
  const myCity = useStore((s) => s.profile.city);
  const [making, setMaking] = useState(false);
  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [city, setCity] = useState(myCity);
  const [problem, setProblem] = useState<string | null>(null);

  const create = async () => {
    setProblem(null);
    try {
      await createClub(name, about, city);
      setMaking(false);
      setName('');
      setAbout('');
      clubs.reload();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Could not create the group.');
    }
  };

  return (
    <View style={{ gap: space.lg }}>
      <P muted>A group is a cycling club or a bunch of friends. Members get their own ranking.</P>
      {making ? (
        <Card>
          <H2>Start a group</H2>
          <Field label="Group name" value={name} onChangeText={setName} placeholder="For example: GenSan Sunday Riders" maxLength={50} />
          <Field label="Town or city" value={city} onChangeText={setCity} placeholder="For example: General Santos" maxLength={60} />
          <Field label="What is the group about? (you can leave this empty)" value={about} onChangeText={setAbout} placeholder="Easy rides every Sunday at 5 am" multiline maxLength={500} />
          {problem ? <P muted>{problem}</P> : null}
          <Button label="Create the group" icon="checkmark" disabled={name.trim().length < 2} onPress={create} />
          <Button label="Cancel" kind="plain" onPress={() => setMaking(false)} />
        </Card>
      ) : (
        <Button label="Start a group" icon="add" kind="plain" onPress={() => setMaking(true)} />
      )}
      <AsyncBox state={clubs} empty="There are no groups yet. Start the first one.">
        {(rows) => rows.map((c) => <ClubRow key={c.id} club={c} onChanged={clubs.reload} />)}
      </AsyncBox>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { borderRadius: radius.md, borderWidth: 1, padding: space.md, gap: space.sm },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
