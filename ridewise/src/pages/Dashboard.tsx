import { Link, useNavigate } from 'react-router-dom';
import { Bike, Check, CloudSun, Map, PlayCircle, Route as RouteIcon, ClipboardCheck, CalendarClock } from 'lucide-react';
import { useStore, checklistKey } from '../store/store';
import { useAuth } from '../store/auth';
import { usePlanSchedule } from '../lib/usePlan';
import { newPlan } from '../lib/defaults';
import { openSampleRide } from '../lib/sampleRide';
import { CHECKLISTS, progress } from '../lib/checklists';
import { formatDateTime, formatDuration, formatKm, formatTime, parseLocal } from '../lib/time';
import { Badge, Notice } from '../components/ui';
import { Mascot } from '../components/Mascot';
import { WeatherCard } from '../components/WeatherCard';

export default function Dashboard() {
  const nav = useNavigate();
  const { plan, schedule, weather } = usePlanSchedule();
  const name = useAuth((s) => s.current?.name);
  const plans = useStore((s) => s.plans);
  const savePlan = useStore((s) => s.savePlan);
  const setActive = useStore((s) => s.setActive);
  const checklists = useStore((s) => s.checklists);
  const recent = Object.values(plans).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4);

  const planMyRide = () => {
    const draft = Object.values(plans).find((p) => p.status === 'draft' && !p.isSample);
    if (draft) setActive(draft.id);
    else savePlan(newPlan());
    nav('/plan');
  };
  const startSample = async () => {
    await openSampleRide();
    nav('/map');
  };

  const preList = progress(CHECKLISTS['pre-ride'].items, plan ? checklists[checklistKey('pre-ride', plan.id)]?.states ?? {} : {});
  const depMs = plan ? parseLocal(plan.departureLocal, plan.timeZone) : null;
  const confirmed = !!plan?.start.point && !!plan?.end.point;

  // The path a new rider follows. The first step that is not done is highlighted.
  const steps = [
    { n: 1, title: 'Pick your trip', hint: 'Where do you start? Where do you stop?', done: !!plan?.route, to: '/plan', Icon: RouteIcon },
    { n: 2, title: 'See your stops', hint: 'Where will you drink, eat and rest?', done: (plan?.stops.length ?? 0) > 0, to: '/schedule', Icon: CalendarClock },
    { n: 3, title: 'Check your bike', hint: 'Helmet, brakes, tires, lights.', done: preList.pct === 100 && preList.criticalProblems.length === 0, to: '/checklists', Icon: ClipboardCheck },
    { n: 4, title: 'Go ride!', hint: 'Open Ride mode on the day.', done: plan?.status === 'completed', to: '/ride', Icon: Bike },
  ];
  const next = steps.find((s) => !s.done)?.n;

  const alerts: { level: 'info' | 'caution'; text: string; to: string }[] = [];
  if (plan) {
    if (preList.criticalProblems.length) alerts.push({ level: 'caution', text: 'A bike problem is marked. Fix it before you ride.', to: '/checklists' });
    if (plan.group.riders > 1 && !plan.group.regroupProcedureAgreed) alerts.push({ level: 'info', text: 'Agree with your group how you wait for each other.', to: '/plan?step=5' });
    if (depMs && depMs > Date.now() && depMs - Date.now() < 36 * 3600000) alerts.push({ level: 'info', text: `You ride ${formatDateTime(depMs, plan.timeZone)}. Charge your lights and phone tonight.`, to: '/checklists' });
  }

  return (
    <div className="space-y-5">
      <section className="card">
        <p className="text-base font-semibold text-brand-700">Hi{name ? `, ${name}` : ''}!</p>
        <h1 className="mt-1 font-display text-[1.75rem] font-bold leading-snug text-navy">The goal is to arrive smiling, not crawling.</h1>
      </section>

      <div className="space-y-3">
        <button type="button" className="btn-go w-full text-lg" onClick={planMyRide}>
          Plan My Ride
        </button>
        <button type="button" className="btn-secondary w-full" onClick={startSample}>
          <PlayCircle aria-hidden className="h-5 w-5" /> Start Sample Ride (demo data)
        </button>
      </div>

      <section aria-labelledby="upcoming">
        <h2 id="upcoming" className="mb-2 px-1 text-lg font-medium text-slate-500">
          Upcoming Ride
        </h2>
        {plan ? (
          <div className="card-outline space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="font-display text-xl font-bold text-navy">{plan.name}</h3>
              {plan.isSample && <Badge tone="caution">Sample: demonstration data</Badge>}
            </div>
            <p className="text-base">
              <span className="font-bold">Start:</span> {plan.start.label}
            </p>
            <p className="text-base">
              <span className="font-bold">Destination:</span> {plan.end.label}
            </p>
            {!confirmed && <p className="text-base font-semibold text-caution">Not confirmed yet. Open Plan to pick the exact places.</p>}

            {schedule?.ok ? (
              <dl className="grid grid-cols-2 gap-3 pt-1">
                {[
                  ['How far', formatKm(plan.route!.distanceM / 1000), schedule.totals.distanceKm - plan.route!.distanceM / 1000 > 0.05 ? `${formatKm(schedule.totals.distanceKm)} with detours` : 'by bicycle'],
                  ['You leave', formatTime(schedule.departureMs, plan.timeZone), ''],
                  ['Time on the bike', formatDuration(schedule.totals.movingMin + schedule.totals.bufferMin), `at ${plan.settings.speedKmh} km/h`],
                  ['Time resting', formatDuration(schedule.totals.restMin), `${schedule.totals.stops} stops`],
                  ['You arrive about', formatTime(schedule.finish.arrivalMs, plan.timeZone), 'an estimate'],
                  ['Things to watch', String(schedule.warnings.filter((w) => w.level !== 'info').length), 'see the Stops page'],
                ].map(([k, v, h]) => (
                  <div key={k} className="rounded-2xl bg-brand-50 p-3">
                    <dt className="text-sm text-slate-600">{k}</dt>
                    <dd className="font-display text-xl font-bold text-navy">{v}</dd>
                    {h && <dd className="text-xs text-slate-500">{h}</dd>}
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-base text-slate-600">{schedule && !schedule.ok ? schedule.error : 'No route yet. Calculate a route first.'}</p>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Link className="btn-soft" to="/checklists">
                <ClipboardCheck aria-hidden className="h-5 w-5" /> Bike check
              </Link>
              <Link className="btn-soft" to="/ride">
                <Bike aria-hidden className="h-5 w-5" /> Ride mode
              </Link>
              <Link className="btn-soft" to="/schedule">
                <CalendarClock aria-hidden className="h-5 w-5" /> Stops
              </Link>
              <Link className="btn-soft" to="/map">
                <Map aria-hidden className="h-5 w-5" /> Map
              </Link>
            </div>
          </div>
        ) : (
          <div className="card flex items-center gap-4">
            <Mascot size={72} />
            <p className="text-lg">
              <strong>No ride yet.</strong> Tap <em>Plan My Ride</em> and I will help you, step by step.
            </p>
          </div>
        )}
      </section>

      <section className="card" aria-labelledby="ready">
        <h2 id="ready" className="font-display text-xl font-bold text-navy">
          Get ready in 4 steps
        </h2>
        <ol className="mt-3 space-y-2">
          {steps.map((s) => (
            <li key={s.n}>
              <Link to={s.to} aria-label={`Step ${s.n}: ${s.title}${s.done ? ' (done)' : s.n === next ? ' (do this next)' : ''}`} className={`flex min-h-[64px] items-center gap-3 rounded-2xl p-3 ${s.n === next ? 'bg-brand-100 ring-2 ring-brand-500' : 'bg-slate-50 hover:bg-brand-50'}`}>
                <span aria-hidden className={`grid h-10 w-10 shrink-0 place-items-center rounded-full font-bold ${s.done ? 'bg-go text-white' : 'bg-white text-brand-700 ring-2 ring-brand-300'}`}>
                  {s.done ? <Check className="h-5 w-5" /> : s.n}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-bold text-navy">{s.title}</span>
                  <span className="block text-sm text-slate-600">{s.hint}</span>
                </span>
                {s.n === next && <span className="chip bg-brand-700 text-white">Next</span>}
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {alerts.length > 0 && (
        <section className="space-y-2" aria-label="Reminders">
          {alerts.map((a) => (
            <Link key={a.text} to={a.to} className="block">
              <Notice level={a.level} title={a.text} />
            </Link>
          ))}
        </section>
      )}

      {plan?.route && (
        <details className="card group">
          <summary className="flex min-h-[48px] cursor-pointer list-none items-center gap-2 font-display text-xl font-bold text-navy">
            <CloudSun aria-hidden className="h-6 w-6 text-peach-deep" /> Weather and daylight
            <span aria-hidden className="ml-auto text-slate-400 group-open:rotate-180">⌄</span>
          </summary>
          <WeatherCard plan={plan} weather={weather} />
        </details>
      )}

      {recent.length > 0 && (
        <section className="card" aria-labelledby="recent">
          <h2 id="recent" className="font-display text-xl font-bold text-navy">
            Your rides
          </h2>
          <ul className="mt-2 divide-y divide-slate-100">
            {recent.map((p) => (
              <li key={p.id}>
                <button type="button" className="flex min-h-[60px] w-full items-center justify-between gap-2 py-2 text-left" onClick={() => setActive(p.id)}>
                  <span>
                    <span className="block text-lg font-semibold">{p.name}</span>
                    <span className="block text-sm text-slate-500">
                      {p.route ? formatKm(p.route.distanceM / 1000) : 'No route yet'} · {p.stops.length} stops
                    </span>
                  </span>
                  {p.id === plan?.id ? <Badge tone="sky">Open now</Badge> : p.isSample ? <Badge tone="caution">Sample</Badge> : null}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
