import { Link, useNavigate } from 'react-router-dom';
import { Bike, CalendarClock, ClipboardCheck, CloudSun, Map, PlayCircle, Route } from 'lucide-react';
import { useStore, checklistKey } from '../store/store';
import { usePlanSchedule } from '../lib/usePlan';
import { newPlan, samplePlan } from '../lib/defaults';
import { CHECKLISTS, progress } from '../lib/checklists';
import { formatDateTime, formatDuration, formatKm, formatTime, parseLocal } from '../lib/time';
import { Badge, Card, Notice, Stat } from '../components/ui';
import { WeatherCard } from '../components/WeatherCard';

export default function Dashboard() {
  const nav = useNavigate();
  const { plan, schedule, weather } = usePlanSchedule();
  const plans = useStore((s) => s.plans);
  const savePlan = useStore((s) => s.savePlan);
  const setActive = useStore((s) => s.setActive);
  const checklists = useStore((s) => s.checklists);
  const recent = Object.values(plans).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);

  const planMyRide = () => {
    const draft = Object.values(plans).find((p) => p.status === 'draft' && !p.isSample);
    if (draft) setActive(draft.id);
    else savePlan(newPlan());
    nav('/plan');
  };
  const startSample = async () => {
    savePlan(await samplePlan());
    nav('/map');
  };

  const pre = plan ? checklists[checklistKey('pre-ride', plan.id)] : undefined;
  const preProgress = progress(CHECKLISTS['pre-ride'].items, pre?.states ?? {});
  const depMs = plan ? parseLocal(plan.departureLocal, plan.timeZone) : null;
  const reminders: { level: 'info' | 'caution'; text: string; to: string }[] = [];
  if (plan) {
    if (!plan.start.point || !plan.end.point) reminders.push({ level: 'caution', text: 'Confirm the exact start and destination on the Plan page.', to: '/plan' });
    if (plan.route && plan.candidates.length === 0) reminders.push({ level: 'caution', text: 'Find real stops along the route (needs internet).', to: '/map' });
    if (plan.group.riders > 1 && !plan.group.regroupProcedureAgreed)
      reminders.push({ level: 'caution', text: 'Agree a regrouping procedure with the group before departure.', to: '/plan?step=5' });
    if (preProgress.pct < 100) reminders.push({ level: 'info', text: `Pre-ride checklist ${preProgress.pct}% done.`, to: '/checklists' });
    if (preProgress.criticalProblems.length) reminders.push({ level: 'caution', text: 'A safety-critical bike problem is recorded. Fix it before riding.', to: '/checklists' });
    if (depMs && depMs - Date.now() < 36 * 3600000 && depMs > Date.now()) reminders.push({ level: 'info', text: `Ride starts ${formatDateTime(depMs, plan.timeZone)}. Charge lights and phone tonight.`, to: '/checklists' });
  }

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-navy p-5 text-white">
        <p className="text-sm text-slate-300">Welcome to RideWise</p>
        <h1 className="mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">The goal is to arrive smiling, not crawling.</h1>
        <p className="mt-2 max-w-xl text-sm text-slate-300">
          Real routes, real places along the road, and an honest schedule for hydration, food, rest and bike checks.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn bg-white text-navy hover:bg-slate-100" onClick={planMyRide}>
            <Route aria-hidden className="h-5 w-5" /> Plan My Ride
          </button>
          <button type="button" className="btn border border-white/40 text-white hover:bg-navy-3" onClick={startSample}>
            <PlayCircle aria-hidden className="h-5 w-5" /> Start Sample Ride (demo data)
          </button>
        </div>
      </section>

      {plan ? (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Upcoming ride</p>
              <h2 className="text-lg font-bold text-navy">{plan.name}</h2>
            </div>
            {plan.isSample && <Badge tone="caution">Sample: demonstration data</Badge>}
          </div>
          <ol className="mt-3 space-y-2 text-sm">
            {[
              ['Start', plan.start],
              ['Destination', plan.end],
            ].map(([label, ep]) => {
              const e = ep as typeof plan.start;
              return (
                <li key={label as string} className="rounded-xl bg-slate-50 p-2">
                  <span className="font-semibold">{label as string}:</span> {e.label}
                  {e.address && <span className="block text-xs text-slate-600">{e.address}</span>}
                  {e.point ? (
                    <span className="block font-mono text-xs text-slate-500">
                      {e.point.lat.toFixed(6)}, {e.point.lng.toFixed(6)}
                    </span>
                  ) : (
                    <span className="block text-xs font-semibold text-caution">Not confirmed yet: choose the exact place.</span>
                  )}
                </li>
              );
            })}
          </ol>
          {schedule?.ok ? (
            <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Route distance" value={formatKm(plan.route!.distanceM / 1000)} hint={schedule.totals.distanceKm - plan.route!.distanceM / 1000 > 0.05 ? `${formatKm(schedule.totals.distanceKm)} with detours` : 'Bicycle route'} />
              <Stat label="Departure" value={formatTime(schedule.departureMs, plan.timeZone)} />
              <Stat label="Riding time" value={formatDuration(schedule.totals.movingMin + schedule.totals.bufferMin)} hint={`at ${plan.settings.speedKmh} km/h + ${plan.settings.delayBufferPct}% buffer`} />
              <Stat label="Planned rest" value={formatDuration(schedule.totals.restMin)} />
              <Stat label="Pit stops" value={schedule.totals.stops} />
              <Stat label="Total time" value={formatDuration(schedule.totals.elapsedMin)} />
              <Stat label="Est. arrival" value={formatTime(schedule.finish.arrivalMs, plan.timeZone)} hint="Estimate" />
              <Stat label="Warnings" value={schedule.warnings.filter((w) => w.level !== 'info').length} />
            </dl>
          ) : (
            <p className="mt-3 text-sm text-slate-600">{schedule && !schedule.ok ? schedule.error : 'No schedule yet.'}</p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Link className="btn-secondary" to="/schedule"><CalendarClock aria-hidden className="h-4 w-4" />Schedule</Link>
            <Link className="btn-secondary" to="/map"><Map aria-hidden className="h-4 w-4" />Map</Link>
            <Link className="btn-secondary" to="/checklists"><ClipboardCheck aria-hidden className="h-4 w-4" />Bike check</Link>
            <Link className="btn-go" to="/ride"><Bike aria-hidden className="h-4 w-4" />Ride mode</Link>
          </div>
        </Card>
      ) : (
        <Card>
          <p className="font-semibold text-navy">No ride planned yet.</p>
          <p className="text-sm text-slate-600">Start with Plan My Ride, or open the sample to see how RideWise works.</p>
        </Card>
      )}

      {plan?.route && (
        <Card>
          <h2 className="flex items-center gap-2 font-bold text-navy"><CloudSun aria-hidden className="h-5 w-5" />Weather and daylight</h2>
          <WeatherCard plan={plan} weather={weather} />
        </Card>
      )}

      {reminders.length > 0 && (
        <Card>
          <h2 className="mb-2 font-bold text-navy">Before you ride</h2>
          <ul className="space-y-2">
            {reminders.map((r) => (
              <li key={r.text}>
                <Link to={r.to} className="block">
                  <Notice level={r.level} title={r.text} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {recent.length > 0 && (
        <Card>
          <h2 className="mb-2 font-bold text-navy">Recent ride plans</h2>
          <ul className="divide-y divide-slate-100">
            {recent.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                <button type="button" className="min-h-[44px] flex-1 text-left" onClick={() => setActive(p.id)}>
                  <span className="font-medium">{p.name}</span>
                  <span className="block text-xs text-slate-500">
                    {p.route ? formatKm(p.route.distanceM / 1000) : 'No route'} · {p.stops.length} stops · updated {p.updatedAt.slice(0, 10)}
                  </span>
                </button>
                {p.id === plan?.id ? <Badge tone="sky">Open</Badge> : p.isSample ? <Badge tone="caution">Sample</Badge> : null}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
