import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Loader2, Plus, Route as RouteIcon, Trash2 } from 'lucide-react';
import type { BikeType, Endpoint, RidePlan, RideStyle, RouteResult, StopCategory } from '../types';
import { useStore } from '../store/store';
import { usePlanSchedule } from '../lib/usePlan';
import { newPlan, STYLE_PRESETS, ALL_STOP_TYPES } from '../lib/defaults';
import { routeWithFallback } from '../services/routing';
import { discoverAlongRoute } from '../services/places';
import { applySuggestions, selectRoute } from '../lib/planOps';
import { CATEGORY_LABEL } from '../lib/discovery';
import { formatDuration, formatKm, parseLocal } from '../lib/time';
import { validateSpeed } from '../lib/schedule';
import { Card, Field, Notice, NumberField, PageTitle } from '../components/ui';
import { EndpointPicker, endpointFromPin } from '../components/EndpointPicker';
import { RouteMap } from '../components/RouteMap';

const STEPS = ['Route', 'Rider', 'Bike', 'Prefs', 'Group'];

export default function PlanWizard() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const step = Math.min(5, Math.max(1, Number(params.get('step') ?? 1)));
  const setStep = (n: number) => setParams({ step: String(n) });
  const { plan, edit } = usePlanSchedule();
  const savePlan = useStore((s) => s.savePlan);

  if (!plan) {
    return (
      <div>
        <PageTitle title="Plan a Ride" />
        <Card>
          <p className="mb-3">Start a new plan. It is prefilled with the General Santos to Davao route; you can change both ends.</p>
          <button type="button" className="btn-primary" onClick={() => savePlan(newPlan())}>
            <RouteIcon aria-hidden className="h-4 w-4" /> Plan My Ride
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageTitle title="Plan a Ride" subtitle={plan.isSample ? 'Editing the sample plan (demo data)' : plan.name} />
      <ol className="mb-4 grid grid-cols-5 gap-1" aria-label="Planning steps">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => setStep(i + 1)}
              aria-current={step === i + 1 ? 'step' : undefined}
              className={`w-full rounded-lg px-1 py-2 text-xs font-semibold ${step === i + 1 ? 'bg-navy text-white' : 'bg-slate-200 text-slate-700'}`}
            >
              {i + 1}. {s}
            </button>
          </li>
        ))}
      </ol>
      {step === 1 && <RouteStep plan={plan} edit={edit} />}
      {step === 2 && <RiderStep plan={plan} edit={edit} />}
      {step === 3 && <BikeStep plan={plan} edit={edit} />}
      {step === 4 && <PrefsStep plan={plan} edit={edit} />}
      {step === 5 && <GroupStep plan={plan} edit={edit} onDone={() => nav('/schedule')} />}
      <div className="mt-4 flex justify-between">
        <button type="button" className="btn-secondary" disabled={step === 1} onClick={() => setStep(step - 1)}>
          <ArrowLeft aria-hidden className="h-4 w-4" /> Back
        </button>
        {step < 5 && (
          <button type="button" className="btn-primary" onClick={() => setStep(step + 1)}>
            Next <ArrowRight aria-hidden className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

type StepProps = { plan: RidePlan; edit: (fn: (p: RidePlan) => RidePlan) => void };

function RouteStep({ plan, edit }: StepProps) {
  const [picking, setPicking] = useState<null | 'start' | 'end' | number>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<RouteResult[] | null>(plan.alternatives ?? null);
  const depValid = parseLocal(plan.departureLocal, plan.timeZone) !== null;
  const [date, time] = plan.departureLocal.split('T');

  const setEndpoint = (which: 'start' | 'end' | number, e: Endpoint) =>
    edit((p) =>
      // Any change to the ends or waypoints invalidates the current route.
      typeof which === 'number'
        ? { ...p, waypoints: p.waypoints.map((w, i) => (i === which ? e : w)), route: undefined, alternatives: undefined }
        : { ...p, [which]: e, route: undefined, alternatives: undefined },
    );
  const unconfirmedWaypoints = plan.waypoints.filter((w) => !w.point).length;

  const calculate = async () => {
    if (!plan.start.point || !plan.end.point || unconfirmedWaypoints) return;
    setBusy(true);
    setError(null);
    try {
      const pts = [plan.start.point, ...plan.waypoints.map((w) => w.point).filter((p): p is NonNullable<typeof p> => !!p), plan.end.point];
      const { routes } = await routeWithFallback(pts);
      setOptions(routes);
      // The rider confirms the choice below; the first route is preselected
      // only so the map has something to show.
      edit((p) => selectRoute(p, routes[0], routes));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <EndpointPicker id="start" label="Starting point" value={plan.start} onChange={(e) => setEndpoint('start', e)} pickingOnMap={picking === 'start'} onPickOnMap={() => setPicking(picking === 'start' ? null : 'start')} />
        {plan.waypoints.map((w, i) => (
          <div key={i} className="relative">
            <EndpointPicker id={`wp${i}`} label={`Waypoint ${i + 1} (optional)`} value={w} onChange={(e) => setEndpoint(i, e)} pickingOnMap={picking === i} onPickOnMap={() => setPicking(picking === i ? null : i)} />
            <button type="button" className="btn-ghost absolute right-2 top-0 min-h-[36px] px-2" aria-label={`Remove waypoint ${i + 1}`} onClick={() => edit((p) => ({ ...p, waypoints: p.waypoints.filter((_, j) => j !== i), route: undefined }))}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <EndpointPicker id="end" label="Destination" value={plan.end} onChange={(e) => setEndpoint('end', e)} pickingOnMap={picking === 'end'} onPickOnMap={() => setPicking(picking === 'end' ? null : 'end')} />
        <button type="button" className="btn-ghost" onClick={() => edit((p) => ({ ...p, waypoints: [...p.waypoints, { label: '', point: null }] }))}>
          <Plus aria-hidden className="h-4 w-4" /> Add waypoint
        </button>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Departure date" htmlFor="dep-date">
            <input id="dep-date" type="date" className="input" value={date} onChange={(e) => edit((p) => ({ ...p, departureLocal: `${e.target.value}T${time}` }))} />
          </Field>
          <Field label="Departure time" htmlFor="dep-time">
            <input id="dep-time" type="time" className="input" value={time} onChange={(e) => edit((p) => ({ ...p, departureLocal: `${date}T${e.target.value}` }))} />
          </Field>
        </div>
        {!depValid && <Notice level="danger" title="Departure date or time is not valid." />}
        <p className="text-xs text-slate-500">Times are in Philippine time ({plan.timeZone}).</p>
      </Card>

      <RouteMap
        className="h-[45dvh]"
        route={plan.route}
        alternatives={plan.alternatives}
        start={plan.start.point}
        end={plan.end.point}
        extraPoints={plan.waypoints.filter((w) => w.point).map((w, i) => ({ point: w.point!, label: `Waypoint ${i + 1}` }))}
        onMapClick={
          picking === null
            ? undefined
            : async (pt) => {
                const which = picking;
                setPicking(null);
                setEndpoint(which, await endpointFromPin(pt));
              }
        }
      />

      <Card className="space-y-3">
        <button type="button" className="btn-primary w-full" onClick={calculate} disabled={busy || !plan.start.point || !plan.end.point || unconfirmedWaypoints > 0}>
          {busy ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <RouteIcon aria-hidden className="h-4 w-4" />}
          {busy ? 'Asking the bicycle router…' : plan.route ? 'Recalculate bicycle route' : 'Calculate bicycle route'}
        </button>
        {(!plan.start.point || !plan.end.point) && <p className="text-sm text-slate-600">Confirm both the start and destination first.</p>}
        {unconfirmedWaypoints > 0 && <p className="text-sm text-caution">Choose a place for each waypoint, or remove the empty ones.</p>}
        {!plan.route && (plan.stops.length > 0 || plan.candidates.length > 0) && (
          <Notice level="caution" title="The route changed">Recalculate it. Places from the old route will be cleared; stops you added yourself are kept and re-measured.</Notice>
        )}
        {error && <Notice level="danger" title="Route not available">{error} You can still try again later; nothing has been guessed.</Notice>}
        {options && options.length > 0 && <RouteCompare plan={plan} options={options} onChoose={(r) => edit((p) => selectRoute(p, r, options))} />}
        <Notice level="info" title="A mapped route is a planning aid">
          It is not a guarantee that every road is safe, open, or legally accessible to bicycles. Check the route with riders who know it, and obey local traffic rules.
        </Notice>
      </Card>
    </div>
  );
}

function RouteCompare({ plan, options, onChoose }: { plan: RidePlan; options: RouteResult[]; onChoose: (r: RouteResult) => void }) {
  const speed = plan.settings.speedKmh;
  return (
    <div>
      <h3 className="font-semibold text-navy">Compare routes</h3>
      <p className="mb-2 text-xs text-slate-600">
        The shortest route is not chosen automatically. Times use your group pace of {speed} km/h, not the router's own estimate.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-1">Route</th>
              <th>Distance</th>
              <th>Riding time</th>
              <th>Elevation gain</th>
              <th>Surface / road type</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {options.map((r, i) => {
              const chosen = plan.route?.id === r.id;
              return (
                <tr key={r.id} className={`border-t border-slate-100 ${chosen ? 'bg-sky-soft' : ''}`}>
                  <td className="py-2 font-medium">
                    {String.fromCharCode(65 + i)}
                    <span className="block text-[11px] font-normal text-slate-500">{r.providerLabel}</span>
                  </td>
                  <td>{formatKm(r.distanceM / 1000)}</td>
                  <td>{formatDuration((r.distanceM / 1000 / speed) * 60)}</td>
                  <td>{r.ascentM != null ? `${Math.round(r.ascentM)} m` : 'Not available'}</td>
                  <td className="text-xs">
                    {r.surfaceSummary ? Object.entries(r.surfaceSummary).map(([k, v]) => `${k} ${Math.round(v * 100)}%`).join(', ') : 'Not available'}
                    {r.wayTypeSummary && <span className="block">{Object.entries(r.wayTypeSummary).map(([k, v]) => `${k} ${Math.round(v * 100)}%`).join(', ')}</span>}
                  </td>
                  <td>
                    <button type="button" className={chosen ? 'btn-go min-h-[36px]' : 'btn-secondary min-h-[36px]'} onClick={() => onChoose(r)} aria-pressed={chosen}>
                      {chosen ? 'Selected' : 'Use'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {options.some((r) => r.distanceM > options[0].distanceM * 1.5) && (
        <p className="mt-1 text-xs text-slate-600">Much longer alternatives are usually detours around a closed or excluded road segment; inspect them on the map before choosing.</p>
      )}
    </div>
  );
}

function RiderStep({ plan, edit }: StepProps) {
  const rider = useStore((s) => s.rider);
  const setRider = useStore((s) => s.setRider);
  const applyStyle = (style: RideStyle) => {
    setRider({ ...rider, style });
    edit((p) => ({ ...p, settings: { ...p.settings, ...STYLE_PRESETS[style] } }));
  };
  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h2 className="font-bold text-navy">Ride style</h2>
        <p className="text-sm text-slate-600">Sets editable starting values for pace and stop frequency. Based on how you like to ride, never on age.</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {(['relaxed', 'moderate', 'experienced'] as RideStyle[]).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={rider.style === s}
              onClick={() => applyStyle(s)}
              className={`rounded-xl border p-3 text-left ${rider.style === s ? 'border-navy bg-navy text-white' : 'border-slate-300 bg-white'}`}
            >
              <span className="font-semibold capitalize">{s === 'relaxed' ? 'Relaxed recreational' : s === 'moderate' ? 'Moderate endurance' : 'Experienced endurance'}</span>
              <span className="block text-xs opacity-80">
                ~{STYLE_PRESETS[s].speedKmh} km/h, stop every {STYLE_PRESETS[s].maxRideMinBetweenStops} min
              </span>
            </button>
          ))}
        </div>
      </Card>
      <Card className="space-y-3">
        <h2 className="font-bold text-navy">About you (optional, stays on this phone)</h2>
        <p className="text-sm text-slate-600">
          Nothing here is required. It is never put in share links or sent to other riders. Medical details are optional and only shown to you in the emergency panel.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Display name" htmlFor="r-name">
            <input id="r-name" className="input" value={rider.displayName ?? ''} onChange={(e) => setRider({ ...rider, displayName: e.target.value })} />
          </Field>
          <Field label="Age range" htmlFor="r-age">
            <select id="r-age" className="input" value={rider.ageRange ?? ''} onChange={(e) => setRider({ ...rider, ageRange: e.target.value || undefined })}>
              <option value="">Prefer not to say</option>
              {['Under 30', '30–39', '40–49', '50–59', '60+'].map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </Field>
          <Field label="Fitness (self-assessed)" htmlFor="r-fit">
            <select id="r-fit" className="input" value={rider.fitness ?? ''} onChange={(e) => setRider({ ...rider, fitness: (e.target.value || undefined) as never })}>
              <option value="">Prefer not to say</option>
              <option value="building">Building up</option>
              <option value="steady">Steady</option>
              <option value="strong">Strong</option>
            </select>
          </Field>
          <NumberField id="r-speed" optional label="Comfortable cruising speed" suffix="km/h" value={rider.comfortableKmh ?? NaN} min={5} max={45} onChange={(n) => setRider({ ...rider, comfortableKmh: Number.isFinite(n) ? n : undefined })} hint="Used as a suggestion for the group pace." />
          <NumberField id="r-break" optional label="Usual break every" suffix="min" value={rider.usualBreakMin ?? NaN} min={10} max={240} onChange={(n) => setRider({ ...rider, usualBreakMin: Number.isFinite(n) ? n : undefined })} />
          <Field label="Food preferences" htmlFor="r-diet">
            <input id="r-diet" className="input" value={rider.dietary ?? ''} onChange={(e) => setRider({ ...rider, dietary: e.target.value })} placeholder="e.g. no pork, vegetarian" />
          </Field>
          <Field label="Emergency contact name" htmlFor="r-ecn">
            <input id="r-ecn" className="input" value={rider.emergencyContactName ?? ''} onChange={(e) => setRider({ ...rider, emergencyContactName: e.target.value })} autoComplete="off" />
          </Field>
          <Field label="Emergency contact phone" htmlFor="r-ecp">
            <input id="r-ecp" className="input" type="tel" value={rider.emergencyContactPhone ?? ''} onChange={(e) => setRider({ ...rider, emergencyContactPhone: e.target.value })} autoComplete="off" />
          </Field>
        </div>
        <Field label="Medical or emergency notes (optional)" htmlFor="r-med" hint="Only if you want responders or yourself to see it. Not shared.">
          <textarea id="r-med" className="input min-h-[80px]" value={rider.medicalNotes ?? ''} onChange={(e) => setRider({ ...rider, medicalNotes: e.target.value })} />
        </Field>
        {rider.comfortableKmh && rider.comfortableKmh < plan.settings.speedKmh && (
          <Notice level="caution" title={`Your comfortable speed (${rider.comfortableKmh} km/h) is below the plan pace (${plan.settings.speedKmh} km/h).`}>
            <button type="button" className="btn-secondary mt-1 min-h-[36px]" onClick={() => edit((p) => ({ ...p, settings: { ...p.settings, speedKmh: rider.comfortableKmh! } }))}>
              Use {rider.comfortableKmh} km/h for the plan
            </button>
          </Notice>
        )}
      </Card>
    </div>
  );
}

function BikeStep({ plan, edit }: StepProps) {
  const b = plan.bike;
  const set = (patch: Partial<RidePlan['bike']>) => edit((p) => ({ ...p, bike: { ...p.bike, ...patch } }));
  return (
    <Card className="space-y-3">
      <h2 className="font-bold text-navy">Your bicycle</h2>
      <Field label="Bike type" htmlFor="b-type">
        <select id="b-type" className="input" value={b.type} onChange={(e) => set({ type: e.target.value as BikeType })}>
          {['road', 'gravel', 'mountain', 'hybrid', 'touring', 'other'].map((t) => (
            <option key={t} value={t}>
              {t[0].toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tyres" htmlFor="b-tire">
          <input id="b-tire" className="input" value={b.tire ?? ''} onChange={(e) => set({ tire: e.target.value })} placeholder="e.g. 700x28c tubeless" />
        </Field>
        <Field label="Tyre pressure range" htmlFor="b-psi" hint="Copy it from the tyre sidewall or rim maker. RideWise does not invent pressures.">
          <input id="b-psi" className="input" value={b.tirePressureNote ?? ''} onChange={(e) => set({ tirePressureNote: e.target.value })} placeholder="From the tyre sidewall" />
        </Field>
        <NumberField id="b-tubes" label="Spare tubes carried" value={b.spareTubes ?? 0} min={0} max={10} onChange={(n) => set({ spareTubes: n })} />
        <Field label="Brake type" htmlFor="b-brake">
          <select id="b-brake" className="input" value={b.brakeType ?? ''} onChange={(e) => set({ brakeType: e.target.value })}>
            <option value="">Not set</option>
            <option>Rim brakes</option>
            <option>Mechanical disc</option>
            <option>Hydraulic disc</option>
          </select>
        </Field>
        <Field label="Repair kit" htmlFor="b-kit">
          <input id="b-kit" className="input" value={b.repairKit ?? ''} onChange={(e) => set({ repairKit: e.target.value })} placeholder="Pump, levers, multitool, patches" />
        </Field>
      </div>
      <label className="flex min-h-[44px] items-center gap-3">
        <input type="checkbox" className="h-5 w-5" checked={!!b.lights} onChange={(e) => set({ lights: e.target.checked })} /> Front and rear lights fitted
      </label>
      <label className="flex min-h-[44px] items-center gap-3">
        <input type="checkbox" className="h-5 w-5" checked={!!b.chainLubed} onChange={(e) => set({ chainLubed: e.target.checked })} /> Chain cleaned and lubricated recently
      </label>
      {!b.lights && <Notice level="caution" title="No lights recorded. A long ride can run into dusk; carry front and rear lights." />}
    </Card>
  );
}

function PrefsStep({ plan, edit }: StepProps) {
  const s = plan.settings;
  const set = (patch: Partial<RidePlan['settings']>) => edit((p) => ({ ...p, settings: { ...p.settings, ...patch } }));
  const speedErr = validateSpeed(s.speedKmh);
  const toggleType = (t: StopCategory) => set({ stopTypes: s.stopTypes.includes(t) ? s.stopTypes.filter((x) => x !== t) : [...s.stopTypes, t] });
  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h2 className="font-bold text-navy">Pace and stops</h2>
        <p className="text-sm text-slate-600">Editable planning defaults, not medical advice. Stop whenever you need to, whatever the plan says.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField id="p-speed" label="Group moving speed" suffix="km/h" value={s.speedKmh} min={5} max={45} step={0.5} onChange={(n) => set({ speedKmh: n })} hint="Use the slowest comfortable rider's pace." />
          <NumberField id="p-maxride" label="Max riding between stops" suffix="min" value={s.maxRideMinBetweenStops} min={15} max={180} onChange={(n) => set({ maxRideMinBetweenStops: n })} />
          <NumberField id="p-interval" label="Preferred stop interval" suffix="km" value={s.preferredStopIntervalKm} min={3} max={80} onChange={(n) => set({ preferredStopIntervalKm: n })} />
          <NumberField id="p-buffer" label="Delay buffer" suffix="%" value={s.delayBufferPct} min={0} max={100} onChange={(n) => set({ delayBufferPct: n })} hint="Extra time for lights, hills, traffic and flats." />
          <NumberField id="p-short" label="Short stop" suffix="min" value={s.shortStopMin} min={0} max={60} onChange={(n) => set({ shortStopMin: n })} />
          <NumberField id="p-rest" label="Rest stop" suffix="min" value={s.restStopMin} min={0} max={90} onChange={(n) => set({ restStopMin: n })} />
          <NumberField id="p-meal" label="Meal stop" suffix="min" value={s.mealStopMin} min={0} max={120} onChange={(n) => set({ mealStopMin: n })} />
          <Field label="Lunch around" htmlFor="p-lunch">
            <input id="p-lunch" type="time" className="input" value={s.lunchTime} onChange={(e) => set({ lunchTime: e.target.value })} />
          </Field>
        </div>
        {speedErr && <Notice level="danger" title={speedErr} />}
      </Card>
      <Card className="space-y-3">
        <h2 className="font-bold text-navy">Where to stop</h2>
        <div className="flex flex-wrap gap-2">
          {ALL_STOP_TYPES.map((t) => (
            <label key={t} className={`chip min-h-[40px] cursor-pointer border px-3 text-sm ${s.stopTypes.includes(t) ? 'border-navy bg-navy text-white' : 'border-slate-300 bg-white text-slate-700'}`}>
              <input type="checkbox" className="sr-only" checked={s.stopTypes.includes(t)} onChange={() => toggleType(t)} />
              {CATEGORY_LABEL[t]}
            </label>
          ))}
        </div>
        <label className="flex min-h-[44px] items-center gap-3">
          <input type="checkbox" className="h-5 w-5" checked={s.preferOnRoute} onChange={(e) => set({ preferOnRoute: e.target.checked })} /> Prefer roadside stops over detours
        </label>
        <label className="flex min-h-[44px] items-start gap-3">
          <input type="checkbox" className="mt-1 h-5 w-5" checked={s.includeFuelStations} onChange={(e) => set({ includeFuelStations: e.target.checked })} />
          <span>
            Allow fuel stations as automatic stops
            <span className="block text-xs text-slate-500">Only stations you have confirmed in person, with a safe area away from the pumps.</span>
          </span>
        </label>
        <Field label="Search distance each side of the route" htmlFor="p-corr" hint="For finding places. Being inside it does not mean a place is reachable by bike.">
          <select id="p-corr" className="input" value={s.corridorM} onChange={(e) => set({ corridorM: Number(e.target.value) })}>
            {[300, 500, 1000, 1500, 2000, 3000].map((m) => (
              <option key={m} value={m}>
                {m >= 1000 ? `${m / 1000} km` : `${m} m`}
              </option>
            ))}
          </select>
        </Field>
      </Card>
    </div>
  );
}

function GroupStep({ plan, edit, onDone }: StepProps & { onDone: () => void }) {
  const g = plan.group;
  const set = (patch: Partial<RidePlan['group']>) => edit((p) => ({ ...p, group: { ...p.group, ...patch } }));
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ level: 'ok' | 'caution' | 'danger'; text: string } | null>(null);
  const ready = useMemo(() => !!plan.route, [plan.route]);

  const build = async () => {
    if (!plan.route) return;
    let current = plan;
    let searchError = '';
    setMsg(null);
    if (plan.candidates.length === 0) {
      setBusy('Searching OpenStreetMap for real places along the route…');
      try {
        const r = await discoverAlongRoute(plan.route.coords, plan.settings.corridorM, plan.settings.preferOnRoute);
        current = { ...current, candidates: r.candidates, candidatesRetrievedAt: r.retrievedAt, candidatesSource: r.source };
      } catch (e) {
        searchError = `${(e as Error).message} `;
      }
    }
    setBusy('Building the pit stop schedule…');
    const { plan: next, gaps } = applySuggestions(current);
    edit(() => next);
    setBusy(null);
    if (next.candidates.length === 0) {
      setMsg({ level: 'danger', text: `${searchError}No places could be loaded, so no stops were suggested. The schedule shows riding time only. Add stops by dropping pins on the Map page, or try the search again later.` });
    } else {
      onDone();
      if (gaps.length) setMsg({ level: 'caution', text: `${gaps.length} stretch(es) had no suitable mapped stop. They are flagged on the schedule.` });
    }
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h2 className="font-bold text-navy">Group</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Group ride name" htmlFor="g-name">
            <input id="g-name" className="input" value={g.name ?? ''} onChange={(e) => set({ name: e.target.value })} placeholder="Saturday Titos Ride" />
          </Field>
          <Field label="Organiser" htmlFor="g-org">
            <input id="g-org" className="input" value={g.organizer ?? ''} onChange={(e) => set({ organizer: e.target.value })} />
          </Field>
          <NumberField id="g-riders" label="Number of riders" value={g.riders} min={1} max={100} onChange={(n) => set({ riders: n })} />
          <NumberField
            id="g-slow"
            optional
            label="Slowest comfortable pace"
            suffix="km/h"
            value={g.slowestComfortableKmh ?? NaN}
            min={5}
            max={45}
            step={0.5}
            onChange={(n) => {
              set({ slowestComfortableKmh: Number.isFinite(n) ? n : undefined });
              if (!validateSpeed(n)) edit((p) => ({ ...p, group: { ...p.group, slowestComfortableKmh: n }, settings: { ...p.settings, speedKmh: n } }));
            }}
            hint="The schedule uses this pace, not the fastest rider's."
          />
          <NumberField id="g-regroup" label="Regroup time at each stop" suffix="min" value={plan.settings.regroupMin} min={0} max={30} onChange={(n) => edit((p) => ({ ...p, settings: { ...p.settings, regroupMin: n } }))} />
          <Field label="Meeting point" htmlFor="g-meet">
            <input id="g-meet" className="input" value={g.meetingPoint ?? ''} onChange={(e) => set({ meetingPoint: e.target.value })} placeholder={plan.start.label} />
          </Field>
        </div>
        <label className="flex min-h-[44px] items-center gap-3">
          <input type="checkbox" className="h-5 w-5" checked={g.regroupEveryStop} onChange={(e) => set({ regroupEveryStop: e.target.checked })} /> Regroup at every stop
        </label>
        <label className="flex min-h-[44px] items-center gap-3">
          <input type="checkbox" className="h-5 w-5" checked={g.supportVehicle} onChange={(e) => set({ supportVehicle: e.target.checked })} /> Support vehicle follows the group
        </label>
        <div>
          <p className="label">Participants (names stay off share links unless you choose to include them)</p>
          <div className="flex gap-2">
            <label htmlFor="g-add" className="sr-only">Participant name</label>
            <input id="g-add" className="input" value={name} onChange={(e) => setName(e.target.value)} />
            <button
              type="button"
              className="btn-secondary"
              disabled={!name.trim()}
              onClick={() => {
                set({ participants: [...g.participants, { id: crypto.randomUUID?.() ?? String(Date.now()), name: name.trim() }] });
                setName('');
              }}
            >
              Add
            </button>
          </div>
          <ul className="mt-2 flex flex-wrap gap-2">
            {g.participants.map((p) => (
              <li key={p.id} className="chip bg-slate-200 text-slate-800">
                {p.name}
                <button type="button" aria-label={`Remove ${p.name}`} onClick={() => set({ participants: g.participants.filter((x) => x.id !== p.id) })}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
        <Notice level={g.regroupProcedureAgreed ? 'ok' : 'caution'} title="Agree how you regroup before you leave">
          Who rides sweep, where you wait after junctions, and what happens if someone drops back or has a flat.
          <label className="mt-2 flex min-h-[44px] items-center gap-3 font-medium">
            <input type="checkbox" className="h-5 w-5" checked={g.regroupProcedureAgreed} onChange={(e) => set({ regroupProcedureAgreed: e.target.checked })} /> Our group has agreed a regrouping procedure
          </label>
        </Notice>
      </Card>
      <Card className="space-y-3">
        <button type="button" className="btn-go w-full text-base" onClick={build} disabled={!ready || !!busy}>
          {busy ? <Loader2 aria-hidden className="h-5 w-5 animate-spin" /> : null}
          {busy ?? 'Find real stops and build my schedule'}
        </button>
        {!ready && <p className="text-sm text-slate-600">Calculate a route in step 1 first.</p>}
        {plan.candidates.length > 0 && (
          <p className="text-xs text-slate-500">
            {plan.candidates.length} places already loaded from {plan.candidatesSource}. Building keeps your own stops and re-picks only the automatic ones.
          </p>
        )}
        {msg && <Notice level={msg.level} title={msg.text} />}
        {parseLocal(plan.departureLocal, plan.timeZone) === null && <Notice level="danger" title="Fix the departure date and time in step 1." />}
      </Card>
    </div>
  );
}
