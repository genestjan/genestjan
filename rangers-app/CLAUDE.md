# CLAUDE.md: rules for every session on the Rangers App

You are working on the Rangers App, a free, non-commercial coach and parent web app for Rangers Football Club (General Santos City, Philippines) and its sister teams FC New Mabu and Gila Academy. It is served at https://rangersfc.net/app/ from the club website's GitHub Pages (see `docs/adr/0010-hosting-at-app-path.md`), with Supabase as the backend. The code lives in `app/`.

Most users are volunteer coaches on mid-range Android phones at a dusty pitch with weak or no signal, and parents on prepaid data. The data is about children. Build accordingly.

## Read before you work

1. `README.md` for the overall plan and the phase order.
2. The current phase spec in `docs/specs/phase-N.md`. **Build only what that spec asks for.** If the spec is missing or unclear, stop and ask; do not invent scope.
3. The docs the spec links to: `docs/02-product-spec.md`, `docs/03-coaching-playbook.md`, `docs/04-technical-blueprint.md`.
4. `docs/decisions.md` for choices the club has made. A decision there overrides a default anywhere else.

## Roles

- **Planner session**: writes and updates `docs/specs/phase-N.md`, reviews pull requests against the spec and this file, records architecture decisions in `docs/adr/NNNN-title.md`. Does not write feature code.
- **Builder session**: implements one phase spec, with tests, on a feature branch, and opens one pull request per phase (or per spec section if the spec splits it). Writes `docs/specs/phase-N-handoff.md` at the end.

## Stack (do not change without an ADR approved by Jan)

What is actually in use (keep to this unless an ADR changes it):
- Vite, React 18, TypeScript in strict mode, Tailwind CSS, React Router with **HashRouter** (`#/screen` links work on first open from any static host)
- `vite-plugin-pwa` (Workbox) for the installable, offline app shell; `public/push-sw.js` for push messages
- One on-device state (`src/lib/store.ts`, IndexedDB through Dexie) with `useSyncExternalStore`; `migrate()` upgrades old saved data
- Cloud sync in `src/lib/syncMap.ts` + `src/lib/cloud.ts`: diff-based push of changed rows, pull by `updated_at`, Supabase Realtime for live messages
- zod for external input that matters (backup files); extend it to anything new that comes from outside
- Supabase: Postgres with Row Level Security, Auth (Google sign-in and email one-time code), Edge Function `send-push`, pg_cron
- Fonts self-hosted through `@fontsource` (Bebas Neue, Barlow)
- Tests: Vitest (`npm test`), browser flows (`npm run test:e2e`, Playwright), database access rules (`npm run test:db`, plain SQL tests on any Postgres)
- Not used yet: i18next (UI text is English in the components; translations are Phase 7), TanStack Query, react-hook-form
- Pin exact dependency versions. Add a new dependency only when the spec allows it or an ADR records why.

## Non-negotiables

### Children's data
1. **No real child data in the repository, ever.** Test fixtures use invented names. Seed files contain no real people. Screenshots in docs use the demo team.
2. **Row Level Security on every table**, deny by default. Every new table or record kind ships with tests in `app/supabase/tests/` proving: a parent cannot read another family's child; a coach cannot read players outside their teams; a player login reads only their own profile.
3. **Collect the minimum.** No weight, no school grades, no full medical history. Medical notes are limited to what a coach needs in an emergency (allergies, asthma inhaler, condition to watch) and live in a separate table with tighter rules.
4. **Kid-facing screens** (Match Day Board, TV, motivation corner) show first names or chosen nicknames and shirt numbers only. Photos appear only when the child's photo consent is on; otherwise show initials.
5. **No direct coach-to-child messaging.** All messages go to parent or guardian accounts. Player logins (13+) are read-only.
6. **Ratings are never ranked or compared** across children anywhere in the app, including coach screens. No league tables of children.

### Secrets and security
7. The Supabase **anon key** may be in the frontend. The **service role key, VAPID private key, SMTP password and backup keys** live only in Supabase or GitHub secrets. Never in code, never in `.env` files committed to git, never in logs.
8. Invite tokens are stored hashed, expire, and are single-use. Redemption is rate limited.
9. No third-party analytics, ads or trackers. YouTube is embedded only through `youtube-nocookie.com`.
10. Validate and size-limit every upload. Player photos are resized on the device to 256 px WebP before upload.

### Safety logic
11. The app **never diagnoses**. Concussion, heat and growth features recognise, record, remind and restrict. Wording comes from `docs/03-coaching-playbook.md`; do not rewrite safety text.
12. A player with a suspected concussion is blocked from lineups until a coach records clearance. Only a head coach or club admin can clear the block.
13. Heat and lightning guidance thresholds are config values from the playbook, never hard-coded in components.

### Reliability on the touchline
14. Everything in the Match Day Kit works **fully offline**. Writes go to the outbox and sync later. Match events are append-only.
15. Timers follow wall-clock time, so a match clock keeps running when the screen locks or the app closes.
16. Touch targets at least 48 px, 56 px on match screens. Every destructive action has undo or a confirm.
17. Performance budget: first load under 250 KB of JavaScript (gzipped) for parent routes; the board stays smooth (no dropped frames when dragging) on a mid-range Android phone with 4x CPU throttling in Playwright.

### Coaching content
18. Coaching content (drills, strategies, rubric wording, safety thresholds, psychology prompts) lives in data files under `src/content/` validated by zod schemas. Do not change the meaning of that content without Jan's approval; fixing typos is fine.

## Conventions

- Language in the UI: plain English, British spelling, short sentences. No em dashes in UI text. (Strings are inline for now; move them to i18next when Filipino and Cebuano are added.)
- Branding tokens live in `src/styles/tokens.css` and `tailwind.config`: red `#C31E24`, navy `#051A31`, deep `#03080F`, cream `#F9F6EF`, theme colour `#05101F`, headings Bebas Neue, body Barlow, pill buttons, 20 px card radius. Never hard-code colours in components.
- Keep pure logic (rotation, fair share, heat index, growth velocity, rubric summary, fee states, sync mapping) in `src/lib/` with no React imports, each with unit tests. New record types go in `syncMap.ts` CONFIG with the right visibility, and the database allow-lists if parents may write them.
- IDs are UUIDs generated on the device so offline records never collide.
- Times are stored in UTC (`timestamptz`) and shown in `Asia/Manila`.
- Commits: small and descriptive ("Add fair-share ledger with tests"). One phase or spec section per pull request.

## Definition of done (every pull request)

- [ ] Only the spec's scope is built; anything left out is listed in the handoff file
- [ ] `npm run typecheck`, `npm test` and `npm run test:e2e` pass
- [ ] New tables or record kinds have access tests; `npm run test:db` passes (it exits non-zero on any failure)
- [ ] Works offline where the spec says so (tested with Playwright offline mode)
- [ ] No secrets, no real names, no console errors
- [ ] `docs/specs/phase-N-handoff.md` lists: what was built, how to test it on a real phone, known gaps, and any decision Jan must make

## When you are unsure

Stop and ask in the pull request or the session. A short question is cheaper than a wrong feature built on children's data.
