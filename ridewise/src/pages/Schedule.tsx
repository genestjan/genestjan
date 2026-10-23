import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown, ArrowUp, CheckCircle2, ClipboardCheck, Clock, Flag, MapPinned, Minus, Navigation, Plus, RefreshCcw, Replace, Share2, SkipForward, Star, Trash2, Utensils, Droplets,
} from 'lucide-react';
import type { PlannedStop, RidePlan } from '../types';
import { usePlanSchedule } from '../lib/usePlan';
import { categoryLabel, kindLabel, suggestedActivities, type Schedule as Sched, type ScheduleRow, type ScheduleWarning } from '../lib/schedule';
import { addStop, applySuggestions, moveStop, removeStop, replaceStopPlace, replacementOptions, updateStop, verifyPlace } from '../lib/planOps';
import { hoursLabel, hoursStatusAt } from '../lib/hours';
import { googleDirectionsUrl } from '../lib/navlinks';
import { encodeShare } from '../lib/share';
import { formatDuration, formatKm, formatTime, localDayKey } from '../lib/time';
import { useNow } from '../lib/hooks';
import { Badge, Card, EmptyState, Field, Notice, NumberField, PageTitle, Stat, confirmAction } from '../components/ui';
import { verificationBadge } from '../components/PlaceDetail';
import { etaFor } from '../components/PlaceDetail';

