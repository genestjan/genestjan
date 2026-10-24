import { CREST } from './ui';

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
