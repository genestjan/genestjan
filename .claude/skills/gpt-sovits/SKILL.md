---
name: gpt-sovits
description: "Make voice-overs with GPT-SoVITS (MIT, runs free on your own computer) in Jan's own cloned voice or any voice he has written permission to use. Use for Reels, YouTube, podcast intros, Vision's voice and client videos. Never clone a celebrity or anyone without consent."
---

# GPT-SoVITS voice-overs

GPT-SoVITS (https://github.com/RVC-Boss/GPT-SoVITS, MIT licence) is a free text-to-speech and voice-cloning program. It runs on Jan's own laptop. A 3 to 10 second clean voice sample is enough for a good clone; 1 minute of training audio makes it better.

## Consent rule (always)
- Only clone a voice when the owner has said yes: Jan's own voice, or a client or voice actor who agreed in writing (keep the agreement in clients/<name>/voice-consent.md).
- Never clone a celebrity, actor or public figure (for example a film actor's voice), even "for fun". If asked, offer a similar style from a consenting voice or a stock voice instead.
- Say in the description when a voice-over is AI-generated if the platform asks for it.

## Where it lives on Jan's laptop
D:\GPT-SoVITS (the Windows integrated package). Voice samples go in D:\GPT-SoVITS\my-voices\ as .wav files with a matching .txt holding the exact words spoken.

## Start the voice server (once per session)
In PowerShell:
  cd D:\GPT-SoVITS
  .\runtime\python.exe api_v2.py -a 127.0.0.1 -p 9880 -c GPT_SoVITS/configs/tts_infer.yaml
Leave that window open. It only listens on this computer (127.0.0.1), nothing is shared online.

## Make a voice-over
POST http://127.0.0.1:9880/tts with JSON:
{
  "text": "<the script>",
  "text_lang": "en",
  "ref_audio_path": "D:/GPT-SoVITS/my-voices/jan.wav",
  "prompt_text": "<exact words spoken in jan.wav>",
  "prompt_lang": "en",
  "text_split_method": "cut5",
  "speed_factor": 1.0,
  "media_type": "wav"
}
The reply is the .wav audio. One PowerShell line:
  Invoke-WebRequest -Uri http://127.0.0.1:9880/tts -Method POST -ContentType "application/json" -InFile request.json -OutFile video/voice.wav

## Save money
- It runs locally, so it costs nothing per word. Prefer it over paid voice APIs for drafts and final voice-overs.
- Keep scripts short; split long scripts into paragraphs.

## If something fails
- "Connection refused": the server window is closed. Start it again.
- Robotic or wrong accent: use a cleaner, longer reference clip (no music, no echo) and make sure prompt_text matches the clip word for word.
- Very slow: the laptop has no NVIDIA graphics card, so it uses the processor. Short clips still work.
