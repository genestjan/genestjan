import { useEffect } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { LatLng, VehicleType } from '../lib/types';
import { GENSAN } from '../lib/geo';

const glyph: Record<string, string> = { motorcycle: '🏍️', tricycle: '🛺', car: '🚗', van: '🚐' };

const pin = (bg: string, inner: string, size = 34) =>
  L.divIcon({
    className: 'smooth',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};display:grid;place-items:center;border:3px solid #050d05;box-shadow:0 0 14px rgba(127,240,4,.7);font-size:${size * 0.5}px">${inner}</div>`,
  });

export const icons = {
  me: pin('#3b82f6', '', 22),
  pickup: pin('#7ff004', '●', 30),
  drop: pin('#ef4444', '⚑', 30),
  vehicle: (t: VehicleType) => pin('#b9f73c', glyph[t] ?? '🏍️', 40),
  customer: pin('#ffffff', '🙋', 38),
};

export type MapMarker = { id: string; p: LatLng; icon: L.DivIcon; onClick?: () => void };

function Fit({ points }: { points: LatLng[] }) {
  const map = useMap();
  const key = points.map((p) => p.lat.toFixed(3) + p.lng.toFixed(3)).join('|');
  useEffect(() => {
    // The bottom sheet covers roughly the lower half, so keep markers in the visible top part.
    const bottom = Math.round(map.getSize().y * 0.5);
    if (points.length) map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { paddingTopLeft: [50, 130], paddingBottomRight: [50, bottom], maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

function Clicks({ onPick }: { onPick?: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onPick?.({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

export function MapView({ markers, line, fit, onPick, className = '' }: { markers: MapMarker[]; line?: LatLng[]; fit: LatLng[]; onPick?: (p: LatLng) => void; className?: string }) {
  return (
    <MapContainer center={GENSAN} zoom={14} zoomControl={false} className={'map-dark h-full w-full ' + className} attributionControl>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" maxZoom={19} />
      {line && line.length > 1 && (
        <>
          <Polyline positions={line} pathOptions={{ color: '#050d05', weight: 9, opacity: 0.8 }} />
          <Polyline positions={line} pathOptions={{ color: '#7ff004', weight: 5 }} />
        </>
      )}
      {markers.map((m) => (
        <Marker key={m.id} position={m.p} icon={m.icon} eventHandlers={m.onClick ? { click: m.onClick } : undefined} />
      ))}
      <Fit points={fit} />
      <Clicks onPick={onPick} />
    </MapContainer>
  );
}
