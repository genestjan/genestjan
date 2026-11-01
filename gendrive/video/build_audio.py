"""Builds narration, music, sound effects and a timeline for each GenDrive video.

Run:  python -I build_audio.py marketing|tutorial   (setup: README.md)
Outputs in out/<name>/: timeline.json, mix.wav, voice.wav (voices only, for checks).

Gen's lines are made one sentence at a time, so the timeline knows when every
sentence starts. Captions are shown sentence by sentence from those times.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
import tts  # noqa: E402  (save, wer)
import audio_gen as A  # noqa: E402
from scripts import MARKETING, TUTORIAL  # noqa: E402

# Kokoro-82M (Apache-2.0) voices: name, accent, and speeds to try (the model gives the same take each run).
GEN = ("bm_george", "en-gb", (0.95, 0.93, 0.97, 0.91, 0.99))   # Gen: calm, refined British
YOU = ("am_michael", "en-us", (1.0, 0.97, 1.03))                 # the driver
KOKORO_DIR = HERE / "models" / "kokoro"
_KOKORO = None


def kokoro():
    global _KOKORO
    if _KOKORO is None:
        from kokoro_onnx import Kokoro
        _KOKORO = Kokoro(str(KOKORO_DIR / "kokoro-v1.0.onnx"), str(KOKORO_DIR / "voices-v1.0.bin"))
    return _KOKORO
CAPTION_CHARS = 78  # one caption line at 34 px across 1536 px
SPEECH_OVER_MUSIC_DB = 15  # broadcast practice: dialogue 10 to 15 dB or more above the music bed


def sentences(text: str) -> list[str]:
    return [x for x in re.split(r"(?<=[.!?”])\s+", text.strip()) if x]


def speakable(text: str) -> str:
    """Spellings the voice engine (espeak-ng inside Kokoro) says correctly."""
    text = text.replace("GenDrive", "Gen Drive")        # the brand, as two words
    text = text.replace("Davao", "Da vow")               # dah-VOW, not DAV-ow
    text = text.replace("A P K", "Eigh P K")             # the letter A says "ay"; the word "a" stays "uh"
    text = text.replace("A P I", "API").replace("A I ", "AI ")  # read as letters natively
    return text


_ASR = None


def heard(audio: np.ndarray, rate: int = 22050) -> str:
    """What a speech recogniser hears (Moonshine tiny, loaded once)."""
    global _ASR
    if _ASR is None:
        import sherpa_onnx
        import os
        size = os.environ.get("ASR_MODEL", "tiny")  # "base" is slower and more accurate: used for the final check
        d = HERE / "models" / f"sherpa-onnx-moonshine-{size}-en-int8"
        _ASR = sherpa_onnx.OfflineRecognizer.from_moonshine(
            preprocessor=str(d / "preprocess.onnx"), encoder=str(d / "encode.int8.onnx"),
            uncached_decoder=str(d / "uncached_decode.int8.onnx"), cached_decoder=str(d / "cached_decode.int8.onnx"),
            tokens=str(d / "tokens.txt"), num_threads=2)
    stream = _ASR.create_stream()
    stream.accept_waveform(rate, audio.astype(np.float32))
    _ASR.decode_stream(stream)
    return stream.result.text


SPELLING = {"favorite": "favourite", "kilometers": "kilometres", "kilometer": "kilometre", "tire": "tyre", "tires": "tyres", "jen": "gen"}


def words(text: str) -> list[str]:
    from num2words import num2words
    text = re.sub(r"\d+", lambda m: " " + num2words(int(m[0])) + " ", text.lower())
    text = re.sub(r"[^a-z ]", " ", text.replace("'", "")).replace("gendrive", "gen drive")
    return [SPELLING.get(w, w) for w in text.split() if w != "and"]


def score(ref: str, hyp: str) -> float:
    return tts.wer(" ".join(words(ref)), " ".join(words(hyp)))


def best_take(text: str, voice: tuple, chain: str, tmp: Path) -> tuple[np.ndarray, float, str]:
    """A take at each speed in turn, with the voice effect added; keep the take a speech
    recogniser hears most accurately (stops at the first perfect one)."""
    best = None
    raw, done = tmp / "take_raw.wav", tmp / "take.wav"
    name, lang, speeds = voice
    for speed in speeds:
        audio, sr = kokoro().create(speakable(text), voice=name, speed=speed, lang=lang)
        tts.save(str(raw), np.concatenate([audio, np.zeros(int(sr * 0.3), dtype=np.float32)]), rate=sr)
        fx(raw, done, chain)
        audio = np.asarray(A.read_wav_mono(str(done)), dtype=np.float32)
        hyp = heard(audio, A.SR)
        w = score(text, hyp)
        if best is None or w < best[1]:
            best = (audio, w, hyp)
        if w == 0:
            break
    return best


def fx(src: Path, dst: Path, chain: str) -> None:
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(src), "-af", chain, "-ac", "1", "-ar", "44100", str(dst)], check=True)


# Gen's "AI assistant" polish: warmth, presence, air, gentle compression and a small digital room.
GEN_FX = ("highpass=f=70,equalizer=f=180:t=q:w=1:g=1.5,equalizer=f=3500:t=q:w=1.2:g=2,highshelf=f=9000:g=2,"
          "acompressor=threshold=-18dB:ratio=2.5:attack=8:release=120:makeup=2,aecho=0.8:0.35:14|38:0.10|0.06")
YOU_FX = "highpass=f=120,lowpass=f=7000,equalizer=f=2500:t=q:w=1:g=1.5,aecho=0.8:0.25:18:0.04"


def gen_line(s: dict, out: Path) -> tuple[Path, float, list[float], list[list]]:
    """Gen's line, sentence by sentence. Returns file, duration, sentence starts and caption chunks."""
    spoken = sentences(s["say"])
    shown = sentences(s.get("caption") or s["say"])
    if len(spoken) != len(shown):
        raise SystemExit(f"{s['id']}: {len(spoken)} spoken sentences but {len(shown)} caption sentences")
    parts, starts, t = [], [], 0.0
    for sentence in spoken:
        audio, w, hyp = best_take(sentence, GEN, GEN_FX, out / "lines")
        if w > 0:
            print(f"    {w:.2f} {sentence!r} heard as {hyp!r}")
        starts.append(round(t, 3))
        t += len(audio) / A.SR
        parts.append(audio)
    done = out / "lines" / f"{s['id']}.wav"
    A.write_wav(str(done), np.concatenate(parts))
    dur = len(A.read_wav_mono(str(done))) / A.SR
    caps, text, first = [], "", 0
    for i, sentence in enumerate(shown):
        if text and len(text) + 1 + len(sentence) > CAPTION_CHARS:
            caps.append([starts[first], text])
            text, first = sentence, i
        else:
            text = f"{text} {sentence}".strip()
    caps.append([starts[first], text])
    return done, dur, starts, caps


