import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Candidate, LatLng, PlannedStop, RouteResult } from '../types';
import { config } from '../config';
import { boundsOf, cumulativeKm, pointAtKm } from '../lib/geo';
import { GROUP_OF, GROUP_STYLE } from './mapStyle';

const pin = (color: string, text: string, size = 24, ring = false) =>
  L.divIcon({
    className: '',
    html: `<div class="rw-pin" style="width:${size}px;height:${size}px;background:${color};${ring ? 'outline:3px solid #facc15;' : ''}">${text}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

function bearing(a: LatLng, b: LatLng) {
  const r = Math.PI / 180;
  const y = Math.sin((b.lng - a.lng) * r) * Math.cos(b.lat * r);
  const x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lng - a.lng) * r);
  return (Math.atan2(y, x) / r + 360) % 360;
}

function FitTo({ coords, focus }: { coords: [number, number][]; focus?: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (focus) map.setView([focus.lat, focus.lng], Math.max(map.getZoom(), 15));
  }, [focus, map]);
  useEffect(() => {
    const b = boundsOf(coords);
    if (b) map.fitBounds(b, { padding: [24, 24] });
  }, [coords, map]);
  return null;
}

function ClickCatcher({ onClick }: { onClick?: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onClick?.({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

export type RouteMapProps = {
  route?: RouteResult;
  alternatives?: RouteResult[];
  start?: LatLng | null;
  end?: LatLng | null;
  candidates?: Candidate[];
  stops?: PlannedStop[];
  selectedId?: string | null;
  onSelect?: (c: Candidate) => void;
  onMapClick?: (p: LatLng) => void;
  extraPoints?: { point: LatLng; label: string }[];
  focus?: LatLng | null;
  progressKm?: number | null;
  className?: string;
};

export function RouteMap({
  route,
  alternatives = [],
  start,
  end,
  candidates = [],
  stops = [],
  selectedId,
  onSelect,
  onMapClick,
  extraPoints = [],
  focus,
  progressKm,
  className = 'h-[60dvh]',
}: RouteMapProps) {
  const coords = route?.coords ?? [];
  const cum = useMemo(() => cumulativeKm(coords), [coords]);
  const arrows = useMemo(() => {
    if (coords.length < 2) return [];
    const total = cum[cum.length - 1];
    const step = Math.max(2, total / 12);
    const out: { p: LatLng; deg: number }[] = [];
    for (let km = step / 2; km < total; km += step) {
      const a = pointAtKm(coords, km, cum);
      const b = pointAtKm(coords, Math.min(total, km + 0.2), cum);
      out.push({ p: a, deg: bearing(a, b) });
    }
    return out;
  }, [coords, cum]);
  const stopIds = new Set(stops.map((s) => s.place.id));
  const fitCoords = coords.length ? coords : ([start, end].filter(Boolean) as LatLng[]).map((p) => [p.lat, p.lng] as [number, number]);
  const center: [number, number] = start ? [start.lat, start.lng] : [6.6, 125.4];
  const progressPoint = progressKm != null && coords.length ? pointAtKm(coords, progressKm, cum) : null;

  return (
    <div className={`overflow-hidden rounded-2xl border border-slate-200 ${className}`}>
      <MapContainer center={center} zoom={9} className="h-full w-full" scrollWheelZoom>
        <TileLayer url={config.tileUrl} attribution={config.tileAttribution} maxZoom={19} />
        <FitTo coords={fitCoords} focus={focus} />
        <ClickCatcher onClick={onMapClick} />
        {alternatives
          .filter((a) => a.id !== route?.id)
          .map((a) => (
            <Polyline key={a.id} positions={a.coords} pathOptions={{ color: '#64748b', weight: 4, opacity: 0.5, dashArray: '6 8' }} />
          ))}
        {coords.length > 1 && (
          <>
            <Polyline positions={coords} pathOptions={{ color: '#ffffff', weight: 8, opacity: 0.9 }} />
            <Polyline positions={coords} pathOptions={{ color: '#0f1b2d', weight: 5 }} />
          </>
        )}
        {arrows.map((a, i) => (
          <Marker
            key={i}
            position={[a.p.lat, a.p.lng]}
            interactive={false}
            keyboard={false}
            icon={L.divIcon({ className: '', html: `<div class="rw-arrow" style="transform:rotate(${a.deg}deg)">▲</div>`, iconSize: [16, 16], iconAnchor: [8, 8] })}
          />
        ))}
        {candidates
          .filter((c) => !stopIds.has(c.id))
          .map((c) => {
            const g = GROUP_STYLE[GROUP_OF[c.category]];
            return (
              <Marker
                key={c.id}
                position={[c.point.lat, c.point.lng]}
                icon={pin(c.verification === 'reported-closed' ? '#94a3b8' : g.color, g.letter, 20, c.id === selectedId)}
                eventHandlers={{ click: () => onSelect?.(c) }}
                title={`${c.name} (${g.label})`}
                alt={`${c.name}, ${g.label}`}
              />
            );
          })}
        {stops.map((s, i) => (
          <Marker
            key={s.id}
            position={[s.place.point.lat, s.place.point.lng]}
            icon={pin(s.status === 'skipped' ? '#94a3b8' : s.status === 'completed' ? '#15803d' : '#0369a1', String(i + 1), 28, s.place.id === selectedId)}
            eventHandlers={{ click: () => onSelect?.(s.place) }}
            title={`Stop ${i + 1}: ${s.place.name}`}
            alt={`Stop ${i + 1}: ${s.place.name}`}
            zIndexOffset={500}
          >
            <Tooltip direction="top" offset={[0, -14]}>
              Stop {i + 1}: {s.place.name}
            </Tooltip>
          </Marker>
        ))}
        {start && <Marker position={[start.lat, start.lng]} icon={pin('#15803d', 'S', 30)} title="Start" alt="Start" zIndexOffset={800} />}
        {end && <Marker position={[end.lat, end.lng]} icon={pin('#0f1b2d', 'F', 30)} title="Finish" alt="Finish" zIndexOffset={800} />}
        {extraPoints.map((e, i) => (
          <Marker key={`x${i}`} position={[e.point.lat, e.point.lng]} icon={pin('#facc15', '?', 26)} title={e.label} alt={e.label}>
            <Tooltip permanent direction="top" offset={[0, -14]}>
              {e.label}
            </Tooltip>
          </Marker>
        ))}
        {progressPoint && <Marker position={[progressPoint.lat, progressPoint.lng]} icon={pin('#16a34a', '●', 22)} title="Your progress" alt="Your progress" zIndexOffset={900} />}
      </MapContainer>
    </div>
  );
}

export function MapLegend() {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-700" aria-label="Map legend">
      <li className="flex items-center gap-1"><span className="rw-pin h-4 w-4 text-[9px]" style={{ background: '#15803d' }}>S</span>Start</li>
      <li className="flex items-center gap-1"><span className="rw-pin h-4 w-4 text-[9px]" style={{ background: '#0f1b2d' }}>F</span>Finish</li>
      <li className="flex items-center gap-1"><span className="rw-pin h-4 w-4 text-[9px]" style={{ background: '#0369a1' }}>1</span>Planned stop</li>
      {Object.values(GROUP_STYLE).map((g) => (
        <li key={g.label} className="flex items-center gap-1">
          <span className="rw-pin h-4 w-4 text-[9px]" style={{ background: g.color }}>{g.letter}</span>
          {g.label}
        </li>
      ))}
      <li className="flex items-center gap-1"><span className="rw-pin h-4 w-4 text-[9px]" style={{ background: '#94a3b8' }}>×</span>Reported closed / skipped</li>
    </ul>
  );
}
