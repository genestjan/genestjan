'use client';
import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { bindGlobal, isOn, onSoundChange, setSound } from '@/lib/sound';

/**
 * The sound control.
 *
 * Browsers will not let a page make a noise before the visitor has touched it,
 * so "on by default" means the bed comes up on their first click or key press,
 * not on load. There is no way around that and no point pretending otherwise;
 * this control is always visible so anyone can stop it instantly, which is
 * also what WCAG 1.4.2 asks for.
 *
 * The wake and cue listeners live in the engine because this renders twice for
 * the responsive nav.
 */
export default function SoundToggle({ className = '' }: { className?: string }) {
  const [on, setOn] = useState(false);

  useEffect(() => onSoundChange(setOn), []);
  useEffect(() => bindGlobal(), []);

  return (
    <button
      type="button"
      onClick={() => setSound(!isOn())}
      aria-pressed={on}
      aria-label={on ? 'Turn sound off' : 'Turn sound on'}
      title={on ? 'Sound on' : 'Sound off'}
      className={`sound-toggle ${on ? 'is-on' : ''} ${className}`}
    >
      {on ? <Volume2 size={15} aria-hidden /> : <VolumeX size={15} aria-hidden />}
      <span className="sound-bars" aria-hidden>
        <i /><i /><i />
      </span>
    </button>
  );
}
