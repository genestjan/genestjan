# RideWise: architecture and implementation plan

## 1. Where it lives

The repository is the genestjanramirez.com site (Next.js static export on GitHub Pages, with
standalone apps under `/invoices` and `/payroll`). RideWise follows the same pattern: a
self-contained app in `ridewise/`, built by the existing Pages workflow and copied to
`out/ridewise/`, served at **https://genestjanramirez.com/ridewise/**. The Next.js site is
untouched apart from excluding `ridewise/` from its TypeScript project.

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| UI | React 18, TypeScript, Vite, Tailwind, Lucide | Requested stack; fast on mid-range Android |
| Map | Leaflet + react-leaflet, OSM tiles (configurable) | Free, light, provider-agnostic |
| Routing | FOSSGIS OSRM bicycle profile (default, no key); openrouteservice via a Supabase Edge Function (optional) | ORS adds elevation, surface and road type but needs a private key, so it is proxied server-side |
| Places | OpenStreetMap via Overpass, 3 mirrors with backoff | Only free source of shops/water/clinics with licence to reuse |
| Geocoding | Nominatim (search on button press only, 1 req/s) | Usage policy |
| Weather | Open-Meteo (no key) | Hourly forecast + sunrise/sunset, 16 days |
| State | zustand persisted to IndexedDB (localStorage fallback) | Works offline, holds full route geometry |
| Sync | Supabase (optional), Postgres + PostGIS + RLS | Only if the owner configures it |
| PWA | vite-plugin-pwa (Workbox), app shell precache | Installable on Android and iOS |
| Routing (app) | HashRouter | Deep links work on static hosting |

### Provider evaluation (summary)

| Provider | Bike routing | Turn-by-turn | Elevation / surface | Places | Cost / limits | Mindanao coverage |
|---|---|---|---|---|---|---|
| FOSSGIS OSRM (routing.openstreetmap.de) | Yes (bike profile) | Yes (basic) | No | No | Free, fair use, no SLA | OSM roads; verified GenSan→Davao returns 135.1 km |
| openrouteservice | Yes (road/regular/mountain) | Yes | Yes / Yes | Limited POI API | Free tier ~2,000 directions/day, key required | OSM roads |
| GraphHopper | Yes | Yes | Yes (paid tiers) | No | Free tier small, commercial terms stricter | OSM roads |
| Google Directions | Bicycling mode not available in the Philippines | — | — | Places API is paid | Paid, key required | — |
| Overpass (OSM) | — | — | — | Yes, all tags incl. opening_hours | Free, public servers overloaded at times | Good for chains, weak for sari-sari stores |

Decision: OSRM by default so the app works with zero setup; ORS through the proxy when a key
is configured. Both sit behind `RoutingProvider` in `src/services/routing.ts`, so swapping
providers does not touch the UI or the scheduler.

## 3. Modules

```
src/
  types.ts              data model (plan, stop, candidate, session, checklist)
  config.ts             public env config (no secrets)
  lib/geo.ts            haversine, projection onto route, simplification, detour estimate
  lib/discovery.ts      OSM tag classification, de-duplication, corridor, scoring, Overpass query
  lib/schedule.ts       scheduling engine, warnings, stop suggestion (never invents places)
  lib/hours.ts          conservative opening_hours reader ("Hours not verified" when unsure)
  lib/time.ts           zone-aware local time (plans store wall-clock + IANA zone)
  lib/planOps.ts        pure plan edits (add/move/replace/verify/custom stop, route switch)
  lib/fatigue.ts        check-in advice and status (no diagnosis, never pressures)
  lib/reminders.ts      hydration/snack/supply reminders, snooze, disable, low-supply check
  lib/checklists.ts     pre-ride, pit stop, post-ride lists, safety-critical items
  lib/share.ts          read-only share links (plan compressed into URL fragment)
  services/*            routing, geocoding, places, weather, sync, fetch-with-retry
  store/                zustand store + IndexedDB storage
  pages/*               Dashboard, Plan wizard, Map, Schedule, Live, Checklists, History, Settings, Shared
supabase/               migration (PostGIS + RLS) and ORS proxy Edge Function
e2e/                    Playwright tests (Android-sized viewport)
```

## 4. Scheduling engine

For each non-skipped stop, in order:

```
segment_km   = |stop.route_km - prev.route_km| + prev.detour/2 + stop.detour/2
riding_min   = segment_km / speed * 60          (speed = agreed group pace)
buffer_min   = riding_min * delay_buffer%
arrival      = previous departure + riding + buffer   (or the recorded actual arrival)
departure    = arrival + stop duration + regroup time  (or the recorded actual departure)
finish       = last departure + final segment
```

Warnings: long segments vs. max riding time, supply gaps (danger when the map has nothing in
the stretch), listed-closed at ETA, reported-closed, unconfirmed fuel stations, outside the
corridor, duplicates, backwards order, departure-before-arrival, after sunset (when weather
data is loaded), next-day arrival, very long day, invalid speed/departure/route.

Suggestions walk the route at `min(preferred km, max minutes at pace)`, pick the best real
candidate in the window (category, distance off route, listed hours at ETA, lunch timing),
keep every rider-added or mandatory stop, and record a gap instead of inventing a stop.

## 5. Milestones

| # | Milestone | Status |
|---|---|---|
| 1 | Repo inspection, architecture, data model | Done |
| 2 | Geo, discovery, scheduling engine + unit tests | Done |
| 3 | Provider services with retry/mirrors + parsing tests | Done |
| 4 | UI: dashboard, wizard, map, schedule editor | Done |
| 5 | Live mode, fatigue, reminders, checklists, emergency panel | Done |
| 6 | Persistence (IndexedDB), history, export/import, share links | Done |
| 7 | PWA, icons, offline shell, site integration and CI | Done |
| 8 | Supabase schema, RLS, ORS proxy, optional sync | Written; not run against a live project |
| 9 | Live verification against public APIs from a real phone | **Pending (see README "Verification status")** |
| 10 | Future: GPX import/export, live group GPS, QR share, elevation-aware pacing, Filipino/Cebuano | Not started |
