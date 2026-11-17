# Gen Pedal Hub

A cycling app: record rides, train, explore routes and ride with other people.

One codebase (Expo, React Native) produces both versions:

| Version | Where | How it is built |
|---|---|---|
| Android APK | `https://genestjanramirez.com/pedalhub/gen-pedal-hub.apk` | `.github/workflows/pedalhub-apk.yml` |
| Web app (iPhone, any browser) | `https://genestjanramirez.com/pedalhub/` | `.github/workflows/pages.yml` |

## Features

Works with no account and no internet (except where noted):

- **Ride tracker:** speed, average speed, distance, time, climbing, calories (estimate), ride history.
  On Android it keeps recording with the screen locked. Bad GPS readings are filtered out.
- **Map:** the route on a real map (OpenStreetMap, needs internet), live during the ride and on the summary.
- **Training:** three 8-week plans, a workout for each day, weekly targets, rest day reminders, weekly and monthly goals.
- **Progress:** 12-week and 6-month charts, comparison with the weeks before, records.
- **Motivation:** badges, weeks-in-a-row streak, four monthly challenges sized to the rider's goal.
- **Safety:** SOS text with a map link, drink reminders, danger alerts while riding.
- **Bikes:** distance per bike, care reminders by distance, repair log with cost.
- **Route finder:** keep a ride as a route, difficulty level, water and bike repair shops from OpenStreetMap.

Need the shared server (Supabase) and a free account:

- **Community:** rider pages, follow, posts with photos, likes, comments, groups.
- **Rankings:** top riders by week or month (distance, climbing, speed, longest ride), group rankings.
- **Challenges and competitions:** shared monthly challenges and rider-made competitions with a ranking.
- **Events:** create, sign up, participant list, race number, announcements, fee with payment reference.
- **Shared routes and danger reports.**

## Switching the shared server on

1. Create a Supabase project (free tier is enough to start).
2. Run `supabase/migrations/0001_pedal_hub.sql`, then `0002_pedal_hub_photos.sql`, in the project's SQL editor.
3. Put the project's URL and anon (public) key into `src/config.ts` as `DEFAULT_SUPABASE_URL` and
   `DEFAULT_SUPABASE_ANON_KEY`. Both are public values by design.
4. For sign-up without an email step, switch off "Confirm email" under Authentication, Sign In / Providers, Email.

All tables start with `ph_`, so the project can be shared with another app.

## Known limits

- The web version (iPhone) only records while the screen is on and the app is open.
  Apple does not let a web page use GPS in the background. Reminders on a locked phone are Android only.
- The event fee is paid outside the app (for example GCash). The rider types in the reference
  number and the organiser marks it paid. Paying inside the app needs a payment provider account.
- Rankings trust the phone's numbers, with limits on impossible rides. There is no stronger cheat check yet.
- Rankings use Philippine time for "this week" and "this month".
- Map pictures come from OpenStreetMap's public server, which is for light use. A busy app needs a tile provider.
- The APK is signed with the standard debug key. Fine for installing directly, not accepted by Google Play.
- Not yet tested on a real phone: locked-screen recording, notifications, photo picking.
- The shared server is live (Supabase project `gen-pedal-hub`, Singapore, free plan). Sign-up, profiles,
  rides, posts with photos, likes, comments, follows, rankings, group rankings and monthly challenges were
  tested against it. Events and shared routes were only tested against a local PostgreSQL.
- A free Supabase project pauses after a week with no use. Open the dashboard and click Restore if that happens.

## Commands

```bash
npm install
npm run web          # run in a browser
npm test             # unit tests (ride maths, stats, training, charts, map, places)
npm run typecheck
npm run build:web    # web build into dist/
```

Database rule tests (needs PostgreSQL): create a scratch database with an `auth.users` table, an
`auth.uid()` function and the `anon` and `authenticated` roles, apply `0001_pedal_hub.sql`, then run
`supabase/tests/rules.sql`.

## Layout

```
src/app/              screens (Expo Router): tabs, ride, route, rider, club, event, challenge and more
src/screens/          welcome screen and the four Community sections
src/components/       shared UI, tab bar, map, charts, lists
src/lib/              pure logic with tests: track, stats, training, analytics, calories, tiles, places
src/recorder.ts       GPS recording, pause, resume, crash recovery, drink reminders, danger alerts
src/backend.ts        everything that talks to the shared server
src/notify.ts         reminders on a locked phone (Android)
src/store.ts          data saved on the phone
supabase/             database schema and rule tests
```
