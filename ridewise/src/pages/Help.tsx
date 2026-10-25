import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import { useStore } from '../store/store';
import { Card, PageTitle } from '../components/ui';
import { Mascot } from '../components/Mascot';

const WORDS: [string, string][] = [
  ['Route', 'The road line we follow from where you start to where you finish.'],
  ['Stop', 'A place to rest, drink water, eat a snack, or look at your bike.'],
  ['Pace', 'How fast the group rides. We use the slowest rider, so nobody gets left behind.'],
  ['Estimate', 'A smart guess. Real life can be faster or slower.'],
  ['Hours not verified', 'The map does not say if a shop is open. It might be closed, so ask or have a back-up.'],
  ['From the map', 'Someone added this place to OpenStreetMap, a free map made by people. Nobody here has checked it yet.'],
  ['Added by a rider', 'A rider added this place. It stays "not checked" until someone sees it with their own eyes.'],
  ['Wait for everyone', 'When the whole group stops and waits until all riders are together again.'],
  ['SOS', 'The red button. It shows who to call and the nearest hospitals on your route.'],
];

const HOWTO: [string, string][] = [
  ['A shop is not on the map. What do I do?', 'Open the Map page. Tap "Drop a pin", tap the map where the shop is, and fill in the name. Pins you add are marked "Added by a rider".'],
  ['How do I rest longer at a stop?', 'Open the Stops page, tap "Edit this stop", and tap + . Every time after it changes by itself.'],
  ['How do I share the plan with my friends?', 'Open the Stops page and tap "Share plan". Send the link in Messenger or Viber. They can look at it without making an account.'],
  ['I am on the road and have no signal.', 'Saved plans still work. Open your plan once while you have signal and it will be saved on your phone. Searching for new places needs the internet.'],
  ['I feel sick or dizzy.', 'Stop in a safe place. Do not ride. Tap the red SOS button if you need help. Calling 911 is always okay.'],
  ['I want to leave the app safely.', 'Tap your name at the top, then "Lock for now". Your rides stay saved.'],
];

export default function Help() {
  const setPrefs = useStore((s) => s.setPrefs);
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="space-y-4">
      <PageTitle title="Help" subtitle="Little answers to little questions." />
      <Card className="flex items-center gap-4">
        <Mascot size={72} mood="cheer" />
        <div>
          <p className="text-lg font-bold text-navy">Want the lesson again?</p>
          <button type="button" className="btn-go mt-2" onClick={() => setPrefs({ tutorialDone: false })}>
            <Play aria-hidden className="h-5 w-5" /> Show me again
          </button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 text-xl font-bold text-navy">What do I do if…</h2>
        <ul className="divide-y divide-slate-100">
          {HOWTO.map(([q, a], i) => (
            <li key={q}>
              <button type="button" className="flex min-h-[56px] w-full items-center justify-between gap-3 py-2 text-left text-lg font-semibold" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                {q}
                <span aria-hidden className="text-2xl text-slate-400">{open === i ? '−' : '+'}</span>
              </button>
              {open === i && <p className="pb-3 text-lg leading-relaxed text-slate-700">{a}</p>}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="mb-2 text-xl font-bold text-navy">Words I use</h2>
        <dl className="space-y-3">
          {WORDS.map(([w, d]) => (
            <div key={w}>
              <dt className="text-lg font-bold">{w}</dt>
              <dd className="text-lg text-slate-700">{d}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <p className="text-center text-base text-slate-600">
        Still stuck? Go back to <Link className="font-semibold text-sky underline" to="/">Home</Link> and tap the big green button.
      </p>
    </div>
  );
}
