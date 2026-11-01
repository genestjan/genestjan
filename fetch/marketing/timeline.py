"""
Builds, for each video, the sound-effect timeline (for audio.py) and George's voice script
(for voice.py), from the cue logs that rec.cjs writes while recording the apps.
Segment lengths must match compose.py.

Usage: python timeline.py <vid dir with *-cues.json and *.webm> <out dir>
Also writes <out dir>/feats.txt, the marketing footage cut list used by compose.py.
"""
import json, re, subprocess, sys

VID, OUT = sys.argv[1], sys.argv[2]
INTRO = 3.9
SKIP = 4.3  # app intro trimmed from the app footage


def dur(f):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]))


def spoken(text):
    t = re.sub(r'\(Demo\)\s*', '', text)
    t = re.sub(r'₱(\d+)', r'\1 pesos', t)
    t = t.replace('km', 'kilometres').replace('GenSan', 'Gen San').replace('GCash', 'G Cash')
    t = t.replace('genestjanramirez.com/fetch', 'genestjanramirez dot com slash fetch')
    return t


def cues(name):
    return json.load(open(f'{VID}/{name}-cues.json'))


def save(name, timeline, voice):
    json.dump(timeline, open(f'{OUT}/{name}-timeline.json', 'w'), indent=1)
    json.dump(voice, open(f'{OUT}/{name}-voice.json', 'w'), indent=1, ensure_ascii=False)


TUT = {
    'customer': {
        'title': "Hi, I'm George. In the next few minutes I'll show you how to install Fetch Gen San, and book your first ride.",
        'android': 'On Android, open Chrome and go to genestjanramirez dot com slash fetch. Tap the three-dot menu, then Install app. Or download the A P K from the link in the description.',
        'ios': 'On iPhone, open Safari and go to the same address. Tap the Share button, then Add to Home Screen, and tap Add.',
        'end': 'That is all there is to it. Ride. Pick. Deliver. Sa Gen San!',
    },
    'driver': {
        'title': "Welcome, driver. I'm George. Here is how to install the Fetch Gen San Driver app, set your own rates, and finish your first trip.",
        'android': 'On Android, open Chrome and go to genestjanramirez dot com slash fetch slash driver. Tap the menu, then Install app. Or install the driver A P K from the description.',
        'ios': 'On iPhone, open Safari, go to the same address, tap Share, then Add to Home Screen. Allow location and camera when asked.',
        'end': 'Drive. Deliver. Earn on your own terms. Welcome to Fetch Gen San.',
    },
}

for name, lines in TUT.items():
    c = cues(name)
    app_len = dur(f'{VID}/{name}.webm') - SKIP
    segs = [INTRO, 4.5, 10, 10, 3, app_len, 5]
    starts = [sum(segs[:i]) for i in range(len(segs))]
    app0 = starts[5] - SKIP  # recording time -> video time
    total = sum(segs)
    tl = {'duration': total, 'cuts': starts[1:], 'logo': [0.0], 'taps': [], 'typing': [], 'dings': []}
    voice = [{'t': starts[1] + 0.4, 'text': lines['title']},
             {'t': starts[2] + 0.4, 'text': lines['android']},
             {'t': starts[3] + 0.4, 'text': lines['ios']},
             {'t': starts[4] + 0.2, 'text': "Now let's use it. Just follow the green circles."}]
    for e in c:
        t = app0 + e['t']
        if t < starts[5]:
            continue
        if e['kind'] == 'tap':
            tl['taps'].append(round(t, 3))
        elif e['kind'] == 'type':
            tl['typing'].append([round(t + 0.1, 3), e['d']])
        elif e['kind'] == 'cap':
            voice.append({'t': round(t + 0.15, 3), 'text': spoken(e['text'])})
            if re.search(r'accepted|new request', e['text'], re.I):
                tl['dings'].append(round(t, 3))
    voice.append({'t': starts[6] + 0.4, 'text': lines['end']})
    save(name, tl, voice)

