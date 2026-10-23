import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Bike, CheckCircle2, Coffee, Flag, HeartPulse, LocateFixed, LocateOff, MapPinned, Pause, Play, Square } from 'lucide-react';
import type { FatigueAnswer, PlannedStop, RideSession, SupplyLevel } from '../types';
import { usePlanSchedule } from '../lib/usePlan';
import { checklistKey, useStore } from '../store/store';
import { adviceFor, fatigueStatus, FATIGUE_OPTIONS, STATUS_LABEL, type FatigueAdvice } from '../lib/fatigue';
import { DEFAULT_REMINDERS, remindersDue, supplyWarning } from '../lib/reminders';
import { CHECKLISTS, progress } from '../lib/checklists';
import { SUPPLY_CATEGORIES } from '../lib/discovery';
import { projectOntoRoute } from '../lib/geo';
import { updateStop } from '../lib/planOps';
import { computeSchedule } from '../lib/schedule';
import { formatDuration, formatKm, formatTime } from '../lib/time';
import { useNow } from '../lib/hooks';
import { googleDirectionsUrl } from '../lib/navlinks';
import { Card, EmptyState, Notice, confirmAction } from '../components/ui';
import { EmergencyButton } from '../components/Emergency';
import { RouteMap } from '../components/RouteMap';

const STATUS_TONE = {
  ready: 'bg-go text-white',
  'consider-break': 'bg-caution text-white',
  'rest-recommended': 'bg-orange-700 text-white',
  'stop-and-assess': 'bg-danger text-white',
} as const;

function pausedMin(s: RideSession, now: number) {
  return s.pauses.reduce((acc, p) => acc + ((p.end ? Date.parse(p.end) : now) - Date.parse(p.start)) / 60000, 0);
}

