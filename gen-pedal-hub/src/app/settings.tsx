import { useRouter } from 'expo-router';
import { Text } from 'react-native';

import { hasBackend, saveMyProfile, signOut, useSession } from '@/backend';
import { BackTitle, Button, Card, Choices, Field, H2, P, Screen } from '@/components/ui';
import { confirm } from '@/lib/confirm';
import { eraseEverything, updateProfile, useStore } from '@/store';
import { useTheme } from '@/theme';

const DRINK = ['Off', '10 min', '15 min', '20 min', '30 min'];

export default function Settings() {
  const t = useTheme();
  const router = useRouter();
  const profile = useStore((s) => s.profile);
  const session = useSession();
  const label = { color: t.muted, fontSize: 14, fontWeight: '600' as const };

  // Keep the public page in step with the name and city typed here.
  const pushProfile = () => {
    if (hasBackend && session.userId) saveMyProfile().catch(() => {});
  };

  return (
    <Screen>
      <BackTitle title="Settings" />

      {hasBackend ? (
        <Card>
          <H2>Account</H2>
          {session.userId ? (
            <>
              <P muted>Signed in as {session.email}. Your ride totals count in the rankings.</P>
              <Button label="Sign out" kind="plain" onPress={() => signOut()} />
            </>
          ) : (
            <>
              <P muted>Sign in to join the community, rankings, groups and events. Recording rides works without it.</P>
              <Button label="Sign in or create an account" icon="person-add-outline" onPress={() => router.push('/sign-in')} />
            </>
          )}
        </Card>
      ) : null}

      <Card>
        <H2>My details</H2>
        <Field label="Name" value={profile.name} onChangeText={(name) => updateProfile({ name })} onBlur={pushProfile} placeholder="Your first name" />
        <Field label="Town or city" value={profile.city} onChangeText={(city) => updateProfile({ city })} onBlur={pushProfile} placeholder="For example: General Santos" />
        <Field
          label="Body weight in kg (only used to work out calories)"
          value={profile.weightKg ? String(profile.weightKg) : ''}
          onChangeText={(v) => updateProfile({ weightKg: Math.min(250, Math.max(0, Number(v.replace(/[^0-9.]/g, '')) || 0)) })}
          placeholder="70"
          keyboardType="numeric"
        />
        <Text style={label}>Show distance in</Text>
        <Choices
          options={['Kilometres', 'Miles']}
          value={profile.units === 'km' ? 'Kilometres' : 'Miles'}
          onChange={(v) => updateProfile({ units: v === 'Miles' ? 'mi' : 'km' })}
        />
      </Card>

      <Card>
        <H2>Drink reminder</H2>
        <P muted>During a ride the phone buzzes and reminds you to drink water.</P>
        <Choices
          options={DRINK}
          value={profile.drinkEveryMin > 0 ? `${profile.drinkEveryMin} min` : 'Off'}
          onChange={(v) => updateProfile({ drinkEveryMin: v === 'Off' ? 0 : parseInt(v, 10) })}
        />
      </Card>

      <Card>
        <H2>Emergency contact</H2>
        <P muted>During a ride, the SOS button opens a text message to this person with a link to where you are. You press send yourself.</P>
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
        <P muted>Your rides and their GPS lines stay on this phone. If you sign in, only ride totals are sent, for the rankings.</P>
        <Button
          label="Erase everything on this phone"
          icon="trash-outline"
          kind="danger"
          onPress={async () => {
            if (await confirm('Erase everything?', 'All rides, bikes and details on this phone will be deleted. This cannot be undone.', 'Erase', true)) {
              if (hasBackend && session.userId) await signOut().catch(() => {});
              await eraseEverything();
            }
          }}
        />
      </Card>
      <Text style={{ color: t.muted, fontSize: 13, textAlign: 'center' }}>GenRide 0.3</Text>
    </Screen>
  );
}
