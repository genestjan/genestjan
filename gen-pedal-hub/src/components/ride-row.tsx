import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fmtDate, fmtDist, fmtHours } from '@/lib/format';
import { radius, space, useTheme } from '@/theme';
import type { Ride, Units } from '@/types';

export function RideRow({ ride, units }: { ride: Ride; units: Units }) {
  const t = useTheme();
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${ride.title}, ${fmtDist(ride.distanceM, units)} ${units}, ${fmtDate(ride.startedAt)}`}
      onPress={() => router.push(`/ride/${ride.id}`)}
      style={({ pressed }) => [styles.row, { backgroundColor: t.card, borderColor: t.line, opacity: pressed ? 0.8 : 1 }]}>
      <View style={[styles.icon, { backgroundColor: t.soft }]}>
        <Ionicons name="bicycle" size={22} color={t.accentText} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>
          {ride.title}
        </Text>
        <Text style={{ color: t.muted, fontSize: 14 }}>
          {fmtDate(ride.startedAt)} · {fmtHours(ride.movingMs)}
        </Text>
      </View>
      <Text style={[styles.dist, { color: t.text }]}>
        {fmtDist(ride.distanceM, units)}
        <Text style={{ color: t.muted, fontSize: 14, fontWeight: '600' }}> {units}</Text>
      </Text>
      <Ionicons name="chevron-forward" size={18} color={t.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700' },
  dist: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
