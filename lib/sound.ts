/**
 * The site's audio: a generative ambient bed plus short interaction cues.
 *
 * Everything here is synthesised in Web Audio rather than loaded as files.
 * That keeps the payload at zero, and more importantly the bed never loops:
 * a fixed music file long enough not to feel repetitive would be megabytes,
 * and a short one becomes maddening within a minute.
 *
 * Nothing can start before a user gesture. Browsers block audio outright
 * until then, so the engine is built on first interaction and the stored
 * preference decides whether it comes up sounding or silent.
 */

type Cue = 'hover' | 'click' | 'open' | 'close';

const KEY = 'gjr-sound';
const listeners = new Set<(on: boolean) => void>();

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let bed: GainNode | null = null;
let verb: ConvolverNode | null = null;
let bellTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;
let on = false;

export function isOn() { return on; }

export function onSoundChange(cb: (on: boolean) => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
const announce = () => listeners.forEach((cb) => cb(on));

/** Stored preference. Defaults to sounding, which is what the site wants, but
 *  it still cannot make a noise until the visitor touches something. */
export function preferred(): boolean {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}

/* --------------------------------------------------------------- plumbing */

/** Exponential-decay noise, which is a serviceable small room. */
function impulse(c: AudioContext, seconds = 2.4, decay = 3.1) {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
    }
  }
  return buf;
}

function build() {
  if (started) return;
  started = true;
  const C = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  ctx = new C();

  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  verb = ctx.createConvolver();
  verb.buffer = impulse(ctx);
  const verbGain = ctx.createGain();
  verbGain.gain.value = 0.5;
  verb.connect(verbGain).connect(master);

  // --- the bed: a slow minor pad under a filtered noise wash ---
  bed = ctx.createGain();
  bed.gain.value = 0.085;
  bed.connect(master);
  bed.connect(verb);

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 520;
  lp.Q.value = 0.8;
  lp.connect(bed);

  // A minor, spread wide and detuned so it beats slowly instead of sitting still
  for (const [hz, det] of [[55, 0], [110, -6], [164.81, 5], [220, -9], [329.63, 7]] as const) {
    const o = ctx.createOscillator();
    o.type = hz < 120 ? 'sine' : 'triangle';
    o.frequency.value = hz;
    o.detune.value = det;
    const g = ctx.createGain();
    g.gain.value = hz < 120 ? 0.5 : 0.16;
    o.connect(g).connect(lp);
    o.start();
  }

  // Breathing: one slow LFO opens the filter and lifts the level together.
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.045;
  const lfoAmt = ctx.createGain();
  lfoAmt.gain.value = 190;
  lfo.connect(lfoAmt).connect(lp.frequency);
  lfo.start();
}

/* ------------------------------------------------------------------ bells */

const SCALE = [220, 261.63, 329.63, 392, 440, 523.25];

function bell() {
  if (!ctx || !bed || !verb || !on) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.value = SCALE[Math.floor(Math.random() * SCALE.length)] * (Math.random() < 0.25 ? 2 : 1);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.065, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);
  const pan = ctx.createStereoPanner();
  pan.pan.value = Math.random() * 1.4 - 0.7;
  o.connect(g).connect(pan);
  pan.connect(master!);
  pan.connect(verb);
  o.start(t);
  o.stop(t + 4.6);
}

function scheduleBells() {
  if (bellTimer) clearTimeout(bellTimer);
  bellTimer = setTimeout(() => {
    bell();
    scheduleBells();
  }, 5200 + Math.random() * 6500);
}

/* ------------------------------------------------------------------- cues */

let lastCue = 0;

export function cue(name: Cue) {
  if (!on || !ctx || !master) return;
  const t = ctx.currentTime;
  // Sweeping a pointer across a nav should not sound like a machine gun.
  if (name === 'hover') {
    if (t - lastCue < 0.06) return;
    lastCue = t;
  }

  if (name === 'hover') {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(2600, t);
    o.frequency.exponentialRampToValueAtTime(1900, t + 0.03);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.035, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 0.06);
    return;
  }

  if (name === 'click') {
    // A short metal clack: filtered noise over a low thump, to match the gears.
    const len = Math.floor(ctx.sampleRate * 0.09);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.4;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 1.1;
    const ng = ctx.createGain();
    ng.gain.value = 0.16;
    src.connect(bp).connect(ng).connect(master);
    if (verb) ng.connect(verb);
    src.start(t);

    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(190, t);
    o.frequency.exponentialRampToValueAtTime(90, t + 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.10, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 0.13);
    return;
  }

  // open rises, close falls
  const notes = name === 'open' ? [523.25, 783.99] : [659.25, 392];
  notes.forEach((hz, i) => {
    const at = t + i * 0.07;
    const o = ctx!.createOscillator();
    o.type = 'sine';
    o.frequency.value = hz;
    const g = ctx!.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.06, at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
    o.connect(g).connect(master!);
    if (verb) g.connect(verb);
    o.start(at); o.stop(at + 0.32);
  });
}

/* ------------------------------------------------------- global bindings */

let bound = false;

/**
 * Wake-on-first-gesture, plus hover and click cues by delegation.
 *
 * Idempotent on purpose: the toggle renders twice for the responsive nav, and
 * binding per instance fired every click cue twice.
 */
export function bindGlobal() {
  if (bound || typeof window === 'undefined') return () => {};
  bound = true;

  const interactive = (t: EventTarget | null) =>
    t instanceof Element ? t.closest('a, button, [role="button"], summary') : null;

  const wake = (e: Event) => {
    // A press on the toggle itself must not be pre-empted: it renders as off
    // until audio exists, so waking on that same gesture would turn sound on
    // and let the click immediately turn it back off.
    if (e.target instanceof Element && e.target.closest('.sound-toggle')) return;
    if (!on && preferred()) setSound(true);
    window.removeEventListener('pointerdown', wake);
    window.removeEventListener('keydown', wake);
  };

  let last: Element | null = null;
  const over = (e: Event) => {
    const el = interactive(e.target);
    if (el && el !== last) { last = el; cue('hover'); }
    if (!el) last = null;
  };
  const down = (e: Event) => { if (interactive(e.target)) cue('click'); };

  window.addEventListener('pointerdown', wake);
  window.addEventListener('keydown', wake);
  window.addEventListener('pointerover', over);
  window.addEventListener('click', down);

  return () => {
    bound = false;
    window.removeEventListener('pointerdown', wake);
    window.removeEventListener('keydown', wake);
    window.removeEventListener('pointerover', over);
    window.removeEventListener('click', down);
  };
}

/* ---------------------------------------------------------------- control */

export function setSound(next: boolean) {
  on = next;
  try { localStorage.setItem(KEY, next ? 'on' : 'off'); } catch { /* private mode */ }

  if (next) {
    build();
    void ctx!.resume();
    master!.gain.cancelScheduledValues(ctx!.currentTime);
    master!.gain.setTargetAtTime(0.9, ctx!.currentTime, 1.2);
    scheduleBells();
  } else if (ctx && master) {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
    if (bellTimer) { clearTimeout(bellTimer); bellTimer = null; }
  }
  announce();
}
