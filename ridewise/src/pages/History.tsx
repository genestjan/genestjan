import { Link, useNavigate } from 'react-router-dom';
import { Copy, FolderOpen, Trash2 } from 'lucide-react';
import { useStore } from '../store/store';
import { newId } from '../lib/schedule';
import { formatDateTime, formatDuration, formatKm } from '../lib/time';
import { Badge, Card, EmptyState, PageTitle, confirmAction } from '../components/ui';

export default function History() {
  const nav = useNavigate();
  const plans = useStore((s) => s.plans);
  const history = useStore((s) => s.history);
  const setActive = useStore((s) => s.setActive);
  const savePlan = useStore((s) => s.savePlan);
  const deletePlan = useStore((s) => s.deletePlan);
  const list = Object.values(plans).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="space-y-4">
      <PageTitle title="Ride History" subtitle="Saved plans and finished rides on this device." />
      <Card>
        <h2 className="mb-2 font-bold text-navy">Saved ride plans</h2>
        {list.length === 0 ? (
          <EmptyState title="No saved plans" action={<Link className="btn-primary" to="/plan">Plan My Ride</Link>} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {list.map((p) => (
              <li key={p.id} className="py-3">
                <p className="font-semibold">
                  {p.name} {p.isSample && <Badge tone="caution">Sample</Badge>} <Badge>{p.status}</Badge>
                </p>
                <p className="text-xs text-slate-500">
                  {p.start.label} → {p.end.label} · {p.route ? formatKm(p.route.distanceM / 1000) : 'no route'} · {p.stops.length} stops · departs {p.departureLocal.replace('T', ' ')} · saved {p.updatedAt.slice(0, 16).replace('T', ' ')}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className="btn-secondary min-h-[40px]" onClick={() => { setActive(p.id); nav('/schedule'); }}><FolderOpen aria-hidden className="h-4 w-4" />Open</button>
                  <button
                    type="button"
                    className="btn-ghost min-h-[40px]"
                    onClick={() => {
                      const now = new Date().toISOString();
                      savePlan({
                        ...p,
                        id: newId('plan'),
                        name: `${p.name} (copy)`,
                        isSample: false,
                        createdAt: now,
                        status: p.route ? 'planned' : 'draft',
                        stops: p.stops.map((s) => ({ ...s, status: 'planned', actualArrival: undefined, actualDeparture: undefined, suppliesReplenished: false })),
                      });
                    }}
                  >
                    <Copy aria-hidden className="h-4 w-4" />Duplicate
                  </button>
                  <button type="button" className="btn-ghost min-h-[40px] text-danger" onClick={() => confirmAction(`Delete "${p.name}" from this device? This cannot be undone.`) && deletePlan(p.id)}>
                    <Trash2 aria-hidden className="h-4 w-4" />Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <h2 className="mb-2 font-bold text-navy">Finished rides</h2>
        {history.length === 0 ? (
          <p className="text-sm text-slate-600">Rides you end in Live Ride mode appear here.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {history.map((h) => (
              <li key={h.id} className="py-2 text-sm">
                <p className="font-semibold">{h.planName}</p>
                <p className="text-slate-600">
                  {formatDateTime(Date.parse(h.startedAt), 'Asia/Manila')} · total {formatDuration(h.elapsedMin)} · riding {formatDuration(h.movingMin)} · {h.distanceKm != null ? `${formatKm(h.distanceKm)} (to last stop reached)` : 'distance not recorded'} · {h.stopsCompleted} {h.stopsCompleted === 1 ? 'stop' : 'stops'}
                </p>
              </li>
            ))}
          </ul>
        )}
        <Link className="btn-secondary mt-3" to="/checklists?kind=post-ride">Post-ride checklist</Link>
      </Card>
    </div>
  );
}
