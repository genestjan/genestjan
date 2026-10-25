import { useEffect, useState } from 'react';
import { Copy, ExternalLink } from 'lucide-react';
import { Back, Card, H2, Page } from '../components/ui';
import { accessToken, cloudEnabled, enablePush, PUBLIC_CFG, sendTestAlert, useCloud } from '../lib/cloud';
import { update, useAppState } from '../lib/store';
import { useRole } from '../lib/role';
import { drivePing, driveSpace, isDriveScriptUrl, scriptSender } from '../lib/drive';
import { isVapidPublic, makeVapidKeys, pushCronSql } from '../lib/vapid';
import scriptTpl from '../../supabase/drive-videos/Code.gs?raw';
import manifest from '../../supabase/drive-videos/appsscript.json?raw';
import pushFunction from '../../supabase/functions/send-push/index.ts?raw';

/** A value to copy into another website, with a Copy button. */
export function CopyBox({ label, value, rows = 1, secret }: { label: string; value: string; rows?: number; secret?: boolean }) {
  const [done, setDone] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 2000); } catch { setDone(false); } };
  return (
    <div className="grid gap-1">
      <span className="text-sm font-semibold">{label}</span>
      {rows > 1 ? <textarea className="field py-2 font-mono text-xs" rows={rows} readOnly value={value} aria-label={label} onFocus={(e) => e.currentTarget.select()} />
        : <input className="field font-mono text-xs" readOnly value={value} aria-label={label} onFocus={(e) => e.currentTarget.select()} />}
      <button className="btn ghost min-h-[44px]" onClick={() => void copy()}><Copy size={16} aria-hidden="true" />{done ? 'Copied' : 'Copy'}{secret ? ' (paste it only into Supabase)' : ''}</button>
    </div>
  );
}
const Step = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
  <Card className="mb-3 grid gap-2"><h3 className="text-lg font-bold">{n}. {title}</h3>{children}</Card>
);
const Out = ({ href, children }: { href: string; children: React.ReactNode }) => <a className="underline" href={href} target="_blank" rel="noreferrer">{children}<ExternalLink size={12} className="ml-1 inline" aria-hidden="true" /></a>;
const needsCloud = <Card><p>This needs sign-in (accounts) switched on for the club first.</p></Card>;

