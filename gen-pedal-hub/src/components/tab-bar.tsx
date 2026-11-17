import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { glow, useTheme } from '@/theme';

import type { IconName } from './ui';

const TABS: Record<string, { label: string; icon: IconName; iconOn: IconName }> = {
  index: { label: 'Home', icon: 'home-outline', iconOn: 'home' },
  explore: { label: 'Map', icon: 'map-outline', iconOn: 'map' },
  community: { label: 'Community', icon: 'people-outline', iconOn: 'people' },
  me: { label: 'Profile', icon: 'person-outline', iconOn: 'person' },
};

type Props = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigateToTab: (routeKey: string) => void;
};

/** Four plain tabs with one big Ride button in the middle. */
export function TabBar({ state, navigateToTab }: Props) {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const routes = state.routes.filter((r) => TABS[r.name]);

  const tab = (r: { key: string; name: string }) => {
    const on = state.routes[state.index]?.key === r.key;
    const cfg = TABS[r.name];
    return (
      <Pressable
        key={r.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        accessibilityLabel={cfg.label}
        onPress={() => navigateToTab(r.key)}
        style={styles.tab}>
        <Ionicons name={on ? cfg.iconOn : cfg.icon} size={24} color={on ? t.accentText : t.muted} />
        <Text style={[styles.label, { color: on ? t.accentText : t.muted, fontWeight: on ? '700' : '500' }]}>
          {cfg.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.bar, { backgroundColor: t.card, borderTopColor: t.line, paddingBottom: Math.max(insets.bottom, 8) }]}>
      {routes.slice(0, 2).map(tab)}
      <View style={styles.tab}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ride"
          onPress={() => router.push('/record')}
          style={({ pressed }) => [styles.ride, { backgroundColor: t.accent, borderColor: t.brandLight, opacity: pressed ? 0.85 : 1 }, glow]}>
          <Ionicons name="bicycle" size={30} color={t.onAccent} />
        </Pressable>
        <Text style={[styles.label, { color: t.text, fontWeight: '700' }]}>Ride</Text>
      </View>
      {routes.slice(2).map(tab)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 8 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 2, minHeight: 52 },
  label: { fontSize: 12 },
  ride: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -34,
  },
});
