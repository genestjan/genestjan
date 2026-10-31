"""Original music and sound effects for the GenDrive videos, synthesised from scratch.

Nothing sampled, nothing licensed: every sound is generated here, so the
tracks can be used anywhere (social media, ads) without copyright claims.
"""
import wave

import numpy as np

SR = 44100
rng = np.random.default_rng(7)


def note_hz(midi: float) -> float:
    return 440.0 * 2 ** ((midi - 69) / 12)


def adsr(n: int, a: float, d: float, s: float, r: float) -> np.ndarray:
    a_n, d_n, r_n = int(a * SR), int(d * SR), int(r * SR)
    env = np.ones(n) * s
    if a_n:
        env[:min(a_n, n)] = np.linspace(0, 1, a_n)[:min(a_n, n)]
    if d_n and a_n < n:
        seg = env[a_n:a_n + d_n]
        env[a_n:a_n + d_n] = np.linspace(1, s, d_n)[:len(seg)]
    if r_n:
        env[-r_n:] *= np.linspace(1, 0, min(r_n, n))[-min(r_n, n):] if r_n <= n else np.linspace(1, 0, n)
    return env


def saw(freq: float, n: int, phase: float = 0.0) -> np.ndarray:
    t = np.arange(n) / SR
    return 2 * ((t * freq + phase) % 1.0) - 1


def lowpass(x: np.ndarray, cutoff: float) -> np.ndarray:
    """One-pole low-pass, run twice for a gentler 12 dB slope."""
    a = np.exp(-2 * np.pi * cutoff / SR)
    for _ in range(2):
        y = np.empty_like(x)
        acc = 0.0
        b = 1 - a
        for i in range(len(x)):  # noqa: small loops on short notes only
            acc = b * x[i] + a * acc
            y[i] = acc
        x = y
    return x


def lowpass_fast(x: np.ndarray, cutoff: float) -> np.ndarray:
    """FFT low-pass for long buffers."""
    spec = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(len(x), 1 / SR)
    spec *= 1 / np.sqrt(1 + (freqs / cutoff) ** 4)
    return np.fft.irfft(spec, len(x))


def highpass_fast(x: np.ndarray, cutoff: float) -> np.ndarray:
    spec = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(len(x), 1 / SR)
    spec *= 1 - 1 / np.sqrt(1 + (freqs / max(cutoff, 1)) ** 4)
    return np.fft.irfft(spec, len(x))


def place(buf: np.ndarray, sound: np.ndarray, at: float, gain: float = 1.0) -> None:
    i = int(at * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sound))
    buf[i:j] += sound[: j - i] * gain


# ---------------- instruments ----------------

def supersaw(midi: float, dur: float, voices: int = 5, detune: float = 0.12) -> np.ndarray:
    n = int(dur * SR)
    out = np.zeros(n)
    for k in range(voices):
        cents = (k - (voices - 1) / 2) * detune
        out += saw(note_hz(midi + cents), n, rng.random())
    return out / voices


def pad_chord(midis: list[int], dur: float, cutoff: float = 1800) -> np.ndarray:
    n = int(dur * SR)
    x = sum(supersaw(m, dur) for m in midis) / len(midis)
    x = lowpass_fast(x, cutoff)
    return x * adsr(n, 0.6, 0.4, 0.8, 0.8)


def pluck(midi: float, dur: float = 0.22) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = saw(note_hz(midi), n) * 0.6 + np.sign(np.sin(2 * np.pi * note_hz(midi) * t)) * 0.4
    x = lowpass_fast(x, 3200)
    return x * np.exp(-t * 14)


def bass(midi: float, dur: float) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * note_hz(midi) * t) * 0.7 + saw(note_hz(midi), n) * 0.3
    x = lowpass_fast(x, 600)
    return x * adsr(n, 0.005, 0.08, 0.7, 0.05)


def kick() -> np.ndarray:
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 50 + 110 * np.exp(-t * 28)
    phase = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(phase) * np.exp(-t * 7.5) * 1.1


def snare() -> np.ndarray:
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    noise = highpass_fast(rng.standard_normal(n), 1800) * np.exp(-t * 16)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 22)
    return noise * 0.55 + tone * 0.5


def hat(open_: bool = False) -> np.ndarray:
    n = int((0.25 if open_ else 0.06) * SR)
    t = np.arange(n) / SR
    return highpass_fast(rng.standard_normal(n), 7500) * np.exp(-t * (9 if open_ else 60)) * 0.35


def delay(x: np.ndarray, seconds: float, feedback: float = 0.35, mix: float = 0.3) -> np.ndarray:
    d = int(seconds * SR)
    y = x.copy()
    for k in range(1, 5):
        g = mix * feedback ** (k - 1)
        y[d * k:] += x[: len(x) - d * k] * g
    return y


def reverb(x: np.ndarray, size: float = 1.8, mix: float = 0.22) -> np.ndarray:
    """Cheap convolution reverb with a synthetic decaying-noise impulse."""
    n = int(size * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal(n) * np.exp(-t * 3.2)
    ir = lowpass_fast(ir, 5000)
    ir /= np.sqrt(np.sum(ir ** 2))
    wet = np.fft.irfft(np.fft.rfft(x, len(x) + n) * np.fft.rfft(ir, len(x) + n))[: len(x)]
    return x * (1 - mix) + wet * mix


# ---------------- sound effects ----------------

def whoosh(dur: float = 0.9) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    # Sweep a band upward through the noise.
    for lo, hi, w in ((300, 900, 1.0), (900, 3000, 0.8), (3000, 8000, 0.5)):
        band = highpass_fast(lowpass_fast(noise, hi), lo)
        out += band * w
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2
    return out * env * 0.5


def riser(dur: float = 2.4) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 200 * (8 ** (t / dur))
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25
    noise = highpass_fast(rng.standard_normal(n), 2000) * 0.25
    return (tone + noise) * (t / dur) ** 2


def impact() -> np.ndarray:
    n = int(2.2 * SR)
    t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-t * 6)) / SR) * np.exp(-t * 2.2)
    crack = highpass_fast(rng.standard_normal(n), 1500) * np.exp(-t * 18) * 0.5
    return reverb(boom * 1.2 + crack, 2.5, 0.35)


