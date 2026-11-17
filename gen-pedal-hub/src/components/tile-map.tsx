import { useState, type JSX } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Polyline, Text as SvgText } from 'react-native-svg';

import { BACKUP_TILE_CREDIT, BACKUP_TILE_URL, TILE_CREDIT, TILE_HEADERS, TILE_URL } from '@/config';
import { fitView, tilesFor, tileUrl, toScreen, type LatLon, type View as MapView } from '@/lib/tiles';

export type MapMarker = { key: string; lat: number; lon: number; color: string; label?: string };

type Props = {
  points?: LatLon[];
  markers?: MapMarker[];
  center?: LatLon;
  zoom?: number;
  height?: number;
  lineColor?: string;
  controls?: boolean;
  follow?: LatLon | null;
};

const MIN_ZOOM = 3;
const MAX_ZOOM = 18;
const MAX_DRAWN_POINTS = 800;
const FOLLOW_BLUE = '#2F7BEA';

// Once OpenStreetMap refuses a picture, every map in the app uses the backup until it restarts.
let osmRefused = false;

const finite = (p: LatLon) => Number.isFinite(p.lat) && Number.isFinite(p.lon);

function thinForDrawing(points: LatLon[]): LatLon[] {
  if (points.length <= MAX_DRAWN_POINTS) return points;
  const step = Math.ceil(points.length / MAX_DRAWN_POINTS);
  const out: LatLon[] = [];
  for (let i = 0; i < points.length; i += step) out.push(points[i]);
  if (out[out.length - 1] !== points[points.length - 1]) out.push(points[points.length - 1]);
  return out;
}

/** Cheap fingerprint so a manual zoom is forgotten when the route itself changes. */
function signature(points: LatLon[]): string {
  if (points.length === 0) return '0';
  const a = points[0];
  const b = points[points.length - 1];
  return `${points.length}:${a.lat},${a.lon}:${b.lat},${b.lon}`;
}

export function TileMap({
  points = [],
  markers = [],
  center,
  zoom,
  height = 220,
  lineColor = '#1F7A4D',
  controls = false,
  follow = null,
}: Props): JSX.Element {
  const [width, setWidth] = useState(0);
  const [backup, setBackup] = useState(osmRefused);
  const tileTemplate = backup ? BACKUP_TILE_URL : TILE_URL;
  const onTileError = () => {
    if (backup) return;
    osmRefused = true;
    setBackup(true);
  };
  const [userZoom, setUserZoom] = useState<number | null>(null);
  // During a live ride the route grows with every fix, so only a new ride should reset the zoom.
  const sig = follow ? `follow:${points.length > 0 ? signature(points.slice(0, 1)) : ''}` : signature(points);
  const [seenSig, setSeenSig] = useState(sig);

  if (sig !== seenSig) {
    setSeenSig(sig);
    setUserZoom(null);
  }

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w !== width) setWidth(w);
  };

  const route = points.filter(finite);
  const pins = markers.filter(finite);
  const followAt = follow && finite(follow) ? follow : null;

  let label = 'Map';
  if (route.length > 1) label = 'Map of the route';
  else if (pins.length > 0) label = pins.length === 1 ? 'Map showing 1 place' : `Map showing ${pins.length} places`;

  if (width <= 0) {
    return (
      <View
        style={[styles.box, { height }]}
        onLayout={onLayout}
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
      />
    );
  }

  let base: MapView;
  if (followAt) {
    base = { zoom: zoom ?? 16, centerLat: followAt.lat, centerLon: followAt.lon };
  } else if (route.length > 0 || pins.length > 0) {
    base = fitView([...route, ...pins], width, height);
  } else if (center && finite(center)) {
    base = { zoom: zoom ?? 13, centerLat: center.lat, centerLon: center.lon };
  } else {
    base = fitView([], width, height);
  }
  const view: MapView = userZoom === null ? base : { ...base, zoom: userZoom };

  const tiles = tilesFor(view, width, height);
  const screen = (p: LatLon) => toScreen(view, width, height, p);

  const drawn = thinForDrawing(route).map(screen);
  const line = drawn.map((s) => `${s.x.toFixed(1)},${s.y.toFixed(1)}`).join(' ');
  const start = drawn[0];
  const finish = drawn.length > 1 ? drawn[drawn.length - 1] : null;

  const step = (delta: number) => {
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, view.zoom + delta));
    if (next !== view.zoom) setUserZoom(next);
  };

  return (
    <View style={[styles.box, { height }]} onLayout={onLayout}>
      <View style={StyleSheet.absoluteFill} accessible accessibilityRole="image" accessibilityLabel={label}>
        {tiles.map((t) => (
          <Image
            key={t.key}
            source={{ uri: tileUrl(tileTemplate, t), headers: backup ? undefined : TILE_HEADERS }}
            onError={onTileError}
            style={[styles.tile, { left: Math.round(t.left), top: Math.round(t.top) }]}
            fadeDuration={0}
          />
        ))}
        <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
          {drawn.length > 1 && (
            <>
              <Polyline points={line} fill="none" stroke="#FFFFFF" strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" />
              <Polyline points={line} fill="none" stroke={lineColor} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
            </>
          )}
          {start && <Circle cx={start.x} cy={start.y} r={6} fill={lineColor} stroke="#FFFFFF" strokeWidth={2} />}
          {finish && <Circle cx={finish.x} cy={finish.y} r={6} fill="#FFFFFF" stroke={lineColor} strokeWidth={3} />}
          {pins.map((m) => {
            const s = screen(m);
            return (
              <G key={m.key}>
                <Circle cx={s.x} cy={s.y} r={7} fill={m.color} stroke="#FFFFFF" strokeWidth={2} />
                {m.label ? (
                  <>
                    <SvgText x={s.x + 11} y={s.y + 4} fontSize={11} fontWeight="600" stroke="#FFFFFF" strokeWidth={3} fill="#FFFFFF">
                      {m.label}
                    </SvgText>
                    <SvgText x={s.x + 11} y={s.y + 4} fontSize={11} fontWeight="600" fill="#171C1B">
                      {m.label}
                    </SvgText>
                  </>
                ) : null}
              </G>
            );
          })}
          {followAt && (
            <>
              <Circle cx={width / 2} cy={height / 2} r={14} fill={FOLLOW_BLUE} opacity={0.18} />
              <Circle cx={width / 2} cy={height / 2} r={8} fill={FOLLOW_BLUE} stroke="#FFFFFF" strokeWidth={3} />
            </>
          )}
        </Svg>
      </View>

      {controls && (
        <View style={styles.controls}>
          <Pressable
            onPress={() => step(1)}
            accessibilityRole="button"
            accessibilityLabel="Zoom in"
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <Text style={styles.buttonText}>+</Text>
          </Pressable>
          <Pressable
            onPress={() => step(-1)}
            accessibilityRole="button"
            accessibilityLabel="Zoom out"
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <Text style={styles.buttonText}>-</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.credit} pointerEvents="none">
        <Text style={styles.creditText}>{backup ? BACKUP_TILE_CREDIT : TILE_CREDIT}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E4E7E1',
  },
  tile: {
    position: 'absolute',
    width: 256,
    height: 256,
  },
  controls: {
    position: 'absolute',
    top: 8,
    right: 8,
    gap: 6,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  pressed: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#171C1B',
    lineHeight: 26,
  },
  credit: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderTopLeftRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  creditText: {
    fontSize: 10,
    color: '#333333',
  },
});
