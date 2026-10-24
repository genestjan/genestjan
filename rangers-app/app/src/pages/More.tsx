import { Avatar, CLUB_PHOTO, CREST, Hero, IconChip, Row } from '../components/ui';
import { Award, ClipboardCheck, Inbox, MessageSquareHeart, ClipboardList, Dumbbell, HeartHandshake, HeartPulse, HelpCircle, IdCard, Lightbulb, ListChecks, Lock, LogOut, Medal, Megaphone, Settings as SettingsIcon, Shapes, ShieldAlert, Sparkles, TrendingUp, Trophy, type LucideIcon } from 'lucide-react';
import { unreadCount } from '../lib/inbox';
import { HelpChat } from '../components/HelpChat';
import { guidesFor } from '../content/guides';
import { startGuide } from '../lib/guide';
import { isSchoolTeam } from '../lib/school';
import { SchoolSettings } from './School';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Back, Card, H2, Page } from '../components/ui';
import { activeTeam, put, uid, update, useAppState, exportBackup } from '../lib/store';
import { AGE_BANDS, PROGRAMMES, type Programme } from '../lib/model';
import { FORMATS, type FormatId } from '../lib/types';
import { isStaff, useMyChildren, useRole } from '../lib/role';
import { approveMember, assignStaff, cloudEnabled, createAdminInvite, createCoachInvite, enablePush, inviteLink, listMembers, removeAdmin, removeMember, removeStaff, setConsent, signOut, syncNow, useCloud, useNewFeedback, type Member } from '../lib/cloud';
import { NOTICE_VERSION, PrivacyText } from './Auth';
import { EmergencyEditor } from '../components/Emergency';
import { download, fmtDateTime, share } from '../lib/util';
import { TIPS_PARENTS } from '../content/safety';

/** One line of the More menu (defined outside the page so it is not rebuilt on every render). */
const R = ({ to, icon, title, badge }: { to: string; icon: LucideIcon; title: string; badge?: number }) => <Row to={to} lead={<IconChip icon={icon} />} title={title} badge={badge ? <span className="rounded-full bg-red px-2 text-sm font-bold text-white">{badge}</span> : undefined} />;

