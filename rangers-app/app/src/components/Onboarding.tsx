import { useState } from 'react';
import { CREST } from './ui';
import type { TourRole } from '../lib/onboarding';

/** First screen on a new phone, before sign-in. */
export function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <main className="mx-auto grid min-h-screen max-w-md content-center gap-6 px-6 py-10 text-center" style={{ paddingTop: 'max(40px, env(safe-area-inset-top))' }}>
      <img src={CREST.rangers} alt="Rangers FC crest" width={112} height={112} className="mx-auto h-28 w-28 object-contain" />
      <div><h1 className="display text-5xl text-red">Welcome to Rangers</h1><p className="muted mt-2 text-lg">Rangers FC, FC New Mabu and Gila Academy, together in one app.</p></div>
      <ul className="card grid gap-3 p-5 text-left text-lg">
        <li><b>Coaches:</b> plan training, run match day, send tasks and keep every child safe.</li>
        <li><b>Parents and players:</b> see the schedule, message the coach, do your tasks and follow progress.</li>
      </ul>
      <button className="btn h-14 text-xl" onClick={onStart}>Get started</button>
      <p className="muted text-sm">Free for the club. No ads. Your child's information stays private.</p>
    </main>
  );
}

interface Step { title: string; body: string }
const COACH: Step[] = [
  { title: 'Your Today screen', body: 'This is your home. It shows the next event, who is going, anything that needs attention, and shortcuts to start a match or plan training.' },
  { title: 'Squad and safety', body: 'Add your players in Squad. Open a child to see their details and to send their parent a private invite link. Head knocks block a child from lineups until a head coach clears them.' },
  { title: 'Match day', body: 'Pick the players, and the app plans fair playing time. It works without signal, and the clock keeps running when the screen locks.' },
  { title: 'Assign tasks', body: 'Open Assign from Today. Pick a ready-made task list or write your own, add a YouTube link or a photo to show how, and choose the players. They send back a photo for each task to clear their list, and you approve them.' },
  { title: 'Inbox', body: 'Post announcements to a team or the whole club, and message a child\'s parent directly. Parents are notified. You never message a child.' },
  { title: 'More', body: 'Settings, privacy, backup and help live in More. You can replay this tour any time from Help.' },
];
const PARENT: Step[] = [
  { title: 'Your Home screen', body: 'See the next training or match, tell the coach if your child is going, and read the latest club news.' },
  { title: 'Finish your child\'s details', body: 'Tap the reminder on Home to add your child\'s birthday, address, emergency contacts, allergies, health conditions and medication. Coaches use it in an emergency. Only the coaches and your family can see it.' },
  { title: 'Tasks', body: 'Your coach can send tasks to do at home. Open Tasks, watch the video if there is one, then send a photo for each task. When every task has a photo, the list is cleared.' },
  { title: 'Inbox', body: 'Message the coach and read team news. You will see messages about your own child only.' },
  { title: 'Progress', body: 'When the coach shares a review, you will see strengths, what your child is working on, and their goal. Nobody is ranked against other children.' },
  { title: 'Add to your home screen', body: 'On Android, open the Chrome menu and choose Add to Home screen. On iPhone, open this page in Safari, tap Share, then Add to Home Screen. Alerts on iPhone only work after that.' },
];

/** A short step-by-step tour, shown once per phone per role and replayable from Help. */
export function Tour({ role, onDone }: { role: TourRole; onDone: () => void }) {
  const steps = role === 'parent' ? PARENT : COACH; const [i, setI] = useState(0); const last = i === steps.length - 1; const st = steps[i];
  return (
    <div role="dialog" aria-modal="true" aria-label="App tour" className="fixed inset-0 z-50 grid place-items-end bg-black/60 p-4 sm:place-items-center">
      <div className="card grid w-full max-w-md gap-3 p-5" style={{ background: 'var(--card)', paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
        <div className="muted text-sm">Step {i + 1} of {steps.length}</div>
        <h2 className="text-3xl">{st.title}</h2>
        <p className="text-lg">{st.body}</p>
        <div className="flex justify-center gap-1.5" aria-hidden="true">{steps.map((_, k) => <span key={k} className="h-2 w-2 rounded-full" style={{ background: k === i ? 'var(--red, #C31E24)' : 'var(--line)' }} />)}</div>
        <div className="flex gap-2">
          {i > 0 ? <button className="btn ghost flex-1" onClick={() => setI(i - 1)}>Back</button> : <button className="btn ghost flex-1" onClick={onDone}>Skip</button>}
          <button className="btn flex-1" onClick={() => (last ? onDone() : setI(i + 1))}>{last ? 'Done' : 'Next'}</button>
        </div>
      </div>
    </div>
  );
}
