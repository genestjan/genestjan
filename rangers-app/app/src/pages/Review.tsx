import { contentBand } from '../lib/model';
import { bandOf, infoFor } from '../lib/school';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Back, Card, Empty, Page } from '../components/ui';
import { put, teamPlayers, uid, useAppState } from '../lib/store';
import { RUBRIC } from '../content/rubric';
import { LEVEL_WORDS, type Assessment } from '../lib/model';
import { summarise } from '../lib/development';

const currentTerm = () => { const d = new Date(); return `${d.getFullYear()} Term ${Math.floor(d.getMonth() / 3) + 1}`; };

export function ReviewList() {
  const s = useAppState(); const kids = teamPlayers(s); const term = currentTerm();
  return (
    <Page title="Term reviews" back={<Back to="/squad" />}>
      <p className="muted mb-3">{term}. About two minutes per child. Families see the published version only, never your private notes.</p>
      {kids.length === 0 && <Empty>No players yet.</Empty>}
      <ul className="grid gap-2">{kids.map((k) => { const a = s.assessments.find((x) => x.playerId === k.id && x.term === term); return (
        <li key={k.id}><Link to={`/review/${k.id}`} className="card flex items-center justify-between p-3"><span className="text-lg">{k.firstName}</span><span className={a?.publishedAt ? 'text-[#2e8b57]' : a ? 'text-[#d98a00]' : 'muted'}>{a?.publishedAt ? 'Published' : a ? 'Draft' : 'Not started'}</span></Link></li>); })}</ul>
    </Page>
  );
}

export function Review() {
  const { playerId } = useParams(); const nav = useNavigate(); const s = useAppState(); const term = currentTerm();
  const kids = teamPlayers(s); const p = s.players.find((x) => x.id === playerId);
  const team = s.teams.find((t) => t.id === p?.teamId) ?? s.teams[0];
  const existing = s.assessments.find((a) => a.playerId === playerId && a.term === term);
  const [a, setA] = useState<Assessment | null>(null);
  if (!p) return <Page title="Review" back={<Back to="/review" />}><Empty>Player not found.</Empty></Page>;
  const band = bandOf(p, team, infoFor(s.teamInfo, team.id)); const skills = RUBRIC[contentBand(band)];
  const cur: Assessment = a ?? existing ?? { id: uid(), playerId: p.id, teamId: p.teamId, term, ratings: {}, strength: '', working: '', familyComment: '', coachNote: '' };
  const prev = s.assessments.filter((x) => x.playerId === p.id && x.term !== term).sort((x, y) => y.term.localeCompare(x.term))[0];
  const sum = summarise(skills, cur, prev);
  const save = (patch: Partial<Assessment>) => { const n = { ...cur, ...patch }; setA(n); put('assessments', n); };
  const idx = kids.findIndex((k) => k.id === p.id);
  const go = (d: number) => { const k = kids[idx + d]; if (k) { setA(null); nav(`/review/${k.id}`); } };
  const corners = [...new Set(skills.map((x) => x.corner))];
  return (
    <Page title={p.firstName} back={<Back to="/review" />}>
      <p className="muted mb-3">{term} · {band}{band !== team.ageBand ? ' (own age group)' : ''} · {idx + 1} of {kids.length}</p>
      {corners.map((c) => (
        <Card key={c} className="mb-3 grid gap-3"><h2 className="text-2xl">{c}</h2>
          {skills.filter((x) => x.corner === c).map((sk) => (
            <div key={sk.id}><div className="mb-1 font-semibold">{sk.label}{prev?.ratings[sk.id] ? <span className="muted text-sm font-normal"> (last term: {LEVEL_WORDS[prev.ratings[sk.id]]})</span> : null}</div>
              <div className="grid grid-cols-5 gap-1" role="group" aria-label={sk.label}>{LEVEL_WORDS.map((w, i) => <button key={i} className={`btn min-h-[48px] px-1 text-xs leading-tight ${(cur.ratings[sk.id] ?? 0) === i ? '' : 'ghost'}`} aria-pressed={(cur.ratings[sk.id] ?? 0) === i} onClick={() => save({ ratings: { ...cur.ratings, [sk.id]: i } })}>{w}</button>)}</div></div>))}
        </Card>))}
      <Card className="mb-3 grid gap-2">
        <h2 className="text-2xl">Summary for the family</h2>
        <p><b>Strengths:</b> {sum.strengths.map((x) => x.label).join(', ') || 'rate some skills first'}</p>
        <p><b>Working on:</b> {sum.working.map((x) => x.label).join(', ') || '-'}</p>
        {sum.fastest && <p><b>Fastest developing:</b> {sum.fastest.label}</p>}
        <label className="grid gap-1 text-sm font-semibold">One or two sentences for the family (start with something positive)<textarea className="field py-3" rows={3} value={cur.familyComment} onChange={(e) => save({ familyComment: e.target.value })} /></label>
        <label className="grid gap-1 text-sm font-semibold">Your private note (coaches only, never shown to families)<textarea className="field py-3" rows={2} value={cur.coachNote} onChange={(e) => save({ coachNote: e.target.value })} /></label>
        <button className="btn h-14" onClick={() => save({ strength: sum.strengths.map((x) => x.label).join(', '), working: sum.working.map((x) => x.label).join(', '), publishedAt: cur.publishedAt ?? new Date().toISOString() })}>{cur.publishedAt ? 'Update the published version' : 'Publish to the family'}</button>
        {cur.publishedAt && <button className="btn ghost" onClick={() => save({ publishedAt: undefined })}>Take back (hide from the family)</button>}
      </Card>
      <div className="grid grid-cols-2 gap-2"><button className="btn ghost h-14" disabled={idx <= 0} onClick={() => go(-1)}>Previous child</button><button className="btn h-14" disabled={idx >= kids.length - 1} onClick={() => go(1)}>Next child</button></div>
    </Page>
  );
}
