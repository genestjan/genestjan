import { useState } from 'react';
import { Phone, Siren, X } from 'lucide-react';
import { useActivePlan, useStore } from '../store/store';
import { MEDICAL_CATEGORIES, CATEGORY_LABEL } from '../lib/discovery';
import { googleDirectionsUrl } from '../lib/navlinks';
import { formatKm } from '../lib/time';

export function EmergencyButton({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={compact ? 'btn min-h-[42px] bg-danger px-4 text-sm font-bold uppercase tracking-wide text-white' : 'btn-danger w-full text-lg'}
        aria-haspopup="dialog"
      >
        <Siren aria-hidden className="h-5 w-5" /> {compact ? 'SOS' : 'Emergency help'}
      </button>
      {open && <EmergencyPanel onClose={() => setOpen(false)} />}
    </>
  );
}

export function EmergencyPanel({ onClose }: { onClose: () => void }) {
  const plan = useActivePlan();
  const session = useStore((s) => (plan ? s.sessions[plan.id] : undefined));
  const rider = useStore((s) => s.rider);
  const here = session?.progressKm ?? 0;
  const medical = (plan?.candidates ?? [])
    .filter((c) => MEDICAL_CATEGORIES.includes(c.category) && c.verification !== 'reported-closed')
    .map((c) => ({ c, away: Math.abs(c.routeKm - here) + c.detourKm / 2 }))
    .sort((a, b) => a.away - b.away)
    .slice(0, 5);

  return (
    <div className="fixed inset-0 z-[3000] flex items-end justify-center bg-black/50 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="emergency-title">
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-4xl bg-white p-6 sm:rounded-4xl">
        <div className="flex items-start justify-between">
          <h2 id="emergency-title" className="text-xl font-bold text-danger">
            Emergency help
          </h2>
          <button type="button" className="btn-ghost min-h-[40px] px-2" onClick={onClose} aria-label="Close emergency panel">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-3 space-y-3 text-sm">
          <p className="font-semibold">
            Chest pain, fainting, confusion, severe difficulty breathing, a serious crash or heavy bleeding: call emergency services now.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <a className="btn-danger text-base" href="tel:911">
              <Phone aria-hidden className="h-5 w-5" /> Call 911
            </a>
            <a className="btn-secondary text-base" href="tel:143">
              <Phone aria-hidden className="h-5 w-5" /> Red Cross 143
            </a>
          </div>
          <p className="text-xs text-slate-500">911 is the Philippines national emergency hotline. 143 is the Philippine Red Cross hotline.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Move yourself and the bike off the road to a safe, visible place.</li>
            <li>Tell your group where you are. Share your location from your maps app if you can.</li>
            <li>Do not ride again while dizzy, confused, in significant pain, or with a damaged bike.</li>
          </ul>
          {rider.emergencyContactPhone && (
            <a className="btn-secondary w-full" href={`tel:${rider.emergencyContactPhone}`}>
              <Phone aria-hidden className="h-5 w-5" /> Call {rider.emergencyContactName || 'emergency contact'}
            </a>
          )}
          <div>
            <h3 className="font-semibold">Nearest mapped medical places on this route</h3>
            {medical.length === 0 ? (
              <p className="text-slate-600">
                None loaded. Run place search on the Map page while online, or ask locals for the nearest health centre.
              </p>
            ) : (
              <ul className="mt-1 space-y-2">
                {medical.map(({ c, away }) => (
                  <li key={c.id} className="rounded-xl border border-slate-200 p-2">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-slate-600">
                      {CATEGORY_LABEL[c.category]} · about {formatKm(away)} along the route from {session ? 'your last known position' : 'the start'} · {c.source === 'user' ? 'added by a rider' : 'OpenStreetMap listing, not verified'}
                    </p>
                    <a className="mt-1 inline-block text-sm font-semibold text-sky underline" href={googleDirectionsUrl(c.point)} target="_blank" rel="noreferrer">
                      Directions in Google Maps
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
