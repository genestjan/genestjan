import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { startBackend } from '@/backend';
import { dayIndexAt, dayStartAt, getPlan } from '@/lib/training';
import { setRestDayReminders } from '@/notify';
import { restoreRide } from '@/recorder';
import Welcome from '@/screens/welcome';
import { loadStore, useStore } from '@/store';
import { useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const t = useTheme();
  const loaded = useStore((s) => s.loaded);
  const onboarded = useStore((s) => s.profile.onboarded);
  const training = useStore((s) => s.training);
  const restReminders = useStore((s) => s.profile.restDayReminders);

  useEffect(() => {
    loadStore().then(restoreRide).then(startBackend);
  }, []);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  // Keep the phone's rest day reminders in step with the training plan (next two weeks).
  useEffect(() => {
    if (!loaded) return;
    const plan = getPlan(training.planId);
    const days: number[] = [];
    if (plan && restReminders) {
      const today = dayIndexAt(training, Date.now());
      for (let i = Math.max(0, today); i < Math.min(plan.days.length, today + 14); i++) {
        if (plan.days[i].kind === 'rest') days.push(dayStartAt(training.startedAt, i));
      }
    }
    setRestDayReminders(days);
  }, [loaded, training, restReminders]);

  // The navigator is always rendered (the web build needs it to produce a working page).
  // Until the saved data is read a plain cover hides it, so a returning rider never
  // sees the welcome screen flash. New riders get the welcome screen on top.
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="record" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
      </Stack>
      {!loaded || !onboarded ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: t.bg }]}>{loaded ? <Welcome /> : null}</View>
      ) : null}
    </>
  );
}
