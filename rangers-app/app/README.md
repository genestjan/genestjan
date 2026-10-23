# Rangers App

Free coach and parent web app for Rangers FC, FC New Mabu and Gila Academy. Installable PWA, works offline, coach and parent have separate logins.

**Coach side:** today dashboard with heat forecast, schedule and attendance, announcements and private messages to families, squad and player profiles (emergency info, goals, badges, growth, injuries), term reviews, recognition by club values, training builder with 30 drills and run mode, match planner with fair minutes, live match, the kid-facing Match Day Board with TV link, tactics board editor, safety (head knock block, heat, thunder, heading), club support (tournament fund, boot bank, optional contributions), settings and coach invites.

**Parent side:** next event with Going / Maybe / Not going per child, announcements, messages with the coach, child progress ("you then, you now", strengths, working on with a drill to try at home, goals, badges, attendance and minutes), contributions (own child only), privacy and data download.

## Run it
```
npm install
npm run dev          # local-only mode works with no setup (use More > Preview the parent app)
npm test             # 47 logic tests
npm run build
PGHOST=localhost PGUSER=postgres bash supabase/run-tests.sh   # 52 database tests (access rules, invites, notifications)
```
Going live with real logins and sync: **SETUP.md**. Plan and rules: `../README.md`, `../CLAUDE.md`, `../docs/`.

## How it is wired
- `src/lib/store.ts`: one on-device state (IndexedDB), migrated across versions. Everything works offline.
- `src/lib/syncMap.ts` + `src/lib/cloud.ts`: when `VITE_SUPABASE_URL` is set, changes are diffed and pushed, and new rows pulled (plus live updates for messages). Parents can only push replies, messages, payment references and read marks; the database enforces it.
- `supabase/migrations`: tables, Row Level Security, invites, notification triggers. `supabase/tests`: the access tests.
- Pure logic with tests lives in `src/lib/` (rotation, fair share, heat index, growth, development summary, fees, session builder, weather parsing, sync mapping).

## What is verified and what is not
Verified here: all logic tests, all database access tests on PostgreSQL 16 (including a deliberate policy break that the tests caught), a full browser run of coach and parent flows at phone size with no errors, TV-size screenshots.

**Not yet verified (needs your accounts, see SETUP.md):** sign-in with Google and email codes, sync against a real Supabase project, realtime message updates, push notifications (including iPhone), the TV link over Supabase Realtime, the `send-push` function, the GitHub Pages deploy and the custom domain. They are written to the design but have not run against the live services. Plan one evening on a staging project with two coach phones and two parent phones before real families join.

## Known gaps
- App icons are placeholders: replace `public/icons/icon-192.png` and `icon-512.png` with the crest.
- 8v8 minutes plan: gap is 5 min or less for 9 to 13 players; 14 or 15 players gives 15 min because each keeper plays a full period.
- Heat forecast uses General Santos city coordinates unless an event sets its own.
- Filipino and Cebuano translations, player 13+ logins, PNG/GIF export and season rollover are not built.
- Photos are not uploaded (initials only); the consent switch is stored for when they are.
- Playbook content (drills, strategies) needs a coach to read it before it is trusted.
