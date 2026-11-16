import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { BackTitle, P, Screen } from '@/components/ui';
import { badges } from '@/lib/stats';
import { useStore } from '@/store';
import { radius, space, useTheme } from '@/theme';

export default function Badges() {
  const t = useTheme();
  const rides = useStore((s) => s.rides);
  const list = badges(rides, Date.now());
  const earned = list.filter((b) => b.earned).length;

  return (
    <Screen>
      <BackTitle title="Badges" />
      <P muted>
        You have {earned} of {list.length}. Each locked badge says what to do to earn it.
      </P>
      <View style={styles.grid}>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  badge: { width: '48.5%', borderWidth: 1.5, borderRadius: radius.md, padding: space.md, gap: 4 },
});