export default function SchedulePage() {
  const { plan, schedule, edit } = usePlanSchedule();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [includeNames, setIncludeNames] = useState(false);
  const [lunchPicker, setLunchPicker] = useState(false);

  if (!plan) return <EmptyState title="No ride plan open" action={<Link className="btn-primary" to="/plan">Plan My Ride</Link>} />;
  if (!schedule || !schedule.ok)
    return (
      <div>
        <PageTitle title="Pit Stop Schedule" />
        <EmptyState title="Schedule not available" action={<Link className="btn-primary" to="/plan">Open the planner</Link>}>
          {schedule && !schedule.ok ? schedule.error : 'Calculate a route first.'}
        </EmptyState>
      </div>
    );

  const tz = plan.timeZone;
  const depDay = localDayKey(schedule.departureMs, tz);
  const t = (ms: number | null) => (ms === null ? '—' : `${formatTime(ms, tz)}${localDayKey(ms, tz) !== depDay ? ' (+1 day)' : ''}`);
  const general = schedule.warnings.filter((w) => !w.stopId);

  const share = async () => {
    const token = await encodeShare(plan, includeNames);
    const url = `${location.origin}${location.pathname}#/share/${token}`;
    setShareUrl(url);
    try {
      if (navigator.share) await navigator.share({ title: plan.name, text: 'Our RideWise pit stop plan', url });
      else await navigator.clipboard?.writeText(url);
    } catch {
      /* user cancelled the share sheet */
    }
  };

  return (
    <div className="space-y-4">
      <PageTitle
        title="Pit Stop Schedule"
        subtitle={`${plan.name}${plan.isSample ? ' · sample (demonstration data)' : ''}`}
        action={
          <button type="button" className="btn-secondary" onClick={share}>
            <Share2 aria-hidden className="h-4 w-4" /> Share plan
          </button>
        }
      />
      {shareUrl && (
        <Notice level="ok" title="Share link ready (copied if your phone allows)">
          <label className="mt-1 flex items-center gap-2 text-xs">
            <input type="checkbox" checked={includeNames} onChange={(e) => { setIncludeNames(e.target.checked); setShareUrl(null); }} /> Include organiser and participant names
          </label>
          <input aria-label="Share link" readOnly className="input mt-1 font-mono text-xs" value={shareUrl} onFocus={(e) => e.target.select()} />
          <p className="mt-1 text-xs">The plan travels inside the link itself. Emergency contacts, medical notes and your rider profile are never included.</p>
        </Notice>
      )}

      <Card>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Depart" value={t(schedule.departureMs)} />
          <Stat label="Est. arrival" value={t(schedule.finish.arrivalMs)} hint="Estimate from route + pace" />
          <Stat label="Distance" value={formatKm(schedule.totals.distanceKm)} hint={`Route ${formatKm(plan.route!.distanceM / 1000)} + detours`} />
          <Stat label="Total time" value={formatDuration(schedule.totals.elapsedMin)} />
          <Stat label="Riding" value={formatDuration(schedule.totals.movingMin)} hint={`at ${plan.settings.speedKmh} km/h`} />
          <Stat label="Buffer" value={formatDuration(schedule.totals.bufferMin)} hint={`${plan.settings.delayBufferPct}% for delays`} />
          <Stat label="Rest" value={formatDuration(schedule.totals.restMin)} />
          <Stat label="Stops" value={schedule.totals.stops} />
        </dl>
        <QuickEdit plan={plan} edit={edit} />
      </Card>

      {general.length > 0 && (
        <div className="space-y-2" aria-label="Plan warnings">
          {general.map((w, i) => (
            <WarningNotice key={i} w={w} />
          ))}
        </div>
      )}

      <ol className="space-y-3">
        <li className="card flex items-center gap-3 border-go/40">
          <Flag aria-hidden className="h-6 w-6 text-go" />
          <div>
            <p className="font-semibold">Start: {plan.start.label}</p>
            <p className="text-sm text-slate-600">Depart {t(schedule.departureMs)} · km 0</p>
          </div>
        </li>
        {schedule.rows.map((row) => (
          <StopCard key={row.stop.id} row={row} plan={plan} schedule={schedule} edit={edit} t={t} />
        ))}
        <li className="card flex items-center gap-3 border-navy/40">
          <Flag aria-hidden className="h-6 w-6 text-navy" />
          <div>
            <p className="font-semibold">Finish: {plan.end.label}</p>
            <p className="text-sm text-slate-600">
              Arrive {t(schedule.finish.arrivalMs)} (estimate) · {formatKm(schedule.finish.segmentKm)} and {formatDuration(schedule.finish.movingMin + schedule.finish.bufferMin)} from the last stop
            </p>
          </div>
        </li>
      </ol>

      <Card className="space-y-2">
        <h2 className="font-bold text-navy">Edit the plan</h2>
        <div className="flex flex-wrap gap-2">
          <Link className="btn-secondary" to="/map"><Plus aria-hidden className="h-4 w-4" /> Add stop from map</Link>
          <button type="button" className="btn-secondary" onClick={() => setLunchPicker((v) => !v)}><Utensils aria-hidden className="h-4 w-4" /> Add lunch stop</button>
          <button
            type="button"
            className="btn-ghost"
            disabled={plan.candidates.length === 0}
            onClick={() => confirmAction('Re-pick the automatic stops? Stops you added, edited or marked mandatory are kept.') && edit((p) => applySuggestions(p).plan)}
          >
            <RefreshCcw aria-hidden className="h-4 w-4" /> Regenerate suggestions
          </button>
        </div>
        {plan.candidates.length === 0 && <p className="text-sm text-slate-600">No places loaded. Use the Map page to search along the route or drop pins for stops you know.</p>}
        {lunchPicker && <LunchPicker plan={plan} schedule={schedule} onPick={(c) => { edit((p) => addStop(p, c, 'meal')); setLunchPicker(false); }} />}
      </Card>
    </div>
  );
}

function WarningNotice({ w }: { w: ScheduleWarning }) {
  return <Notice level={w.level} title={w.message} />;
}

function QuickEdit({ plan, edit }: { plan: RidePlan; edit: (fn: (p: RidePlan) => RidePlan) => void }) {
  const [date, time] = plan.departureLocal.split('T');
  return (
    <details className="mt-3">
      <summary className="min-h-[44px] cursor-pointer py-2 text-sm font-semibold text-sky">Change departure, pace or stop frequency</summary>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <Field label="Departure date" htmlFor="q-date">
          <input id="q-date" type="date" className="input" value={date} onChange={(e) => edit((p) => ({ ...p, departureLocal: `${e.target.value}T${time}` }))} />
        </Field>
        <Field label="Departure time" htmlFor="q-time">
          <input id="q-time" type="time" className="input" value={time} onChange={(e) => edit((p) => ({ ...p, departureLocal: `${date}T${e.target.value}` }))} />
        </Field>
        <NumberField id="q-speed" label="Group moving speed" suffix="km/h" value={plan.settings.speedKmh} min={5} max={45} step={0.5} onChange={(n) => edit((p) => ({ ...p, settings: { ...p.settings, speedKmh: n } }))} />
        <NumberField id="q-max" label="Max riding between stops" suffix="min" value={plan.settings.maxRideMinBetweenStops} min={15} max={180} onChange={(n) => edit((p) => ({ ...p, settings: { ...p.settings, maxRideMinBetweenStops: n } }))} />
      </div>
    </details>
  );
}

