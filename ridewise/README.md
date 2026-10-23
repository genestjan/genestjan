# RideWise: Smart Cycling Pit Stop Planner

Plan the ride, respect the rider, make every stop count.

RideWise plans long-distance rides for recreational groups: a real bicycle route, real places
along it from OpenStreetMap, a pit stop schedule built from your group's pace, and a simple
live mode for check-ins, reminders and bike checks. It ships pre-filled for
**Jollibee, General Santos City → Ecoland Bus Terminal (Davao City Overland Transport
Terminal)** and works for any route in the Philippines.

Live at **https://genestjanramirez.com/ridewise/** once this branch is merged into `main`.
Open it on a phone and choose *Add to Home screen* (Android Chrome) or *Share → Add to Home
Screen* (iPhone Safari) to install it.

## Quick start (development)

```bash
cd ridewise
npm install
cp .env.example .env.local   # optional; defaults work without any keys
npm run dev                  # http://localhost:5173/ridewise/
```

| Command | What it does |
|---|---|
| `npm test` | Unit and component tests (Vitest) |
| `npm run test:e2e` | Browser tests on an Android-sized viewport (Playwright; builds first) |
| `npm run typecheck` | TypeScript |
| `npm run build` | Production build to `dist/` |

## Configuration and credentials

Nothing is required. Every `VITE_` variable is bundled into the browser and is public.

| Variable | Needed? | How to get it |
|---|---|---|
| `VITE_OSRM_BIKE_URL` | No (defaults to FOSSGIS public server) | Self-host OSRM with the bicycle profile for heavy use |
| `VITE_OVERPASS_URLS` | No (3 public mirrors) | Comma-separated; self-host Overpass for heavy use |
| `VITE_NOMINATIM_URL` | No | Self-host or use a commercial Nominatim for heavy use |
| `VITE_OPEN_METEO_URL` | No | Commercial use needs an Open-Meteo plan |
| `VITE_TILE_URL`, `VITE_TILE_ATTRIBUTION` | No | For real traffic, use a tile provider (MapTiler, Stadia, Thunderforest) with a domain-restricted key |
| `VITE_ROUTE_PROXY_URL` | Optional | Deploy `supabase/functions/route-proxy` (below) to get elevation, surface and road-type data from openrouteservice |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Optional | Supabase project → Settings → API. Enables email sign-in and plan sync |
| `ORS_API_KEY` (server secret) | Only with the proxy | Free key at openrouteservice.org/dev → set with `supabase secrets set` |

### Optional: openrouteservice + account sync (Supabase)

1. Create a free project at supabase.com. Install the CLI: `npm i -g supabase`.
2. `cd ridewise && supabase link --project-ref <ref>`
3. `supabase db push` (applies `supabase/migrations`, PostGIS + Row Level Security).
4. `supabase secrets set ORS_API_KEY=<key> ALLOWED_ORIGIN=https://genestjanramirez.com`
5. `supabase functions deploy route-proxy --no-verify-jwt`
6. In Auth → URL configuration add `https://genestjanramirez.com/ridewise/` as a redirect URL.
7. Add `VITE_ROUTE_PROXY_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` as GitHub
   Actions variables and pass them as `env:` to the RideWise build step in
   `.github/workflows/pages.yml`.

Cost: free tiers cover a cycling club. Supabase free tier pauses after a week of no
activity; ORS free tier is about 2,000 route requests per day.

## Deployment

`.github/workflows/pages.yml` builds the Next.js site, then runs RideWise's tests and build
and copies `ridewise/dist` to `out/ridewise`. Pushing to `main` deploys. The app uses hash
routes (`/ridewise/#/schedule`), so no server rewrites are needed. To host elsewhere, build
with `RIDEWISE_BASE=/ npm run build` and serve `dist/` from any static host.

## How to use

1. **Plan My Ride** → step 1: search the start. OpenStreetMap lists six Jollibee branches in
   General Santos; RideWise lists them all and makes you choose. Search the destination
   ("Ecoland Terminal Davao" finds the Davao City Overland Transport Terminal).
