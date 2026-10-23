import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, MapPin, Search } from 'lucide-react';
import type { Candidate, LatLng, StopCategory } from '../types';
import { usePlanSchedule } from '../lib/usePlan';
import { discoverAlongRoute } from '../services/places';
import { addStop, addCustomPlace, applySuggestions, verifyPlace, validateCustomPlace, type CustomPlaceInput } from '../lib/planOps';
import { CATEGORY_LABEL } from '../lib/discovery';
import { GROUP_OF, GROUP_STYLE, type MapGroup } from '../components/mapStyle';
import { formatDateTime, formatDuration, formatKm } from '../lib/time';
import { useOnline } from '../lib/hooks';
import { Badge, Card, EmptyState, Field, Notice, PageTitle } from '../components/ui';
import { MapLegend, RouteMap } from '../components/RouteMap';
import { PlaceDetail } from '../components/PlaceDetail';
import { ElevationChart } from '../components/ElevationChart';
import { ELEVATION_SAMPLES, buildProfile, hasElevation } from '../lib/elevation';
import { fetchRouteElevation } from '../services/elevation';

export default function MapPage() {
  const { plan, schedule, edit } = usePlanSchedule();
  const online = useOnline();
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<MapGroup>>(new Set(['fuel']));
  const [pinMode, setPinMode] = useState(false);
  const [pin, setPin] = useState<LatLng | null>(null);
  const mapBox = useRef<HTMLDivElement>(null);
  const startPinMode = () => {
    setPinMode((m) => !m);
    // The button sits below the map; bring the map back into view.
    if (!pinMode) mapBox.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const [hillsBusy, setHillsBusy] = useState(false);
  const [hillsError, setHillsError] = useState<string | null>(null);
  const routeId = plan?.route?.id;
  const hasHills = hasElevation(plan?.route);
  const loadHills = useCallback(async () => {
    const route = plan?.route;
    if (!route) return;
    setHillsBusy(true);
    setHillsError(null);
    try {
      const data = await fetchRouteElevation(route.coords);
      edit((p) => (p.route && p.route.id === route.id ? { ...p, route: { ...p.route, elevation: data } } : p));
    } catch (e) {
      setHillsError((e as Error).message);
    } finally {
      setHillsBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);
  // Look up the hills by themselves, once per route, when there is a connection.
  useEffect(() => {
    if (routeId && !hasHills && online) void loadHills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId, online]);

  const visible = useMemo(
    () => (plan?.candidates ?? []).filter((c) => !hidden.has(GROUP_OF[c.category]) && c.insideCorridor),
    [plan?.candidates, hidden],
  );

  if (!plan) return <EmptyState title="No ride plan open" action={<Link className="btn-primary" to="/plan">Plan My Ride</Link>} />;
  if (!plan.route)
    return (
      <div>
        <PageTitle title="Route Map" />
        <EmptyState title="No route yet" action={<Link className="btn-primary" to="/plan">Calculate a route</Link>}>
          Choose the start and destination and calculate a bicycle route first.
        </EmptyState>
      </div>
    );

  const search = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await discoverAlongRoute(plan.route!.coords, plan.settings.corridorM, plan.settings.preferOnRoute);
      // Keep rider-added places; refresh OSM ones.
      const mine = plan.candidates.filter((c) => c.source === 'user' || c.source === 'map-pin');
      edit((p) => ({ ...p, candidates: [...r.candidates, ...mine].sort((a, b) => a.routeKm - b.routeKm), candidatesRetrievedAt: r.retrievedAt, candidatesSource: r.source }));
      setReport(
        `${r.candidates.length} places found. ${r.report.missingCoords ? `${r.report.missingCoords} skipped for missing coordinates. ` : ''}${r.report.duplicates ? `${r.report.duplicates} duplicates merged.` : ''}`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const inPlan = (c: Candidate) => plan.stops.some((s) => s.place.id === c.id);
  const counts = plan.candidates.reduce<Record<MapGroup, number>>((acc, c) => {
    if (c.insideCorridor) acc[GROUP_OF[c.category]] = (acc[GROUP_OF[c.category]] ?? 0) + 1;
    return acc;
  }, {} as Record<MapGroup, number>);

  const info = hasElevation(plan.route) ? buildProfile(plan.route.coords, plan.route.elevation) : null;
  const rideMin = schedule?.ok ? schedule.totals.movingMin + schedule.totals.bufferMin : (plan.route.distanceM / 1000 / plan.settings.speedKmh) * 60;

  return (
    <div className="space-y-4">
      <PageTitle
        title="Route Map"
        subtitle={`${plan.start.label} → ${plan.end.label}`}
        action={plan.isSample ? <Badge tone="caution">Sample: demonstration data</Badge> : undefined}
      />
      <div ref={mapBox} className="relative">
        {pinMode && !pin && (
          <p className="absolute inset-x-3 top-3 z-[1100] rounded-full bg-caution px-4 py-2 text-center text-sm font-bold text-white shadow-lift" role="status">
            Tap the map where the stop is. <button type="button" className="underline" onClick={() => setPinMode(false)}>Cancel</button>
          </p>
        )}
        <RouteMap
          className="h-[52dvh] min-h-[320px]"
          route={plan.route}
          start={plan.start.point}
          end={plan.end.point}
          candidates={visible}
          stops={plan.stops}
          selectedId={selected?.id}
          onSelect={(c) => setSelected(c)}
          onMapClick={pinMode ? (p) => setPin(p) : undefined}
          extraPoints={pin ? [{ point: pin, label: 'New stop' }] : []}
          focus={selected?.point ?? pin}
        />
      </div>

      <section className="card" aria-labelledby="route-details">
        <h2 id="route-details" className="font-display text-xl font-bold text-navy">Route Details</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4">
          <div>
            <dt className="text-sm text-slate-500">Total distance</dt>
            <dd className="font-display text-2xl font-bold">{formatKm(plan.route.distanceM / 1000)}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Time on the bike</dt>
            <dd className="font-display text-2xl font-bold">{formatDuration(rideMin)}</dd>
            <dd className="text-xs text-slate-500">an estimate, at {plan.settings.speedKmh} km/h</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Total climb</dt>
            <dd className="font-display text-2xl font-bold">{info ? `about ${info.ascentM} m` : '—'}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Steepest hill</dt>
            <dd className="font-display text-2xl font-bold">{info ? `${info.steepestUpPct.toFixed(1)}%` : '—'}</dd>
            {info && <dd className="text-xs text-slate-500">averaged over about {(plan.route.distanceM / 1000 / (ELEVATION_SAMPLES - 1)).toFixed(1)} km</dd>}
          </div>
        </dl>
        {info ? (
          <div className="mt-4">
            <h3 className="mb-1 text-base font-semibold text-slate-700">Hills along the way</h3>
            <ElevationChart route={plan.route} stops={plan.stops} />
            <p className="mt-2 text-xs text-slate-500">
              Highest point {info.highestM} m. From a 90 m terrain map ({plan.route.elevation!.source}), retrieved {plan.route.elevation!.retrievedAt.slice(0, 10)}. Small bumps do not show, so these are estimates.
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl bg-brand-50 p-3 text-base">
            {hillsBusy ? 'Looking up the hills…' : hillsError ? `I could not get the hills: ${hillsError}` : online ? 'Hills are not loaded yet.' : 'Hills need internet. Open this page once with signal to save them.'}
            {!hillsBusy && online && (
              <button type="button" className="btn-soft ml-2 min-h-[40px]" onClick={() => void loadHills()}>
                {hillsError ? 'Try again' : 'Show hills'}
              </button>
            )}
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Route: {plan.route.providerLabel}, retrieved {plan.route.retrievedAt.slice(0, 10)}. Arrows show which way to ride. Map data © OpenStreetMap contributors.
        </p>
      </section>

      {selected && schedule && (
        <PlaceDetail
          c={selected}
          plan={plan}
          schedule={schedule}
          inPlan={inPlan(selected)}
          onClose={() => setSelected(null)}
          onAdd={() => edit((p) => addStop(p, selected, selected.category === 'restaurant' ? 'rest' : 'short', { autoSuggested: false }))}
          onVerify={() => {
            edit((p) => verifyPlace(p, selected.id));
            setSelected({ ...selected, verification: 'user-verified', lastVerified: new Date().toISOString().slice(0, 10) });
          }}
        />
      )}

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-navy">Places along the route</h2>
          <button type="button" className="btn-primary" onClick={search} disabled={busy || !online}>
            {busy ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Search aria-hidden className="h-4 w-4" />}
            {busy ? 'Searching (can take a minute)…' : plan.candidates.length ? 'Search again' : 'Find real stops along this route'}
          </button>
        </div>
        {!online && <Notice level="caution" title="Place search needs internet">Saved places below still work offline.</Notice>}
        {error && <Notice level="danger" title="Place search failed">{error}</Notice>}
        {report && <Notice level="ok" title={report} />}
        {plan.candidatesRetrievedAt ? (
          <p className="text-xs text-slate-500">
            {plan.candidates.length} places from {plan.candidatesSource}, retrieved {formatDateTime(Date.parse(plan.candidatesRetrievedAt), plan.timeZone)}. OpenStreetMap coverage of small shops is incomplete; many sari-sari stores are not mapped.
          </p>
        ) : (
          <p className="text-sm text-slate-600">No places loaded yet. RideWise searches OpenStreetMap within {plan.settings.corridorM >= 1000 ? `${plan.settings.corridorM / 1000} km` : `${plan.settings.corridorM} m`} of the route.</p>
        )}
        <Field label="Search distance each side of the route" htmlFor="corridor" hint="Change it, then search again.">
          <select id="corridor" className="input" value={plan.settings.corridorM} onChange={(e) => edit((p) => ({ ...p, settings: { ...p.settings, corridorM: Number(e.target.value) } }))}>
            {[300, 500, 1000, 1500, 2000, 3000].map((m) => (
              <option key={m} value={m}>
                {m >= 1000 ? `${m / 1000} km` : `${m} m`}
              </option>
            ))}
          </select>
        </Field>
        <fieldset>
          <legend className="label">Show on map</legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(GROUP_STYLE) as MapGroup[]).map((g) => {
              const on = !hidden.has(g);
              return (
                <label key={g} className={`chip min-h-[40px] cursor-pointer border px-3 text-sm ${on ? 'border-navy bg-navy text-white' : 'border-slate-300 bg-white text-slate-700'}`}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={on}
                    onChange={() => setHidden((h) => {
                      const n = new Set(h);
                      if (n.has(g)) n.delete(g);
                      else n.add(g);
                      return n;
                    })}
                  />
                  {GROUP_STYLE[g].label} ({counts[g] ?? 0})
                </label>
              );
            })}
          </div>
        </fieldset>
        <MapLegend />
        {plan.candidates.length > 0 && plan.stops.length === 0 && (
          <button type="button" className="btn-go" onClick={() => edit((p) => applySuggestions(p).plan)}>
            Suggest pit stops from these places
          </button>
        )}
      </Card>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-navy">Add a stop that is not on the map</h2>
          <button type="button" className={pinMode ? 'btn-go' : 'btn-secondary'} onClick={startPinMode} aria-pressed={pinMode}>
            <MapPin aria-hidden className="h-4 w-4" />
            {pinMode ? 'Tap the map to drop the pin' : 'Drop a pin'}
          </button>
        </div>
        <p className="text-sm text-slate-600">For sari-sari stores, carinderias and water refills you know but OpenStreetMap does not. Saved as user-submitted until someone confirms it.</p>
        {pin && <CustomStopForm pin={pin} onCancel={() => { setPin(null); setPinMode(false); }} onSave={(input) => {
          edit((p) => addCustomPlace(p, input, true));
          setPin(null);
          setPinMode(false);
        }} />}
      </Card>

      {plan.candidates.length > 0 && (
        <Card>
          <h2 className="mb-2 font-bold text-navy">List view</h2>
          <ul className="max-h-[50dvh] divide-y divide-slate-100 overflow-y-auto">
            {visible.map((c) => (
              <li key={c.id}>
                <button type="button" className="flex min-h-[44px] w-full items-center justify-between gap-2 py-2 text-left" onClick={() => setSelected(c)}>
                  <span>
                    <span className="font-medium">{c.name}</span>
                    <span className="block text-xs text-slate-500">
                      km {c.routeKm.toFixed(1)} · {CATEGORY_LABEL[c.category]} · {c.offRouteM} m off route · {c.openingHours ? 'hours listed' : 'hours not verified'}
                    </span>
                  </span>
                  {inPlan(c) && <Badge tone="sky">In plan</Badge>}
                  {c.verification === 'reported-closed' && <Badge tone="danger">Closed</Badge>}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

const CUSTOM_TYPES: StopCategory[] = ['sari-sari', 'convenience', 'restaurant', 'cafe', 'bakery', 'water', 'toilets', 'shelter', 'bicycle', 'other'];
const SUPPLY_OPTIONS = ['Water', 'Ice', 'Soft drinks', 'Electrolyte drinks', 'Bread / snacks', 'Hot meals', 'Toilet', 'Shade / seats', 'Bike parking'];

function CustomStopForm({ pin, onSave, onCancel }: { pin: LatLng; onSave: (i: CustomPlaceInput) => void; onCancel: () => void }) {
  const [input, setInput] = useState<CustomPlaceInput>({ name: '', category: 'sari-sari', point: pin, supplies: [] });
  const [error, setError] = useState<string | null>(null);
  const set = (p: Partial<CustomPlaceInput>) => setInput((i) => ({ ...i, ...p, point: pin }));
  const onPhoto = (f: File | undefined) => {
    if (!f) return;
    const img = new Image();
    const url = URL.createObjectURL(f);
    img.onload = () => {
      // Downscale so photos do not fill device storage or share links.
      const scale = Math.min(1, 480 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
      set({ photo: c.toDataURL('image/jpeg', 0.7) });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };
  return (
    <form
      className="space-y-3 rounded-2xl border border-slate-200 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const err = validateCustomPlace(input);
        if (err) return setError(err);
        onSave(input);
      }}
    >
      <p className="font-mono text-xs text-slate-600">
        Pin: {pin.lat.toFixed(6)}, {pin.lng.toFixed(6)}
      </p>
      <Field label="Store or place name" htmlFor="c-name">
        <input id="c-name" className="input" value={input.name} onChange={(e) => set({ name: e.target.value })} required />
      </Field>
      <Field label="Type" htmlFor="c-type">
        <select id="c-type" className="input" value={input.category} onChange={(e) => set({ category: e.target.value as StopCategory })}>
          {CUSTOM_TYPES.map((t) => (
            <option key={t} value={t}>
              {CATEGORY_LABEL[t]}
            </option>
          ))}
        </select>
      </Field>
      <fieldset>
        <legend className="label">Available supplies</legend>
        <div className="flex flex-wrap gap-2">
          {SUPPLY_OPTIONS.map((s) => (
            <label key={s} className="flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-200 px-2 text-sm">
              <input type="checkbox" checked={input.supplies?.includes(s)} onChange={(e) => set({ supplies: e.target.checked ? [...(input.supplies ?? []), s] : input.supplies?.filter((x) => x !== s) })} />
              {s}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Opening hours, if known" htmlFor="c-hours" hint='OpenStreetMap style, e.g. "Mo-Su 06:00-21:00". Leave blank if unsure.'>
        <input id="c-hours" className="input" value={input.openingHours ?? ''} onChange={(e) => set({ openingHours: e.target.value })} />
      </Field>
      <Field label="Date you last confirmed it in person" htmlFor="c-date" hint="Leave blank if you have not been there recently; it stays unverified.">
        <input id="c-date" type="date" className="input" value={input.lastConfirmed ?? ''} onChange={(e) => set({ lastConfirmed: e.target.value })} />
      </Field>
      <Field label="Rider notes" htmlFor="c-notes">
        <textarea id="c-notes" className="input min-h-[70px]" value={input.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} placeholder="Shade, friendly owner, cold drinks, safe to park bikes…" />
      </Field>
      <Field label="Photo (optional)" htmlFor="c-photo">
        <input id="c-photo" type="file" accept="image/*" className="block text-sm" onChange={(e) => onPhoto(e.target.files?.[0])} />
      </Field>
      {input.photo && <img src={input.photo} alt="Preview of the uploaded store photo" className="max-h-32 rounded-lg" />}
      {error && <Notice level="danger" title={error} />}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary">Save stop</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