/** Admin, once: coaches' videos go into the club's Google Drive (free), through a small script on the club's Google account. */
export function DriveSetup() {
  const s = useAppState(); const role = useRole(); const c = useCloud();
  const [url, setUrl] = useState(s.settings.driveUrl ?? ''); const [msg, setMsg] = useState('');
  const script = scriptTpl.replace('__SUPABASE_URL__', PUBLIC_CFG.url).replace('__SUPABASE_ANON_KEY__', PUBLIC_CFG.anon);
  const check = async () => {
    setMsg('Checking...');
    if (!isDriveScriptUrl(url)) { setMsg('That is not a web app link. It starts with https://script.google.com/macros/s/ and ends with /exec.'); return; }
    if (!(await drivePing(url.trim()))) { setMsg('No answer from that link. Check step 5: Who has access must be "Anyone".'); return; }
    update((x) => ({ ...x, settings: { ...x.settings, driveUrl: url.trim() } }));
    const sp = await driveSpace(scriptSender(url.trim()), await accessToken()).catch(() => null);
    setMsg(sp ? `Connected. Coaches can now upload videos in the app.${sp.free !== null ? ` ${(sp.free / 1073741824).toFixed(1)} GB free in the club's Drive.` : ''}` : 'Connected, but the script could not check your sign-in. Run the latest update.sql in Supabase, then press Check again.');
  };
  if (!cloudEnabled || c.status !== 'ready') return <Page title="Videos in Google Drive" back={<Back to="/settings" />}>{needsCloud}</Page>;
  if (role !== 'admin') return <Page title="Videos in Google Drive" back={<Back to="/settings" />}><Card><p>Only a club admin can set this up.</p></Card></Page>;
  return (
    <Page title="Videos in Google Drive" back={<Back to="/settings" />}>
      <Card className="mb-3 grid gap-2">
        <p>Coaches upload videos inside the app; they are kept in the club's Google Drive (free, 15 GB) and play here in the app. About 10 minutes, once, on a computer.</p>
        <p className="text-sm"><b>Use the club's Google account</b>, not a personal one, so the videos stay with the club when people change. The script can only open the files it makes itself, nothing else in that Drive.</p>
      </Card>
      <Step n={1} title="Make the script"><p>Sign in to Google with the club account, open <Out href="https://script.google.com/home/projects/create">script.google.com, New project</Out>, and name it "Rangers videos". Delete what is in Code.gs and paste this:</p>
        <CopyBox label="The script (Code.gs)" value={script} rows={5} /></Step>
      <Step n={2} title="Limit what it can open"><p>Click the gear (Project Settings) and tick <b>Show "appsscript.json" manifest file</b>. Go back to the Editor, open <b>appsscript.json</b>, delete what is there and paste:</p>
        <CopyBox label="appsscript.json" value={manifest.trim()} rows={4} /></Step>
      <Step n={3} title="Run setup once"><p>At the top, choose <b>setup</b> and press <b>Run</b>. Google asks for permission: Review permissions, choose the club account. If it says "Google hasn't verified this app": Advanced, then Go to Rangers videos. It is your own script. Allow.</p>
        <p className="muted text-sm">It makes a Drive folder called "Rangers App videos".</p></Step>
      <Step n={4} title="Publish it as a web app"><p><b>Deploy</b>, <b>New deployment</b>, the gear next to "Select type", <b>Web app</b>. Execute as: <b>Me</b>. Who has access: <b>Anyone</b>. Deploy, then copy the <b>Web app URL</b>.</p>
        <p className="muted text-sm">"Anyone" is needed because families and coaches do not sign in to Google. Every upload and removal is still checked with their Rangers sign-in: only coaches can upload.</p></Step>
      <Step n={5} title="Paste the link here">
        <label className="grid gap-1 text-sm font-semibold">Web app URL<input className="field" inputMode="url" placeholder="https://script.google.com/macros/s/.../exec" value={url} onChange={(e) => setUrl(e.target.value)} /></label>
        <button className="btn" onClick={() => void check()}>Check and save</button>
        {msg && <p role="status">{msg}</p>}
      </Step>
      <p className="muted text-sm">Changed the script later? Deploy, Manage deployments, the pencil, Version: New version, Deploy. The link stays the same.</p>
    </Page>
  );
}

/** Admin, once: push alerts on everyone's phone (announcements, messages, tasks, reminders). Free on Supabase. */
export function PushSetup() {
  const s = useAppState(); const role = useRole(); const c = useCloud();
  const [keys, setKeys] = useState<{ publicKey: string; privateKey: string } | null>(null); const [msg, setMsg] = useState(''); const [test, setTest] = useState('');
  const pub = keys?.publicKey ?? s.settings.vapidPublic ?? '';
  useEffect(() => () => setKeys(null), []);
  const make = async () => {
    if (s.settings.vapidPublic && !confirm('Make new keys? Alerts stop on every phone until each person taps Turn on alerts again. Only do this if the private key was lost.')) return;
    const k = await makeVapidKeys(); setKeys(k);
    update((x) => ({ ...x, settings: { ...x.settings, vapidPublic: k.publicKey } }));
  };
  if (!cloudEnabled || c.status !== 'ready') return <Page title="Push alerts" back={<Back to="/settings" />}>{needsCloud}</Page>;
  if (role !== 'admin') return <Page title="Push alerts" back={<Back to="/settings" />}><Card><p>Only a club admin can set this up.</p></Card></Page>;
  const dash = PUBLIC_CFG.url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
  const base = dash ? `https://supabase.com/dashboard/project/${dash}` : 'https://supabase.com/dashboard';
  return (
    <Page title="Push alerts" back={<Back to="/settings" />}>
      <Card className="mb-3"><p>Alerts pop up on phones for announcements, messages, new tasks and the day before events, even when the app is closed. Free. About 15 minutes, once, best on a computer.</p></Card>
      <Step n={1} title="Make the alert keys">
        {pub && !keys && <p className="text-sm">Keys were made already{isVapidPublic(pub) ? '' : ' (but the public key looks wrong)'}. If you still have the private key in Supabase, skip to step 3.</p>}
        <button className="btn" onClick={() => void make()}>{pub ? 'Make new keys' : 'Make the keys'}</button>
        {keys && <><CopyBox label="Public key" value={keys.publicKey} />
          <CopyBox label="Private key (secret)" value={keys.privateKey} secret />
          <p className="text-sm text-red">The private key is shown only now. Paste it into Supabase in step 2 and nowhere else: not in chat, email or GitHub.</p></>}
      </Step>
      <Step n={2} title="Put the keys in Supabase"><p>Open <Out href={`${base}/functions/secrets`}>Supabase, Edge Functions, Secrets</Out> and add these three (name, then value):</p>
        <CopyBox label="Name 1" value="VAPID_PUBLIC_KEY" />{pub && <CopyBox label="Value 1 (public key)" value={pub} />}
        <CopyBox label="Name 2" value="VAPID_PRIVATE_KEY" /><p className="muted text-sm">Value 2: the private key from step 1.</p>
        <CopyBox label="Name 3" value="VAPID_SUBJECT" /><CopyBox label="Value 3" value={`mailto:${c.email || 'admin@rangersfc.net'}`} /></Step>
      <Step n={3} title="Add the sending function"><p>Open <Out href={`${base}/functions`}>Supabase, Edge Functions</Out>, <b>Deploy a new function</b>, <b>Via Editor</b>. Name it exactly <b>send-push</b>. Delete the example code, paste this, then <b>Deploy function</b>:</p>
        <CopyBox label="The function code" value={pushFunction} rows={5} /></Step>
      <Step n={4} title="Send alerts every minute"><p>In <Out href={`${base}/database/extensions`}>Database, Extensions</Out> turn on <b>pg_net</b> (pg_cron is on already). Then <Out href={`${base}/sql/new`}>SQL Editor, New query</Out>: paste this and Run. The last line, "Push alerts sending", should say true.</p>
        <CopyBox label="SQL" value={pushCronSql(PUBLIC_CFG.url, PUBLIC_CFG.anon)} rows={5} /></Step>
      <Step n={5} title="Try it on this phone">
        <button className="btn" onClick={async () => setMsg(await enablePush())}>Turn on alerts on this phone</button>{msg && <p role="status">{msg}</p>}
        <button className="btn ghost" onClick={async () => setTest(await sendTestAlert())}>Send me a test alert</button>{test && <p role="status">{test}</p>}
        <p className="muted text-sm">Then ask each coach and family to tap More, Alerts and sound, Turn on alerts. On iPhone they must first add the app to the Home Screen (Share, Add to Home Screen) and open it from there.</p>
      </Step>
    </Page>
  );
}