# ------------------------------ Marketing ------------------------------
cc, dc = cues('customer'), cues('driver')


def find(cs, pat):
    for e in cs:
        if e['kind'] == 'cap' and re.search(pat, e['text']):
            return e['t']
    raise SystemExit('cue not found: ' + pat)


FEATS = [  # card, footage, caption to start from, length, George's line
    ('m_f1', 'customer', r'^This is your home screen', 13, 'Book in seconds. Choose Ride, Pabili or Delivery, type where you are going, and you are done.'),
    ('m_f2', 'customer', r'^Choose your driver', 13, 'You choose your driver. See the real vehicle, the plate number, the rating and the price, before you book.'),
    ('m_f3', 'customer', r'^Metered', 13, 'Fair prices, your way. Pay by the meter, or agree a fixed price in chat. Drivers set their own rates.'),
    ('m_f4', 'customer', r'^Step 3\. Verify', 13, 'Everyone is verified, with a real name, mobile number and valid I D. Track your trip live, and S O S is one tap away.'),
    ('m_f5', 'customer', r'^Chat for free', 13, 'Chat for free inside the app, or call with one tap, and watch your driver come to you on the map.'),
    ('m_f6', 'customer', r'^You have arrived', 14, 'Pay with cash, G Cash or bank transfer. Tip your driver, rate your trip, and earn suki points for up to ten per cent off.'),
    ('m_f7', 'customer', r'^Meet George', 13, 'And just ask me. I am George, your voice assistant. Book a ride, find your driver, or play your music.'),
    ('m_f8', 'driver', r'^A new request', 14, 'Drivers: your rates, your schedule. Go online when you want, and get paid straight to your G Cash.'),
]
segs = [('m_intro', INTRO), ('m_hook', 5), ('m_problem', 6), ('m_solution', 7)] + [(f[0], f[3]) for f in FEATS] + [('m_cta', 9), ('m_outro', INTRO)]
starts = {}
acc = 0.0
for n, d in segs:
    starts[n] = acc
    acc += d
tl = {'duration': acc, 'cuts': [starts[n] for n, _ in segs[1:]], 'logo': [0.0, starts['m_outro']], 'taps': [], 'typing': [], 'dings': []}
voice = [{'t': starts['m_hook'] + 0.3, 'text': 'Need a ride? A pabili? A padala?'},
         {'t': starts['m_problem'] + 0.3, 'text': 'No more waiting at the kanto. No more haggling. No more guessing who is driving.'},
         {'t': starts['m_solution'] + 0.3, 'text': 'Meet Fetch Gen San. Rides, pabili, pick-up and delivery. Made in Gen San, for all of Mindanao.'}]
with open(f'{OUT}/feats.txt', 'w') as f:
    for card, src, pat, d, line in FEATS:
        cs = cc if src == 'customer' else dc
        ss = max(0.0, find(cs, pat) - 0.4)
        f.write(f'{card} {src} {ss:.2f} {d}\n')
        voice.append({'t': starts[card] + 0.5, 'text': line})
        for e in cs:
            if ss <= e['t'] < ss + d:
                t = starts[card] + e['t'] - ss
                if e['kind'] == 'tap':
                    tl['taps'].append(round(t, 3))
                elif e['kind'] == 'type':
                    tl['typing'].append([round(t + 0.1, 3), min(e['d'], ss + d - e['t'])])
                elif e['kind'] == 'cap' and re.search(r'accepted|new request', e['text'], re.I):
                    tl['dings'].append(round(t, 3))
voice.append({'t': starts['m_cta'] + 0.5, 'text': 'Download Fetch Gen San now. On Android, iPhone, or any browser, at genestjanramirez dot com slash fetch.'})
voice.append({'t': starts['m_outro'] + 1.9, 'text': 'Ride. Pick. Deliver. Sa Gen San!'})
save('marketing', tl, voice)
print('timelines written to', OUT)