export default function More() {
  const role = useRole(); const staff = isStaff(role); const s = useAppState(); const cloud = useCloud(); const nav = useNavigate(); const myKids = useMyChildren();
  const team = activeTeam(s); const unread = unreadCount(s, staff ? 'staff' : 'parent', staff ? 'coach' : 'parent');
  const newFb = useNewFeedback();
  const roleName = role === 'admin' ? 'Club admin' : role === 'coach' ? 'Coach' : 'Parent or guardian';
  return (
    <Page title="More">
      <Row to={staff ? '/settings' : myKids[0] ? `/details/${myKids[0].id}` : '/privacy'} lead={<Avatar name={s.me.name || 'Me'} size={56} />} title={<span className="text-lg">{s.me.name || 'Me'}</span>} sub={`${roleName}${staff ? ` · ${team.name}` : myKids.length ? ` · ${myKids.map((k) => k.firstName).join(', ')}` : ''}`} />
      <div className="mt-3 grid gap-2">
        {staff ? (<>
          <R to="/inbox" icon={Megaphone} title="Announcements and messages" badge={unread} />
          <R to="/attendance" icon={ClipboardCheck} title="Attendance" />
          <R to="/pathway" icon={Medal} title="Road to Palaro (school teams)" />
          <R to="/documents" icon={IdCard} title="ID papers" />
          <R to="/match" icon={Trophy} title="Matches" />
          <R to="/train" icon={Dumbbell} title="Training" />
          <R to="/board" icon={Shapes} title="Tactics board" />
          <R to="/safety" icon={ShieldAlert} title="Safety: head knock, heat, thunder" />
          <R to="/recognise" icon={Award} title="Recognise a child" />
          <R to="/review" icon={ClipboardList} title="Term reviews" />
          <R to="/motivation" icon={Sparkles} title="Motivation corner" />
          <R to="/support" icon={HeartHandshake} title="Club support: fund, boots, contributions" />
          <R to="/settings" icon={SettingsIcon} title="Settings and club admin" />
          <R to="/help" icon={HelpCircle} title="Help and Show me how" />
          <R to="/feedback?from=More" icon={MessageSquareHeart} title="Send feedback about the app" />
        </>) : (<>
          <R to="/inbox" icon={Megaphone} title="Announcements and messages" badge={unread} />
          <R to="/tasks" icon={ListChecks} title="Tasks from the coach" />
          <R to="/progress" icon={TrendingUp} title="Progress" />
          {myKids.map((k) => <R key={k.id} to={`/details/${k.id}`} icon={HeartPulse} title={`${k.firstName}'s details and health information`} />)}
          {myKids.map((k) => <R key={'d' + k.id} to={`/docs/${k.id}`} icon={IdCard} title={`${k.firstName}'s ID papers`} />)}
          {myKids.some((k) => isSchoolTeam(s.teamInfo, k.teamId)) && <R to="/pathway" icon={Medal} title="Road to Palaro" />}
          <R to="/support" icon={HeartHandshake} title="Club support" />
          <R to="/privacy" icon={Lock} title="Privacy and my child's information" />
          <R to="/tips" icon={Lightbulb} title="Tips for parents" />
          <R to="/help" icon={HelpCircle} title="Help and Show me how" />
          <R to="/feedback?from=More" icon={MessageSquareHeart} title="Send feedback about the app" />
        </>)}
        {cloud.reader && <R to="/feedback/inbox" icon={Inbox} title="Feedback inbox" badge={newFb} />}
        {!cloudEnabled && staff && <button className="btn ghost" onClick={() => { update((x) => ({ ...x, previewChildId: x.players[0]?.id })); nav('/'); }}>Preview the parent app</button>}
        {!cloudEnabled && s.previewChildId && <button className="btn" onClick={() => { update((x) => ({ ...x, previewChildId: undefined })); nav('/'); }}>Back to the coach app</button>}
        {cloudEnabled && <button className="btn ghost" onClick={() => signOut()}><LogOut size={18} />Sign out ({cloud.email})</button>}
      </div>
      {cloudEnabled && <p className="muted mt-3 text-sm">{cloud.syncing ? 'Syncing...' : cloud.lastSync ? `Last synced ${fmtDateTime(new Date(cloud.lastSync).toISOString())}` : 'Not synced yet'} {cloud.offline && ' · offline'} <button className="underline" onClick={() => syncNow()}>Sync now</button></p>}
      <Hero image={CLUB_PHOTO[team.programme]} className="mt-5 min-h-[150px]">
        <div className="flex min-h-[150px] items-center gap-3 p-4"><img src={CREST[team.programme]} alt="" width={72} height={72} className="h-[72px] w-[72px] rounded-full bg-white object-contain p-1" /><div className="text-white"><div className="display text-3xl leading-none">{PROGRAMMES[team.programme].name}</div><div className="text-sm italic text-gold">Play with your heart</div></div></div>
      </Hero>
    </Page>
  );
}

export function Tips() {
  return <Page title="Tips" back={<Back to="/more" />}><Card><ul className="grid gap-3 text-lg">{TIPS_PARENTS.map((t) => <li key={t}>{t}</li>)}</ul></Card></Page>;
}
export function Help() {
  const role = useRole(); const r = role === 'parent' ? 'parent' : 'coach';
  return (
    <Page title="Help" back={<Back to="/more" />}>
      <H2>Ask a question</H2>
      <HelpChat role={r} />
      <H2>Show me how</H2>
      <p className="muted mb-2 text-sm">Each guide opens the right screen and points at the button to tap.</p>
      <div className="grid gap-2">{guidesFor(r).map((g) => <button key={g.id} className="btn ghost justify-start text-left" onClick={() => startGuide(g.id)}>{g.title}</button>)}</div>
      <Card className="mt-4 grid gap-2"><p className="font-bold">Something missing, confusing or not working?</p><p className="muted text-sm">Tell us. Your feedback decides what we improve next.</p><Link className="btn" to="/feedback?from=Help">Send feedback</Link></Card>
      {r === 'coach' && <><H2>More help</H2>
      <Card className="grid gap-3"><h2 className="text-2xl">Match day in five steps</h2>
        <ol className="list-decimal pl-5"><li>Matches, New match: pick the format, periods and how often you sub.</li><li>Tick who is here. Check the minutes plan. Lock a keeper if you want.</li><li>Show the kids: lineup, our 3 keys, the move, values. Swipe through.</li><li>Kick off. The phone buzzes before each sub. Tap a child on the pitch, then a child on the bench to swap.</li><li>Half-time: ask them first what is working. After the match, celebrate, win or lose.</li></ol>
        <h2 className="text-2xl">Showing the board on a TV</h2><ul className="list-disc pl-5"><li>Hold the tablet up: simplest for small groups. Use Sun mode outdoors.</li><li>HDMI: USB-C to HDMI adapter and cable. Most reliable, no internet needed.</li><li>Screen mirroring to a smart TV or casting stick on the same Wi-Fi.</li><li>TV link: open this app's address followed by /tv on the TV, then type the code shown on your phone.</li></ul>
        <h2 className="text-2xl">Add to the home screen</h2><p>Android Chrome: three dots, Add to Home screen. iPhone: open in Safari (not inside Messenger), Share, Add to Home Screen. Reminders on iPhone only work after this.</p></Card></>}
    </Page>
  );
}

