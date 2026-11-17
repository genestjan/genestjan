import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { Button, Choices, Field, H2, P, Screen } from '@/components/ui';
import { addBike, updateProfile } from '@/store';
import { glow, space, useTheme } from '@/theme';

const LEVELS = ['Beginner', 'Regular', 'Experienced'];
const BIKES = ['Road', 'Mountain', 'Gravel', 'Folding', 'City', 'Other'];
const GOAL: Record<string, number> = { Beginner: 30, Regular: 75, Experienced: 150 };

export default function Welcome() {
  const t = useTheme();
  const [name, setName] = useState('');
  const [level, setLevel] = useState('Beginner');
  const [bikeKind, setBikeKind] = useState('Road');

  const start = () => {
    addBike(`My ${bikeKind.toLowerCase()} bike`, bikeKind, 0);
    updateProfile({ onboarded: true, name: name.trim(), level, bikeKind, weeklyGoalKm: GOAL[level] });
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <Image source={require('../../assets/images/logo.png')} accessibilityLabel="GenRide. Ride. Explore. Go further." style={[styles.logo, glow]} />
        <Text style={[styles.tagline, { color: t.muted }]}>Your cycling companion</Text>
      </View>

      <P muted>Three quick questions, then you are ready to ride. You can change these later.</P>

      <Field label="What should we call you?" value={name} onChangeText={setName} placeholder="Your first name" autoCapitalize="words" />

      <View style={styles.block}>
        <H2>How often do you ride?</H2>
        <Choices options={LEVELS} value={level} onChange={setLevel} />
      </View>

      <View style={styles.block}>
        <H2>What bike do you ride most?</H2>
        <Choices options={BIKES} value={bikeKind} onChange={setBikeKind} />
      </View>

      <Button label="Start" icon="arrow-forward" big onPress={start} />
      <P muted style={{ fontSize: 14, textAlign: 'center' }}>
        No account needed. Your rides stay on this phone.
      </P>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: space.md, alignItems: 'center' },
  logo: { width: 200, height: 200, borderRadius: 44 },
  tagline: { fontSize: 17, opacity: 0.9 },
  block: { gap: space.md },
});
