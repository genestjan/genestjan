"""Speech-recognition check of every voice line in a timeline (Gen and the driver), scored like the builder."""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import build_audio as B
import audio_gen as A
import numpy as np
tl = json.loads(Path(sys.argv[1]).read_text())
scores = []
for s in tl["scenes"]:
    for key, text, who in (("you_file", s.get("you_say"), "you"), ("voice_file", s.get("say"), "gen")):
        if key in s:
            hyp = B.heard(np.asarray(A.read_wav_mono(s[key]), dtype=np.float32), A.SR)
            w = B.score(text, hyp)
            scores.append(w)
            print(f"{s['id']:12} {who:3} WER {w:.2f} | {hyp}")
print(f"mean WER {sum(scores) / len(scores):.2f} over {len(scores)} lines")
