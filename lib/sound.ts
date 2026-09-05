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

const listeners = new Set<(on: boolean) => void>();

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let bed: GainNode | null = null;
let verb: ConvolverNode | null = null;
let bellTimer: ReturnType<typeof setTimeout> | null = null;
let grind: { gain: GainNode; src: AudioBufferSourceNode } | null = null;
let trainOn = false;
let lastTooth = 0;
let started = false;
let on = false;

export function isOn() { return on; }

/** Whether audio is genuinely playing, as opposed to merely asked for. A
 *  context can be created and still sit suspended if the gesture that reached
 *  it did not count as user activation. */
export function isRunning() { return ctx?.state === 'running'; }

export function onSoundChange(cb: (on: boolean) => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
const announce = () => listeners.forEach((cb) => cb(on));

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

/* ------------------------------------------------- the gear box, as sound */

/** A metal tooth passing through the mesh: a hard transient over a set of
 *  inharmonic partials, which is what makes it read as metal rather than as a
 *  drum. Fired by the train itself when a tooth actually passes. */
export function tooth() {
  if (!on || !ctx || !master) return;
  const t = ctx.currentTime;
  if (t - lastTooth < 0.07) return;
  lastTooth = t;

  const len = Math.floor(ctx.sampleRate * 0.035);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3.2;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = 'bandpass'; hp.frequency.value = 2600; hp.Q.value = 0.9;
  const g = ctx.createGain();
  g.gain.value = 0.14;
  src.connect(hp).connect(g).connect(master);
  if (verb) g.connect(verb);
  src.start(t);

  // Inharmonic ring, detuned a little each time so it never sounds sampled.
  const root = 1750 * (0.94 + Math.random() * 0.12);
  [1, 2.41, 3.83].forEach((mult, i) => {
    const o = ctx!.createOscillator();
    o.type = 'sine';
    o.frequency.value = root * mult;
    const og = ctx!.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.06 / (i + 1.4), t + 0.004);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.18 + i * 0.05);
    o.connect(og).connect(master!);
    if (verb) og.connect(verb);
    o.start(t); o.stop(t + 0.3);
  });
}

/** The continuous grind of a box under load. Only while it is turning. */
export function setTrain(running: boolean) {
  trainOn = running;
  if (!on || !ctx || !master) return;

  if (running && !grind) {
    // Looping noise through a narrow band is a serviceable bearing rumble.
    const len = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let prev = 0;
    for (let i = 0; i < len; i++) {
      // one-pole lowpassed noise: brown-ish, without the harsh top
      prev = prev * 0.96 + (Math.random() * 2 - 1) * 0.04;
      d[i] = prev * 6;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(bp).connect(g).connect(master);

    // Slow wobble, so it breathes like something turning rather than hissing.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.7;
    const amt = ctx.createGain();
    amt.gain.value = 90;
    lfo.connect(amt).connect(bp.frequency);
    lfo.start();
    src.start();
    grind = { gain: g, src };
  }

  if (grind) {
    grind.gain.gain.setTargetAtTime(running ? 0.05 : 0, ctx.currentTime, running ? 0.9 : 0.5);
  }
}

/* ------------------------------------------------------- global bindings */

let bound = false;

/** The events browsers accept as user activation. Wheel and scroll are not
 *  among them, however much one would like them to be. */
const WAKE = ['pointerdown', 'pointerup', 'touchend', 'keydown'] as const;

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

  // Kept armed until the context is actually running rather than dropped
  // after one attempt: not every event a browser delivers counts as user
  // activation, and a single failed try used to leave the site silent for the
  // whole visit.
  const wake = () => {
    if (isRunning()) {
      for (const ev of WAKE) window.removeEventListener(ev, wake);
      document.removeEventListener('visibilitychange', wake);
      return;
    }
    setSound(true);
  };

  let last: Element | null = null;
  const over = (e: Event) => {
    const el = interactive(e.target);
    if (el && el !== last) { last = el; cue('hover'); }
    if (!el) last = null;
  };
  const down = (e: Event) => { if (interactive(e.target)) cue('click'); };

  for (const ev of WAKE) window.addEventListener(ev, wake);
  // Some browsers suspend the context when the tab goes away and will not
  // resume it on their own.
  document.addEventListener('visibilitychange', wake);
  window.addEventListener('pointerover', over);
  window.addEventListener('click', down);

  return () => {
    bound = false;
    for (const ev of WAKE) window.removeEventListener(ev, wake);
    document.removeEventListener('visibilitychange', wake);
    window.removeEventListener('pointerover', over);
    window.removeEventListener('click', down);
  };
}

/* ---------------------------------------------------------------- control */

/**
 * Turns the sound on. There is no path that turns it back off: by request the
 * bed is part of the site, not an option. The only reason this takes an
 * argument at all is the wake handler, which passes true.
 */
export function setSound(next: boolean) {
  on = next;

  if (next) {
    build();
    void ctx!.resume();
    master!.gain.cancelScheduledValues(ctx!.currentTime);
    master!.gain.setTargetAtTime(0.9, ctx!.currentTime, 1.2);
    scheduleBells();
    if (trainOn) setTrain(true);
  } else if (ctx && master) {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
    if (bellTimer) { clearTimeout(bellTimer); bellTimer = null; }
  }
  announce();
}