def click() -> np.ndarray:
    n = int(0.05 * SR)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * 1800 * t) * np.exp(-t * 120) * 0.5


def chime() -> np.ndarray:
    """The assistant's "I'm listening" sound: two soft bell tones."""
    n = int(1.2 * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for start, midi in ((0.0, 84), (0.12, 91)):
        s = int(start * SR)
        tt = t[: n - s]
        f = note_hz(midi)
        bell = sum(np.sin(2 * np.pi * f * h * tt) * a for h, a in ((1, 1), (2.76, 0.4), (5.4, 0.15)))
        out[s:] += bell * np.exp(-tt * 4.5) * 0.25
    return reverb(out, 1.5, 0.3)


def success() -> np.ndarray:
    n = int(1.4 * SR)
    out = np.zeros(n)
    for k, midi in enumerate((76, 81, 88)):
        s = int(k * 0.09 * SR)
        tt = np.arange(n - s) / SR
        out[s:] += np.sin(2 * np.pi * note_hz(midi) * tt) * np.exp(-tt * 5) * 0.22
    return reverb(out, 1.4, 0.3)


# ---------------- music ----------------

# A minor: Am, F, C, G (i, VI, III, VII). A common progression, written here from scratch.
PROG = [(57, [57, 60, 64]), (53, [53, 57, 60]), (48, [55, 60, 64]), (55, [55, 59, 62])]


def track(duration: float, bpm: float, energy_plan, seed: int = 3) -> np.ndarray:
    """energy_plan(bar) -> dict of which layers play in that bar."""
    global rng
    rng = np.random.default_rng(seed)
    beat = 60 / bpm
    bar = beat * 4
    total = int(duration * SR) + SR * 3
    pad_l, arp_l, bass_l, drum_l = (np.zeros(total) for _ in range(4))
    bars = int(np.ceil(duration / bar))
    k, s, h, ho = kick(), snare(), hat(), hat(True)
    for b in range(bars):
        layers = energy_plan(b)
        t0 = b * bar
        root, chord = PROG[b % 4]
        if layers.get("pad"):
            place(pad_l, pad_chord([m + 12 for m in chord], bar + 0.6, layers.get("cutoff", 1800)), t0, 0.32)
        if layers.get("arp"):
            notes = [chord[0] + 24, chord[1] + 24, chord[2] + 24, chord[1] + 36]
            for i in range(16):
                place(arp_l, pluck(notes[i % 4]), t0 + i * beat / 4, 0.16)
        if layers.get("bass"):
            for i in range(8):
                place(bass_l, bass(root - 12, beat / 2 * 0.9), t0 + i * beat / 2, 0.42)
        if layers.get("drums"):
            for i in range(4):
                place(drum_l, k, t0 + i * beat, 0.9)
                if i in (1, 3):
                    place(drum_l, s, t0 + i * beat, 0.55)
            for i in range(8):
                place(drum_l, ho if i == 7 and layers.get("open_hat") else h, t0 + i * beat / 2 + (beat / 4 if layers.get("offbeat") else 0), 0.55)
        elif layers.get("hats"):
            for i in range(8):
                place(drum_l, h, t0 + i * beat / 2, 0.4)
    # Sidechain-style pump on pad and bass where drums play.
    pump = np.ones(total)
    for b in range(bars):
        if energy_plan(b).get("drums"):
            for i in range(4):
                start = int((b * bar + i * beat) * SR)
                ln = int(beat * 0.6 * SR)
                seg = pump[start:start + ln]
                pump[start:start + ln] = np.minimum(seg, 0.45 + 0.55 * (np.arange(len(seg)) / ln) ** 0.6)
    arp_l = delay(arp_l, beat * 0.75, 0.4, 0.35)
    mix = pad_l * pump + bass_l * pump + arp_l + drum_l
    mix = reverb(mix, 1.6, 0.16)
    mix = mix[: int(duration * SR)]
    fade = int(2.5 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)
    mix[: int(0.05 * SR)] *= np.linspace(0, 1, int(0.05 * SR))
    peak = np.max(np.abs(mix)) or 1
    return mix / peak * 0.8


def write_wav(path: str, mono: np.ndarray, stereo_width: float = 0.0) -> None:
    left = mono
    right = mono if stereo_width == 0 else np.roll(mono, int(stereo_width * SR))
    data = np.stack([left, right], axis=1)
    data = np.clip(data, -1, 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((data * 32767).astype(np.int16).tobytes())


def read_wav_mono(path: str) -> np.ndarray:
    """Read a WAV (any rate) and return float mono at 44.1 kHz."""
    with wave.open(path) as w:
        rate = w.getframerate()
        ch = w.getnchannels()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    if ch == 2:
        x = x.reshape(-1, 2).mean(axis=1)
    if rate != SR:
        n = int(len(x) * SR / rate)
        x = np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x)
    return x
