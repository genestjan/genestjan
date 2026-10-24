import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { guideById, type GuideCtx } from '../content/guides';
import { goStep, stopGuide, useGuideRun } from '../lib/guide';
import { activeTeam, teamPlayers, useAppState } from '../lib/store';
import { useMyChildren } from '../lib/role';
import { openAssignments } from '../lib/assignments';

/** "Show me how": opens the right screen, dims everything except the real button, and explains it. */
export function GuideOverlay() {
  const run = useGuideRun(); const nav = useNavigate(); const loc = useLocation(); const s = useAppState(); const kids = useMyChildren();
  const g = run ? guideById(run.id) : undefined; const i = run?.step ?? 0; const step = g?.steps[i];
  const [rect, setRect] = useState<DOMRect | null>(null); const [looked, setLooked] = useState(false);
  const card = useRef<HTMLDivElement>(null); const [cardH, setCardH] = useState(200);
  const team = activeTeam(s);
  const ctx: GuideCtx = {
    firstPlayerId: teamPlayers(s)[0]?.id,
    nextEventId: s.events.filter((e) => e.teamId === team.id && ['match', 'tournament', 'meet'].includes(e.type) && !e.cancelled && Date.parse(e.endsAt) > Date.now()).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0]?.id,
    firstKidId: kids[0]?.id,
    firstTaskId: openAssignments(s.assignments.filter((a) => kids.some((k) => k.id === a.playerId)), s.submissions)[0]?.id,
  };
  const route = step ? (typeof step.route === 'function' ? step.route(ctx) : step.route) : undefined;
  // Go to the step's screen, then look for its button for up to 4 seconds.
  useEffect(() => {
    if (!step) return;
    setRect(null); setLooked(false);
    if (route && loc.pathname !== route) nav(route);
    if (!step.target) { setLooked(true); return; }
    let tries = 0; let found: Element | null = null;
    const t = setInterval(() => {
      found = found ?? document.querySelector(`[data-tour="${step.target}"]`);
      if (found) { if (tries < 40) found.scrollIntoView({ block: 'center' }); tries = 40; setRect(found.getBoundingClientRect()); setLooked(true); }
      else if (++tries >= 40) { setLooked(true); }
    }, 100);
    const stop = setTimeout(() => clearInterval(t), 60000);
    return () => { clearInterval(t); clearTimeout(stop); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.id, i]);
  useLayoutEffect(() => { if (card.current) setCardH(card.current.offsetHeight); });
  if (!g || !step) return null;
  const last = i === g.steps.length - 1; const pad = 8; const vh = window.innerHeight;
  const below = rect ? rect.bottom + pad + cardH + 12 < vh : false;
  const top = rect ? (below ? rect.bottom + pad + 12 : Math.max(12, rect.top - pad - cardH - 12)) : undefined;
  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Show me how">
      {rect ? <div className="pointer-events-none absolute rounded-2xl" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, boxShadow: '0 0 0 9999px rgba(0,0,0,.7)', outline: '3px solid #C31E24' }} />
        : <div className="absolute inset-0 bg-black/70" />}
      <div ref={card} className="card absolute left-4 right-4 mx-auto grid max-w-md gap-2 p-4" style={{ background: 'var(--card)', ...(top !== undefined ? { top } : { top: '50%', transform: 'translateY(-50%)' }) }}>
        <div className="muted text-sm">{g.title} · step {i + 1} of {g.steps.length}</div>
        <h2 className="text-2xl">{step.title}</h2>
        <p className="text-lg">{step.text}</p>
        {looked && step.target && !rect && <p className="muted text-sm">This button is not on the screen yet (for example, there are no players or events yet). The steps still apply.</p>}
        <div className="flex gap-2">
          {i > 0 ? <button className="btn ghost flex-1" onClick={() => goStep(i - 1)}>Back</button> : <button className="btn ghost flex-1" onClick={stopGuide}>Close</button>}
          <button className="btn flex-1" onClick={() => (last ? stopGuide() : goStep(i + 1))}>{last ? 'Done' : 'Next'}</button>
        </div>
      </div>
    </div>
  );
}