2. **Calculate bicycle route** and compare the options. Times use your group pace.
3. Steps 2–5: ride style, optional private rider info, bike, stop preferences, group pace
   (slowest comfortable rider), regrouping.
4. **Find real stops and build my schedule**: searches OpenStreetMap within 1 km of the route
   (adjustable) and suggests stops. Gaps are flagged, never filled.
5. **Schedule**: edit durations, skip, reorder, replace, add a lunch stop, mark verified.
   Every later time recalculates. **Map**: browse places, drop a pin for an unmapped
   sari-sari store or water refill.
6. **Checklists** before you leave. **Ride** on the day: start, arrive, rest timer,
   check-ins, reminders, supplies, emergency help. **Share plan** sends a read-only link.

## What is real and what is estimated

| Shown | Source |
|---|---|
| Route line and distance | Routing engine (OSRM or ORS), with retrieval date |
| Places, names, hours, coordinates | OpenStreetMap via Overpass, labelled "OpenStreetMap listing, not verified" |
| User-added places | Labelled "User-submitted, unverified" until a rider confirms with a date |
| Opening status | Only "Listed hours say open/closed at ETA (not verified)" or "Hours not verified"; never "open now" |
| Detours | Estimate: 2 × straight-line distance × 1.3, labelled as estimate |
| Times | Estimates from distance ÷ group pace + buffer + stop durations |
| Weather, sunrise/sunset | Open-Meteo with retrieval time; "not verified" when unavailable |
| Sample ride | Real OSRM route geometry bundled from 2026-10-23, labelled demo data everywhere |

## Verification status (honest)

Verified during development (2026-10-23):

- Real OSRM bicycle route Jollibee (Digos-Makar Rd, Lagao) → DCOTT: **135.13 km**, 3,601
  points, plus a 292.8 km alternative. The geometry is bundled for the sample ride and a test
  checks our distance maths against OSRM's within 1% (we compute 135.58 km).
- Real Nominatim results: six Jollibee branches in GenSan; DCOTT at 7.05557, 125.60109.
- 76 unit/component tests and 7 end-to-end tests pass. The e2e tests use the real recorded
  route and geocoding responses; place-search results in e2e are synthetic and named
  "TEST …". Production build passes, and the full site builds with RideWise inside.

Not yet verified:

- **Live Overpass place search for this route.** The public Overpass server answered "at
  capacity" to every request from the development environment (including tiny queries), so
  the real list of stores along GenSan → Davao has not been seen. The app retries with
  backoff across three mirrors and tells the rider clearly if all are busy. First real test
  should be on a phone.
- Live calls from a phone browser to OSRM, Nominatim and Open-Meteo (CORS and rate limits
  behave differently from the server-side checks done here).
- Supabase sync, the migration and the ORS proxy have not been run against a live project.
- Background GPS: browsers pause location when the screen is off. RideWise says so and falls
  back to manual progress.

## Features

Implemented: dashboard; 5-step wizard with ambiguous-place selection and pick-on-map;
route comparison; interactive map with category markers, direction arrows, filters, legend,
corridor control, detail panel (source, coordinates, hours, detour, ETA, Google Maps / OSM
links); place discovery with dedupe, missing-coordinate handling, closed detection; custom
stops with photo/supplies/hours/confirmed date; scheduling engine with warnings and
suggestions; editable itinerary (durations, skip, reorder, replace, mandatory, backup,
notes, verify, lunch stop, regenerate); rest timer; live mode (start/pause/resume,
arrived, rest, check-ins, safety pause, reminders with ack/snooze/off, supplies, opt-in
GPS, emergency panel with 911 and Red Cross 143); three checklists with custom items and
safety-critical warnings; history; export/import; delete-all; read-only share links
without private data; weather and daylight; offline indicator and offline use of saved
plans; installable PWA.

Needs credentials: elevation/surface comparison (ORS key + proxy), account sync (Supabase).

Future: GPX import/export, live group GPS sharing, QR codes, elevation-aware pacing,
Filipino and Cebuano, maintenance logs, community stop reviews.

## Safety

RideWise is a planning aid. It does not diagnose, does not know road conditions, and never
asks a rider to keep going to protect the schedule. In an emergency call **911**.
