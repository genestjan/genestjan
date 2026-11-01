# GenDrive videos

Source for the two GenDrive videos: the marketing video (about 95 seconds) and the
step-by-step tutorial (about 4 minutes). Both are rendered from the design preview
(`../design/preview.html`) in a headless browser, with demo data, an open voice model
and original music. Nothing here is part of the app.

## What each file does

| File | Job |
|---|---|
| `scripts.py` | Every scene: what Gen says, the caption, the title, what the screen shows. Captions and spoken text must have the same number of sentences. |
| `build_audio.py` | Makes the voices one sentence at a time (best of several takes, checked by speech recognition), the music and sound effects, the mix and `timeline.json`. `--mix-only` remixes without new voices. |
| `tts.py` | Small audio helpers (save a WAV, word error rate). |
| `audio_gen.py` | Original music and sound effects, synthesised from code. |
| `film_layer.html` | Titles, captions, rings, the tap finger, tutorial illustrations and end cards, driven by the timeline. |
| `build_film.py` | Joins the design preview and the film layer into `film.html`. |
| `render.js` | Renders frames with a paused page clock, so the in-app clock and animations match the film exactly. |
| `finish.py` | Renders in parallel segments, joins them, normalises loudness (-16 LUFS) and adds the sound. `remux` redoes only the sound. |
| `stills.js` | Single frames, for checking scenes before a full render. |
| `check_lines.py` | Speech-recognition check of every voice line. |

## Rebuild

1. Python 3.11 or newer, in a virtual environment:
   `pip install kokoro-onnx sherpa-onnx numpy num2words`
2. The voice model into `models/kokoro/`: `kokoro-v1.0.onnx` and `voices-v1.0.bin` from the
   [kokoro-onnx model-files-v1.0 release](https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0).
   Gen is the voice `bm_george` (British English) and the driver is `am_michael`.
3. The speech checker into `models/`: `sherpa-onnx-moonshine-tiny-en-int8` (and, for the
   stricter final check, `sherpa-onnx-moonshine-base-en-int8`) from the
   [sherpa-onnx asr-models release](https://github.com/k2-fsa/sherpa-onnx/releases/tag/asr-models).
4. Node 18 or newer with Playwright and its Chromium, ffmpeg, and the Inter font
   (`apt install fonts-inter`, or the TTFs in `../android/app/src/main/res/font`).
5. Build:

```bash
python -I build_audio.py marketing
python -I build_audio.py tutorial
python3 build_film.py
python3 finish.py marketing 30 film.html
python3 finish.py tutorial 24 film.html
```

The videos land in `out/marketing/GenDrive-marketing.mp4` and `out/tutorial/GenDrive-tutorial.mp4`.
Set `ASR_MODEL=base` on `build_audio.py` or `check_lines.py` for the stricter speech check.

## Credits and licences

- **Voices:** Kokoro-82M (Apache-2.0), run with kokoro-onnx (MIT). Gen is `bm_george`, the
  driver is `am_michael`. No attribution is required; the end cards credit it anyway.
- **Speech checking:** Moonshine by Useful Sensors (MIT), run with sherpa-onnx (Apache-2.0).
- **Music and sound effects:** original, made by `audio_gen.py`.
- **Font:** Inter (SIL OFL 1.1).
- The screens are the GenDrive design preview with demo data. Gen's in-car voice is the car's
  own text-to-speech engine, not this demo voice, and the end card says so.