export default function Live() {
  const { plan, schedule, edit } = usePlanSchedule();
  const session = useStore((s) => (plan ? s.sessions[plan.id] : undefined));
  const startSession = useStore((s) => s.startSession);
  const updateSession = useStore((s) => s.updateSession);
  const checkIn = useStore((s) => s.checkIn);
  const endSession = useStore((s) => s.endSession);
  const prefs = useStore((s) => s.prefs);
  const pre = useStore((s) => (plan ? s.checklists[checklistKey('pre-ride', plan.id)] : undefined));
  const now = useNow(1000);
  const [askFeeling, setAskFeeling] = useState(false);
  const [advice, setAdvice] = useState<FatigueAdvice | null>(null);
  const [baseline, setBaseline] = useState<FatigueAnswer | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [restEnds, setRestEnds] = useState<number | null>(null);
  const watchId = useRef<number | null>(null);

  const reminderDefs = useMemo(
    () => DEFAULT_REMINDERS.map((r) => ({ ...r, everyMin: r.id === 'hydrate' ? prefs.hydrateEveryMin : r.id === 'snack' ? prefs.snackEveryMin : prefs.suppliesEveryMin })),
    [prefs],
  );

  // Location is watched only while the rider has switched it on and this screen is open.
  useEffect(() => {
    if (!plan?.route || !session?.gpsEnabled || !('geolocation' in navigator)) return;
    const coords = plan.route.coords;
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const proj = projectOntoRoute({ lat: pos.coords.latitude, lng: pos.coords.longitude }, coords);
        // Persisting the store is not free; only save meaningful movement.
        if (proj)
          updateSession(plan.id, (s) =>
            s.progressSource === 'gps' && Math.abs((s.progressKm ?? 0) - proj.routeKm) < 0.05 ? s : { ...s, progressKm: proj.routeKm, progressSource: 'gps' },
          );
        setGpsError(proj && proj.offRouteM > 1500 ? `You seem to be ${(proj.offRouteM / 1000).toFixed(1)} km from the planned route.` : null);
      },
      (err) => {
        setGpsError(err.code === err.PERMISSION_DENIED ? 'Location permission denied. Progress will follow the stops you mark as arrived.' : 'Location unavailable right now. Using manual progress.');
        updateSession(plan.id, (s) => ({ ...s, gpsEnabled: false, progressSource: 'manual' }));
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 },
    );
    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, [plan?.id, plan?.route, session?.gpsEnabled, updateSession]);

  const due = session ? remindersDue(session, now, reminderDefs) : [];
  const overdue = due.filter((d) => d.overdue);
  const notified = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const d of overdue) {
      const key = `${d.id}:${d.dueAt}`;
      if (notified.current.has(key)) continue;
      notified.current.add(key);
      navigator.vibrate?.(200);
      if (prefs.notifications && 'Notification' in window && Notification.permission === 'granted') {
        // Android Chrome rejects `new Notification()`; the service worker path works there and on desktop.
        const show = () => {
          try {
            new Notification('RideWise', { body: d.message, tag: d.id });
          } catch {
            /* not supported in this browser: the in-app banner still shows */
          }
        };
        if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistration().then((reg) => (reg ? reg.showNotification('RideWise', { body: d.message, tag: d.id }) : show())).catch(show);
        else show();
      }
    }
  }, [overdue, prefs.notifications]);

  if (!plan) return <EmptyState title="No ride plan open" action={<Link className="btn-primary" to="/plan">Plan My Ride</Link>} />;
  if (!plan.route || !schedule?.ok)
    return <EmptyState title="Plan not ready for riding" action={<Link className="btn-primary" to="/plan">Finish planning</Link>}>{schedule && !schedule.ok ? schedule.error : ''}</EmptyState>;

  const preP = progress(CHECKLISTS['pre-ride'].items, pre?.states ?? {});

  if (!session) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-navy">Live Ride</h1>
        {plan.status === 'completed' && (
          <Notice level="ok" title="Ride completed. Nice work.">
            Times are saved in <Link className="font-semibold underline" to="/history">Ride History</Link>. Do the{' '}
            <Link className="font-semibold underline" to="/checklists?kind=post-ride">post-ride check</Link> while it is fresh. You can start this plan again below.
          </Notice>
        )}
        <Notice level="info" title="Use your phone only when safely stopped">Check-ins, navigation and edits are for pit stops, not while moving.</Notice>
        {plan.isSample && <Notice level="caution" title="This is the sample plan (demonstration data)." />}
        <Card className="space-y-3">
          <p className="text-lg font-semibold">Before we roll: how are you feeling?</p>
          <div className="grid grid-cols-2 gap-2">
            {FATIGUE_OPTIONS.map((o) => (
              <button key={o.value} type="button" aria-pressed={baseline === o.value} onClick={() => setBaseline(o.value)} className={`btn min-h-[56px] border ${baseline === o.value ? 'border-navy bg-navy text-white' : 'border-slate-300 bg-white'}`}>
                {o.label}
              </button>
            ))}
          </div>
          {baseline && baseline !== 'good' && (
            <Notice level={adviceFor(baseline).status === 'stop-and-assess' ? 'danger' : 'caution'} title={adviceFor(baseline).title}>
              {adviceFor(baseline).advice} {adviceFor(baseline).status === 'stop-and-assess' && 'Starting a long ride like this is not advisable.'}
            </Notice>
          )}
          <p className={preP.criticalProblems.length ? 'font-semibold text-danger' : 'text-sm text-slate-600'}>
            Pre-ride checklist: {preP.pct}% done{preP.criticalProblems.length ? `, with a safety-critical problem: ${preP.criticalProblems.map((i) => i.label).join(', ')}. Do not ride until it is fixed.` : ''}{' '}
            <Link className="font-semibold text-sky underline" to="/checklists">Open checklist</Link>
          </p>
          <button
            type="button"
            className="btn-go min-h-[64px] w-full text-xl"
            disabled={!baseline}
            onClick={() => {
              if (baseline && adviceFor(baseline).status === 'stop-and-assess' && !confirmAction('You reported not feeling OK. Start the ride anyway?')) return;
              startSession(plan.id, baseline ?? undefined);
            }}
          >
            <Play aria-hidden className="h-6 w-6" /> Start ride
          </button>
          <p className="text-xs text-slate-500">Ride smart, stop smart, finish strong.</p>
        </Card>
      </div>
    );
  }

  const tz = plan.timeZone;
  const total = plan.route.distanceM / 1000;
  const elapsedMin = (now - Date.parse(session.startedAt)) / 60000;
  const movingMin = Math.max(0, elapsedMin - pausedMin(session, now));
  const nextIdx = plan.stops.findIndex((s) => s.status === 'planned' || s.status === 'arrived');
  const next: PlannedStop | undefined = plan.stops[nextIdx];
  const nextRow = schedule.rows.find((r) => r.stop.id === next?.id);
  const lastDone = [...plan.stops].reverse().find((s) => s.status === 'completed' || s.status === 'arrived');
  const progressKm = session.progressSource === 'gps' ? session.progressKm ?? 0 : Math.max(session.progressKm ?? 0, lastDone?.place.routeKm ?? 0);
  const atNext = next?.status === 'arrived';
  const toNextKm = !next ? Math.max(0, total - progressKm) : atNext ? 0 : Math.max(0, next.place.routeKm - progressKm) + next.place.detourKm / 2;
  const toNextMin = (toNextKm / plan.settings.speedKmh) * 60;
  const remainingKm = Math.max(0, total - progressKm);
  const fatigue = fatigueStatus(session, now, plan.settings.maxRideMinBetweenStops);
  // The original plan, for an honest "where are we" — never a reason to hurry.
  const original = computeSchedule(plan, { ignoreActuals: true });
  const driftMin = original.ok ? Math.round((schedule.finish.arrivalMs - original.finish.arrivalMs) / 60000) : 0;
  const sunsetRisk = schedule.warnings.find((w) => w.code === 'after-sunset' || w.code === 'near-sunset');
  const nextSupply = plan.stops.find((s) => s.status === 'planned' && s.place.routeKm > progressKm && SUPPLY_CATEGORIES.includes(s.place.category));
  const supplyMsg = supplyWarning(session.supplies, nextSupply ? nextSupply.place.routeKm - progressKm : null, plan.settings.speedKmh);
  const iso = () => new Date().toISOString();
  const closePause = (s: RideSession) => ({ ...s, pauses: s.pauses.map((p) => (p.end ? p : { ...p, end: iso() })) });

  const arrived = () => {
    if (!next) return;
    edit((p) => updateStop(p, next.id, { status: 'arrived', actualArrival: iso() }));
    updateSession(plan.id, (s) => ({ ...closePause(s), state: 'at-stop', pauses: [...closePause(s).pauses, { start: iso(), reason: 'stop' }], progressKm: next.place.routeKm, progressSource: s.gpsEnabled ? 'gps' : 'manual' }));
  };
  const finishRest = () => {
    if (next && next.status === 'arrived') edit((p) => updateStop(p, next.id, { status: 'completed', actualDeparture: iso() }));
    setRestEnds(null);
    updateSession(plan.id, (s) => ({ ...closePause(s), state: 'riding', lastRideResumeAt: iso() }));
  };
  const pause = () => updateSession(plan.id, (s) => ({ ...s, state: 'paused', pauses: [...s.pauses, { start: iso(), reason: 'manual' }] }));
  const resume = () => updateSession(plan.id, (s) => ({ ...closePause(s), state: 'riding', lastRideResumeAt: iso() }));
  const answer = (a: FatigueAnswer) => {
    checkIn(plan.id, a);
    setAskFeeling(false);
    setAdvice(adviceFor(a));
  };
  const setSupply = (k: 'water' | 'food' | 'electrolytes', v: SupplyLevel) => updateSession(plan.id, (s) => ({ ...s, supplies: { ...s.supplies, [k]: v, updatedAt: iso() } }));
  const reminderAction = (id: string, patch: { lastAck?: string; snoozedUntil?: string; disabled?: boolean }) =>
    updateSession(plan.id, (s) => ({ ...s, reminders: { ...s.reminders, [id]: { ...s.reminders[id], ...patch } } }));
  const toggleGps = () => {
    if (session.gpsEnabled) {
      updateSession(plan.id, (s) => ({ ...s, gpsEnabled: false, progressSource: 'manual' }));
      return;
    }
    if (!('geolocation' in navigator)) return setGpsError('This browser has no location support. Using manual progress.');
    if (confirmAction('RideWise uses your location only while this screen is open, to show distance to the next stop. It is not sent anywhere. Turn it on?'))
      updateSession(plan.id, (s) => ({ ...s, gpsEnabled: true }));
  };
  const end = () => {
    if (!confirmAction('End this ride? Your times are saved to Ride History.')) return;
    endSession(plan.id, {
      elapsedMin,
      movingMin,
      distanceKm: session.progressSource === 'gps' ? progressKm : lastDone ? lastDone.place.routeKm : null,
      stopsCompleted: plan.stops.filter((s) => s.status === 'completed').length,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">Live Ride</h1>
        <span className={`chip px-3 py-1 text-sm ${STATUS_TONE[fatigue.status]}`} role="status" aria-label={`Rider status: ${STATUS_LABEL[fatigue.status]}`}>
          <HeartPulse aria-hidden className="h-4 w-4" /> {STATUS_LABEL[fatigue.status]}
        </span>
      </div>
      <p className="text-xs text-slate-500">Status is based on your check-ins and riding time. It is a prompt, not a medical assessment. Take a break any time you need one.</p>

      {session.state === 'safety-pause' && (
        <Notice level="danger" title="Ride paused for safety. The schedule can wait.">
          Get off the road to a safe place. Tell the group. Arrange help or a pickup if needed.
          <div className="mt-2 flex flex-wrap gap-2">
            <EmergencyButton />
            <button type="button" className="btn-secondary" onClick={() => confirmAction('Only continue if you feel safe and well. Continue?') && (checkIn(plan.id, 'good'), resume())}>
              I am safe to continue
            </button>
          </div>
        </Notice>
      )}
      {advice && (
        <Notice level={advice.status === 'ready' ? 'ok' : advice.status === 'stop-and-assess' ? 'danger' : 'caution'} title={advice.title}>
          {advice.advice}
          {advice.showEmergency && <div className="mt-2"><EmergencyButton /></div>}
          <button type="button" className="btn-ghost mt-1 min-h-[36px]" onClick={() => setAdvice(null)}>OK</button>
        </Notice>
      )}

      <Card className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-center">
          <div>
            <p className="text-xs uppercase text-slate-500">Next stop</p>
            <p className="text-lg font-bold leading-tight text-navy">{next ? next.place.name : 'Destination'}</p>
            <p className="text-sm text-slate-600">
              {!next ? `Est. ${formatTime(schedule.finish.arrivalMs, tz)}` : atNext && next.actualArrival ? `Arrived ${formatTime(Date.parse(next.actualArrival), tz)}` : `Est. ${nextRow?.arrivalMs ? formatTime(nextRow.arrivalMs, tz) : '—'}`}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">To next stop</p>
            <p className="text-3xl font-extrabold text-navy">{formatKm(toNextKm)}</p>
            <p className="text-sm text-slate-600">~{formatDuration(toNextMin)} at {plan.settings.speedKmh} km/h</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Elapsed</p>
            <p className="text-2xl font-bold tabular-nums">{formatDuration(elapsedMin)}</p>
            <p className="text-xs text-slate-500">Riding {formatDuration(movingMin)}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Remaining</p>
            <p className="text-2xl font-bold">{formatKm(remainingKm)}</p>
            <p className="text-xs text-slate-500">{session.progressSource === 'gps' ? 'From GPS' : 'From last stop reached (manual)'}</p>
          </div>
        </div>
        {lastDone && <p className="text-center text-sm text-slate-600">Current/last stop: {lastDone.place.name}</p>}
        <p className="text-center text-sm text-slate-700" role="status">
          Estimated finish {formatTime(schedule.finish.arrivalMs, tz)}
          {Math.abs(driftMin) >= 5 ? ` · ${formatDuration(Math.abs(driftMin))} ${driftMin > 0 ? 'later' : 'earlier'} than the original plan` : ' · on the original plan'}
          {driftMin >= 5 && '. The schedule has adjusted; no need to rush.'}
        </p>
        {sunsetRisk && <Notice level="caution" title={sunsetRisk.message} />}
        {next && (
          <a className="btn-secondary w-full" href={googleDirectionsUrl(next.place.point)} target="_blank" rel="noreferrer">
            Navigate to {next.place.name} in Google Maps
          </a>
        )}
      </Card>

      {overdue.length > 0 && (
        <div className="space-y-2" aria-live="polite">
          {overdue.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-sky/40 bg-sky-soft p-3">
              <Bell aria-hidden className="h-5 w-5 text-sky" />
              <p className="flex-1 font-semibold text-sky-900">{r.message}</p>
              <button type="button" className="btn-primary min-h-[40px]" onClick={() => reminderAction(r.id, { lastAck: iso() })}>Done</button>
              <button type="button" className="btn-secondary min-h-[40px]" onClick={() => reminderAction(r.id, { snoozedUntil: new Date(Date.now() + 10 * 60000).toISOString() })}>Snooze 10 min</button>
              <button type="button" className="btn-ghost min-h-[40px]" onClick={() => reminderAction(r.id, { disabled: true })}>Turn off</button>
            </div>
          ))}
        </div>
      )}
      {overdue.length === 0 && due[0] && <p className="text-sm text-slate-600"><Bell aria-hidden className="inline h-4 w-4" /> Next reminder: {due[0].label} at {formatTime(due[0].dueAt, tz)}</p>}

      <div className="grid grid-cols-2 gap-2">
        {session.state === 'riding' && !atNext && (
          <button type="button" className="btn-go min-h-[64px] text-lg" onClick={arrived} disabled={!next}>
            <MapPinned aria-hidden className="h-6 w-6" /> Arrived at stop
          </button>
        )}
        {(session.state === 'at-stop' || atNext) && session.state !== 'safety-pause' && (
          <>
            <button type="button" className="btn-secondary min-h-[64px] text-lg" onClick={() => setRestEnds(Date.now() + (nextRow?.restMin ?? 10) * 60000)}>
              <Coffee aria-hidden className="h-6 w-6" /> Start rest timer
            </button>
            <button type="button" className="btn-go min-h-[64px] text-lg" onClick={finishRest}>
              <CheckCircle2 aria-hidden className="h-6 w-6" /> Finish rest
            </button>
          </>
        )}
        {session.state === 'riding' && !atNext && (
          <button type="button" className="btn-secondary min-h-[64px] text-lg" onClick={pause}>
            <Pause aria-hidden className="h-6 w-6" /> Pause
          </button>
        )}
        {session.state === 'paused' && (
          <button type="button" className="btn-go min-h-[64px] text-lg" onClick={resume}>
            <Play aria-hidden className="h-6 w-6" /> Resume
          </button>
        )}
        <button type="button" className="btn-primary min-h-[64px] text-lg" onClick={() => setAskFeeling(true)}>
          <HeartPulse aria-hidden className="h-6 w-6" /> How am I feeling?
        </button>
        {session.state === 'riding' && (
          <button type="button" className="btn min-h-[64px] border-2 border-caution bg-white text-lg text-amber-900" onClick={() => { pause(); setAdvice(adviceFor('little-tired')); }}>
            <Coffee aria-hidden className="h-6 w-6" /> Take a break now
          </button>
        )}
      </div>
      {restEnds && <RestCountdown endsAt={restEnds} now={now} />}

      {askFeeling && (
        <Card className="space-y-2" >
          <p className="text-lg font-semibold" id="feel-q">How are you feeling?</p>
          <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="feel-q">
            {FATIGUE_OPTIONS.map((o) => (
              <button key={o.value} type="button" className={`btn min-h-[56px] border ${['unwell', 'pain', 'unsafe'].includes(o.value) ? 'border-danger text-danger' : 'border-slate-300'} bg-white`} onClick={() => answer(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">Chest pain, fainting, confusion or severe difficulty breathing: stop and call 911.</p>
        </Card>
      )}

      <Card className="space-y-2">
        <p className="font-semibold">Water and food</p>
        {(['water', 'food', 'electrolytes'] as const).map((k) => (
          <fieldset key={k}>
            <legend className="mb-1 text-sm font-medium capitalize">{k}</legend>
            <div className="grid grid-cols-4 gap-2">
              {(['full', 'half', 'low', 'empty'] as SupplyLevel[]).map((v) => (
                <button key={v} type="button" aria-pressed={session.supplies[k] === v} aria-label={`${k}: ${v}`} onClick={() => setSupply(k, v)} className={`btn min-h-[44px] border px-1 capitalize ${session.supplies[k] === v ? 'border-navy bg-navy text-white' : 'border-slate-300 bg-white'}`}>
                  {v}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
        <p className="text-sm text-slate-600">
          Next planned water/food stop: {nextSupply ? `${nextSupply.place.name}, ${formatKm(nextSupply.place.routeKm - progressKm)} ahead` : 'none planned ahead'}.
        </p>
        {supplyMsg && <Notice level="caution" title={supplyMsg} />}
      </Card>

      <Card className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">Progress</p>
          <button type="button" className="btn-secondary" onClick={toggleGps} aria-pressed={session.gpsEnabled}>
            {session.gpsEnabled ? <LocateOff aria-hidden className="h-4 w-4" /> : <LocateFixed aria-hidden className="h-4 w-4" />}
            {session.gpsEnabled ? 'Stop using location' : 'Use my location'}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Location works only while this screen is open; phone browsers pause it in the background. Without it, progress updates when you tap "Arrived at stop".
        </p>
        {gpsError && <Notice level="caution" title={gpsError} />}
        <RouteMap className="h-64" route={plan.route} start={plan.start.point} end={plan.end.point} stops={plan.stops} progressKm={progressKm} />
      </Card>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <EmergencyButton />
        <button type="button" className="btn-secondary min-h-[56px]" onClick={end}>
          <Square aria-hidden className="h-5 w-5" /> End ride
        </button>
      </div>
      <p className="flex items-center justify-center gap-2 text-center text-xs text-slate-500">
        <Bike aria-hidden className="h-4 w-4" /> Forty-plus riders, professionally managed pit stops. <Flag aria-hidden className="h-4 w-4" />
      </p>
    </div>
  );
}

function RestCountdown({ endsAt, now }: { endsAt: number; now: number }) {
  const left = Math.max(0, Math.round((endsAt - now) / 1000));
  return (
    <div className="rounded-xl bg-navy p-4 text-center text-white" role="timer">
      <p className="text-5xl font-extrabold tabular-nums">
        {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
      </p>
      <p className="text-sm">{left ? 'Coffee stop approved. Just remember to drink water, too.' : 'Rest time is up. Quick bike check, count riders, then roll.'}</p>
    </div>
  );
}
