/**
 * "George", the Fetch GenSan voice assistant.
 * Listening: the browser's SpeechRecognition (Chrome/Android, Edge, Safari 14.1+).
 * Speaking: if VITE_TTS_URL is set (the supabase/functions/tts proxy to ElevenLabs'
 * "George" voice) it is used; otherwise the phone's built-in voice, preferring a
 * British English male voice for a calm butler-like tone.
 */
export type Intent =
  | { kind: 'book'; service: 'ride' | 'pabili' | 'delivery'; place?: string; items?: string }
  | { kind: 'music'; query: string; app: 'spotify' | 'youtube' }
  | { kind: 'stopMusic' }
  | { kind: 'call' }
  | { kind: 'message'; text: string }
  | { kind: 'whereDriver' }
  | { kind: 'points' }
  | { kind: 'cancel' }
  | { kind: 'goOnline'; on: boolean }
  | { kind: 'accept' }
  | { kind: 'navigate' }
  | { kind: 'time' }
  | { kind: 'help' }
  | { kind: 'unknown'; text: string };

const ALIASES: [RegExp, string][] = [
  [/\bsm\b/, 'SM City General Santos'], [/\bkcc\b/, 'KCC Mall of GenSan'], [/robinson/, 'Robinsons Place GenSan'],
  [/gaisano/, 'Gaisano Mall GenSan'], [/fish ?port/, 'GenSan Fish Port Complex'], [/airport/, 'GenSan International Airport'],
  [/bulaong|terminal/, 'Bulaong Bus Terminal'], [/city hall/, 'City Hall, General Santos'], [/msu/, 'Mindanao State University GenSan'],
  [/elizabeth|hospital/, 'St. Elizabeth Hospital'], [/marbel|koronadal/, 'Koronadal City (Marbel)'], [/polomolok/, 'Polomolok, South Cotabato'],
  [/alabel/, 'Alabel, Sarangani'], [/davao/, 'Davao City (Ecoland Terminal)'], [/cotabato/, 'Cotabato City'], [/cagayan|cdo/, 'Cagayan de Oro'],
];

export function matchPlace(text: string): string | undefined {
  const t = text.toLowerCase();
  const hit = ALIASES.find(([r]) => r.test(t));
  if (hit) return hit[1];
  const m = t.match(/(?:to|sa|papunta sa|going to)\s+(.+)$/);
  return m?.[1]?.trim();
}

/** English, Tagalog and Bisaya keywords. Order matters: specific before general. */
export function parse(raw: string): Intent {
  const t = raw.toLowerCase().trim().replace(/^(hey |hi |ok |okay )?george[,!.]?\s*/, '');
  if (/^(stop|pause|hinto).*(music|song|kanta)|^stop music/.test(t)) return { kind: 'stopMusic' };
  const music = t.match(/^(?:play|patugtog|i-play|tokara)\s+(.+?)(?:\s+on\s+(spotify|youtube))?$/);
  if (music) return { kind: 'music', query: music[1].replace(/^(some|ug|ng)\s+/, ''), app: music[2] === 'youtube' ? 'youtube' : 'spotify' };
  if (/\b(play music|music|kanta)\b/.test(t)) return { kind: 'music', query: 'OPM hits', app: 'spotify' };
  if (/\b(pabili|buy|bili|palit|purchase)\b/.test(t)) {
    const items = t.replace(/.*?\b(pabili|buy|bili|palit|purchase)\b\s*(ng|ug|of|me)?\s*/, '').replace(/\s+(from|sa|at)\s+.*$/, '');
    return { kind: 'book', service: 'pabili', items, place: matchPlace(t.replace(/^.*\b(from|at)\b/, 'to')) };
  }
  if (/\b(deliver|delivery|send|padala|ipadala)\b/.test(t)) return { kind: 'book', service: 'delivery', place: matchPlace(t) };
  if (/\b(book|ride|sakay|hatid|take me|fetch me|kuha)\b/.test(t)) return { kind: 'book', service: 'ride', place: matchPlace(t) };
  if (/\b(call|tawag|tawagan)\b/.test(t)) return { kind: 'call' };
  const msg = t.match(/^(?:message|text|tell|sabihi|sabihin)(?: the)?(?: driver| customer| rider)?(?: that)?\s+(.+)$/);
  if (msg) return { kind: 'message', text: msg[1] };
  if (/\b(where|asa|nasaan|how far|eta)\b/.test(t)) return { kind: 'whereDriver' };
  if (/\b(points|suki|discount|puntos)\b/.test(t)) return { kind: 'points' };
  if (/\b(cancel|kanselar|ayaw na)\b/.test(t)) return { kind: 'cancel' };
  if (/\b(go online|online na|start working)\b/.test(t)) return { kind: 'goOnline', on: true };
  if (/\b(go offline|offline|stop working|pahuway)\b/.test(t)) return { kind: 'goOnline', on: false };
  if (/\b(accept|tanggap|dawat)\b/.test(t)) return { kind: 'accept' };
  if (/\b(navigate|directions|waze|google maps)\b/.test(t)) return { kind: 'navigate' };
  if (/\b(time|oras)\b/.test(t)) return { kind: 'time' };
  if (/\b(help|what can you do|tabang)\b/.test(t)) return { kind: 'help' };
  return { kind: 'unknown', text: raw };
}

