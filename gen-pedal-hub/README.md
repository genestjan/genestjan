# Gen Pedal Hub

A cycling app: record a ride, see your week, look after your bike.

One codebase (Expo, React Native) produces both versions:

| Version | Where | How it is built |
|---|---|---|
| Android APK | `https://genestjanramirez.com/pedalhub/gen-pedal-hub.apk` | `.github/workflows/pedalhub-apk.yml` |
| Web app (iPhone, any browser) | `https://genestjanramirez.com/pedalhub/` | `.github/workflows/pages.yml` |

## What version 0.1 does

- Records a ride with GPS: speed, distance, time, average speed, climbing.
- On Android the ride keeps recording with the screen locked.
- Filters out bad GPS readings so distance is not inflated.
- Keeps an unfinished ride if the app is closed, and offers to resume it.
- Home screen: weekly goal, the week day by day, weeks-in-a-row streak.
- Ride history, ride summary with the route outline, personal bests.
- Bikes: distance per bike and care reminders by distance.
- Badges, emergency contact with an SOS text message, km or miles.
- No account. Everything is stored on the phone.

## Known limits

- The web version (iPhone) only records while the screen is on and the app is open.
  Apple does not let a web page use GPS in the background.
- The route is drawn as an outline. There is no map background yet.
- No community, clubs, events or route planner yet. These need a server.
- The APK is signed with the standard debug key. Fine for installing directly,
  not accepted by Google Play. A private signing key is needed before a store release.
- Background recording on Android has not been tested on a real phone yet.

## Commands

```bash
npm install
npm run web          # run in a browser
npm test             # ride maths and stats tests
npm run typecheck
npm run build:web    # web build into dist/
```

## Layout

```
src/app/         screens (Expo Router): tabs, record, ride/[id]
src/screens/     welcome screen
src/components/  shared UI, tab bar, route outline
src/lib/         ride maths (track.ts), stats, formatting, GPX export, tests
src/recorder.ts  GPS recording, pause, resume, crash recovery
src/store.ts     saved data (profile, rides, bikes)
src/theme.ts     colours and spacing
```
