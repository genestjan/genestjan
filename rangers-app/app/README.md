# Rangers App

Free coach and parent web app for Rangers FC, FC New Mabu and Gila Academy. Installable PWA, works offline, coach and parent have separate logins.

**Coach side:** today dashboard with heat forecast, schedule and attendance, announcements and private messages to families, squad and player profiles (emergency info, goals, badges, growth, injuries), term reviews, recognition by club values, training builder with 30 drills and run mode, match planner with fair minutes, live match, the kid-facing Match Day Board with TV link, tactics board editor, safety (head knock block, heat, thunder, heading), club support (tournament fund, boot bank, optional contributions), settings and coach invites.

**Parent side:** next event with Going / Maybe / Not going per child, announcements, messages with the coach, child progress ("you then, you now", strengths, working on with a drill to try at home, goals, badges, attendance and minutes), contributions (own child only), privacy and data download.

## Run it
```
npm install
npm run dev          # local-only mode works with no setup (use More > Preview the parent app)
npm test             # 52 logic tests
npm run build
npm run test:e2e     # browser run of coach and parent flows
PGHOST=localhost PGUSER=postgres npm run test:db   # 81 database tests (access rules, invites, notifications)
```
Going live with real logins and sync: **SETUP.md**. Plan and rules: `../README.md`, `../CLAUDE.md`, `../docs/`.

## How it is wired
- `src/lib/store.ts`: one on-device state (IndexedDB), migrated across versions. Everything works offline.
- `src/lib/syncMap.ts` + `src/lib/cloud.ts`: when `VITE_SUPABASE_URL` is set, changes are diffed and pushed, and new rows pulled (plus live updates for messages). Parents can only push replies, messages, payment references and read marks; the database enforces it.
- `supabase/migrations`: tables, Row Level Security, invites, notification triggers. `supabase/tests`: the access tests.
- Pure logic with tests lives in `src/lib/` (rotation, fair share, heat index, growth, development summary, fees, session builder, weather parsing, sync mapping).

## What is verified and what is not
- `npm test`: 52 logic tests (minutes planner for 4v4 to 11v11, fair share, heat index, growth, reviews, contributions, sync mapping).
- `npm run test:db`: 81 database tests on PostgreSQL 16. Deliberately broken rules make them fail, so they are not passing by accident.
- `npm run test:e2e`: coach and parent flows in Chromium on one device (also with `APP_BASE=/app/`).
- `node e2e/cloud.mjs` with `supabase/local-stack/start.sh` running: **online mode end to end** against the real Supabase auth server (GoTrue) and PostgREST, with three separate browsers (club admin, parent, coach) signing in with emailed codes. Covers admin setup, family invite, privacy consent, announcements, two-way messages, replies, review publish and take-back (the private note never reaches the parent's phone), coach invite, approval and head coach, the head-injury block reaching another coach's phone and clearance by the head coach only, sign-out wiping the phone, and direct API attacks with a parent's login (all refused).

**Not yet tested:** Google sign-in (needs your Google Cloud client), live updates over Supabase Realtime (the app also refreshes on open and every minute, which is tested), push notifications and the `send-push` function, and the TV link (uses Realtime). Check these on the real project.

## Known gaps
- Heat forecast uses General Santos city coordinates unless an event sets its own.
- Filipino and Cebuano translations, player 13+ logins, PNG/GIF export and season rollover are not built.
- Photos are not uploaded (initials only); the consent switch is stored for when they are.
- Playbook content (drills, strategies) needs a coach to read it before it is trusted.
