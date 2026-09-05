'use client';
import { useEffect } from 'react';
import { bindGlobal } from '@/lib/sound';

/**
 * Arms the audio and the interaction cues. Renders nothing.
 *
 * There is no control any more, by request: the bed is part of the site rather
 * than something a visitor switches on. Browsers still will not let a page
 * make a noise before it has been touched, so this waits for the first event
 * that counts as user activation and starts there.
 */
export default function SoundBoot() {
  useEffect(() => bindGlobal(), []);
  return null;
}