export function musicUrl(query: string, app: 'spotify' | 'youtube') {
  const q = encodeURIComponent(query);
  return app === 'spotify' ? `https://open.spotify.com/search/${q}` : `https://music.youtube.com/search?q=${q}`;
}

let audio: HTMLAudioElement | null = null;

function pickVoice(): SpeechSynthesisVoice | undefined {
  const vs = speechSynthesis.getVoices();
  const pref = [/Google UK English Male/i, /Daniel/i, /Arthur/i, /George/i, /Male.*(GB|UK)/i, /en-GB/i];
  for (const r of pref) {
    const v = vs.find((x) => r.test(x.name) || (r.source === 'en-GB' && x.lang === 'en-GB'));
    if (v) return v;
  }
  return vs.find((x) => x.lang.startsWith('en'));
}

export async function speak(text: string): Promise<void> {
  const tts = import.meta.env.VITE_TTS_URL as string | undefined;
  if (tts) {
    try {
      const r = await fetch(tts, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      if (!r.ok) throw new Error('tts');
      audio?.pause();
      audio = new Audio(URL.createObjectURL(await r.blob()));
      await audio.play();
      return;
    } catch { /* fall back to the device voice */ }
  }
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice();
  if (v) u.voice = v;
  u.lang = v?.lang ?? 'en-GB';
  u.rate = 0.98;
  u.pitch = 0.85;
  speechSynthesis.speak(u);
}

type Rec = { lang: string; interimResults: boolean; onresult: (e: { results: { 0: { transcript: string } }[] }) => void; onerror: (e: { error: string }) => void; onend: () => void; start: () => void; stop: () => void };

export function canListen() {
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function listen(onText: (t: string) => void, onEnd: (err?: string) => void): () => void {
  const w = window as unknown as Record<string, new () => Rec>;
  const C = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!C) { onEnd('Voice input is not supported on this browser. Type your command instead.'); return () => {}; }
  const r = new C();
  r.lang = 'en-PH';
  r.interimResults = false;
  r.onresult = (e) => onText(e.results[0][0].transcript);
  r.onerror = (e) => onEnd(e.error === 'not-allowed' ? 'Please allow the microphone.' : undefined);
  r.onend = () => onEnd();
  r.start();
  return () => r.stop();
}

export const HELP_TEXT =
  'Try: "book a ride to SM", "pabili ng Jollibee chicken", "send a parcel to Bulaong", "where is my driver", "call the driver", "message the driver I am at the gate", "play OPM on Spotify", "how many points do I have".';
