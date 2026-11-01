import subprocess, sys, os
S = sys.argv[1]; C = S + '/cards/'; V = S + '/vid/'; G = S + '/seg/'
FPS = 30
def run(args): subprocess.run(['ffmpeg', '-v', 'error', '-y'] + args, check=True)
def enc(): return ['-r', str(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-an']
def fade(d): return f'fade=t=in:st=0:d=0.35,fade=t=out:st={d-0.35:.2f}:d=0.35'

def card(name, d, w, h, out):
    # Slow push-in (Ken Burns) on a still card.
    run(['-i', C + name + '.png', '-vf',
         f"scale={w*2}:{h*2},zoompan=z='min(1+0.0006*on,1.06)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={int(d*FPS)}:s={w}x{h}:fps={FPS},{fade(d)}"] + enc() + [out])

def clip(src, ss, d, out, w, h, vf_extra=''):
    run(['-ss', str(ss), '-t', str(d), '-i', src, '-vf', f'scale={w}:{h}:flags=lanczos,fps={FPS},{fade(d)}{vf_extra}'] + enc() + [out])

def phone_on(bg, src, ss, d, out, W, H, ph, x, y):
    # App footage in a rounded neon phone frame over a background card.
    pw = int(ph * 540 / 1168) // 2 * 2
    fc = (f"[1:v]trim=start={ss}:duration={d},setpts=PTS-STARTPTS,scale={pw}:{ph}:flags=lanczos,fps={FPS}[p];"
          f"[0:v]scale={W}:{H},drawbox=x={x-8}:y={y-8}:w={pw+16}:h={ph+16}:color=0x7ff004@0.9:t=4[b];"
          f"[b][p]overlay={x}:{y}:shortest=1,{fade(d)}")
    run(['-loop', '1', '-t', str(d), '-i', bg, '-i', src, '-filter_complex', fc, '-t', str(d)] + enc() + [out])

def concat(parts, out):
    lst = G + 'list-' + os.path.basename(out) + '.txt'
    open(lst, 'w').write(''.join(f"file '{p}'\n" for p in parts))
    run(['-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', '-movflags', '+faststart', out])

def dur(f):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).strip())

which = sys.argv[2]
if which in ('customer', 'driver'):
    W, H = 1080, 1920; k = 'c' if which == 'customer' else 'd'; parts = []
    clip(V + 'introV.webm', 0, 3.9, G + 'v_intro.mp4', W, H); parts.append(G + 'v_intro.mp4')
    for n, d in [('t_title_' + k, 4.5), ('t_android_' + k, 10), ('t_ios_' + k, 10), ('t_use', 3)]:
        card(n, d, W, H, G + n + '.mp4'); parts.append(G + n + '.mp4')
    src = V + which + '.webm'; total = dur(src) - 4.3
    ph = 1800; phone_on(C + 'bgv.png', src, 4.3, total, G + 'v_app_' + k + '.mp4', W, H, ph, (W - int(ph * 540 / 1168) // 2 * 2) // 2, 60)
    parts.append(G + 'v_app_' + k + '.mp4')
    card('t_end_' + k, 5, W, H, G + 't_end_' + k + '.mp4'); parts.append(G + 't_end_' + k + '.mp4')
    concat(parts, S + f'/out/FetchGenSan-{which}-tutorial.mp4')
else:
    W, H = 1920, 1080; parts = []
    clip(V + 'introH.webm', 0, 3.9, G + 'm_intro.mp4', W, H); parts.append(G + 'm_intro.mp4')
    for n, d in [('m_hook', 5), ('m_problem', 6), ('m_solution', 7)]:
        card(n, d, W, H, G + n + '.mp4'); parts.append(G + n + '.mp4')
    feats = [l.split() for l in open(S + '/feats.txt').read().strip().splitlines()]  # name src start dur
    for n, s, ss, d in feats:
        phone_on(C + n + '.png', V + s + '.webm', float(ss), float(d), G + n + '.mp4', W, H, 940, 1300, 70); parts.append(G + n + '.mp4')
    card('m_cta', 9, W, H, G + 'm_cta.mp4'); parts.append(G + 'm_cta.mp4')
    clip(V + 'introH.webm', 0, 3.9, G + 'm_outro.mp4', W, H); parts.append(G + 'm_outro.mp4')
    concat(parts, S + '/out/FetchGenSan-marketing.mp4')
print('done', which)
