"""
George's voiceover. Sends each line of <name>-voice.json to ElevenLabs (voice "George"),
then lays the lines on a timeline as one WAV. A line that would run into the next one is sped
up slightly (at most 1.25x), and if it is still too long the next line waits for it.

Usage: ELEVENLABS_API_KEY=... python voice.py <voice.json> <duration seconds> <out.wav>
"""
import hashlib, json, os, subprocess, sys, time, urllib.request

KEY = os.environ['ELEVENLABS_API_KEY']
VOICE = os.environ.get('GEORGE_VOICE_ID', 'JBFqnCBsd6RMkjVDRZzb')  # ElevenLabs stock voice "George"
MODEL = os.environ.get('ELEVENLABS_MODEL', 'eleven_multilingual_v2')
CACHE = os.environ.get('VOICE_CACHE', 'voice-cache')
os.makedirs(CACHE, exist_ok=True)


def tts(text):
    path = f"{CACHE}/{hashlib.sha1((VOICE + MODEL + text).encode()).hexdigest()}.mp3"
    if os.path.exists(path):
        return path
    body = json.dumps({'text': text, 'model_id': MODEL,
                       'voice_settings': {'stability': 0.45, 'similarity_boost': 0.8, 'style': 0.25, 'use_speaker_boost': True}}).encode()
    for attempt in range(4):
        req = urllib.request.Request(f'https://api.elevenlabs.io/v1/text-to-speech/{VOICE}?output_format=mp3_44100_128', data=body,
                                     headers={'xi-api-key': KEY, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg'})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                open(path, 'wb').write(r.read())
            return path
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors='replace')[:300]
            if e.code in (401, 403):
                sys.exit(f'ElevenLabs refused the key ({e.code}): {msg}')
            print(f'retry {attempt + 1}: {e.code} {msg}', file=sys.stderr)
            time.sleep(2 ** attempt * 2)
    sys.exit('ElevenLabs failed after 4 tries')


def length(f):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]))


lines = json.load(open(sys.argv[1]))
total = float(sys.argv[2])
out = sys.argv[3]
print(f'{sys.argv[1]}: {len(lines)} lines, {sum(len(l["text"]) for l in lines)} characters')

inputs, filters = [], []
cursor = 0.0
for i, l in enumerate(lines):
    mp3 = tts(l['text'])
    d = length(mp3)
    start = max(l['t'], cursor)
    nxt = lines[i + 1]['t'] if i + 1 < len(lines) else total
    room = max(0.5, nxt - start - 0.15)
    tempo = min(1.25, max(1.0, d / room))
    inputs += ['-i', mp3]
    filters.append(f'[{i}:a]atempo={tempo:.3f},aresample=48000,adelay={int(start * 1000)}|{int(start * 1000)}[v{i}]')
    cursor = start + d / tempo + 0.1
mixin = ''.join(f'[v{i}]' for i in range(len(lines)))
fc = ';'.join(filters) + f';{mixin}amix=inputs={len(lines)}:normalize=0,apad,atrim=0:{total:.3f}[a]'
subprocess.run(['ffmpeg', '-v', 'error', '-y'] + inputs + ['-filter_complex', fc, '-map', '[a]', '-ac', '2', '-ar', '48000', out], check=True)
print('wrote', out)
