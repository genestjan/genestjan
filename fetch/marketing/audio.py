"""
Fetch GenSan video audio: original music, sound effects, and the final mix.

Everything is synthesised here (no samples, no licences needed):
  - Music: 120 BPM electronic track in A minor (Am F C G), kick, clap, hats, bass, pad, pluck arp.
  - Sound effects: whoosh (scene changes), riser and impact (logo reveal), shimmer (headlight flash),
    tap pops, typing ticks and a notification chime.

Usage:
  python audio.py bed <timeline.json> <out.wav>
      Builds music + sound effects for one video from its timeline.
  python audio.py mix <bed.wav> <video.mp4> <out.mp4> [voice.wav]
      Puts the audio on the video; with a voice track the music ducks under George.

timeline.json: {"duration": s, "cuts": [s...], "logo": [s...], "taps": [s...],
                "typing": [[s, dur]...], "dings": [s...]}
"""
import json, subprocess, sys
import numpy as np

SR = 48000
rng = np.random.default_rng(7)


def t_axis(d):
    return np.arange(int(d * SR)) / SR


def fft_filter(x, lo=None, hi=None):
    """Brick-ish band filter with soft edges, done in the frequency domain (no scipy needed)."""
    n = len(x)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    g = np.ones_like(f)
    if lo:
        g *= 1 / (1 + (lo / np.maximum(f, 1)) ** 4)
    if hi:
        g *= 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * g, n)


def env(d, a=0.005, r=None):
    t = t_axis(d)
    e = np.minimum(1, t / max(a, 1e-4))
    if r:
        e *= np.exp(-t / r)
    return e


def note(n):  # MIDI to Hz
    return 440 * 2 ** ((n - 69) / 12)


def saw(f, d, detune=0.0):
    t = t_axis(d)
    out = np.zeros_like(t)
    for k in (-1, 0, 1):
        ph = (t * f * (1 + k * detune)) % 1
        out += 2 * ph - 1
    return out / 3


# ------------------------------- Music -------------------------------

BPM = 120
BEAT = 60 / BPM
BAR = 4 * BEAT
CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]  # Am F C G
ROOTS = [45, 41, 36, 43]


def kick():
    d = 0.35
    t = t_axis(d)
    f = 45 + 95 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 9) * 0.9


def clap():
    d = 0.25
    n = fft_filter(rng.standard_normal(int(d * SR)), 900, 5000)
    e = np.exp(-t_axis(d) * 22)
    return n * e * 0.35


def hat(open_=False):
    d = 0.18 if open_ else 0.05
    n = fft_filter(rng.standard_normal(int(d * SR)), 7000, None)
    return n * np.exp(-t_axis(d) * (14 if open_ else 70)) * 0.08


