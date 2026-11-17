import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, space, useTheme } from '@/theme';

import type { IconName } from './ui';

/** A big tappable row that opens another page. */
export function MenuRow({ icon, title, hint, to, onPress, badge }: { icon: IconName; title: string; hint?: string; to?: string; onPress?: () => void; badge?: string }) {
  const t = useTheme();
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hint ? `${title}. ${hint}` : title}
      onPress={onPress ?? (() => to && router.push(to as never))}
      style={({ pressed }) => [styles.row, { backgroundColor: t.card, borderColor: t.line, opacity: pressed ? 0.8 : 1 }]}>
      <View style={[styles.icon, { backgroundColor: t.soft }]}>
        <Ionicons name={icon} size={22} color={t.accentText} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontSize: 17, fontWeight: '700' }}>{title}</Text>
        {hint ? <Text style={{ color: t.muted, fontSize: 14 }}>{hint}</Text> : null}
      </View>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: t.warn }]}>
          <Text style={{ color: '#1B1300', fontSize: 13, fontWeight: '800' }}>{badge}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={t.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1, minHeight: 68 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
});