def you_line(s: dict, out: Path) -> tuple[Path, float]:
    done = out / "lines" / f"{s['id']}_you.wav"
    audio, w, hyp = best_take(s["you_say"], YOU, YOU_FX, out / "lines")
    if w > 0:
        print(f"    you {w:.2f} {s['you_say']!r} heard as {hyp!r}")
    A.write_wav(str(done), audio)
    return done, len(A.read_wav_mono(str(done))) / A.SR


def build(name: str) -> None:
    scenes = MARKETING if name == "marketing" else TUTORIAL
    out = HERE / "out" / name
    (out / "lines").mkdir(parents=True, exist_ok=True)
    timeline, t = [], 0.0
    for s in scenes:
        entry = {k: v for k, v in s.items() if k != "sfx"}
        pre = s.get("pre", 0.55)
        post = s.get("post", 0.9)
        if s.get("you_say"):
            you_file, you_dur = you_line(s, out)
            you_at = s.get("you_at", 0.5)
            entry.update(you_file=str(you_file), you_start=round(you_at, 3), you_dur=round(you_dur, 3))
            entry.setdefault("heard", s["you_say"].rstrip(".!?"))
            pre = max(pre, you_at + you_dur + s.get("think", 0.85))
        voice_dur = 0.0
        if s.get("say"):
            file, voice_dur, starts, caps = gen_line(s, out)
            entry.update(voice_file=str(file), voice_start=round(pre, 3), voice_dur=round(voice_dur, 3), sents=starts, caps=caps)
        dur = max(s.get("min", 0.0), pre + voice_dur + post) if voice_dur else s.get("min", 3.0)
        # Sound effects: seconds into the scene, or "@i+x" = x seconds after spoken sentence i starts.
        sfx = []
        for effect, when in s.get("sfx", []):
            if isinstance(when, str):
                m = re.fullmatch(r"@(\d+)\+([\d.]+)", when)
                when = pre + entry["sents"][int(m[1])] + float(m[2])
            sfx.append([effect, round(when, 3)])
        entry["sfx"] = sfx
        entry["start"] = round(t, 3)
        entry["dur"] = round(dur, 3)
        timeline.append(entry)
        t += dur
        print(f"{s['id']:12} start {entry['start']:6.2f}  dur {dur:5.2f}  voice {voice_dur:5.2f}  captions {len(entry.get('caps', []))}")
    total = t
    (out / "timeline.json").write_text(json.dumps({"name": name, "total": round(total, 3), "scenes": timeline}, indent=1, ensure_ascii=False))
    mix(name, timeline, total)


