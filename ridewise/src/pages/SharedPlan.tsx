import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { decodeShare, type SharedPlan as Shared } from '../lib/share';
import { computeSchedule, kindLabel } from '../lib/schedule';
import { CATEGORY_LABEL } from '../lib/discovery';
import { newId } from '../lib/schedule';
import { formatDuration, formatKm, formatTime } from '../lib/time';
import { googleDirectionsUrl } from '../lib/navlinks';
import { useStore } from '../store/store';
import { Badge, Card, Notice, PageTitle } from '../components/ui';
import { RouteMap } from '../components/RouteMap';

export default function SharedPlan() {
  const { token } = useParams();
  const nav = useNavigate();
  const savePlan = useStore((s) => s.savePlan);
  const [plan, setPlan] = useState<Shared | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!token) return;
    decodeShare(token).then(setPlan).catch((e) => setError((e as Error).message || 'This share link could not be read.'));
  }, [token]);
  const schedule = useMemo(() => (plan ? computeSchedule({ ...plan, candidates: [] }) : null), [plan]);

  if (error) return <Notice level="danger" title="Could not open this ride plan">{error}</Notice>;
  if (!plan || !schedule) return <p role="status">Opening shared plan…</p>;
  const tz = plan.timeZone;
  return (
    <div className="space-y-4">
      <PageTitle title={plan.group.name || plan.name} subtitle={`Shared ride plan · read-only · shared ${plan.sharedAt.slice(0, 10)}`} />
      {plan.isSample && <Badge tone="caution">Sample: demonstration data</Badge>}
      <Card className="text-sm">
        <p><strong>Meet:</strong> {plan.group.meetingPoint || plan.start.label}</p>
        <p><strong>Depart:</strong> {plan.departureLocal.replace('T', ' ')} ({tz})</p>
        <p><strong>Destination:</strong> {plan.end.label}</p>
        <p><strong>Pace:</strong> {plan.settings.speedKmh} km/h group pace{plan.group.organizer ? ` · organiser ${plan.group.organizer}` : ''}</p>
        {schedule.ok && (
          <p><strong>Estimated arrival:</strong> {formatTime(schedule.finish.arrivalMs, tz)} · {formatKm(schedule.totals.distanceKm)} · {formatDuration(schedule.totals.elapsedMin)} total</p>
        )}
      </Card>
      <RouteMap className="h-[45dvh]" route={plan.route} start={plan.start.point} end={plan.end.point} stops={plan.stops} />
      {schedule.ok && (
        <ol className="space-y-2">
          {schedule.rows.filter((r) => !r.skipped).map((r) => (
            <li key={r.stop.id} className="card text-sm">
              <p className="text-xs font-bold uppercase text-sky">Stop {r.number}: {kindLabel(r.stop.kind)}</p>
              <p className="font-semibold">{r.stop.place.name} <span className="font-normal text-slate-500">({CATEGORY_LABEL[r.stop.place.category]})</span></p>
              <p>Arrive {formatTime(r.arrivalMs!, tz)} · leave {formatTime(r.departureMs!, tz)} · km {r.cumKm.toFixed(1)}</p>
              <a className="text-sky underline" href={googleDirectionsUrl(r.stop.place.point)} target="_blank" rel="noreferrer">Directions</a>
            </li>
          ))}
        </ol>
      )}
      <Notice level="info" title="Times are estimates from the organiser's plan.">Agree your regrouping procedure with the organiser before you leave.</Notice>
      <div className="flex gap-2">
        <button type="button" className="btn-primary" onClick={() => { const { sharedAt: _s, ...rest } = plan; savePlan({ ...rest, id: newId('plan'), candidates: [], name: `${plan.name} (shared)` }); nav('/schedule'); }}>
          Save a copy to this phone
        </button>
        <Link className="btn-ghost" to="/">Open RideWise</Link>
      </div>
    </div>
  );
}
