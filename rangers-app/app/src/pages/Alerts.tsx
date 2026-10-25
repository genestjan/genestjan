import { useState } from 'react';
import { Download, Volume2 } from 'lucide-react';
import { Back, Card, H2, Page } from '../components/ui';
import { cloudEnabled, enablePush, sendTestAlert, useCloud } from '../lib/cloud';
import { playAlert, setSoundOn, soundOn, TONE } from '../lib/sound';

/** Everyone: alerts on this phone, and the club song as the alert sound. */
export default function Alerts() {
  const c = useCloud(); const [msg, setMsg] = useState(''); const [test, setTest] = useState(''); const [on, setOn] = useState(soundOn());
  return (
    <Page title="Alerts and sound" back={<Back to="/more" />}>
      <H2>Alerts on this phone</H2>
      <Card className="grid gap-2">
        <p>Get an alert for announcements, messages, new tasks and the day before an event, even when the app is closed.</p>
        <button className="btn" onClick={async () => setMsg(await enablePush())}>Turn on alerts</button>{msg && <p role="status">{msg}</p>}
        {cloudEnabled && c.status === 'ready' && <><button className="btn ghost" onClick={async () => setTest(await sendTestAlert())}>Send me a test alert</button>{test && <p role="status">{test}</p>}</>}
        <p className="muted text-sm">iPhone: open the app in Safari, tap Share, Add to Home Screen, and open it from the Home Screen first. Alerts only work there.</p>
      </Card>
      <H2>Our song as the sound</H2>
      <Card className="grid gap-2">
        <label className="flex items-center gap-3"><input type="checkbox" className="h-6 w-6" checked={on} onChange={(e) => { setOn(e.target.checked); setSoundOn(e.target.checked); }} />Play "We move as one" for new messages and announcements while the app is open</label>
        <button className="btn ghost" onClick={() => playAlert(true)}><Volume2 size={18} aria-hidden="true" />Play it now</button>
        <p className="muted text-sm">When the app is closed, the phone plays its own alert sound. On Android you can change it to our song:</p>
        <a className="btn ghost" href={TONE} download="Rangers - We move as one.mp3"><Download size={18} aria-hidden="true" />Save the song to this phone</a>
        <ol className="list-decimal grid gap-1 pl-5 text-sm">
          <li>Tap the button above to save the song.</li>
          <li>Open your phone's <b>Settings</b>, then <b>Apps</b>, then <b>Rangers</b> (if you added the app to the Home screen) or <b>Chrome</b>.</li>
          <li>Tap <b>Notifications</b>, then the alert type (for example "Sites" or "General"), then <b>Sound</b>.</li>
          <li>Choose <b>Rangers - We move as one</b>. If it is not listed, tap <b>+</b> or "Add" and pick it from Downloads.</li>
        </ol>
        <p className="muted text-sm">Every phone is a little different. If you choose Chrome, the song plays for alerts from other websites too. iPhone does not let web apps change the alert sound.</p>
      </Card>
    </Page>
  );
}
