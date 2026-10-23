import { ExternalLink, Navigation, Plus, ShieldCheck, X } from 'lucide-react';
import type { Candidate, RidePlan } from '../types';
import { CATEGORY_LABEL } from '../lib/discovery';
import { hoursLabel, hoursStatusAt } from '../lib/hours';
import { googleDirectionsUrl, osmUrl } from '../lib/navlinks';
import { formatKm, formatTime } from '../lib/time';
import type { Schedule } from '../lib/schedule';
import { Badge } from './ui';

export function verificationBadge(c: Candidate) {
  switch (c.verification) {
    case 'user-verified':
      return <Badge tone="go">Confirmed by a rider{c.lastVerified ? ` ${c.lastVerified}` : ''}</Badge>;
    case 'user-unverified':
      return <Badge tone="caution">User-submitted, unverified</Badge>;
    case 'reported-closed':
      return <Badge tone="danger">Reported closed</Badge>;
    default:
      return <Badge tone="slate">OpenStreetMap listing, not verified</Badge>;
  }
}

export function sourceText(c: Candidate) {
  if (c.source === 'user' || c.source === 'map-pin') return `Added by a rider on ${c.retrievedAt.slice(0, 10)}`;
  const via = c.source === 'osm-nominatim' ? 'Nominatim (sample snapshot)' : 'Overpass';
  return `OpenStreetMap contributors via ${via}${c.osmRef ? ` (${c.osmRef})` : ''}, retrieved ${c.retrievedAt.slice(0, 10)}`;
}

/** Estimated arrival at a candidate if the group rode straight there from the last stop before it. */
export function etaFor(c: Candidate, plan: RidePlan, schedule: Schedule): number | null {
  if (!schedule.ok) return null;
  let clock = schedule.departureMs;
  let prevKm = 0;
  for (const r of schedule.rows) {
    if (r.skipped || r.stop.place.routeKm > c.routeKm) break;
    clock = r.departureMs!;
    prevKm = r.stop.place.routeKm;
  }
  const km = c.routeKm - prevKm + c.detourKm / 2;
  return clock + (km / plan.settings.speedKmh) * 60 * (1 + plan.settings.delayBufferPct / 100) * 60000;
}

export function PlaceDetail({
  c,
  plan,
  schedule,
  onClose,
  onAdd,
  onVerify,
  inPlan,
}: {
  c: Candidate;
  plan: RidePlan;
  schedule: Schedule;
  onClose: () => void;
  onAdd?: () => void;
  onVerify?: () => void;
  inPlan: boolean;
}) {
  const eta = etaFor(c, plan, schedule);
  const hours = eta ? hoursStatusAt(c.openingHours, eta, plan.timeZone) : 'unknown';
  const prevStop = [...plan.stops].filter((s) => s.status !== 'skipped' && s.place.routeKm < c.routeKm).pop();
  return (
    <div className="card relative" aria-live="polite">
      <button type="button" onClick={onClose} className="btn-ghost absolute right-2 top-2 min-h-[40px] px-2" aria-label="Close details">
        <X className="h-5 w-5" />
      </button>
      <h2 className="pr-10 text-lg font-bold text-navy">{c.name}</h2>
      <p className="text-sm text-slate-600">{CATEGORY_LABEL[c.category]}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {verificationBadge(c)}
        {!c.insideCorridor && <Badge tone="caution">Outside search corridor</Badge>}
        {c.category === 'fuel' && <Badge tone="caution">Confirm a safe bike area before stopping</Badge>}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-slate-500">From start</dt>
        <dd>{formatKm(c.routeKm)} along route</dd>
        <dt className="text-slate-500">From previous stop</dt>
        <dd>{formatKm(c.routeKm - (prevStop?.place.routeKm ?? 0))}</dd>
        <dt className="text-slate-500">Off route</dt>
        <dd>{c.offRouteM} m (straight line)</dd>
        <dt className="text-slate-500">Detour</dt>
        <dd>{c.detourKm === 0 ? 'Roadside' : `~${formatKm(c.detourKm, 2)} there and back (estimate)`}</dd>
        <dt className="text-slate-500">Estimated arrival</dt>
        <dd>{eta ? `${formatTime(eta, plan.timeZone)} (estimate)` : '—'}</dd>
        <dt className="text-slate-500">Opening hours</dt>
        <dd>
          {c.openingHours ? <span className="font-mono text-xs">{c.openingHours}</span> : 'Hours not verified'}
          {c.openingHours && <span className={`block text-xs ${hours === 'listed-closed' ? 'font-semibold text-danger' : 'text-slate-600'}`}>{hoursLabel(hours)}</span>}
        </dd>
        {c.address && (
          <>
            <dt className="text-slate-500">Address</dt>
            <dd>{c.address}</dd>
          </>
        )}
        <dt className="text-slate-500">Coordinates</dt>
        <dd className="font-mono text-xs">
          {c.point.lat.toFixed(6)}, {c.point.lng.toFixed(6)}
        </dd>
        <dt className="text-slate-500">Source</dt>
        <dd className="text-xs">{sourceText(c)}</dd>
        {c.supplies?.length ? (
          <>
            <dt className="text-slate-500">Supplies</dt>
            <dd>{c.supplies.join(', ')}</dd>
          </>
        ) : null}
        {c.notes && (
          <>
            <dt className="text-slate-500">Rider notes</dt>
            <dd>{c.notes}</dd>
          </>
        )}
      </dl>
      {c.photo && <img src={c.photo} alt={`Photo of ${c.name} submitted by a rider`} className="mt-3 max-h-48 rounded-xl" />}
      <div className="mt-4 flex flex-wrap gap-2">
        {onAdd && !inPlan && (
          <button type="button" className="btn-primary" onClick={onAdd} disabled={c.verification === 'reported-closed'}>
            <Plus aria-hidden className="h-4 w-4" /> Add to ride plan
          </button>
        )}
        {inPlan && <Badge tone="sky">In your plan</Badge>}
        {onVerify && c.verification !== 'user-verified' && (
          <button type="button" className="btn-secondary" onClick={onVerify}>
            <ShieldCheck aria-hidden className="h-4 w-4" /> I confirmed this place
          </button>
        )}
        <a className="btn-secondary" href={googleDirectionsUrl(c.point)} target="_blank" rel="noreferrer">
          <Navigation aria-hidden className="h-4 w-4" /> Google Maps
        </a>
        <a className="btn-ghost" href={osmUrl(c.point)} target="_blank" rel="noreferrer">
          <ExternalLink aria-hidden className="h-4 w-4" /> OSM
        </a>
      </div>
      <p className="mt-2 text-xs text-slate-500">Navigation links open another app. RideWise calculated the route; turn-by-turn navigation is handled by that app.</p>
    </div>
  );
}
