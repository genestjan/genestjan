# 05. Build roadmap

Eight phases. Each phase ends with something coaches or parents can use, and a **gate**: we only start the next phase when the gate is met. The Planner turns each phase below into `docs/specs/phase-N.md` (file-level tasks, schemas, test lists) just before it is built, using what the last field test taught us.

Time estimates assume evenings-only work with the Builder writing the code. They are rough guesses; real-device testing is the slow part.

| Phase | Name | Result | Estimate |
|---|---|---|---|
| 0 | Setup | `app.rangersfc.net` live, installable, branded, CI green | 1 to 2 evenings |
| 1 | Match Day Kit | Offline board, Match Day Board, fair minutes; no logins | 1 to 2 weeks |
| 2 | Accounts, families, privacy | Sign-in, programmes and teams, family invites, consent, sync | 2 to 3 weeks |
| 3 | Schedule and reminders | Events, replies, attendance, announcements, heat check, push | 2 weeks |
| 4 | Training | Session builder, drills, curriculum, run mode | 2 weeks |
| 5 | Development and wellbeing | Term reviews, progress for families, recognition, safety logs | 2 to 3 weeks |
| 6 | Club support | Tournament fund, boot bank, optional contributions | 1 week |
| 7 | Polish and scale | TV link, translations, player logins, export, rollover, handover | 2 weeks |

---

## Phase 0: Setup

**Jan does first** (steps in `07-club-launch-kit.md`, sections 4 and 5):
- [ ] GitHub organisation `rangersfc` with two owners; repository `rangersfc/rangers-app` (public) containing this plan.
- [ ] Pages source set to GitHub Actions.
- [ ] DNS at Onamae.com: CNAME `app` → `rangersfc.github.io`. Verify `rangersfc.net` in the organisation's Pages settings.
- [ ] High-resolution crest files for Rangers, FC New Mabu and Gila (PNG 1024 px or vector).

**Planner does**: write ADRs 1 to 8 (blueprint section 14) and `docs/specs/phase-0.md`.

**Builder tasks**
1. Vite, React, TypeScript (strict), ESLint, Prettier, Vitest, Playwright with phone, tablet and TV projects.
2. Tailwind with `tokens.css`: Club and Sun modes; `@fontsource` Bebas Neue and Barlow (Latin subset).
3. Base components: Button (pill), Card, bottom Tabs, Sheet, Toast, BigClock, ModeToggle, OfflineBanner.
4. PWA: manifest (name "Rangers FC", short name "Rangers", theme `#05101F`, background `#03080F`, icons 192, 512, maskable 512 from the crest), offline shell, "New version ready" prompt.
5. Router, `404.html` copy, `CNAME`, `robots.txt` (disallow all), `noindex`, CSP meta tag.
6. i18next with `en.json`; no hard-coded UI strings.
7. Dexie database v1 skeleton; `ids.ts` (UUIDs); `time.ts` (Asia/Manila).
8. `src/content/`: zod schemas plus `pitches.json`, `values.json` (three programmes), `safety.json` (thresholds from the playbook).
9. Demo team fixture (16 invented children).
10. `ci.yml` and `deploy.yml`; first deploy.

**Accepted when**
- [ ] `https://app.rangersfc.net` loads over HTTPS with the crest and club colours.
- [ ] It installs to the home screen on an Android phone and opens in airplane mode afterwards.
- [ ] Sun and Club modes switch from the header and are remembered.
- [ ] CI is green on a pull request; merging deploys automatically.

---

## Phase 1: Match Day Kit (offline, no logins)

**Goal**: the pilot coach uses it at a real match within two weeks.

