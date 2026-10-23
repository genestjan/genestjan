import { useEffect, useState } from 'react';
import { Download, Upload, Trash2 } from 'lucide-react';
import { useStore } from '../store/store';
import { NumberField, Card, Field, Notice, PageTitle, confirmAction } from '../components/ui';
import { config } from '../config';
import { currentUserEmail, sendMagicLink, signOut, syncConfigured, syncNow } from '../services/sync';
import type { RidePlan } from '../types';

export default function Settings() {
  const prefs = useStore((s) => s.prefs);
  const setPrefs = useStore((s) => s.setPrefs);
  const plans = useStore((s) => s.plans);
  const sessions = useStore((s) => s.sessions);
  const updateSession = useStore((s) => s.updateSession);
  const wipeAll = useStore((s) => s.wipeAll);
  const [msg, setMsg] = useState<{ level: 'ok' | 'caution' | 'danger'; text: string } | null>(null);

  const askNotifications = async (on: boolean) => {
    if (!on) return setPrefs({ notifications: false });
    if (!('Notification' in window)) return setMsg({ level: 'caution', text: 'This browser does not support notifications. Reminders still show inside the app.' });
    const p = await Notification.requestPermission();
    setPrefs({ notifications: p === 'granted' });
    if (p !== 'granted') setMsg({ level: 'caution', text: 'Notifications were not allowed. Reminders still show inside the app.' });
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), plans: Object.values(plans) }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ridewise-plans-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importData = async (f: File | undefined) => {
    if (!f) return;
    try {
      const j = JSON.parse(await f.text()) as { plans?: RidePlan[] };
      if (!Array.isArray(j.plans)) throw new Error('No plans in this file.');
      const valid = j.plans.filter((p) => p && typeof p.id === 'string' && Array.isArray(p.stops) && p.settings);
      useStore.setState((s) => ({ plans: { ...s.plans, ...Object.fromEntries(valid.map((p) => [p.id, p])) } }));
      setMsg({ level: 'ok', text: `Imported ${valid.length} plan(s).` });
    } catch (e) {
      setMsg({ level: 'danger', text: `Import failed: ${(e as Error).message}` });
    }
  };
  const anyGps = Object.values(sessions).some((s) => s.gpsEnabled);

  return (
    <div className="space-y-4">
      <PageTitle title="Settings" />
      {msg && <Notice level={msg.level} title={msg.text} />}
      <Card className="space-y-3">
        <h2 className="font-bold text-navy">Reminders</h2>
        <p className="text-sm text-slate-600">Starting points, not prescriptions. Drink and eat to your own needs, the heat and how hard you are working.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <NumberField id="s-h" label="Hydration check every" suffix="min" value={prefs.hydrateEveryMin} min={5} max={120} onChange={(n) => setPrefs({ hydrateEveryMin: n })} />
          <NumberField id="s-s" label="Snack reminder every" suffix="min" value={prefs.snackEveryMin} min={10} max={180} onChange={(n) => setPrefs({ snackEveryMin: n })} />
          <NumberField id="s-u" label="Supply check every" suffix="min" value={prefs.suppliesEveryMin} min={15} max={240} onChange={(n) => setPrefs({ suppliesEveryMin: n })} />
        </div>
        <label className="flex min-h-[44px] items-center gap-3">
          <input type="checkbox" className="h-5 w-5" checked={prefs.notifications} onChange={(e) => askNotifications(e.target.checked)} /> Phone notifications for reminders (while RideWise is open)
        </label>
      </Card>

      <Card className="space-y-2">
        <h2 className="font-bold text-navy">Location</h2>
        <p className="text-sm text-slate-600">
          RideWise reads your location only in Live Ride mode, only after you turn it on, and only while that screen is open. It is used on this phone to measure distance to the next stop and is never uploaded or shared.
        </p>
        <button type="button" className="btn-secondary" disabled={!anyGps} onClick={() => Object.keys(sessions).forEach((id) => updateSession(id, (s) => ({ ...s, gpsEnabled: false, progressSource: 'manual' })))}>
          {anyGps ? 'Turn off location for all rides' : 'Location is off'}
        </button>
        <p className="text-xs text-slate-500">To remove the permission completely, use your browser's site settings for this page.</p>
      </Card>

      <AccountCard />

      <Card className="space-y-2">
        <h2 className="font-bold text-navy">Your data</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>Ride plans, checklists and history are saved on this device (browser storage). Clearing site data or uninstalling deletes them.</li>
          <li>Your rider profile, emergency contact and medical notes never leave this device: not in share links, not in sync.</li>
          <li>Searches send the text you type to OpenStreetMap Nominatim. Route and place searches send coordinates to the routing and Overpass servers. Weather sends three route coordinates to Open-Meteo.</li>
          <li>Share links carry a copy of the plan inside the link itself; anyone with the link can read it.</li>
        </ul>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={exportData}><Download aria-hidden className="h-4 w-4" />Export plans</button>
          <label className="btn-secondary cursor-pointer">
            <Upload aria-hidden className="h-4 w-4" />Import plans
            <input type="file" accept="application/json" className="sr-only" onChange={(e) => importData(e.target.files?.[0])} />
          </label>
          <button type="button" className="btn-danger" onClick={() => confirmAction('Delete ALL RideWise data on this device? This cannot be undone.') && wipeAll()}>
            <Trash2 aria-hidden className="h-4 w-4" />Delete all data
          </button>
        </div>
      </Card>

      <Card className="space-y-1 text-sm">
        <h2 className="font-bold text-navy">Data sources</h2>
        <p>Map tiles and place data: © OpenStreetMap contributors (ODbL). Place search: Overpass API ({config.overpassUrls.map((u) => new URL(u).host).join(', ')}).</p>
        <p>Bicycle routing: {config.routeProxyUrl ? 'openrouteservice via RideWise server, with ' : ''}OSRM bicycle profile on the FOSSGIS public server.</p>
        <p>Geocoding: Nominatim. Weather: Open-Meteo.com.</p>
        <p className="text-xs text-slate-500">Community map data can be incomplete or out of date. RideWise shows where each fact came from and never fills gaps with invented places.</p>
      </Card>
    </div>
  );
}

