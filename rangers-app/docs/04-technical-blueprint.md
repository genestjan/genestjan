# 04. Technical blueprint

How the Rangers App is built. The Planner turns the relevant sections into each phase spec; the Builder follows them. Changes to anything here need an ADR in `docs/adr/`.

## 1. Architecture at a glance

```
                       app.rangersfc.net (GitHub Pages, static)
                ┌──────────────────────────────────────────────┐
 Phone / tablet │  React PWA (Vite)                              │
 / TV browser   │   ├─ UI: coach side, parent side, present mode │
                │   ├─ src/lib: pure logic (rotation, heat, ...) │
                │   ├─ Dexie (IndexedDB): on-device data + outbox│
                │   └─ Service worker: offline app shell         │
                └──────────────┬───────────────────────┬─────────┘
                               │ HTTPS (sync, reads)   │ HTTPS (forecast)
                     ┌─────────▼─────────┐     ┌───────▼────────┐
                     │ Supabase (Free)    │     │ Open-Meteo API  │
                     │  Auth (Google,     │     │ (no key)        │
                     │   email code)      │     └────────────────┘
                     │  Postgres + RLS    │
                     │  Storage (photos)  │──── Resend SMTP (login codes)
                     │  Edge Functions    │──── Web Push (browsers' push services)
                     │  pg_cron           │
                     └─────────▲──────────┘
                               │ weekly
                     GitHub Actions: keep-alive ping, encrypted backup (private repo)
```

Two Supabase projects on the free plan: **staging** (development and tests) and **production** (real families). Phase 1 uses neither; it runs entirely on the device.

## 2. Hosting and domain

