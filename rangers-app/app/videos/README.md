# Tutorial and promo videos

Three portrait videos (1080x1920, for Facebook, Messenger and phones) with Tagalog captions, filmed from the real app with the demo team (invented names, sample photos marked SAMPLE):

| Script | Video | Length |
|---|---|---|
| `coach.mjs` | Gabay para sa Coach | about 4.5 min |
| `parent.mjs` | Gabay para sa Magulang at Player | about 3 min |
| `admin.mjs` | Gabay para sa Admin (coaches, teams and settings, family links, feedback, handing over) | about 2.7 min |
| `promo.mjs` | Promo: the tactics board first, then every other feature, slow enough to read, ending with a list of every feature | about 3.4 min |

Re-make them after the app changes (needs the club website checkout for the crest, club photo, anthem and live sign-in page):

```bash
APP_BASE=/app/ npx vite build --mode e2e --outDir videos/dist
SITE_DIR=/path/to/rangersfc node videos/coach.mjs        # or parent.mjs, promo.mjs
videos/sheet.sh coach                                     # optional: one still per caption, to check timing
SITE_DIR=/path/to/rangersfc videos/final.sh coach "$PWD/coach.mjs.mp4" -20   # -20 LUFS for tutorials, -14 for the promo
```

The admin video films the signed-in app, so it needs the local test server and a build that talks to it:

```bash
PGHOST=127.0.0.1 PGPORT=5544 PGUSER=postgres bash "$PWD/supabase/local-stack/start.sh"   # fresh each time (the admin is claimed once)
APP_BASE=/app/ VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=<ANON_KEY from supabase/local-stack/keys.mjs> VITE_EMAIL_CODES=1 VITE_GOOGLE_CLIENT_ID= npx vite build --outDir videos/dist-cloud
SITE_DIR=/path/to/rangersfc node videos/admin.mjs
```

How it works: `rec.mjs` opens `stage.html` (navy background, crest, phone frame, caption bar) with the app in the phone, films it with Chrome's screencast, and writes the frames, a frame list and `captions.srt` to `videos/out/NAME/`. `seed.mjs` sets up the demo team through the app's own screens before filming. The clock is fixed to a Saturday afternoon so times look normal. Captions use `r.step(text, actions)`: the caption stays until it has been read and its actions are done.

Never film real children or real families' data. Keep button names in English inside the Tagalog captions, since the app is in English.