export function Settings() {
  const s = useAppState(); const cloud = useCloud(); const role = useRole(); const team = activeTeam(s);
  const [tn, setTn] = useState(''); const [prog, setProg] = useState<Programme>('rangers'); const [band, setBand] = useState<(typeof AGE_BANDS)[number]>('U10'); const [fmt, setFmt] = useState<FormatId>('8v8');
  const [token, setToken] = useState(''); const [adminLink, setAdminLink] = useState(''); const [msg, setMsg] = useState(''); const [adminMsg, setAdminMsg] = useState(''); const [pushMsg, setPushMsg] = useState(''); const [members, setMembers] = useState<Member[]>([]);
  const admins = members.filter((m) => m.role === 'admin'); const teamName = (id: string) => s.teams.find((t) => t.id === id)?.name ?? 'another team';
  useEffect(() => { if (cloud.status === 'ready' && role === 'admin') listMembers().then(setMembers).catch(() => {}); }, [cloud.status, role, token]);
  const st = s.settings; const set = (p: Partial<typeof st>) => update((x) => ({ ...x, settings: { ...x.settings, ...p } }));
  /** Runs an admin action, then refreshes the list and says what happened (or what went wrong). */
  const act = async (f: () => Promise<void>, done: string, say: (m: string) => void = setMsg) => { say('Saving...'); try { await f(); setMembers(await listMembers()); say(done); } catch (e) { say(`Not saved: ${(e as Error).message}`); } };
  return (
    <Page title="Settings" back={<Back to="/more" />}>
      <H2>You</H2><Card><label className="grid gap-1 text-sm font-semibold">Name shown on your messages<input className="field" value={s.me.name} onChange={(e) => update((x) => ({ ...x, me: { ...x.me, name: e.target.value } }))} /></label></Card>
      <H2>Teams</H2>
      <Card className="grid gap-2">{s.teams.map((t) => <div key={t.id} className="flex items-center justify-between gap-2"><span>{t.name} <span className="muted text-sm">({PROGRAMMES[t.programme].short}, {t.ageBand}, {t.defaultFormat})</span></span><button className={`btn min-h-[44px] px-3 text-sm ${t.id === team.id ? '' : 'ghost'}`} onClick={() => update((x) => ({ ...x, activeTeamId: t.id }))}>{t.id === team.id ? 'Active' : 'Use'}</button></div>)}
        <h3 className="mt-2 text-2xl">School team settings for {team.name}</h3>
        <SchoolSettings teamId={team.id} />
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
        <H2>Reminders on this phone</H2><Card className="grid gap-2"><button className="btn" onClick={async () => setPushMsg(await enablePush())}>Turn on reminders</button>{pushMsg && <p role="status">{pushMsg}</p>}<p className="muted text-sm">On iPhone, add the app to the Home Screen first.</p></Card>
        {role === 'admin' && (<><H2>Club admins</H2><Card className="grid gap-2" data-tour="admins">
          <p className="text-sm">Admins run the whole club in the app: teams, coaches, settings and every child's information. Only invite someone you trust.</p>
          <button className="btn" onClick={async () => { setAdminMsg(''); try { setAdminLink(inviteLink(await createAdminInvite())); } catch (e) { setAdminMsg((e as Error).message); } }}>Create an admin invite link</button>
          {adminLink && <><input className="field" readOnly value={adminLink} onFocus={(e) => e.target.select()} aria-label="Admin invite link" />
            <button className="btn ghost" onClick={() => share(`You are invited to be an admin of the Rangers app. Open this link in Chrome and sign in with Google. It works once, for 3 days: ${adminLink}`)}>Send it</button>
            <p className="muted text-sm">Send it to one person, privately (not in a group chat). It works once, for 3 days. They become an admin as soon as they open it and sign in.</p></>}
          {admins.map((m) => <div key={m.user_id} className="flex flex-wrap items-center gap-2 text-sm"><span className="flex-1 truncate"><b>{m.name}</b>{m.user_id === cloud.userId ? ' (you)' : ''} · admin</span>
            {m.user_id === cloud.userId
              ? admins.length > 1 && <button className="btn ghost min-h-[44px]" onClick={() => { if (confirm('Step down as admin? You stay in the app as a coach.')) void act(() => removeAdmin(m.user_id), 'You stepped down. You are now a coach.', setAdminMsg); }}>Step down as admin</button>
              : <button className="btn ghost min-h-[44px]" onClick={() => { if (confirm(`Take admin rights away from ${m.name}? They stay in the app as a coach.`)) void act(() => removeAdmin(m.user_id), `${m.name} is now a coach.`, setAdminMsg); }}>Remove admin</button>}
          </div>)}
          {adminMsg && <p role="status" className="font-semibold">{adminMsg}</p>}
          {admins.length === 1 && <p className="muted text-sm">Handing the club over? Invite the new admin first. Once they are in, you can step down. The club always keeps at least one admin.</p>}
        </Card>
        <H2>Coaches</H2><Card className="grid gap-2">
          <button className="btn" onClick={async () => { try { setToken(inviteLink(await createCoachInvite())); } catch (e) { setMsg((e as Error).message); } }}>Create a coach invite link</button>
          {token && <><input className="field" readOnly value={token} onFocus={(e) => e.target.select()} aria-label="Coach invite link" /><button className="btn ghost" onClick={() => share(`Join the Rangers coaching app: ${token}`)}>Send it</button></>}
          {members.filter((m) => m.role === 'coach').map((m) => { const here = m.teams.find((t) => t.team_id === team.id); return (
            <div key={m.user_id} className="grid gap-1.5 border-t pt-2 text-sm" style={{ borderColor: 'var(--line)' }}>
              <span><b>{m.name}</b>{m.status === 'pending' ? ' · waiting for you' : m.teams.length ? ` · ${m.teams.map((t) => teamName(t.team_id) + (t.head ? ' (head coach)' : '')).join(', ')}` : ' · no team yet'}</span>
              <div className="flex flex-wrap gap-2">
                {m.status === 'pending' && <><button className="btn min-h-[44px]" onClick={() => act(() => approveMember(m.user_id, true), `${m.name} approved. Now add them to a team.`)}>Approve</button><button className="btn ghost min-h-[44px]" onClick={() => act(() => approveMember(m.user_id, false), `${m.name} declined.`)}>Decline</button></>}
                {m.status === 'active' && <>
                  {!here && <button className="btn ghost min-h-[44px]" onClick={() => act(() => assignStaff(m.user_id, team.id, false), `${m.name} added to ${team.name}.`)}>Add to {team.name}</button>}
                  {!here?.head && <button className="btn ghost min-h-[44px]" onClick={() => act(() => assignStaff(m.user_id, team.id, true), `${m.name} is now head coach of ${team.name}.`)}>Head coach of {team.name}</button>}
                  {here && <button className="btn ghost min-h-[44px]" onClick={() => act(() => removeStaff(m.user_id, team.id), `${m.name} is off ${team.name}.`)}>Take off {team.name}</button>}
                  <button className="btn danger min-h-[44px]" onClick={() => { if (confirm(`Remove ${m.name} from the club? They lose every team. If they are also a parent, they keep their own child.`)) void act(() => removeMember(m.user_id), `${m.name} removed from the club.`); }}>Remove from club</button>
                </>}
              </div>
            </div>); })}
          {msg && <p role="status" className="font-semibold">{msg}</p>}
          <p className="muted text-sm">Only head coaches (and admins) can clear a child after a head injury. Coaches see only the teams you add them to. The buttons work on the active team ({team.name}); switch team above for another.</p>
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
