import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Hazard } from '@/backend';
import { fmtAway, type Place } from '@/lib/places';
import { radius, space, useTheme } from '@/theme';

import type { MapMarker } from './tile-map';
import { H2 } from './ui';

export const PLACE_COLOURS = { water: '#1D6FD1', shop: '#D9730D', hazard: '#C2362B' } as const;

export const HAZARD_NAMES: Record<string, string> = {
  pothole: 'Pothole',
  traffic: 'Heavy traffic',
  flood: 'Flooding',
  dogs: 'Loose dogs',
  roadworks: 'Roadworks',
  other: 'Danger',
};

export function placeMarkers(places: Place[], hazards: Hazard[]): MapMarker[] {
  return [
    ...places.slice(0, 60).map((p) => ({ key: p.id, lat: p.lat, lon: p.lon, color: PLACE_COLOURS[p.kind] })),
    ...hazards.slice(0, 40).map((h) => ({ key: `h${h.id}`, lat: h.lat, lon: h.lon, color: PLACE_COLOURS.hazard })),
  ];
}

const openMap = (lat: number, lon: number) => Linking.openURL(`https://maps.google.com/?q=${lat.toFixed(5)},${lon.toFixed(5)}`).catch(() => {});

function Row({ color, icon, title, hint, lat, lon }: { color: string; icon: keyof typeof Ionicons.glyphMap; title: string; hint: string; lat: number; lon: number }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${hint}. Opens in your maps app.`}
      onPress={() => openMap(lat, lon)}
      style={({ pressed }) => [styles.row, { backgroundColor: t.card, borderColor: t.line, opacity: pressed ? 0.8 : 1 }]}>
      <View style={[styles.dot, { backgroundColor: color }]}>
        <Ionicons name={icon} size={18} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>{title}</Text>
        {hint ? <Text style={{ color: t.muted, fontSize: 14 }}>{hint}</Text> : null}
      </View>
      <Ionicons name="navigate-outline" size={18} color={t.muted} />
    </Pressable>
  );
}

/** Water stops, bike shops and reported dangers, each in its own group. */
export function PlaceList({ places, hazards, limit = 8 }: { places: Place[]; hazards: Hazard[]; limit?: number }) {
  const t = useTheme();
  const water = places.filter((p) => p.kind === 'water').slice(0, limit);
  const shops = places.filter((p) => p.kind === 'shop').slice(0, limit);
  const none = (text: string) => <Text style={{ color: t.muted, fontSize: 15 }}>{text}</Text>;

  return (
    <View style={{ gap: space.lg }}>
      <View style={{ gap: space.sm }}>
        <H2>Dangers riders reported</H2>
        {hazards.length === 0
          ? none('None reported here in the last 30 days.')
          : hazards.slice(0, limit).map((h) => (
              <Row key={h.id} color={PLACE_COLOURS.hazard} icon="warning" title={HAZARD_NAMES[h.kind] ?? 'Danger'} hint={h.note || 'No details given'} lat={h.lat} lon={h.lon} />
            ))}
      </View>
      <View style={{ gap: space.sm }}>
        <H2>Water and drinks</H2>
        {water.length === 0 ? none('The map has none marked here. Bring enough water.') : water.map((p) => <Row key={p.id} color={PLACE_COLOURS.water} icon="water" title={p.name} hint={fmtAway(p.distM)} lat={p.lat} lon={p.lon} />)}
      </View>
      <View style={{ gap: space.sm }}>
        <H2>Bike repair shops</H2>
        {shops.length === 0 ? none('The map has none marked here. Carry a spare tube and a pump.') : shops.map((p) => <Row key={p.id} color={PLACE_COLOURS.shop} icon="build" title={p.name} hint={fmtAway(p.distM)} lat={p.lat} lon={p.lon} />)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1, minHeight: 60 },
  dot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
