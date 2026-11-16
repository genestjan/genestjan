import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { restoreRide } from '@/recorder';
import Welcome from '@/screens/welcome';
import { loadStore, useStore } from '@/store';
import { useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const t = useTheme();
  const loaded = useStore((s) => s.loaded);
  const onboarded = useStore((s) => s.profile.onboarded);

  useEffect(() => {
    loadStore().then(restoreRide);
  }, []);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  // The navigator is always rendered (the web build needs it to produce a working page).
  // Until the saved data is read a plain cover hides it, so a returning rider never
  // sees the welcome screen flash. New riders get the welcome screen on top.
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="record" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
        <Stack.Screen name="ride/[id]" />
      </Stack>
      {!loaded || !onboarded ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: t.bg }]}>{loaded ? <Welcome /> : null}</View>
      ) : null}
    </>
  );
}