- Repository `rangersfc/rangers-app` (public). GitHub Pages deploys the `dist/` folder through GitHub Actions.
- Custom domain **`app.rangersfc.net`**: a `CNAME` file in `public/` containing `app.rangersfc.net`, plus a DNS CNAME record at Onamae.com: host `app`, value `rangersfc.github.io` (the organisation's Pages host). Enforce HTTPS in the Pages settings.
- **Verify `rangersfc.net` in the GitHub organisation settings** (Pages, verified domains) so nobody else can claim a subdomain of it.
- Why a subdomain and not `rangersfc.net/app`: a separate origin keeps the app's login session in its own storage, away from any script on the public website; the service worker scope stays clean; and a broken app build can never take the club website offline.
- SPA routing on Pages: build copies `index.html` to `404.html`. The service worker serves the shell for all navigations once installed.
- Security headers: Pages cannot set headers, so `index.html` carries a Content Security Policy meta tag:
  `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://<project>.supabase.co; connect-src 'self' https://<project>.supabase.co wss://<project>.supabase.co https://api.open-meteo.com; frame-src https://www.youtube-nocookie.com; font-src 'self'; object-src 'none'; base-uri 'self'`.

## 3. Repository layout

```
rangers-app/
├── CLAUDE.md, README.md
├── docs/                      plan, specs/, adr/, handoffs
├── public/                    CNAME, icons (from the crest), robots.txt (Disallow: /)
├── src/
│   ├── app/                   routes, layouts, providers, error boundary
│   ├── components/            UI primitives (Button, Card, Sheet, Tabs, Toast, BigClock)
│   ├── styles/tokens.css      brand tokens, Club and Sun modes
│   ├── features/
│   │   ├── board/             engine/ (types, geometry, resolve, render), editor/, present/
│   │   ├── match/             plan/, live/, report/
│   │   ├── squad/
│   │   ├── schedule/          events, availability, attendance
│   │   ├── messages/          announcements, notes, share sheet
│   │   ├── training/          builder, run mode, drills, curriculum
│   │   ├── development/       profile, review, goals, recognition, badges
│   │   ├── safety/            heat, lightning, concussion, injuries, growth, emergency
│   │   ├── club-support/      fund, boot bank, contributions
│   │   ├── auth/              sign-in, invites, consent
│   │   └── admin/
│   ├── lib/                   PURE LOGIC, no React: fairShare.ts, rotation/, heatIndex.ts,
│   │                          growth.ts, rubric.ts, recognition.ts, fees.ts, time.ts, ids.ts
│   ├── data/                  db.ts (Dexie), sync/ (outbox, pull), supabase.ts, queries/
│   ├── content/               drills.json, strategies/*.json, rubric.json, curriculum.json,
│   │                          safety.json, values.json, schemas.ts (zod)
│   └── i18n/                  en.json (fil.json, ceb.json in Phase 7)
├── supabase/
│   ├── migrations/            numbered SQL files
│   ├── functions/             send-notifications/, ...
│   ├── tests/                 pgTAP files, one per table group
│   └── seed.sql               demo club only, invented names
├── e2e/                       Playwright specs and fixtures
└── .github/workflows/         ci.yml, deploy.yml, db.yml, keepalive.yml
```

## 4. Core logic (all in `src/lib/`, all unit tested)

### 4.1 Live fair share (from Hirðir)

```
fair(child, now)  = playingSecondsElapsed(now) × slotsOnField ÷ presentCount
played(child,now) = sum of the child's on-field intervals from the event log
owed(child, now)  = fair − played        (positive = owed time)
```
- `presentCount` excludes children marked away or who left.
- The bench is sorted by `owed` descending; show "owed N min" only when `owed ≥ 60 s`.
- Test vector: 8v8 (8 slots including the keeper), 12 present, 10 minutes played: `fair = 600 × 8 ÷ 12 = 400 s`. A child benched throughout is owed 6:40; a child on throughout is 3:20 ahead.

### 4.2 Rotation planner

**Inputs**: available players (not injured, not concussion-blocked) with `gkWilling`, `preferredPositions`, `seasonOwedMinutes`; format slots and formation positions; periods with minutes; sub mode (`rolling` every N minutes, or `breaks` only); locks (`on`, `off`, `gk`, `position`) per player per window; options: `gkChangesAtBreaksOnly` (default true), `rotatePositions` (default true for U12 and below), `carryOver` (`off` | `gentle` = 0.25 | `strong` = 0.5), seed (match id).

**Algorithm (greedy, deterministic)**
1. Split each period into windows of N minutes (the last may be shorter). Windows never cross periods.
2. Keeper per period: honour `gk` locks; otherwise rotate through `gkWilling` players, fewest keeper periods this season first.
3. For each window in order:
   - `target(p) = totalMatchMinutes × slots ÷ playerCount`
   - `priority(p) = target(p) − planned(p) + carryWeight × min(seasonOwedMinutes(p), 20) + (benchedLastWindow(p) ? bonus : 0)` where `bonus` is one window length.
   - Fixed: the keeper and `on` locks. Excluded: `off` locks.
   - Fill the remaining outfield slots with the highest priority; ties by fewer windows played, then a stable hash of (seed, playerId).
4. Positions: children staying on keep their position within a period. At period breaks (and for newcomers), assign positions with the Hungarian algorithm on a cost matrix: preference cost, plus a variety bonus for positions the child has played least this season when `rotatePositions` is on.
5. Output: a grid (windows by players: `GK`, a position code, or `bench`), planned minutes per player, and the spread (max minus min).

**Live re-plan**: when a child arrives late, leaves, is injured, or the coach swaps off-plan, re-run from the current window using actual minutes from the event log for the past.

**Properties tested** (property-based tests with generated squads):
- Every window has exactly `slots` players, one of them in goal when the format has keepers.
- No lock is violated; blocked players never appear.
- With no locks, keeper rotation by period, and `slots < players ≤ 2 × slots`, the spread is at most one window length.
- Nobody is benched in two consecutive windows when `players ≤ 2 × slots`.
- Same inputs, same plan.

Reference: BenchAssist uses a MIP solver (HiGHS WASM). Only consider that if the greedy planner fails these properties on real squads.

### 4.3 Heat index (`heatIndex.ts`)

NOAA Rothfusz regression, as PAGASA uses heat index:
1. `T` = temperature in °F, `RH` = relative humidity %.
2. `simple = 0.5 × (T + 61 + (T − 68) × 1.2 + RH × 0.094)`. If `(simple + T) ÷ 2 < 80`, use `simple`.
3. Otherwise `HI = −42.379 + 2.04901523T + 10.14333127RH − 0.22475541T·RH − 0.00683783T² − 0.05481717RH² + 0.00122874T²RH + 0.00085282T·RH² − 0.00000199T²RH²`, then:
   - if `RH < 13` and `80 ≤ T ≤ 112`: subtract `((13 − RH) ÷ 4) × √((17 − |T − 95|) ÷ 17)`
   - if `RH > 85` and `80 ≤ T ≤ 87`: add `((RH − 85) ÷ 10) × ((87 − T) ÷ 5)`
4. Convert to °C and **round to the nearest whole degree** (PAGASA reports whole degrees), then categorise with thresholds from `content/safety.json`: below 27 Normal, 27 to 32 Caution, 33 to 41 Extreme caution, 42 to 51 Danger, 52+ Extreme danger.

Test vectors (°C, RH → rounded HI, category):

| Temp | RH | HI | Category |
|---|---|---|---|
| 25 | 60 | 25 | Normal |
| 28 | 70 | 31 | Caution |
| 30 | 60 | 33 | Extreme caution |
| 30 | 75 | 36 | Extreme caution |
| 32 | 65 | 39 | Extreme caution |
| 34 | 60 | 42 | Danger |
| 33 | 70 | 44 | Danger |
| 31 | 90 | 45 | Danger |
| 36 | 60 | 48 | Danger |
| 38 | 10 | 35 | Extreme caution |

Weather source: Open-Meteo forecast API, hourly `temperature_2m`, `relative_humidity_2m`, `precipitation_probability`, `weather_code`, `cape` for the venue's coordinates, `timezone=Asia/Manila`. Thunderstorm risk when any hour in the event has `weather_code` 95, 96 or 99, or `cape ≥ 1000` with `precipitation_probability ≥ 40` **[threshold to tune]**. Cache per venue and date for 3 hours on the device. Never more than one request per event per device per 3 hours.

### 4.4 Growth velocity (`growth.ts`)
- Use the latest measurement and the most recent earlier one at least 56 days before it.
- `velocity = (h2 − h1) ÷ (days ÷ 365.25)` in cm a year.
- Flag **growth spurt** if `velocity ≥ 7.2` (threshold in `safety.json`). Ask to re-measure if `velocity < −1` or `> 15`.
- Test vectors: 140.0 cm then 144.0 cm 181 days later is 8.07 cm a year (flag). 140.0 then 141.5 after 182 days is 3.01 (no flag). Two measurements 40 days apart: not enough data.

### 4.5 Development summary (`rubric.ts`)
- Strengths: the two highest levels; ties broken by most improved since last term, then by the coach's order.
- Working on: the two lowest, ignoring "Not seen".
- Fastest developing: the skill with the largest rise since the previous review; omitted if nothing rose.
- Never compute totals, averages or ranks across children. A unit test asserts there is no exported function that takes more than one child's ratings.

### 4.6 Recognition coverage (`recognition.ts`)
Children in the team with no recognition in the last 42 days, ordered by longest gap. Coach-only.

### 4.7 Contribution states (`fees.ts`)
`due → submitted → paid`; `submitted → rejected → due`; `due → waived` (private). Only coaches with the treasurer role or the head coach can move to `paid`, `rejected` or `waived`. GCash reference numbers are 13 digits; validate format only.

## 5. Board engine (`src/features/board/engine/`)

Ideas from Pitchboard (MIT) and BoardX; our own simpler implementation in SVG.

### 5.1 Document schema (zod-validated, versioned)

```ts
type FormatId = '4v4' | '5v5' | 'futsal' | '7v7' | '8v8' | '9v9' | '11v11';
type AgeBand = 'U8' | 'U10' | 'U12' | 'U14' | 'U16';

interface BoardDoc {
  schemaVersion: 1;
  id: string;                       // uuid
  name: string;
  kind: 'shape' | 'move' | 'set_piece' | 'drill' | 'halftime';
  format: FormatId;
  pitchId?: string;                 // a saved club pitch (e.g. Yam 1); else format default
  view: 'full' | 'half' | 'final_third';
  ageBands: AgeBand[];
  pieces: Piece[];                  // defined once for the whole doc
  steps: Step[];                    // at least one
  whyKids?: string;                 // max 2 sentences, shown to kids
  coachNote?: string;               // coach only
  tags?: string[];
  timing?: { moveMs: number; holdMs: number };   // defaults 1200 / 1500
  presetKey?: string;               // set on shipped presets (read-only originals)
  derivedFrom?: string;             // id of the preset or doc it was copied from
  updatedAt: string;                // ISO
}

interface Piece {
  id: string;
  kind: 'us' | 'them' | 'ball' | 'cone' | 'goal' | 'marker';
  slot?: string;                    // 'GK','LB','CB','RB','LM','CM','RM','ST'... for fill-from-lineup
  label?: string;                   // first name or role text
  number?: number;
}

interface Step {
  id: string;
  name?: string;
  positions: Record<string, { x: number; y: number }>;  // every non-ball piece, metres
  ballWith?: string;                // piece id carrying the ball (a pass = carrier change)
  ballAt?: { x: number; y: number };// only when no carrier (loose ball, set piece spot)
  arrows: Arrow[];
  zones: Zone[];
  strokes: Stroke[];                // pen, from perfect-freehand
  note?: string;
}

interface Arrow { id: string; type: 'run' | 'pass' | 'dribble' | 'shot';
  from: { pieceId?: string; x?: number; y?: number }; to: { x: number; y: number }; bend?: number; }
interface Zone { id: string; shape: 'rect' | 'ellipse' | 'poly'; points: { x: number; y: number }[]; label?: string; }
interface Stroke { id: string; points: [number, number, number][]; }
```

Rules: optional fields default to old behaviour so older boards always open; a breaking change bumps `schemaVersion` with a migration function and tests.

### 5.2 Coordinates and rendering
- Document units are **metres**, origin at the top-left of the pitch in horizontal orientation, `x` along the length. Pitch dimensions come from `content/pitches.json` or the club's saved pitch.
- One SVG with `viewBox` in metres; orientation (vertical on phones in portrait, horizontal on TV and landscape) is a transform, not a different document.
- `resolveStep(doc, t)` is a pure function returning interpolated positions, ball position and visible arrows at time `t`. Rendering components only draw its output. This keeps editor, present mode and future export identical.
- Easing `easeInOutCubic`; ball sits 0.6 m ahead of its carrier; on a carrier change the ball travels along the pass arrow.
- Piece size scales with the view: at least 1.2 m radius or 2.5% of the short side, whichever is larger; numbers in Bebas Neue.
- Colours from tokens; our pieces red circles with white outline; opponents cream rounded squares; never red against green.

### 5.3 Interaction
- Pointer Events with pointer capture; hit area at least 24 px; optional snap to 0.5 m.
- Tools: select/move, run, pass, dribble, shot, zone, pen, eraser; undo/redo (Immer patches, 50 levels).
- Steps bar: add step (copies the current one), duplicate, delete, reorder, play/pause, speed.
- Fill from lineup: replace `us` pieces by matching `slot` to today's lineup positions.
- Performance: no React re-render of every piece on drag; move the dragged element by transform and commit on pointer up.

### 5.4 Present mode
- Route `/present/:matchId` (Phase 1) shows the Match Day slides full-screen, Fullscreen API where allowed, Screen Wake Lock to keep the display on.
- Keyboard and remote: left/right arrows change slides, space plays or pauses.
- Phase 7 adds **TV link**: the TV opens `app.rangersfc.net/tv`, shows a 6-character pairing code, the coach enters it, and slides are controlled over a Supabase Realtime private channel. Only kid-facing data (first names, numbers, slide content) is sent, and only after pairing.

## 6. Offline data and sync

### 6.1 On-device store (Dexie)
Tables mirror the server tables the coach needs offline: `programmes`, `teams`, `players` (kid-facing fields plus emergency info for the coach's own teams), `strategies`, `drills`, `sessions`, `events`, `matches`, `match_events`, `injuries`, plus `outbox` and `meta` (last pulled time per table).

### 6.2 Writes
1. Every write goes to Dexie and appends an `outbox` row `{id, table, op: 'upsert' | 'delete', row, createdAt, attempts, lastError}`.
2. A sync worker runs when the app is online and signed in: push in order; upsert by `id` (client-generated UUID, so retries are safe); remove on success.
3. Network error: retry with backoff (5 s, 30 s, 2 min, 10 min). Validation or permission error: keep the row, show it on a "Sync problems" screen with a plain explanation.

### 6.3 Reads
- Pull per table: rows with `updated_at > lastPulledAt − 5 s`, limited to the coach's teams (RLS enforces this anyway).
- Deletes are soft (`deleted_at`), so pulls see them.
- Conflicts: last write wins per row by server `updated_at` (set by trigger). Match events are append-only and never conflict.
- Parent screens use TanStack Query with a persisted cache; they do not need the outbox (except availability replies, which queue offline).

### 6.4 Phase 1 local-only mode and migration
Phase 1 uses the same Dexie schema with a local placeholder club. When a coach signs in for the first time (Phase 2), the app offers "Upload my squad, boards and match reports to <team>", maps local IDs to the team, and pushes through the outbox. Backup and restore to a JSON file exist from Phase 1 so nothing is lost before accounts exist.

## 7. Data model (Supabase Postgres)

Every table: `id uuid primary key`, `created_at`, `updated_at` (trigger), `deleted_at` (where soft delete applies). RLS enabled on every table; no table is readable by `anon`.

### 7.1 Tables

| Table | Key columns | Read | Write |
|---|---|---|---|
| `programmes` | name, crest_path, colours, values (jsonb), contact | Members of the club | Admin |
| `seasons` | name, starts_on, ends_on, terms (jsonb) | Members | Admin |
| `teams` | programme_id, season_id, name, age_band, default_format | Members of the programme | Admin, head coach |
| `profiles` | user id, display_name, locale | Self; coaches of the user's children's teams (name only) | Self |
| `memberships` | user_id, programme_id, role (`admin`, `head_coach`, `coach`, `treasurer`, `parent`, `player`), status | Self; admins | Admin (coaches), system (parents via invite) |
| `team_staff` | team_id, user_id, role | Team members | Admin, head coach |
| `players` | first_name, nickname, last_name, birth_date, shirt_number, preferred_positions, gk_willing, photo_path, status, left_at | Coaches of the player's teams; the player's guardians; the player (13+) | Coaches of the team; guardians (limited fields) |
| `player_private` | player_id, emergency_contacts (jsonb), allergies, inhaler, condition_note | Coaches of the team; guardians | Guardians; head coach |
| `player_guardians` | player_id, user_id, relation | Guardians of that player; coaches of the team | System via invite; admin |
| `player_teams` | player_id, team_id, season_id | Coaches; guardians | Coaches |
| `consents` | player_id, user_id, kind, granted, notice_version, granted_at | Guardian; coaches (read) | Guardian |
| `invites` | kind (`family`, `coach`), token_hash, player_id or role, team_id, created_by, expires_at, used_at, used_by | Creator; admin | Coach (create); system (redeem) |
| `venues` | name, lat, lng, map_url, hospital, shelter_note | Members | Coaches |
| `events` | team_id, type, starts_at, ends_at, venue_id, opponent, details, recurrence_id, status | Team coaches; guardians of team players | Team coaches |
| `availability` | event_id, player_id, status, note, responded_by | Team coaches; that player's guardians | Guardians; team coaches |
| `attendance` | event_id, player_id, present | Team coaches; that player's guardians | Team coaches |
| `matches` | event_id, format, periods (jsonb), sub_mode, plan (jsonb), status | Team coaches | Team coaches |
| `match_events` | match_id, type, player_id, at, payload, device_id, created_by | Team coaches; guardians see only derived minutes for their child | Team coaches, **insert only** |
| `player_match_minutes` (view or table filled at match end) | match_id, player_id, minutes, positions | Coaches; that player's guardians | System |
| `strategies` | owner_id, programme_id, kind, doc (jsonb BoardDoc), is_preset | Coaches of the programme | Owner; head coach |
| `drills` | programme_id, fields per playbook, diagram_strategy_id, reviewed_by | Coaches | Coaches; head coach marks reviewed |
| `sessions` | team_id, event_id, theme, blocks (jsonb), reflection (jsonb) | Team coaches | Team coaches |
| `assessments` | player_id, team_id, term, ratings (jsonb), strengths, working_on, family_comment, coach_note, published_at | Coaches of team (all fields); guardians and player **only published, without coach_note** (via a view) | Team coaches |
| `self_assessments` | player_id, term, ratings | Player; guardians; coaches | Player (13+); guardian |
| `goals` | player_id, text, status, reviewed_at | Coaches; guardians; player | Coaches; player |
| `recognitions` | player_id, event_id, value_key, note, by | Coaches; that player's family | Coaches |
| `badge_awards` | player_id, badge_key, by, at, note | Coaches; that player's family | Coaches |
| `growth_measurements` | player_id, measured_on, height_cm, by | Coaches; family | Coaches |
| `wellness_checks` | player_id, on, sleep, soreness, mood | Coaches; player; family | Player (13+); coaches |
| `injuries` | player_id, event_id, kind, body_part, notes, concussion_suspected, rtp_status, cleared_on, cleared_by_note | Coaches of team; family | Coaches; clearance only head coach or admin |
| `announcements` | scope (team or programme or club), title, body, author_id, pinned | Members in scope | Coaches |
| `announcement_reads` | announcement_id, user_id, read_at | Author; self | Self |
| `direct_notes` | player_id, author_id, body, reply_to | Coaches of team; guardians of that player | Coaches; guardians (reply) |
| `push_subscriptions` | user_id, endpoint, p256dh, auth | Self | Self |
| `notification_queue` | user_id, kind, payload, send_at, sent_at, dedupe_key (unique) | None (service only) | System |
| `fund_campaigns`, `fund_entries` | tournament, target, items; amounts (no family names) | Members | Head coach, treasurer |
| `equipment_items`, `boot_requests` | item, size, quantity; player_id, size, status | Coaches (boot requests: coaches and that family) | Coaches; guardians (own request) |
| `charges`, `payments` | player_id, amount, due_on, status, waived (private); reference_no, submitted_by, confirmed_by | Treasurer and head coach; that player's guardians | Guardians (submit); treasurer (confirm) |
| `audit_log` | actor, table, row_id, action, at | Admin | Triggers only |

### 7.2 Access helper functions (SQL, `security definer`, `set search_path = ''`)

```
is_admin(programme uuid) → bool
is_team_coach(team uuid) → bool              -- head coach or coach on team_staff
coaches_player(player uuid) → bool           -- any team the player is in this season
is_guardian(player uuid) → bool
is_player_self(player uuid) → bool
is_head_coach_of_player(player uuid) → bool
```

Example policy (the Builder writes all policies in this style):

```sql
create policy "guardians and coaches read players"
on public.players for select to authenticated
using ( public.is_guardian(id) or public.coaches_player(id) or public.is_player_self(id) );
```

### 7.3 pgTAP tests (minimum set per table)
- Parent A cannot select, update or delete Parent B's child, consents, assessments, injuries, charges.
- A coach of U10 cannot read U12 players' private data.
- A guardian cannot read `coach_note` or unpublished assessments.
- Nobody but the head coach or admin can clear a concussion block.
- `match_events` cannot be updated or deleted by anyone.
- `anon` can read nothing.

### 7.4 Storage
- Bucket `player-photos` (private): path `programme/player/uuid.webp`, 256 px WebP from the device, max 100 KB; read through signed URLs for coaches and guardians, and only when photo consent is on.
- Bucket `club-assets` (public): crests, values artwork.
- Bucket `payment-proofs` (private, Phase 6, only if the club wants proofs): deleted by a scheduled job at season end.

## 8. Authentication and invites

- **Google sign-in** (Supabase Auth). Google Cloud OAuth client for `app.rangersfc.net`; **publish the consent screen to production** (basic email and profile scopes; testing mode caps users and expires sessions).
- **Email one-time code** (6 digits) as the fallback. Supabase's built-in email is for testing only; configure **custom SMTP with Resend** (free 100 a day) sending from `no-reply@rangersfc.net` (SPF and DKIM records added at Onamae.com). Use codes, not magic links, because links opened in Messenger's in-app browser land in the wrong browser.
- PKCE flow; redirect URLs for production and staging registered in Supabase.
- **Family invite**: a coach creates an invite for one child; the app shows a link `app.rangersfc.net/join#<token>` (token in the fragment so it never reaches server logs) and a share button. Redemption RPC `redeem_family_invite(token)`: hash, check unused and unexpired, rate limit (10 attempts per user per hour), link guardian, mark used, return the child's first name for confirmation. If the parent is not signed in yet, the app keeps the token in `sessionStorage` through the sign-in redirect, then redeems it and clears it.
- **Coach invite**: admin creates; after sign-in the membership is `pending` until the admin approves.
- Session length: Supabase default refresh; the coach device keeps working offline with the last session.

## 9. Notifications

- **Web Push** with VAPID keys. Subscriptions saved per device in `push_subscriptions`. Permission is asked only after the parent taps "Turn on reminders" (required on iPhone, where it works only after Add to Home Screen; the app shows a short guide).
- **Queue**: SQL function `enqueue_event_reminders()` runs hourly by pg_cron: events starting in 20 to 28 hours, one row per guardian per event (`dedupe_key` unique). A second job enqueues match reminders 2 hours before.
- **Sender**: Edge Function `send-notifications`, called every 10 minutes by pg_cron through pg_net, sends due rows, removes dead subscriptions (HTTP 404 or 410), marks `sent_at`. **First task of Phase 3 is a spike** to confirm a Web Push library runs on the Supabase Edge runtime (candidates: `npm:web-push`, `jsr:@negrel/webpush`).
- **Share sheet**: Web Share API (`navigator.share`) with a plain-text message; fallback copies to clipboard. This is the main channel to Messenger groups.

## 10. Security checklist

- [ ] RLS on every table; pgTAP suite in CI.
- [ ] Only the anon key in the frontend; secrets in Supabase and GitHub secrets.
- [ ] CSP meta tag; no inline scripts; no third-party scripts.
- [ ] Invite tokens hashed, single-use, expiring, rate limited.
- [ ] Uploads: type and size checked on device and by storage policy.
- [ ] `robots.txt` disallows all; `noindex` meta.
- [ ] Audit log on `injuries`, `assessments`, `player_private`, `charges`, `memberships`.
- [ ] Retention jobs: players who left more than 12 months ago are deleted (with their records); payment proofs at season end; notification queue after 30 days.
- [ ] A data export per child (JSON) and a deletion request flow.
- [ ] Dependency audit in CI (`npm audit --omit=dev`, fail on high).

## 11. Testing strategy

| Layer | Tool | What |
|---|---|---|
| Pure logic | Vitest (+ fast-check for properties) | Fair share, rotation properties, heat index vectors, growth vectors, rubric rules, fee states, BoardDoc migrations |
| Components | Vitest + Testing Library | Forms, board tools, slides, offline banners |
| End to end | Playwright | Phone 390x844, tablet 1180x820, TV 1920x1080; offline mode; 4x CPU throttle on the board; axe accessibility checks |
| Database | pgTAP via `supabase test db` | Every access rule in 7.3 |
| Manual | Field-test checklist in `05-build-roadmap.md` | Real phones, real sun, real kids |

Demo data: one invented club ("Rangers Demo") with 16 invented children, used in tests, screenshots and the "Load demo team" button.

## 12. Environments and CI/CD

| Environment | Where | Data |
|---|---|---|
| Local | `npm run dev`; optional `supabase start` (Docker) | Demo only |
| Staging | Supabase project `rangers-staging`; run the app with `npm run dev` or `npm run preview` pointed at staging | Demo only |
| Production | Supabase project `rangers-prod`; `app.rangersfc.net` | Real families |

GitHub Actions:
- `ci.yml` (pull requests): install, typecheck, lint, unit tests, build, size check, Playwright; a second job runs `supabase start`, applies migrations and runs pgTAP.
- `deploy.yml` (push to `main`): build with repository variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, copy `404.html`, deploy to Pages.
- `db.yml` (manual): `supabase db push` to staging, then to production through a GitHub environment that needs Jan's approval.
- `keepalive.yml` (weekly): calls a tiny `ping()` RPC on both projects so the free plan does not pause. Note: GitHub turns off scheduled workflows in repositories with no activity for 60 days; any commit re-enables them, and the admin screen shows "last ping".
- Backups run from a **private** repository `rangersfc/rangers-app-backups`: weekly `supabase db dump`, encrypted with `age` to a public key whose private half is held by Jan and the co-admin offline; keep the last 12. Admin screen shows "last backup".

## 13. Performance budgets

| Item | Budget |
|---|---|
| Parent routes JavaScript (gzipped) | 250 KB |
| Coach routes JavaScript (gzipped, lazy-loaded features) | 450 KB |
| Fonts | Two woff2 subsets (Latin), under 80 KB total |
| Board drag | No long tasks over 50 ms with 4x CPU throttle |
| Repeat parent visit data | Under 200 KB |

## 14. Initial ADRs (the Planner writes these in Phase 0)

1. Subdomain `app.rangersfc.net` on GitHub Pages, separate repository.
2. Supabase (Postgres and RLS) over Firebase: relational data, SQL policies, testable with pgTAP.
3. SVG board engine over Konva.
4. Local-first with Dexie and an outbox; append-only match events.
5. Greedy rotation planner first; optimiser only if properties fail.
6. Google sign-in plus email code; no passwords, no SMS.
7. Web Push plus share-to-Messenger; no in-app chat.
8. Words-based development levels; no cross-child comparisons in code.