function StopCard({ row, plan, schedule, edit, t }: { row: ScheduleRow; plan: RidePlan; schedule: Extract<Sched, { ok: true }>; edit: (fn: (p: RidePlan) => RidePlan) => void; t: (ms: number | null) => string }) {
  const s = row.stop;
  const c = s.place;
  const [timer, setTimer] = useState<number | null>(null);
  const [replacing, setReplacing] = useState(false);
  const warnings = schedule.warnings.filter((w) => w.stopId === s.id);
  const up = (patch: Partial<PlannedStop>) => edit((p) => updateStop(p, s.id, patch));
  const nowIso = () => new Date().toISOString();
  const title = s.status === 'skipped' ? 'Skipped' : `STOP ${String(row.number).padStart(2, '0')}: ${kindLabel(s.kind)}`;

  return (
    <li className={`card ${s.status === 'skipped' ? 'opacity-60' : ''} ${s.status === 'completed' ? 'border-go/50' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-sky">{title}</p>
          <h3 className="text-lg font-bold text-navy">{c.name}</h3>
          <p className="text-sm text-slate-600">{categoryLabel(c.category)}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {verificationBadge(c)}
            {s.mandatory && <Badge tone="sky">Mandatory</Badge>}
            {s.backup && <Badge>Backup</Badge>}
            {s.status === 'arrived' && <Badge tone="go">Arrived</Badge>}
            {s.status === 'completed' && <Badge tone="go"><CheckCircle2 aria-hidden className="h-3 w-3" />Completed</Badge>}
            {s.suppliesReplenished && <Badge tone="go"><Droplets aria-hidden className="h-3 w-3" />Supplies topped up</Badge>}
            {s.checklistDone && <Badge tone="go">Bike checked</Badge>}
          </div>
        </div>
        <div className="text-right text-sm">
          <p className="text-2xl font-extrabold text-navy">{row.skipped ? '—' : t(row.arrivalMs)}</p>
          <p className="text-slate-600">{row.skipped ? '' : `leave ${t(row.departureMs)}`}</p>
          {row.usesActuals && <p className="text-xs font-semibold text-go">Uses recorded times</p>}
        </div>
      </div>

      {!row.skipped && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
          <div><dt className="text-xs text-slate-500">From previous</dt><dd>{formatKm(row.segmentKm)}</dd></div>
          <div><dt className="text-xs text-slate-500">From start</dt><dd>{formatKm(row.cumKm)}</dd></div>
          <div><dt className="text-xs text-slate-500">Riding time</dt><dd>{formatDuration(row.movingMin + row.bufferMin)}</dd></div>
          <div><dt className="text-xs text-slate-500">Planned stop</dt><dd>{formatDuration(row.restMin)}</dd></div>
          <div><dt className="text-xs text-slate-500">Detour</dt><dd>{c.detourKm === 0 ? 'Roadside' : `~${formatKm(c.detourKm, 2)} (est.)`}</dd></div>
          <div className="col-span-2 sm:col-span-3"><dt className="text-xs text-slate-500">Hours</dt><dd className={row.hours === 'listed-closed' ? 'font-semibold text-danger' : ''}>{c.openingHours ? hoursLabel(row.hours) : 'Hours not verified'}</dd></div>
        </dl>
      )}

      {!row.skipped && (
        <div className="mt-2 text-sm">
          <p className="font-medium">Suggested: {suggestedActivities(s).join(' · ')}</p>
          {(c.supplies?.length || c.hasToilets || c.hasDrinkingWater) && (
            <p className="text-slate-600">Facilities: {[...(c.supplies ?? []), c.hasToilets ? 'Toilet' : '', c.hasDrinkingWater ? 'Drinking water' : ''].filter(Boolean).join(', ')}</p>
          )}
          {s.notes && <p className="text-slate-600">Notes: {s.notes}</p>}
        </div>
      )}

      {warnings.length > 0 && <div className="mt-2 space-y-1">{warnings.map((w, i) => <WarningNotice key={i} w={w} />)}</div>}

      {timer !== null && <RestTimer endsAt={timer} onDone={() => setTimer(null)} />}

      <div className="mt-3 flex flex-wrap gap-2">
        {s.status === 'planned' && (
          <button type="button" className="btn-go" onClick={() => up({ status: 'arrived', actualArrival: nowIso() })}>
            <MapPinned aria-hidden className="h-4 w-4" /> Mark arrived
          </button>
        )}
        {s.status === 'arrived' && (
          <button type="button" className="btn-go" onClick={() => up({ status: 'completed', actualDeparture: nowIso() })}>
            <CheckCircle2 aria-hidden className="h-4 w-4" /> Leaving now
          </button>
        )}
        {s.status !== 'skipped' && (
          <button type="button" className="btn-secondary" onClick={() => setTimer(Date.now() + row.restMin * 60000)}>
            <Clock aria-hidden className="h-4 w-4" /> Rest timer
          </button>
        )}
        <Link className="btn-secondary" to={`/checklists?kind=pit-stop&stop=${s.id}`} onClick={() => up({ checklistDone: true })}>
          <ClipboardCheck aria-hidden className="h-4 w-4" /> Checklist
        </Link>
        <button type="button" className="btn-secondary" onClick={() => up({ suppliesReplenished: !s.suppliesReplenished })} aria-pressed={!!s.suppliesReplenished}>
          <Droplets aria-hidden className="h-4 w-4" /> {s.suppliesReplenished ? 'Supplies done' : 'Supplies replenished'}
        </button>
        <a className="btn-secondary" href={googleDirectionsUrl(c.point)} target="_blank" rel="noreferrer">
          <Navigation aria-hidden className="h-4 w-4" /> Navigate
        </a>
      </div>

      <details className="mt-2">
        <summary className="min-h-[44px] cursor-pointer py-2 text-sm font-semibold text-sky">Edit this stop</summary>
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Stop length</span>
            <button type="button" className="btn-secondary min-h-[40px] px-3" aria-label="5 minutes shorter" onClick={() => up({ durationMin: Math.max(0, s.durationMin - 5) })}><Minus className="h-4 w-4" /></button>
            <span className="w-16 text-center font-bold" aria-live="polite">{s.durationMin} min</span>
            <button type="button" className="btn-secondary min-h-[40px] px-3" aria-label="5 minutes longer" onClick={() => up({ durationMin: s.durationMin + 5 })}><Plus className="h-4 w-4" /></button>
          </div>
          <Field label="Stop type" htmlFor={`k-${s.id}`}>
            <select id={`k-${s.id}`} className="input" value={s.kind} onChange={(e) => up({ kind: e.target.value as PlannedStop['kind'] })}>
              {(['short', 'rest', 'meal', 'regroup', 'custom'] as const).map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}
            </select>
          </Field>
          <Field label="Notes" htmlFor={`n-${s.id}`}>
            <input id={`n-${s.id}`} className="input" value={s.notes ?? ''} onChange={(e) => up({ notes: e.target.value })} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" onClick={() => up({ status: s.status === 'skipped' ? 'planned' : 'skipped' })}><SkipForward aria-hidden className="h-4 w-4" />{s.status === 'skipped' ? 'Un-skip' : 'Skip stop'}</button>
            <button type="button" className="btn-ghost" onClick={() => up({ mandatory: !s.mandatory, autoSuggested: false })} aria-pressed={!!s.mandatory}><Star aria-hidden className="h-4 w-4" />{s.mandatory ? 'Not mandatory' : 'Make mandatory'}</button>
            <button type="button" className="btn-ghost" onClick={() => up({ backup: !s.backup })} aria-pressed={!!s.backup}>{s.backup ? 'Not a backup' : 'Mark as backup'}</button>
            {c.verification !== 'user-verified' && <button type="button" className="btn-ghost" onClick={() => edit((p) => verifyPlace(p, c.id))}>I confirmed this place</button>}
            <button type="button" className="btn-ghost" onClick={() => setReplacing((v) => !v)}><Replace aria-hidden className="h-4 w-4" />Replace location</button>
            <button type="button" className="btn-ghost" aria-label="Move earlier" onClick={() => edit((p) => moveStop(p, s.id, -1))}><ArrowUp className="h-4 w-4" /></button>
            <button type="button" className="btn-ghost" aria-label="Move later" onClick={() => edit((p) => moveStop(p, s.id, 1))}><ArrowDown className="h-4 w-4" /></button>
            <button type="button" className="btn-ghost text-danger" onClick={() => confirmAction(`Remove ${c.name} from the plan?`) && edit((p) => removeStop(p, s.id))}><Trash2 aria-hidden className="h-4 w-4" />Remove</button>
            {(s.actualArrival || s.actualDeparture) && <button type="button" className="btn-ghost" onClick={() => up({ actualArrival: undefined, actualDeparture: undefined, status: 'planned' })}>Clear recorded times</button>}
          </div>
          {replacing && (
            <ul className="space-y-1">
              {replacementOptions(plan, s).length === 0 && <li className="text-sm text-slate-600">No other mapped places within 6 km. Drop a pin on the Map page instead.</li>}
              {replacementOptions(plan, s).map((r) => {
                const eta = etaFor(r, plan, schedule);
                return (
                  <li key={r.id}>
                    <button type="button" className="w-full rounded-xl border border-slate-200 p-2 text-left text-sm hover:bg-slate-50" onClick={() => { edit((p) => replaceStopPlace(p, s.id, r)); setReplacing(false); }}>
                      <span className="font-semibold">{r.name}</span> · {categoryLabel(r.category)} · km {r.routeKm.toFixed(1)}
                      <span className="block text-xs text-slate-500">{r.offRouteM} m off route · {eta ? hoursLabel(hoursStatusAt(r.openingHours, eta, plan.timeZone)) : ''}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </details>
    </li>
  );
}

function RestTimer({ endsAt, onDone }: { endsAt: number; onDone: () => void }) {
  const now = useNow(1000);
  const left = Math.max(0, Math.round((endsAt - now) / 1000));
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');
  return (
    <div className="mt-3 flex items-center justify-between rounded-xl bg-navy p-3 text-white" role="timer" aria-live="off">
      <span className="text-3xl font-extrabold tabular-nums">{mm}:{ss}</span>
      <span className="text-sm">{left === 0 ? 'Rest time is up. Check in with everyone before rolling.' : 'Rest. Drink. Stretch.'}</span>
      <button type="button" className="btn bg-white text-navy" onClick={onDone}>Finish rest</button>
    </div>
  );
}

function LunchPicker({ plan, schedule, onPick }: { plan: RidePlan; schedule: Extract<Sched, { ok: true }>; onPick: (c: RidePlan['candidates'][number]) => void }) {
  const used = new Set(plan.stops.map((s) => s.place.id));
  const options = plan.candidates
    .filter((c) => (c.category === 'restaurant' || c.category === 'cafe') && c.insideCorridor && c.verification !== 'reported-closed' && !used.has(c.id))
    .map((c) => ({ c, eta: etaFor(c, plan, schedule) }))
    .slice(0, 200);
  if (!options.length) return <p className="text-sm text-slate-600">No mapped restaurants along the route. Drop a pin for a carinderia you know.</p>;
  return (
    <ul className="max-h-72 space-y-1 overflow-y-auto">
      {options.map(({ c, eta }) => (
        <li key={c.id}>
          <button type="button" className="w-full rounded-xl border border-slate-200 p-2 text-left text-sm hover:bg-slate-50" onClick={() => onPick(c)}>
            <span className="font-semibold">{c.name}</span> · km {c.routeKm.toFixed(1)} · ETA {eta ? formatTime(eta, plan.timeZone) : '—'}
            <span className="block text-xs text-slate-500">{c.offRouteM} m off route · {c.openingHours ? hoursLabel(hoursStatusAt(c.openingHours, eta ?? 0, plan.timeZone)) : 'Hours not verified'}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
