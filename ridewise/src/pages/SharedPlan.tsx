import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { decodeShare, type SharedPlan as Shared } from '../lib/share';
import { computeSchedule, kindLabel } from '../lib/schedule';
import { CATEGORY_LABEL } from '../lib/discovery';
import { newId } from '../lib/schedule';
import { formatDuration, formatKm, formatTime } from '../lib/time';
import { googleDirectionsUrl } from '../lib/navlinks';
import { useStore } from '../store/store';
import { useAuth } from '../store/auth';
import { Mascot } from '../components/Mascot';
import { Badge, Card, Notice, PageTitle } from '../components/ui';
import { RouteMap } from '../components/RouteMap';

export default function SharedPlan() {
  const { token } = useParams();
  const nav = useNavigate();
  const savePlan = useStore((s) => s.savePlan);
  const signedIn = useAuth((s) => s.status === 'unlocked');
  const [plan, setPlan] = useState<Shared | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!token) return;
    decodeShare(token).then(setPlan).catch((e) => setError((e as Error).message || 'This share link could not be read.'));
  }, [token]);
  const schedule = useMemo(() => (plan ? computeSchedule({ ...plan, candidates: [] }) : null), [plan]);

  if (error) return <div className="mx-auto max-w-2xl p-4"><Notice level="danger" title="I could not open this ride plan">{error}</Notice></div>;
  if (!plan || !schedule) return <p role="status" className="p-6">Opening shared plan…</p>;
  const tz = plan.timeZone;
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 pb-10 pt-4">
      <div className="flex items-center gap-3 rounded-2xl bg-navy p-3 text-white">
        <Mascot size={48} />
        <p className="text-base font-semibold">A friend shared this ride with you. You can look at it without an account.</p>
      </div>
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
      <div className="flex flex-wrap gap-2">
        {signedIn ? (
          <button type="button" className="btn-primary" onClick={() => { const { sharedAt: _s, ...rest } = plan; savePlan({ ...rest, id: newId('plan'), candidates: [], name: `${plan.name} (shared)` }); nav('/schedule'); }}>
            Save a copy to this phone
          </button>
        ) : (
          <Link className="btn-primary" to="/">Make an account to keep a copy</Link>
        )}
        {signedIn && <Link className="btn-ghost" to="/">Open RideWise</Link>}
      </div>
    </div>
  );
}
