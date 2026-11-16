import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { hasBackend, signIn, signUp } from '@/backend';
import { BackTitle, Button, Card, Field, P, Screen } from '@/components/ui';
import { useTheme } from '@/theme';

export default function SignIn() {
  const t = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; good: boolean } | null>(null);
  const ready = /\S+@\S+\.\S+/.test(email) && password.length >= 6;

  const go = async (create: boolean) => {
    setBusy(true);
    setMessage(null);
    try {
      if (create) {
        if ((await signUp(email, password)) === 'confirm') {
          setMessage({ text: 'Nearly there. Open the email we just sent you, press the link, then come back and press Sign in.', good: true });
          return;
        }
      } else {
        await signIn(email, password);
      }
      if (router.canGoBack()) router.back();
      else router.replace('/community');
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Something went wrong. Try again.', good: false });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <BackTitle title="Sign in" />
      {!hasBackend ? (
        <Card>
          <P>Accounts are not switched on in this version yet.</P>
        </Card>
      ) : (
        <>
          <P muted>An account lets you share rides, follow friends, join groups and events, and show up in the rankings.</P>
          <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          <Field label="Password (6 or more letters or numbers)" value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry autoCapitalize="none" />
          {message ? (
            <Text accessibilityRole="alert" style={{ color: message.good ? t.accentText : t.danger, fontSize: 16, lineHeight: 22 }}>
              {message.text}
            </Text>
          ) : null}
          <Button label={busy ? 'Please wait…' : 'Sign in'} icon="log-in-outline" big disabled={!ready || busy} onPress={() => go(false)} />
          <Button label="I am new: create my account" kind="plain" disabled={!ready || busy} onPress={() => go(true)} />
        </>
      )}
    </Screen>
  );
}
