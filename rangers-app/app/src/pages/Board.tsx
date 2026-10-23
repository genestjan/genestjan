import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Page } from '../components/ui';
import { BoardView } from '../components/BoardView';
import { PRESETS } from '../lib/presets';

export default function Board() {
  const [id, setId] = useState(PRESETS[0].id);
  const doc = PRESETS.find((p) => p.id === id)!;
  return (
    <Page title="Moves board" back={<Link to="/" className="btn ghost">Home</Link>}>
      <div className="mb-3 flex flex-wrap gap-2">{PRESETS.map((p) => <button key={p.id} className={`btn ${p.id === id ? '' : 'ghost'}`} onClick={() => setId(p.id)}>{p.name}</button>)}</div>
      <BoardView doc={doc} />
      <p className="mt-3 text-xl font-semibold">{doc.whyKids}</p>
      <p className="muted mt-2 text-sm">Red circles are us, cream squares are them. Solid arrow = run. Dashed arrow = pass. Dotted = dribble. The editor to draw your own moves arrives in the next release.</p>
    </Page>
  );
}
