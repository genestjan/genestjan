import { useState } from 'react';
import { MapPin, Search } from 'lucide-react';
import type { Endpoint, LatLng } from '../types';
import { searchPlaces, reverseGeocode, type GeocodeResult } from '../services/geocoding';
import { Notice } from './ui';

/**
 * Search by name or address, then the rider must pick one result. Several
 * matches (six Jollibee branches in General Santos, for example) are never
 * resolved automatically.
 */
export function EndpointPicker({
  id,
  label,
  value,
  onChange,
  pickingOnMap,
  onPickOnMap,
}: {
  id: string;
  label: string;
  value: Endpoint;
  onChange: (e: Endpoint) => void;
  pickingOnMap: boolean;
  onPickOnMap: () => void;
}) {
  const [q, setQ] = useState(value.point ? '' : value.label);
  const [results, setResults] = useState<GeocodeResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await searchPlaces(q);
      setResults(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <fieldset className="rounded-2xl border border-slate-200 p-3">
      <legend className="px-1 text-sm font-semibold text-navy">{label}</legend>
      {value.point ? (
        <div className="rounded-xl bg-go-soft p-2 text-sm text-green-900">
          <p className="font-semibold">Selected: {value.label}</p>
          {value.address && <p className="text-xs">{value.address}</p>}
          <p className="font-mono text-xs">
            {value.point.lat.toFixed(6)}, {value.point.lng.toFixed(6)}
          </p>
          <p className="text-xs">Source: {value.source === 'map-pin' ? 'pin you dropped on the map' : 'OpenStreetMap (Nominatim)'}</p>
        </div>
      ) : (
        <p className="text-sm font-medium text-caution">Not confirmed. Search and choose the exact place, or pick it on the map.</p>
      )}
      <div className="mt-2 flex gap-2">
        <label htmlFor={id} className="sr-only">
          Search for {label}
        </label>
        <input
          id={id}
          className="input"
          value={q}
          placeholder="Name, address or landmark"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), run())}
        />
        <button type="button" className="btn-primary shrink-0" onClick={run} disabled={busy || q.trim().length < 3}>
          <Search aria-hidden className="h-4 w-4" />
          {busy ? 'Searching' : 'Search'}
        </button>
      </div>
      <button type="button" className={`btn-ghost mt-1 ${pickingOnMap ? 'bg-caution-soft' : ''}`} onClick={onPickOnMap} aria-pressed={pickingOnMap}>
        <MapPin aria-hidden className="h-4 w-4" />
        {pickingOnMap ? 'Tap the map to place this point…' : 'Pick on map instead'}
      </button>
      {error && <Notice level="caution" title="Search failed">{error}</Notice>}
      {results && (
        <div className="mt-2">
          {results.length === 0 ? (
            <p className="text-sm text-slate-600">No matches in OpenStreetMap. Try another spelling, a nearby landmark, or pick on the map.</p>
          ) : (
            <>
              {results.length > 1 && (
                <p className="mb-1 text-sm font-medium text-caution">{results.length} matches found. Choose the right one; RideWise will not guess.</p>
              )}
              <ul className="max-h-64 space-y-1 overflow-y-auto" aria-label={`Search results for ${label}`}>
                {results.map((r) => (
                  <li key={r.osmRef}>
                    <button
                      type="button"
                      className="w-full rounded-xl border border-slate-200 p-2 text-left text-sm hover:bg-slate-50"
                      onClick={() => {
                        onChange({ label: r.label, address: r.address, point: r.point, source: 'osm-nominatim', osmRef: r.osmRef });
                        setResults(null);
                      }}
                    >
                      <span className="font-semibold">{r.label}</span>
                      <span className="block text-xs text-slate-600">{r.address}</span>
                      <span className="block font-mono text-[11px] text-slate-500">
                        {r.point!.lat.toFixed(5)}, {r.point!.lng.toFixed(5)} · {r.category}/{r.type}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </fieldset>
  );
}

export async function endpointFromPin(p: LatLng): Promise<Endpoint> {
  const address = await reverseGeocode(p.lat, p.lng);
  return { label: address?.split(',')[0] ?? 'Dropped pin', address: address ?? undefined, point: p, source: 'map-pin' };
}
