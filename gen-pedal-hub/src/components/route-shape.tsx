import { View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import type { Point } from '@/types';

/** Draws the outline of a ride. Green dot is the start, white ring is the finish. */
export function RouteShape({ points, height = 200, color = '#33B1FF' }: { points: Point[]; height?: number; color?: string }) {
  const W = 320;
  const H = height;
  const pad = 18;
  if (points.length < 2) return <View style={{ height }} />;

  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLon = Math.min(minLon, p.lon);
    maxLon = Math.max(maxLon, p.lon);
  }
  // Longitude lines get closer together away from the equator.
  const squash = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const w = Math.max((maxLon - minLon) * squash, 1e-6);
  const h = Math.max(maxLat - minLat, 1e-6);
  const scale = Math.min((W - pad * 2) / w, (H - pad * 2) / h);
  const offX = (W - w * scale) / 2;
  const offY = (H - h * scale) / 2;
  const xy = (p: Point) => [offX + (p.lon - minLon) * squash * scale, offY + (maxLat - p.lat) * scale];

  const line = points.map((p) => xy(p).map((n) => n.toFixed(1)).join(',')).join(' ');
  const [sx, sy] = xy(points[0]);
  const [ex, ey] = xy(points[points.length - 1]);

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <Polyline points={line} fill="none" stroke={color} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={sx} cy={sy} r={6} fill={color} />
      <Circle cx={ex} cy={ey} r={6} fill="#FFFFFF" stroke={color} strokeWidth={3} />
    </Svg>
  );
}