def mix(name: str, timeline: list, total: float) -> None:
    """Music, sound effects and the voices, mixed. Rerun alone with --mix-only (same voices, same timing)."""
    out = HERE / "out" / name
    # ---- music ----
    if name == "marketing":
        bpm = 100
        bar = 60 / bpm * 4
        drive_at = next(e["start"] for e in timeline if e["id"] == "drive")
        ask_at = next(e["start"] for e in timeline if e["id"] == "ask")
        end_at = next(e["start"] for e in timeline if e["id"] == "end")

        def plan(b: int) -> dict:
            tb = b * bar
            if tb < drive_at - bar:
                return {"pad": True, "arp": tb > 2.0, "cutoff": 900 + 400 * min(1, tb / 8)}
            if tb < ask_at:
                return {"pad": True, "arp": True, "bass": True, "hats": True, "cutoff": 1600}
            if tb < end_at:
                return {"pad": True, "arp": True, "bass": True, "drums": True, "open_hat": b % 2 == 1, "cutoff": 2200}
            return {"pad": True, "arp": False, "bass": False, "cutoff": 1400}
        music = A.track(total + 1.0, bpm, plan, seed=11)
        music_gain = 0.45
    else:
        bpm = 84
        bar = 60 / bpm * 4

        def plan(b: int) -> dict:
            tb = b * bar
            return {"pad": True, "arp": tb > 6.0 and (b // 8) % 2 == 0, "bass": tb > 12.0, "cutoff": 1300}
        music = A.track(total + 1.0, bpm, plan, seed=5)
        music_gain = 0.30

    n = int((total + 1.0) * A.SR)
    voice = np.zeros(n)
    sfx = np.zeros(n)
    effects = {"impact": A.impact(), "whoosh": A.whoosh(), "chime": A.chime(), "success": A.success(), "click": A.click(), "riser": A.riser()}
    for e in timeline:
        if "you_file" in e:
            A.place(voice, A.read_wav_mono(e["you_file"]), e["start"] + e["you_start"], 0.85)
        if "voice_file" in e:
            A.place(voice, A.read_wav_mono(e["voice_file"]), e["start"] + e["voice_start"], 1.0)
        for fx_name, offset in e["sfx"]:
            A.place(sfx, effects[fx_name], e["start"] + offset, 0.5 if fx_name != "click" else 0.35)
    if name == "marketing":
        # A riser into the drop, where the drums start.
        A.place(sfx, A.riser(2.4), max(0.0, ask_at - 2.4), 0.35)

    # Duck the music under each spoken line so the voice sits SPEECH_OVER_MUSIC_DB above it,
    # measured line by line (the drums need more ducking than the quiet pad), with smooth ramps.
    music = music[:n] if len(music) >= n else np.pad(music, (0, n - len(music)))
    music = music * music_gain
    duck = np.ones(n)
    ramp = int(0.2 * A.SR)
    for e in timeline:
        for key, at, length in (("you_file", "you_start", "you_dur"), ("voice_file", "voice_start", "voice_dur")):
            if key not in e:
                continue
            a = int((e["start"] + e[at]) * A.SR)
            b = min(n, a + int(e[length] * A.SR))
            v = voice[a:b]
            v_rms = np.sqrt(np.mean(v[np.abs(v) > 0.02] ** 2))
            m_rms = np.sqrt(np.mean(music[a:b] ** 2)) + 1e-9
            gain = min(1.0, v_rms / (m_rms * 10 ** (SPEECH_OVER_MUSIC_DB / 20)))
            lo, hi = max(0, a - ramp), min(n, b + ramp)
            duck[lo:hi] = np.minimum(duck[lo:hi], gain)
    duck = np.convolve(duck, np.ones(ramp) / ramp, mode="same")
    bed = music * duck
    # Speech-to-music ratio while each line plays. Broadcast practice: 10 to 15 dB or more.
    ratios = []
    for e in timeline:
        if "voice_file" in e:
            a = int((e["start"] + e["voice_start"]) * A.SR)
            b = a + int(e["voice_dur"] * A.SR)
            v, m = voice[a:b], bed[a:b]
            ratios.append((10 * np.log10((np.mean(v[np.abs(v) > 0.02] ** 2) + 1e-12) / (np.mean(m ** 2) + 1e-12)), e["id"]))
    worst = sorted(ratios)[:3]
    print("speech above music (dB), lowest:", ", ".join(f"{i} {r:.0f}" for r, i in worst))
    mix = bed + voice * 0.95 + sfx
    peak = np.max(np.abs(mix)) or 1.0
    mix = mix / peak * 0.89
    A.write_wav(str(out / "mix.wav"), mix, stereo_width=0.0)
    A.write_wav(str(out / "voice.wav"), voice / (np.max(np.abs(voice)) or 1) * 0.9)
    print(f"total {total:.2f}s -> {out / 'mix.wav'}")


if __name__ == "__main__":
    if sys.argv[2:] == ["--mix-only"]:
        saved = json.loads((HERE / "out" / sys.argv[1] / "timeline.json").read_text())
        mix(sys.argv[1], saved["scenes"], saved["total"])
    else:
        build(sys.argv[1])
