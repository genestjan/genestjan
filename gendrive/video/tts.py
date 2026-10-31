"""The VCTK voice (Mimic 3, CC BY 4.0) with its original front end: gruut phonemes and phonemes2ids.

Model files go in models/vctk (see README.md). Gen is speaker p258; the driver is p334.
"""
import json
import re
import wave
from pathlib import Path

import gruut
import numpy as np
import onnxruntime as ort
from phonemes2ids import phonemes2ids

HERE = Path(__file__).parent
VCTK = HERE / "models" / "vctk"
CFG = json.loads((VCTK / "config.json").read_text())
P = CFG["phonemes"]
phoneme_to_id = {}
for line in (VCTK / "phonemes.txt").read_text(encoding="utf-8").splitlines():
    if line.strip():
        idx, sym = line.split(" ", 1)
        phoneme_to_id[sym] = int(idx)
phoneme_map = {}
for line in (VCTK / "phoneme_map.txt").read_text(encoding="utf-8").splitlines():
    parts = line.split()
    if len(parts) >= 2:
        phoneme_map[parts[0]] = parts[1:]
speakers = {name: int(sid) for sid, _, name in (l.split("|") for l in (VCTK / "speaker_map.csv").read_text().splitlines())}
session = ort.InferenceSession(str(VCTK / "generator.onnx"), providers=["CPUExecutionProvider"])


def ids_for(sentence_text: str) -> list[int]:
    word_phonemes = []
    for sent in gruut.sentences(sentence_text, lang="en-us"):
        for w in sent:
            if w.phonemes:
                word_phonemes.append(list(w.phonemes))
    return phonemes2ids(
        word_phonemes=word_phonemes, phoneme_to_id=phoneme_to_id, pad=P["pad"], bos=P["bos"], eos=P["eos"],
        blank=P["blank"], blank_word=P["blank_word"], blank_between=P["blank_between"],
        blank_at_start=P["blank_at_start"], blank_at_end=P["blank_at_end"], simple_punctuation=P["simple_punctuation"],
        punctuation_map=P["punctuation_map"], separate=P["separate"], separate_graphemes=P["separate_graphemes"],
        separate_tones=P["separate_tones"], tone_before=P["tone_before"], phoneme_map=phoneme_map or None,
        fail_on_missing=False, auto_bos_eos=P.get("auto_bos_eos", False),
    )


def synth(text: str, speaker: str = "p258", length_scale: float = 1.2, noise_scale: float = 0.333, noise_w: float = 0.333) -> np.ndarray:
    """Speech at 22050 Hz. The model is random each run, so every call is a new take."""
    chunks = []
    for sentence in re.split(r"(?<=[.!?])\s+", text.strip()):
        if not sentence:
            continue
        if sentence[-1] not in ".!?":
            sentence += "."
        ids = np.array([ids_for(sentence)], dtype=np.int64)
        audio = session.run(None, {
            "input": ids, "input_lengths": np.array([ids.shape[1]], dtype=np.int64),
            "scales": np.array([noise_scale, length_scale, noise_w], dtype=np.float32),
            "sid": np.array([speakers[speaker]], dtype=np.int64),
        })[0].squeeze()
        chunks += [audio, np.zeros(int(22050 * 0.25), dtype=np.float32)]
    audio = np.concatenate(chunks)
    return (audio / (float(np.max(np.abs(audio))) or 1.0) * 0.92).astype(np.float32)


def save(path: str, audio: np.ndarray, rate: int = 22050) -> None:
    pcm = (np.clip(audio, -1, 1) * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm.tobytes())


def wer(ref: str, hyp: str) -> float:
    """Word error rate between two plain-word strings."""
    r = re.sub(r"[^a-z0-9 ]", "", ref.lower()).split()
    h = re.sub(r"[^a-z0-9 ]", "", hyp.lower()).split()
    d = [[0] * (len(h) + 1) for _ in range(len(r) + 1)]
    for i in range(len(r) + 1):
        d[i][0] = i
    for j in range(len(h) + 1):
        d[0][j] = j
    for i in range(1, len(r) + 1):
        for j in range(1, len(h) + 1):
            d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (r[i - 1] != h[j - 1]))
    return d[len(r)][len(h)] / max(1, len(r))
