"""Renders a film in parallel segments, joins them, normalises loudness and muxes the sound.

Usage: python3 finish.py <name> <fps> <film.html> [segments]
Reads out/<name>/timeline.json and mix.wav; writes out/<name>/GenDrive-<name>.mp4.
"""
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
name, fps, html = sys.argv[1], int(sys.argv[2]), sys.argv[3]
remux = len(sys.argv) > 4 and sys.argv[4] == "remux"
parts = int(sys.argv[4]) if len(sys.argv) > 4 and not remux else 3
out = HERE / "out" / name
tl = json.loads((out / "timeline.json").read_text())
total = round(tl["total"] * fps)
cuts = [round(total * k / parts) for k in range(parts + 1)]

# 1. Render the segments side by side (one browser each). "remux" skips straight to the sound.
procs = []
for k in range(0 if remux else parts):
    log = open(out / f"seg{k}.log", "w")
    procs.append(subprocess.Popen(["node", str(HERE / "render.js"), str(out / "timeline.json"), str(HERE / html),
                                   str(out / f"seg{k}.mp4"), str(fps), str(cuts[k]), str(cuts[k + 1])], stdout=log, stderr=log))
for p in procs:
    if p.wait() != 0:
        raise SystemExit("a segment failed: see seg*.log")

# 2. Join them without re-encoding.
if not remux:
  (out / "segments.txt").write_text("".join(f"file 'seg{k}.mp4'\n" for k in range(parts)))
  subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(out / "segments.txt"),
                  "-c", "copy", str(out / "video.mp4")], check=True)

# 3. Two-pass loudness normalisation to -16 LUFS, true peak -2 dB (AAC adds a little) (suits YouTube and Facebook).
target = "I=-16:TP=-2:LRA=11"
probe = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(out / "mix.wav"), "-af", f"loudnorm={target}:print_format=json",
                        "-f", "null", "-"], capture_output=True, text=True).stderr
m = json.loads(probe[probe.rindex("{"):probe.rindex("}") + 1])
second = (f"loudnorm={target}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:"
          f"measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,"
          "alimiter=limit=0.67:attack=5:release=50:level=false")  # headroom for the AAC encoder's overshoot

# 4. Mux.
final = out / f"GenDrive-{name}.mp4"
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(out / "video.mp4"), "-i", str(out / "mix.wav"),
                "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-af", second, "-ar", "48000", "-c:a", "aac", "-b:a", "192k",
                "-shortest", "-movflags", "+faststart", str(final)], check=True)
for k in range(0 if remux else parts):
    (out / f"seg{k}.mp4").unlink()
print("done", final, f"frames {total}")
