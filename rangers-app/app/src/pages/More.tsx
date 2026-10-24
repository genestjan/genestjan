import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Back, Card, H2, Page } from '../components/ui';
import { activeTeam, put, uid, update, useAppState, exportBackup } from '../lib/store';
import { AGE_BANDS, PROGRAMMES, type Programme } from '../lib/model';
import { FORMATS, type FormatId } from '../lib/types';
import { isStaff, useMyChildren, useRole } from '../lib/role';
import { approveMember, assignStaff, cloudEnabled, createCoachInvite, enablePush, inviteLink, listMembers, setConsent, signOut, syncNow, useCloud, type Member } from '../lib/cloud';
import { NOTICE_VERSION, PrivacyText } from './Auth';
import { EmergencyEditor } from '../components/Emergency';
import { download, fmtDateTime, share } from '../lib/util';
import { TIPS_PARENTS } from '../content/safety';

export default function More() {
  const role = useRole(); const staff = isStaff(role); const s = useAppState(); const cloud = useCloud(); const nav = useNavigate();
  const L = ({ to, children }: { to: string; children: React.ReactNode }) => <Link to={to} className="card block p-4 text-lg font-semibold">{children}</Link>;
  return (
    <Page title="More">
      <div className="grid gap-2">
        {staff ? (<><L to="/match">Matches</L><L to="/board">Tactics board</L><L to="/safety">Safety: head knock, heat, thunder</L><L to="/recognise">Recognise a child</L><L to="/review">Term reviews</L><L to="/motivation">Motivation corner</L><L to="/support">Club support: fund, boots, contributions</L><L to="/settings">Settings and club admin</L><L to="/help">Match day help</L></>)
          : (<><L to="/support">Club support</L><L to="/privacy">Privacy and my child's information</L><L to="/tips">Tips for parents</L><L to="/help">Help</L></>)}
        {!cloudEnabled && staff && <button className="btn ghost" onClick={() => { update((x) => ({ ...x, previewChildId: x.players[0]?.id })); nav('/'); }}>Preview the parent app</button>}
        {!cloudEnabled && s.previewChildId && <button className="btn" onClick={() => { update((x) => ({ ...x, previewChildId: undefined })); nav('/'); }}>Back to the coach app</button>}
        {cloudEnabled && <button className="btn ghost" onClick={() => signOut()}>Sign out ({cloud.email})</button>}
      </div>
      {cloudEnabled && <p className="muted mt-3 text-sm">{cloud.syncing ? 'Syncing...' : cloud.lastSync ? `Last synced ${fmtDateTime(new Date(cloud.lastSync).toISOString())}` : 'Not synced yet'} {cloud.offline && ' · offline'} <button className="underline" onClick={() => syncNow()}>Sync now</button></p>}
    </Page>
  );
}

export function Tips() {
  return <Page title="Tips" back={<Back to="/more" />}><Card><ul className="grid gap-3 text-lg">{TIPS_PARENTS.map((t) => <li key={t}>{t}</li>)}</ul></Card></Page>;
}
export function Help() {
  return (
    <Page title="Help" back={<Back to="/more" />}>
      <Card className="grid gap-3"><h2 className="text-2xl">Match day in five steps</h2>
        <ol className="list-decimal pl-5"><li>Matches, New match: pick the format, periods and how often you sub.</li><li>Tick who is here. Check the minutes plan. Lock a keeper if you want.</li><li>Show the kids: lineup, our 3 keys, the move, values. Swipe through.</li><li>Kick off. The phone buzzes before each sub. Tap a child on the pitch, then a child on the bench to swap.</li><li>Half-time: ask them first what is working. After the match, celebrate, win or lose.</li></ol>
        <h2 className="text-2xl">Showing the board on a TV</h2><ul className="list-disc pl-5"><li>Hold the tablet up: simplest for small groups. Use Sun mode outdoors.</li><li>HDMI: USB-C to HDMI adapter and cable. Most reliable, no internet needed.</li><li>Screen mirroring to a smart TV or casting stick on the same Wi-Fi.</li><li>TV link: open this app's address followed by /tv on the TV, then type the code shown on your phone.</li></ul>
        <h2 className="text-2xl">Add to the home screen</h2><p>Android Chrome: three dots, Add to Home screen. iPhone: open in Safari (not inside Messenger), Share, Add to Home Screen. Reminders on iPhone only work after this.</p></Card>
    </Page>
  );
}

export function Settings() {
  const s = useAppState(); const cloud = useCloud(); const role = useRole(); const team = activeTeam(s);
  const [tn, setTn] = useState(''); const [prog, setProg] = useState<Programme>('rangers'); const [band, setBand] = useState<(typeof AGE_BANDS)[number]>('U10'); const [fmt, setFmt] = useState<FormatId>('8v8');
  const [token, setToken] = useState(''); const [msg, setMsg] = useState(''); const [members, setMembers] = useState<Member[]>([]);
  useEffect(() => { if (cloud.status === 'ready' && role === 'admin') listMembers().then(setMembers).catch(() => {}); }, [cloud.status, role, token]);
  const st = s.settings; const set = (p: Partial<typeof st>) => update((x) => ({ ...x, settings: { ...x.settings, ...p } }));
  /** Runs an admin action, then refreshes the list and says what happened (or what went wrong). */
  const act = async (f: () => Promise<void>, done: string) => { setMsg('Saving...'); try { await f(); setMembers(await listMembers()); setMsg(done); } catch (e) { setMsg(`Not saved: ${(e as Error).message}`); } };
  return (
    <Page title="Settings" back={<Back to="/more" />}>
      <H2>You</H2><Card><label className="grid gap-1 text-sm font-semibold">Name shown on your messages<input className="field" value={s.me.name} onChange={(e) => update((x) => ({ ...x, me: { ...x.me, name: e.target.value } }))} /></label></Card>
      <H2>Teams</H2>
      <Card className="grid gap-2">{s.teams.map((t) => <div key={t.id} className="flex items-center justify-between gap-2"><span>{t.name} <span className="muted text-sm">({PROGRAMMES[t.programme].short}, {t.ageBand}, {t.defaultFormat})</span></span><button className={`btn min-h-[44px] px-3 text-sm ${t.id === team.id ? '' : 'ghost'}`} onClick={() => update((x) => ({ ...x, activeTeamId: t.id }))}>{t.id === team.id ? 'Active' : 'Use'}</button></div>)}
        <h3 className="mt-2 text-2xl">Rename the active team</h3>
        <input className="field" aria-label="Active team name" value={team.name} onChange={(e) => put('teams', { ...team, name: e.target.value })} />
        <h3 className="mt-2 text-2xl">Add a team</h3><input className="field" placeholder="Team name, e.g. Gila U12" aria-label="Team name" value={tn} onChange={(e) => setTn(e.target.value)} />
        <div className="grid grid-cols-3 gap-2"><select className="field" aria-label="Programme" value={prog} onChange={(e) => setProg(e.target.value as Programme)}>{Object.entries(PROGRAMMES).map(([k, v]) => <option key={k} value={k}>{v.short}</option>)}</select><select className="field" aria-label="Age group" value={band} onChange={(e) => setBand(e.target.value as typeof band)}>{AGE_BANDS.map((b) => <option key={b}>{b}</option>)}</select><select className="field" aria-label="Format" value={fmt} onChange={(e) => setFmt(e.target.value as FormatId)}>{Object.values(FORMATS).map((f) => <option key={f.id} value={f.id}>{f.id}</option>)}</select></div>
        <button className="btn" disabled={!tn} onClick={() => { const id = crypto.randomUUID(); put('teams', { id, name: tn, programme: prog, ageBand: band, defaultFormat: fmt }); update((x) => ({ ...x, activeTeamId: id })); setTn(''); }}>Add team</button></Card>
      <H2>Safety rules</H2>
      <Card className="grid gap-2"><label className="flex items-center gap-3"><input type="checkbox" className="h-6 w-6" checked={st.goingDefaultTraining} onChange={(e) => set({ goingDefaultTraining: e.target.checked })} />Training: "Going" unless the parent says otherwise</label>
        <label className="grid gap-1 text-sm font-semibold">Minimum days before a competitive match after a head injury<input type="number" className="field" value={st.concussionMinDays} onChange={(e) => set({ concussionMinDays: Math.max(0, +e.target.value) })} /></label>
        <label className="grid gap-1 text-sm font-semibold">Head coach PIN (needed to clear a head injury; leave blank for none)<input className="field" inputMode="numeric" value={st.headCoachPin} onChange={(e) => set({ headCoachPin: e.target.value.replace(/\D/g, '') })} /></label></Card>
      <H2>Contributions</H2>
      <Card className="grid gap-2"><label className="flex items-center gap-3"><input type="checkbox" className="h-6 w-6" checked={st.contributionsOn} onChange={(e) => set({ contributionsOn: e.target.checked })} />Show contributions (off by default)</label>
        <label className="grid gap-1 text-sm font-semibold">GCash number families pay to<input className="field" inputMode="tel" value={st.gcashNumber} onChange={(e) => set({ gcashNumber: e.target.value })} /></label><p className="muted text-sm">Reference numbers are checked for format only. A coach confirms each payment by hand. Waivers are private.</p></Card>

      {cloudEnabled && cloud.status === 'ready' && (<>
        <H2>Reminders on this phone</H2><Card className="grid gap-2"><button className="btn" onClick={async () => setMsg(await enablePush())}>Turn on reminders</button>{msg && <p role="status">{msg}</p>}<p className="muted text-sm">On iPhone, add the app to the Home Screen first.</p></Card>
        {role === 'admin' && (<><H2>Coaches</H2><Card className="grid gap-2">
          <button className="btn" onClick={async () => { try { setToken(inviteLink(await createCoachInvite())); } catch (e) { setMsg((e as Error).message); } }}>Create a coach invite link</button>
          {token && <><input className="field" readOnly value={token} onFocus={(e) => e.target.select()} aria-label="Coach invite link" /><button className="btn ghost" onClick={() => share(`Join the Rangers coaching app: ${token}`)}>Send it</button></>}
          {members.filter((m) => m.role !== 'parent').map((m) => <div key={m.user_id} className="flex flex-wrap items-center gap-2 text-sm"><span className="flex-1 truncate"><b>{m.name}</b> · {m.role}{m.status === 'pending' ? ' (waiting)' : ''}</span>
            {m.status === 'pending' && <><button className="btn min-h-[44px]" onClick={() => act(() => approveMember(m.user_id, true), `${m.name} approved. Now add them to a team.`)}>Approve</button><button className="btn ghost min-h-[44px]" onClick={() => act(() => approveMember(m.user_id, false), `${m.name} declined.`)}>Decline</button></>}
            {m.status === 'active' && m.role === 'coach' && <><button className="btn ghost min-h-[44px]" onClick={() => act(() => assignStaff(m.user_id, team.id, false), `${m.name} added to ${team.name}.`)}>Add to {team.name}</button><button className="btn ghost min-h-[44px]" onClick={() => act(() => assignStaff(m.user_id, team.id, true), `${m.name} is now head coach of ${team.name}.`)}>Head coach of {team.name}</button></>}</div>)}
          {msg && <p role="status" className="font-semibold">{msg}</p>}
          <p className="muted text-sm">Only head coaches (and you) can clear a child after a head injury. Coaches see only the teams you add them to.</p>
        </Card></>)}</>)}
      <H2>Your data</H2>
      <Card className="grid gap-2"><button className="btn ghost" onClick={() => download(`rangers-backup-${new Date().toISOString().slice(0, 10)}.json`, exportBackup())}>Back up everything to a file</button>
        <p className="muted text-sm">Keep backups somewhere private. The file has children's information: do not send it in group chats.</p></Card>
    </Page>
  );
}

export function Privacy() {
  const s = useAppState(); const kids = useMyChildren(); const [err, setErr] = useState('');
  const setPhoto = async (id: string, v: boolean) => {
    setErr('');
    if (cloudEnabled) { try { await setConsent(id, 'photo', v, NOTICE_VERSION); await syncNow(); } catch (e) { setErr((e as Error).message); } }
    else update((x) => ({ ...x, players: x.players.map((p) => (p.id === id ? { ...p, photoConsent: v } : p)) }));
  };
  return (
    <Page title="Privacy" back={<Back to="/more" />}>
      <Card className="mb-3 grid gap-2"><PrivacyText /><p className="muted text-sm">Notice version {NOTICE_VERSION}.</p></Card>
      {kids.map((k) => (
        <Card key={k.id} className="mb-3 grid gap-3"><h3 className="text-2xl">{k.firstName}</h3>
          <label className="flex items-center gap-3"><input type="checkbox" className="h-6 w-6" checked={k.photoConsent} onChange={(e) => void setPhoto(k.id, e.target.checked)} />Show {k.firstName}'s photo on team screens</label>
          <h4 className="text-xl">Emergency contacts</h4>
          <EmergencyEditor p={k} />
          <button className="btn ghost" onClick={() => download(`${k.firstName}-data.json`, JSON.stringify({ child: k, reviews: s.assessments.filter((a) => a.playerId === k.id), goals: s.goals.filter((g) => g.playerId === k.id), badges: s.badges.filter((b) => b.playerId === k.id), growth: s.growth.filter((g) => g.playerId === k.id), injuries: s.injuries.filter((i) => i.playerId === k.id), minutes: s.minutes.filter((m) => m.playerId === k.id), messages: s.messages.filter((m) => m.playerId === k.id) }, null, 2))}>Download everything about {k.firstName}</button>
          <p className="muted text-sm">To correct or delete {k.firstName}'s information, message the coach from the Inbox.</p></Card>))}
      {err && <p role="alert" className="text-red">{err}</p>}
    </Page>
  );
}

export function Motivation() {
  const s = useAppState(); const team = activeTeam(s); const [t, setT] = useState(''); const [move, setMove] = useState('');
  return (
    <Page title="Motivation" back={<Back to="/more" />}>
      <Card className="mb-3"><h2 className="text-2xl">Our values</h2><p className="mt-1 text-lg">{PROGRAMMES[team.programme].values.join(' · ')}</p></Card>
      <H2>Move of the week</H2><Card className="grid gap-2"><input className="field" placeholder="e.g. Cruyff turn: show it at the next session" value={move} onChange={(e) => setMove(e.target.value)} /><p className="muted text-sm">Link a good free YouTube clip in your group chat and keep the challenge short.</p></Card>
      <H2>Comeback stories</H2>
      <Card className="grid gap-2"><p className="muted text-sm">Two or three lines about real players who were late developers or kept going after being cut. Check each one is accurate.</p>
        {s.stories.map((x) => <p key={x.id} className="rounded-xl p-3" style={{ background: 'var(--bg)' }}>{x.text} <button className="underline" onClick={() => update((y) => ({ ...y, stories: y.stories.filter((z) => z.id !== x.id) }))}>remove</button></p>)}
        <textarea className="field py-3" rows={2} value={t} onChange={(e) => setT(e.target.value)} /><button className="btn" disabled={!t.trim()} onClick={() => { put('stories', { id: uid(), text: t.trim() }); setT(''); }}>Add story</button></Card>
    </Page>
  );
}
