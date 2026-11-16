import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { difficulty, type Difficulty } from '@/lib/difficulty';
import { fmtDist } from '@/lib/format';
import { radius, space, useTheme } from '@/theme';
import type { Units } from '@/types';

export function difficultyColour(d: Difficulty): string {
  return d === 'Easy' ? '#2E8B57' : d === 'Moderate' ? '#B4690E' : d === 'Hard' ? '#C2362B' : '#7A1FA2';
}

export function DifficultyTag({ level }: { level: Difficulty }) {
  return (
    <View style={[styles.tag, { backgroundColor: difficultyColour(level) }]}>
      <Text style={styles.tagText}>{level}</Text>
    </View>
  );
}

export function RouteRow({ to, name, by, distanceM, elevGainM, saves, units }: { to: string; name: string; by?: string; distanceM: number; elevGainM: number; saves?: number; units: Units }) {
  const t = useTheme();
  const router = useRouter();
  const level = difficulty(distanceM, elevGainM);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${fmtDist(distanceM, units)} ${units}, ${Math.round(elevGainM)} metres of climbing, ${level}.`}
      onPress={() => router.push(to as never)}
      style={({ pressed }) => [styles.row, { backgroundColor: t.card, borderColor: t.line, opacity: pressed ? 0.8 : 1 }]}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: t.text, fontSize: 17, fontWeight: '700' }} numberOfLines={1}>
          {name}
        </Text>
        <Text style={{ color: t.muted, fontSize: 14 }}>
          {fmtDist(distanceM, units)} {units} · {Math.round(elevGainM)} m climbing{by ? ` · by ${by}` : ''}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <DifficultyTag level={level} />
          {saves != null && saves > 0 ? (
            <Text style={{ color: t.muted, fontSize: 14 }}>
              Saved by {saves} rider{saves === 1 ? '' : 's'}
            </Text>
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={t.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1 },
  tag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
  tagText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});