**Builder tasks**
1. **Local squad** (M1): add, edit, paste-import, demo team; initials only (no photos in Phase 1).
2. **Board engine**: BoardDoc schema and migrations, pitch renderer for every format and view, pieces, `resolveStep`, unit tests for geometry and interpolation.
3. **Board editor**: tools (move, run, pass, dribble, shot, zone, pen, eraser), steps bar, play loop, undo/redo, arrow key legend, save and library, copy a preset to edit.
4. **Preset content**: every shape, move and set piece in playbook section 6 as BoardDoc JSON, validated in CI. A "Preset review" page shows them all so Coach James can check them in one sitting.
5. **Match setup**: format, periods and minutes, sub mode, who is available, keeper volunteers.
6. **Rotation planner** (`src/lib/rotation/`) with the property tests in blueprint 4.2; plan grid with locks and the spread shown.
7. **Live match**: wall-clock timer, Now/Next, sub alerts (vibration and sound), append-only event log, coach marks (star, shy, help, note), injury button with a local "suspected head injury" block, undo, forgotten-whistle guard, Screen Wake Lock.
8. **Match Day Board** present mode: Lineup, Our 3 keys, The move, Set pieces, Our values, Half-time (with the "Ask them first" prompt), Next on, Celebrate; keyboard and remote navigation; TV text scaling.
9. **Report and backup**: match report, CSV and JSON export, full local backup and restore to a file.
10. **Help**: a "?" guide for match day and a TV connection guide (HDMI cable, screen mirroring, TV browser).
11. **End-to-end tests**: a full offline match from setup to report; board drag under 4x CPU throttle; present mode at 1920x1080.

**Accepted when** (in addition to the M1 to M4 criteria in the product spec)
- [ ] A coach can set up a match, get a rotation plan and show the Lineup slide in under 5 minutes, offline.
- [ ] A full 2 x 25 minute 8v8 match with 12 players runs offline with the spread at most 5 minutes.
- [ ] Closing and reopening the browser mid-match loses nothing and the clock is right.

### Field-test gate (two real matches)

**Before the match**
- [ ] App opened online at home in the last 24 hours (so the latest version is cached).
- [ ] Airplane-mode rehearsal at home: set up the match, plan, show slides.
- [ ] Phone or tablet fully charged; power bank; cheap waterproof pouch for rain or sweat.
- [ ] TV route tested if using one (HDMI adapter, cable, or mirroring).

**During the match** (an assistant notes these, not the coach)
- [ ] Could kids read names and numbers from where they stood?
- [ ] How many seconds did a substitution take on the phone?
- [ ] Did the clock and sub alerts work with the screen locked?
- [ ] Any moment the coach looked confused or gave up on the app?
- [ ] How did the kids react to the board?

**After the match**
- [ ] Minutes spread (most minus least).
- [ ] Coach's score out of 5 and the top three problems.
- [ ] Decision: keep going, fix first, or stop.

Record results in `docs/field-tests/YYYY-MM-DD.md` and feed them to the Planner with prompt F1. **Do not start Phase 2 until the coaches say they want to keep using it.**

---

## Phase 2: Accounts, families and privacy

**Jan does first**: create Supabase projects `rangers-staging` and `rangers-prod`; Google OAuth client; Resend account with `rangersfc.net` verified (SPF and DKIM at Onamae.com); repository secrets and variables (launch kit, section 6). Have the privacy notice reviewed (launch kit, section 7).

**Builder tasks**
1. Migrations for programmes, seasons, teams, profiles, memberships, team_staff, players, player_private, player_guardians, player_teams, consents, invites, venues, audit_log; helper functions; RLS policies; **pgTAP tests for every rule in blueprint 7.3**.
2. Auth: Google sign-in and email code (custom SMTP), sign-in screens, routing by role, sign-out everywhere.
3. Admin: three programmes seeded with crest, colours and values; seasons; teams; coach invites and approval.
4. Sync engine (outbox and pull) for squad, strategies, matches and match events; "Sync problems" screen.
5. One-time upload of Phase 1 local data to a team.
6. Family invites: create and share link, redeem, add sibling, privacy notice (English and Filipino), consent choices, change consent later, download my child's data, request deletion.
7. Parent home v1: child cards, team, coaches' first names, privacy settings.
8. Photos with consent: resize on device, upload, signed URLs; kid-facing views use photos only with photo consent.
9. `keepalive.yml`; backup workflow in the private backups repository.

**Accepted when**
- [ ] pgTAP suite passes in CI; a deliberate cross-family read attempt fails in a test.
- [ ] Three pilot families each go from invite link to seeing their child in under 2 minutes.
- [ ] A coach signs in on a second phone and sees the same squad, boards and match reports.
- [ ] First encrypted backup exists and a test restore to staging works.

---

## Phase 3: Schedule, availability, reminders and heat check

