import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, space, useTheme } from '@/theme';

const MEDALS = ['#D4A017', '#9AA3A8', '#B0703C'];

export type RankItem = { key: string; name: string; hint?: string; value: string; to?: string; mine?: boolean };

/** A numbered ranking. The top three get gold, silver and bronze. */
export function RankList({ rows, numbered = true }: { rows: RankItem[]; numbered?: boolean }) {
  const t = useTheme();
  const router = useRouter();
  return (
    <View style={{ gap: space.sm }}>
      {rows.map((r, i) => (
        <Pressable
          key={r.key}
          accessibilityRole={r.to ? 'button' : undefined}
          accessibilityLabel={numbered ? `Number ${i + 1}: ${r.name}, ${r.value}` : `${r.name}${r.value ? `, ${r.value}` : ''}`}
          disabled={!r.to}
          onPress={() => r.to && router.push(r.to as never)}
          style={[styles.row, { backgroundColor: r.mine ? t.soft : t.card, borderColor: r.mine ? t.accent : t.line }]}>
          {numbered ? (
            <View style={[styles.place, { backgroundColor: i < 3 ? MEDALS[i] : t.soft }]}>
              <Text style={{ color: i < 3 ? '#FFFFFF' : t.text, fontSize: 15, fontWeight: '800' }}>{i + 1}</Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>
              {r.name}
              {r.mine ? ' (you)' : ''}
            </Text>
            {r.hint ? <Text style={{ color: t.muted, fontSize: 14 }}>{r.hint}</Text> : null}
          </View>
          <Text style={{ color: t.text, fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{r.value}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1, minHeight: 60 },
  place: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