function AccountCard() {
  const plans = useStore((s) => s.plans);
  const [email, setEmail] = useState('');
  const [user, setUser] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    currentUserEmail().then(setUser).catch(() => setUser(null));
  }, []);
  if (!syncConfigured())
    return (
      <Card className="space-y-1">
        <h2 className="font-bold text-navy">Account and sync</h2>
        <p className="text-sm text-slate-600">
          This RideWise is running in local-only mode: everything is saved on this device. Account sync between devices becomes available when the site owner connects a Supabase project (see README).
        </p>
      </Card>
    );
  return (
    <Card className="space-y-2">
      <h2 className="font-bold text-navy">Account and sync</h2>
      {user ? (
        <>
          <p className="text-sm">Signed in as {user}. Sync copies your plans (not your rider profile) to your account.</p>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const merged = await syncNow(Object.values(plans));
                  useStore.setState((s) => ({ plans: { ...s.plans, ...Object.fromEntries(merged.map((p) => [p.id, p])) } }));
                  setMsg(`Synced ${merged.length} plan(s).`);
                } catch (e) {
                  setMsg((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Syncing…' : 'Sync now'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => signOut().then(() => setUser(null))}>Sign out</button>
          </div>
        </>
      ) : (
        <form
          className="space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await sendMagicLink(email);
              setMsg('Check your email for a sign-in link.');
            } catch (err) {
              setMsg((err as Error).message);
            }
          }}
        >
          <Field label="Email" htmlFor="acc-email">
            <input id="acc-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <button type="submit" className="btn-primary">Email me a sign-in link</button>
        </form>
      )}
      {msg && <p className="text-sm" role="status">{msg}</p>}
    </Card>
  );
}