def place(buf, x, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    if i >= buf.shape[1] or i + len(x) <= 0:
        return
    if i < 0:  # starts before the video: keep only the audible tail
        x, i = x[-i:], 0
    j = min(buf.shape[1], i + len(x))
    s = x[: j - i] * gain
    buf[0, i:j] += s * np.sqrt(0.5 * (1 - pan))
    buf[1, i:j] += s * np.sqrt(0.5 * (1 + pan))


def loop_4bars(full=True):
    """One 4-bar phrase of the track."""
    d = 4 * BAR
    buf = np.zeros((2, int(d * SR)))
    K, C, H, HO = kick(), clap(), hat(), hat(True)
    for b in range(4):
        base = b * BAR
        chord, root = CHORDS[b], ROOTS[b]
        # Pad: detuned saws, soft attack, low-passed
        pad = sum(saw(note(n), BAR, 0.004) for n in chord) / 3
        pad = fft_filter(pad, None, 1800) * np.minimum(1, t_axis(BAR) / 0.4) * 0.16
        place(buf, pad, base, 1, -0.3)
        place(buf, pad, base, 1, 0.3)
        if not full:
            continue
        for q in range(4):
            place(buf, K, base + q * BEAT, 1.0)
            if q in (1, 3):
                place(buf, C, base + q * BEAT, 1.0, 0.1)
        for e8 in range(8):
            place(buf, HO if e8 % 2 else H, base + e8 * BEAT / 2, 1.0, 0.35)
            # Off-beat bass pulse
            if e8 % 2:
                bd = BEAT / 2 * 0.9
                bass = fft_filter(saw(note(root), bd), None, 600) * env(bd, 0.004, 0.18) * 0.38
                place(buf, bass, base + e8 * BEAT / 2)
        # Pluck arpeggio, 16ths
        arp = chord + [chord[0] + 12]
        for s16 in range(16):
            n = arp[[0, 1, 2, 3, 2, 1, 0, 2][s16 % 8]] + 12
            pd = BEAT / 4
            pl = fft_filter(saw(note(n), pd * 1.5), None, 3500) * env(pd * 1.5, 0.002, 0.07) * 0.09
            place(buf, pl, base + s16 * pd, 1, 0.5 if s16 % 2 else -0.5)
    return buf


def music(duration):
    soft, full = loop_4bars(False), loop_4bars(True)
    n = int(duration * SR)
    out = np.zeros((2, n))
    phrase = soft.shape[1]
    i = 0
    k = 0
    while i < n:
        src = soft * 2.2 if k == 0 else full  # first 8 s gentle, then the groove
        j = min(n, i + phrase)
        out[:, i:j] += src[:, : j - i]
        i, k = j, k + 1
    fade = int(3 * SR)
    out[:, -fade:] *= np.linspace(1, 0, fade)
    out[:, : int(0.5 * SR)] *= np.linspace(0, 1, int(0.5 * SR))
    return out


# ---------------------------- Sound effects ----------------------------

def whoosh(d=0.7):
    n = rng.standard_normal(int(d * SR))
    t = t_axis(d)
    shape = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
    # Two bands crossfaded to give the feeling of a sweep
    lo, hi = fft_filter(n, 300, 1500), fft_filter(n, 1500, 7000)
    m = t / d
    return (lo * (1 - m) + hi * m) * shape * 0.5


def riser(d=1.2):
    t = t_axis(d)
    f = 200 + 1400 * (t / d) ** 2
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.12
    nz = fft_filter(rng.standard_normal(len(t)), 2000, None) * 0.25
    return (tone + nz) * (t / d) ** 2


def impact():
    d = 1.6
    t = t_axis(d)
    sub = np.sin(2 * np.pi * np.cumsum(38 + 70 * np.exp(-t * 6)) / SR) * np.exp(-t * 2.2)
    crack = fft_filter(rng.standard_normal(len(t)), 200, 6000) * np.exp(-t * 18) * 0.6
    return (sub + crack) * 0.9


def shimmer():
    d = 1.2
    t = t_axis(d)
    out = sum(np.sin(2 * np.pi * f * t) for f in (1760, 2217, 2637, 3520)) / 4
    return out * np.exp(-t * 3) * np.minimum(1, t / 0.02) * 0.18


def tap():
    d = 0.06
    t = t_axis(d)
    return (np.sin(2 * np.pi * 1700 * t) * np.exp(-t * 90) + rng.standard_normal(len(t)) * np.exp(-t * 300) * 0.3) * 0.35


def tick():
    d = 0.02
    return fft_filter(rng.standard_normal(int(d * SR)), 2500, 9000) * np.exp(-t_axis(d) * 250) * 0.18


def ding():
    d = 1.0
    t = t_axis(d)
    out = np.zeros_like(t)
    for start, f in ((0, 1318.5), (0.12, 1760)):
        tt = np.clip(t - start, 0, None)
        out += (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * 2 * f * tt)) * np.exp(-tt * 5) * (t >= start)
    return out * 0.22


def bed(tl):
    D = tl['duration']
    out = music(D) * 0.55
    for c in tl.get('cuts', []):
        place(out, whoosh(), c - 0.35, 0.8, -0.4)
    for s in tl.get('logo', []):
        place(out, riser(), s - 0.6, 0.7)
        place(out, impact(), s + 0.6, 0.9)
        place(out, shimmer(), s + 1.5, 1.0, 0.2)
        place(out, whoosh(0.5), s + 1.85, 0.5, 0.4)
    for s in tl.get('taps', []):
        place(out, tap(), s, 1.0, 0.1)
    for s, d in tl.get('typing', []):
        k = s
        while k < s + d:
            place(out, tick(), k, 1.0, 0.2)
            k += 0.055 + rng.random() * 0.04
    for s in tl.get('dings', []):
        place(out, ding(), s, 1.0)
    peak = np.max(np.abs(out)) or 1
    return out / peak * 0.89


def write_wav(path, x):
    pcm = (np.clip(x, -1, 1).T * 32767).astype('<i2')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', '-', path],
                   input=pcm.tobytes(), check=True)


def mix(bed_wav, video, out, voice=None):
    if voice:
        # Music and effects duck under George's voice, then everything is levelled for social media.
        fc = ('[1:a]volume=0.8[b];[2:a]volume=1.6,asplit=2[v1][v2];'
              '[b][v1]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[d];'
              '[d][v2]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5[a]')
        args = ['-i', video, '-i', bed_wav, '-i', voice, '-filter_complex', fc]
    else:
        fc = '[1:a]loudnorm=I=-16:TP=-1.5[a]'
        args = ['-i', video, '-i', bed_wav, '-filter_complex', fc]
    subprocess.run(['ffmpeg', '-v', 'error', '-y'] + args + ['-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac',
                    '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out], check=True)


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'bed':
        write_wav(sys.argv[3], bed(json.load(open(sys.argv[2]))))
    elif cmd == 'mix':
        mix(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5] if len(sys.argv) > 5 else None)