**Builder tasks**
1. **Spike**: confirm a Web Push library works on the Supabase Edge runtime; record the result in an ADR.
2. Venues (map link, nearest hospital, shelter note) and events, including recurring training.
3. Availability replies for parents (two taps for two children), optional "Going unless you say otherwise", coaches answering for families without phones, reply dashboard and "remind non-repliers".
4. Attendance screen (20 children in under 30 seconds).
5. Announcements with "Seen by"; direct notes with replies.
6. "Share to group chat" for events and announcements.
7. Heat and lightning: Open-Meteo fetch and cache, `heatIndex.ts` with the test vectors, heat badge and guidance on event cards, thunder timer.
8. Notifications: subscribe flow with the iPhone "Add to Home Screen" guide, queue tables, pg_cron jobs, `send-notifications` function, in-app banners.
9. Match setup reads availability; season minutes ledger; carry-over option in the planner.

**Accepted when**
- [ ] One month of the pilot team's schedule runs through the app, with Messenger used only to share the app's messages.
- [ ] At least 70% of pilot families reply to availability in the app (or the coach records it for them).
- [ ] Every outdoor event shows heat guidance a day ahead.

---

## Phase 4: Training

**Builder tasks**
1. Drill schema and seed: the 30 drills in playbook section 5; the Builder drafts write-ups in the given format; each starts "Needs coach review".
2. Drill diagrams with the board engine.
3. Curriculum data and "this week's theme".
4. Session builder: band, players, minutes, theme, equipment; fills the six slots; swap; STEP easier and harder; heading rules by age; water breaks from the heat check.
5. Run mode: block timer, diagram, coaching points, buzz on block change, wake lock, huddle script.
6. Coach reflection (two taps) and session history; "Make groups" tool (random, never by rating).
7. Video links through `youtube-nocookie.com`, added only by coaches.

**Accepted when**
- [ ] Two coaches plan four weeks of sessions in the app.
- [ ] A complete session is built in under 5 minutes using only the equipment the coach has.

---

## Phase 5: Development and wellbeing

**Builder tasks**
1. Rubric content; `assessments` and family-safe view; RLS and pgTAP (guardians never see coach notes or unpublished reviews).
2. Term review swipe screen; publish to families when the team is done.
3. Family progress view: you then and you now, strengths, working on (with a drill to try at home), fastest developing, goals, badges, attendance and minutes.
4. Goals; self-rating for 11+ with the "talk about it" suggestion.
5. Recognition by programme values, coverage nudge, skill and value badges.
6. Safety logs: growth measurements and spurt flag; injury log; full concussion flow with CRT6 wording copied from the official document and the clearance rules; wellness check for 13+ (optional per team).
7. Emergency info available offline; match-day and training checklist.
8. Motivation corner slides.

**Accepted when**
- [ ] One full term review of the pilot team is published to families.
- [ ] A suspected concussion blocks the child from every lineup until a head coach clears it (tested end to end).

---

## Phase 6: Club support

**Ask Coach James first** whether contributions should be in the app at all.

**Builder tasks**
1. Tournament fund: campaign, target, items, totals in and still needed (no family names).
2. Equipment inventory and boot bank (sizes, requests, matching).
3. Needs list with "Share to Facebook" text.
4. Optional contributions, behind a per-programme switch: GCash QR, reference number, treasurer confirm, private waivers, polite reminders, end-of-season cleanup.

**Accepted when**
- [ ] Coach James says it saves time. If not, remove what is unused.

---

## Phase 7: Polish and scale

**Builder tasks**
1. TV link over a Supabase Realtime private channel with pairing code.
2. Filipino and Cebuano translations (volunteers translate, a coach checks).
3. Player 13+ read-only login, approved by a guardian.
4. Export a board or lineup as PNG (photos only with consent); GIF optional.
5. Season rollover; retention jobs; data export for the club.
6. Admin usage panel: weekly active coaches, availability reply rate, sessions planned, reviews done, minutes spread per match. Counts only, stored in our own database.
7. Handover pack: admin guide, recovery guide (restore from backup), "if Jan is unavailable" page.

**Accepted when**
- [ ] Another adult can follow the recovery guide and restore staging from a backup without help.

---

## Every phase: the release routine

1. Planner writes `docs/specs/phase-N.md` (prompt P2).
2. Builder builds on branch `phase-N`, opens a pull request, writes the handoff file (prompt B1).
3. Planner reviews the pull request against the spec and `CLAUDE.md` (prompt R1); Builder fixes.
4. Jan tests on a real phone using the handoff file; merges; the app deploys.
5. Coaches use it; Jan records a field test; problems go back through prompt F1.
6. Update `README.md` status table and `docs/decisions.md` if anything changed.
