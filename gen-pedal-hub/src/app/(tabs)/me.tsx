import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Choices, Field, H2, P, Screen, Stat } from '@/components/ui';
import { confirm } from '@/lib/confirm';
import { fmtDist, fmtHours } from '@/lib/format';
import { badges, totals } from '@/lib/stats';
import { eraseEverything, updateProfile, useStore } from '@/store';
import { radius, space, useTheme } from '@/theme';

const GOALS = ['20', '30', '50', '75', '100', '150', '200'];

export default function Me() {
  const t = useTheme();
  const profile = useStore((s) => s.profile);
  const rides = useStore((s) => s.rides);
  const all = totals(rides);
  const list = badges(rides, Date.now());
  const earned = list.filter((b) => b.earned).length;

  return (
    <Screen title="Me">
      <Card style={{ flexDirection: 'row' }}>
        <Stat value={fmtDist(all.distanceM, profile.units)} unit={profile.units} label="in total" />
        <Stat value={`${all.elevGainM.toFixed(0)}`} unit="m" label="climbed" />
        <Stat value={fmtHours(all.movingMs)} label="riding time" />
      </Card>

      <View style={{ gap: space.md }}>
        <H2>
          Badges ({earned} of {list.length})
        </H2>
        <View style={styles.badges}>
          {list.map((b) => (
            <View
              key={b.key}
              accessibilityLabel={`${b.title}. ${b.earned ? 'Earned' : b.hint}`}
              style={[styles.badge, { backgroundColor: b.earned ? t.soft : t.card, borderColor: b.earned ? t.accent : t.line }]}>
              <Ionicons name={b.earned ? 'ribbon' : 'lock-closed-outline'} size={22} color={b.earned ? t.accentText : t.muted} />
              <Text style={{ color: b.earned ? t.text : t.muted, fontSize: 15, fontWeight: '700' }}>{b.title}</Text>
              <Text style={{ color: t.muted, fontSize: 13 }}>{b.earned ? 'Earned' : b.hint}</Text>
            </View>
          ))}
        </View>
      </View>

      <Card>
        <H2>My details</H2>
        <Field label="Name" value={profile.name} onChangeText={(name) => updateProfile({ name })} placeholder="Your first name" />
        <Text style={[styles.label, { color: t.muted }]}>Weekly goal, in km</Text>
        <Choices options={GOALS} value={String(profile.weeklyGoalKm)} onChange={(v) => updateProfile({ weeklyGoalKm: Number(v) })} />
        <Text style={[styles.label, { color: t.muted }]}>Show distance in</Text>
        <Choices
          options={['Kilometres', 'Miles']}
          value={profile.units === 'km' ? 'Kilometres' : 'Miles'}
          onChange={(v) => updateProfile({ units: v === 'Miles' ? 'mi' : 'km' })}
        />
      </Card>

      <Card>
        <H2>Emergency contact</H2>
        <P muted>
          During a ride, the SOS button opens a text message to this person with a link to where you are. You press send yourself.
        </P>
        <Field label="Their name" value={profile.emergencyName} onChangeText={(emergencyName) => updateProfile({ emergencyName })} placeholder="For example: Maria" />
        <Field
          label="Their mobile number"
          value={profile.emergencyPhone}
          onChangeText={(emergencyPhone) => updateProfile({ emergencyPhone })}
          placeholder="For example: 09171234567"
          keyboardType="phone-pad"
        />
      </Card>

      <Card>
        <H2>Your data</H2>
        <P muted>Everything is stored on this phone only. Nothing is sent anywhere.</P>
        <Button
          label="Erase everything"
          icon="trash-outline"
          kind="danger"
          onPress={async () => {
            if (await confirm('Erase everything?', 'All rides, bikes and details on this phone will be deleted. This cannot be undone.', 'Erase', true)) {
              await eraseEverything();
            }
          }}
        />
      </Card>
      <Text style={{ color: t.muted, fontSize: 13, textAlign: 'center' }}>Gen Pedal Hub 0.1</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  badge: { width: '48.5%', borderWidth: 1.5, borderRadius: radius.md, padding: space.md, gap: 4 },
  label: { fontSize: 14, fontWeight: '600' },
});
