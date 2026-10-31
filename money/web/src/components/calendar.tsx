import { CalendarCheck, Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { calendarScript, newCalendarSecret } from '../lib/calendarScript';
import { ago } from '../lib/dates';
import { native } from '../lib/native';
import { copyText, logProblem } from '../lib/problems';
import { checkScriptUrl, clearCalendar, reminderSettings, testCalendar } from '../lib/reminders';
import { refreshReminders, save, toast, useApp } from '../lib/session';
import { ErrorText, Field, Sheet, Spinner } from './ui';

/** Connect Google Calendar through an Apps Script that runs in your own Google account. */
export function CalendarSheet({ onClose }: { onClose: () => void }) {
  const snap = useApp((s) => s.snap)!;
  const calendarError = useApp((s) => s.calendarError);
  const opts = reminderSettings(snap.settings);
  const link = opts.calendar;
  const [secret] = useState(link?.secret ?? opts.scriptSecret ?? newCalendarSecret());
  const [url, setUrl] = useState(link?.url ?? '');
  const [amounts, setAmounts] = useState(link?.amounts ?? true);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ message: string; detail?: string } | null>(null);

  const saveLink = async (next: typeof link) => {
    await save([{ ...snap.settings, reminders: { ...opts, calendar: next } }]);
  };

  async function copyScript() {
    // Kept from the moment it is copied: Money Hub may lock (closing this panel) while you are
    // in Apps Script, and a new secret would no longer match the script you pasted there.
    if (opts.scriptSecret !== secret) await save([{ ...snap.settings, reminders: { ...opts, scriptSecret: secret } }]);
    if (await copyText(calendarScript(secret))) setCopied(true);
  }

  async function connect() {
    const problem = checkScriptUrl(url);
    if (problem) return setErr({ message: problem });
    setBusy(true);
    setErr(null);
    try {
      const name = await testCalendar({ url: url.trim(), secret });
      await saveLink({ url: url.trim(), secret, amounts, hash: undefined });
      await refreshReminders(true);
      const after = useApp.getState().calendarError;
      if (after) return setErr(after);
      toast(`Connected. Reminders are in your "${name}" calendar.`);
      onClose();
    } catch (e) {
      setErr(logProblem('Connecting Google Calendar', e));
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!link) return;
    setBusy(true);
    try {
      await clearCalendar(link).catch(() => undefined);
      await saveLink(undefined);
      toast('Google Calendar disconnected. Its Money Hub reminders were removed.');
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title="Bill reminders in Google Calendar" wide
      footer={
        <div className="flex gap-2">
          {link && <button className="btn-danger" disabled={busy} onClick={() => void disconnect()}>Disconnect</button>}
          <button className="btn-primary flex-1" disabled={busy || !url} onClick={() => void connect()}>
            {busy ? <Spinner /> : <CalendarCheck size={18} />} {link ? 'Save and send again' : 'Connect and send'}
          </button>
        </div>
      }>
      <div className="space-y-4 text-sm">
        <p className="leading-relaxed text-muted">
          Each bill gets an all-day event {opts.days} days before it is due, in a separate calendar called
          <span className="text-paper"> Money Hub bills</span> that only you can see. Paid bills disappear by themselves.
          It works through a small script in your own Google account, so Money Hub never holds a Google password or token.
        </p>
        {link?.lastSync && <p className="text-xs text-income">Connected. Last sent {ago(link.lastSync)}.</p>}
        {calendarError && link && <ErrorText detail={calendarError.detail}>{calendarError.message}</ErrorText>}
        <ol className="list-decimal space-y-3 pl-5 leading-relaxed text-paper/90">
          <li>
            <button className="btn-outline px-3 py-2 text-sm" onClick={() => void copyScript()}>
              <Copy size={16} /> {copied ? 'Script copied' : 'Copy the script'}
            </button>
            <span className="ml-2 text-muted">(your private secret is already inside)</span>
          </li>
          <li>
            Open <button className="text-current underline" onClick={() => void native.openUrl('https://script.google.com/home/projects/create')}>script.google.com <ExternalLink size={12} className="inline" /></button>,
            signed in to the Google account whose calendar you use. Select everything in the editor, paste the script over it, and click the save icon.
          </li>
          <li>At the top, choose <span className="text-paper">setup</span> and click <span className="text-paper">Run</span>. Allow the calendar permission (Advanced, then Go to the project, then Allow).</li>
          <li>Click <span className="text-paper">Deploy</span>, <span className="text-paper">New deployment</span>, the gear, <span className="text-paper">Web app</span>. Execute as <span className="text-paper">Me</span>, Who has access <span className="text-paper">Anyone</span>. Click <span className="text-paper">Deploy</span> and copy the Web app URL.</li>
          <li>Paste it here.</li>
        </ol>
        <p className="text-xs leading-relaxed text-muted">
          Pasted the script again later? Google keeps running the old copy until you deploy again: Deploy, New deployment, Deploy, then paste the new Web app URL here.
        </p>
        <Field label="Web app URL">
          <input className="field font-mono text-xs" placeholder="https://script.google.com/macros/s/.../exec" value={url} onChange={(e) => setUrl(e.target.value.trim())} spellCheck={false} autoCapitalize="off" />
        </Field>
        <label className="flex items-center gap-3">
          <input type="checkbox" className="h-4 w-4 accent-[#FFB03A]" checked={amounts} onChange={(e) => setAmounts(e.target.checked)} />
          Show amounts in the calendar events
        </label>
        <ErrorText detail={err?.detail}>{err?.message}</ErrorText>
      </div>
    </Sheet>
  );
}
