# GenDrive benchmark: Overdrive, Electro and the open-source BYD scene

Research date: 31 October 2026. Sources are linked at the end.

## The short version

- **Overdrive is free and open source (MIT)**, updated almost weekly (v57.0 on
  23 Oct 2026). It is a sentry/dashcam powerhouse that grew into vehicle control,
  automations, maps, widgets and Home Assistant. Its weak spots: it is built for
  enthusiasts (ADB setup, tunnels, daemons, a web companion), and everyday driving
  comfort (music, lyrics, a simple home screen) is not its focus.
- **Electro is paid** (about R$200 a year, 7-day trial), Brazilian, closed source.
  Its pitch is a polished phone + car pair: live telemetry, remote cameras,
  trips, sentry/dashcam, MQTT/ABRP, remote seat settings and smart alerts.
- **GenDrive's lane:** the best *daily driving* experience on the car screen. A calm
  home screen, music with synced lyrics, a talking assistant, Google Maps handoff,
  trip costs and savings in pesos, an app hub that installs other apps, and a
  safe video rule. Copying Overdrive's camera stack is not the plan; it is MIT, so
  parts can be adopted later with credit, and it can run alongside GenDrive meanwhile.

## Feature matrix

✅ has it · ◐ partly · ❌ no · 🗺 planned for GenDrive

| Area | Feature | Overdrive | Electro | GenDrive v0.1 |
|---|---|---|---|---|
| **Home screen** | Car-screen home / launcher | ◐ home screen + app launcher | ◐ dashboard widget | ✅ landscape and portrait, driver-side rail, optional home-screen mode |
| | Simplifies itself while driving | ❌ | ❌ | ✅ |
| | Right-hand-drive layout | ❌ | ❌ | ✅ |
| | Light, dark, automatic theme | ✅ | ◐ | ✅ |
| **Vehicle data** | Speed, gear, battery %, range | ✅ | ✅ | ✅ |
| | Tyre pressures | ✅ | ✅ | ✅ on a car drawing, with low warning |
| | Charging power, time left, battery temp | ✅ | ✅ | ✅ |
| | Battery health (SOH), cell temps, torque/power charts | ✅ | ✅ | 🗺 |
| | Demo mode for phones and showrooms | ❌ | ❌ | ✅ |
| **Trips and money** | Automatic trip log | ✅ (Driving DNA scores) | ✅ | ✅ |
| | kWh/100 km per trip | ✅ | ✅ | ✅ |
| | Cost per trip and **savings vs petrol** | ◐ (currency only) | ❌ | ✅ in ₱ |
| | Charging sessions with cost | ✅ | ◐ | ✅ AC/DC detected |
| | Week-over-week efficiency coaching | ◐ (scores) | ❌ | ✅ |
| **Music** | Now playing + controls for any app | ❌ | ❌ | ✅ |
| | **Synced lyrics** (karaoke) | ❌ | ❌ | ✅ (current + next line only while moving) |
| **Navigation** | Google Maps | ◐ own map, Google tiles with own key (EEA only) | ❌ | ✅ hands off to the real Google Maps app |
| | Next-turn card on the dashboard | ✅ (own nav) | ❌ | ✅ read from Google Maps / Waze |
| | Saved places, nearby search | ✅ | ❌ | ✅ |
| | Road-hazard alerts (RoadSense) | ✅ | ❌ | ❌ |
| | Cluster / HUD projection | ✅ | ❌ | 🗺 |
| **Voice** | Spoken greeting and status | ❌ | ❌ | ✅ |
| | Offline voice commands | ✅ (wake word, keyword spotting) | ❌ | ✅ (push-to-talk) |
| | Conversational AI (Gemini, own key) | ❌ | ❌ | ✅ with actions: navigate, music, apps |
| | Spoken trip/charging summaries and warnings | ❌ | ◐ (phone notifications) | ✅ |
| | Steering-wheel button / wake word | ✅ | ❌ | 🗺 |
| **Apps** | Install APKs from the car | ◐ (ADB shell) | ❌ | ✅ Android installer + ADB installer |
| | Curated app list (Aurora Store, Spotify, Waze…) | ❌ | ❌ | ✅ |
| | One-tap permission setup via ADB | ◐ | ❌ | ✅ |
| **Video** | Video apps while driving | n/a | n/a | ✅ sound while moving, picture in Park |
| **Security cameras** | Sentry mode, motion/AI detection | ✅ (YOLO) | ✅ | ❌ (run Overdrive alongside) |
| | Dashcam (incl. OEM dashcam) | ✅ | ✅ | ❌ |
| | Live view from anywhere, two-way audio | ✅ (tunnels) | ✅ (P2P) | ❌ |
| | Blind-spot camera view | ✅ (closed libod.so) | ❌ | ❌ |
| **Remote and integrations** | Phone companion app | ✅ web app | ✅ PWA + QR pairing | 🗺 |
| | Home Assistant / MQTT | ✅ two-way | ✅ | 🗺 |
| | ABRP telemetry | ✅ | ✅ | 🗺 |
| | Telegram alerts | ✅ | ❌ | ❌ |
| **Control** | Climate, windows, seats, lights, ADAS toggles | ✅ | ◐ (seats, auto heat/vent) | ❌ read only by design in v0.1 |
| | Automations (if/then rules) | ✅ | ◐ | 🗺 (parked-only actions first) |
| | Key mapping | ✅ | ❌ | 🗺 |
| **Business** | Price | Free | ~R$200/yr | your call |
| | Source | MIT (plus a closed libod.so, AGPL YOLO model, GPL sing-box) | Closed | Your repo |
| | Accounts / cloud | None | Phone pairing, P2P | None |

## What I changed from the original request, and why

| You asked for | What GenDrive does | Why |
|---|---|---|
| Video plays while driving | Sound keeps playing while moving; picture returns in **P** | The most dangerous screen use there is. Philippine law (RA 10913) bans drivers watching movies; a 2017 DOTr working group said built-in screens may be outside it, so the legal side is unsettled, but the risk to your users and your name is not. |
| JARVIS's voice | "Gen", an original calm British butler persona, renameable | JARVIS is Paul Bettany's voice and a Marvel character. Cloning either invites takedowns. The feel comes from the style, which is ours. |
| Plug into BYD's own voice assistant | GenDrive has its own assistant and mic button | BYD's assistant is closed and has no add-on interface. The steering-wheel button can be captured later (Overdrive does it; MIT). |
| All Google Maps features inside the app | Hands off to the real Google Maps app, reads its next-turn notification | Google's Maps Platform terms ban embedding in car head units outside the EEA. The real app is the only way to get every feature anyway. |
| The app unlocks third-party installs | GenDrive installs other apps once it is on the car (Android installer or ADB) | To install GenDrive at all, the car must already allow one install. GenDrive then makes every later install easy. |
| Spotify with lyrics | Works with Spotify and any music app; lyrics from LRCLIB | Spotify has no public lyrics API. LRCLIB is free with no key. |

## Risks and blind spots

1. **Name clash.** "GenDrive" is Plug Power's registered product line
   (GenDrive® hydrogen fuel-cell systems for electric forklifts and other industrial
   vehicles), close to cars. Fine for a personal app; before selling it, run a
   trademark search (IPOPHL and USPTO) or pick a new name.
2. **BYD firmware updates** can block installs or change the car API. Community
   reports show BYD tightening this since firmware 2407. Expect to re-test after
   every BYD update.
3. **DiLink 5** (Android 13/14) uses a different car SDK. GenDrive's car data is
   aimed at DiLink 3 first (community-proven method); DiLink 5 shows the demo drive
   until it is added. Overdrive has a DiLink 5 path (MIT) to learn from.
4. **Warranty.** BYD warns that unofficial apps may affect the infotainment warranty.
   GenDrive is read only and never touches driving systems, which keeps the risk low.
5. **Lyrics copyright.** LRCLIB is fine for personal use. If you sell GenDrive,
   license lyrics (Musixmatch or LyricFind) or switch lyrics off in the paid version.
6. **Gemini costs and privacy.** Each owner uses their own key. Light use usually
   fits Google's free tier, but free-tier data may be used by Google; say so plainly.
7. **Competing with a free Overdrive.** Don't compete on cameras. Compete on daily
   comfort, the assistant, peso savings and a setup that a non-technical owner can
   finish.
8. **Google services.** Most BYD units lack Google Play services, so Google Maps
   sign-in, YouTube and YouTube Music may be limited. Aurora Store installs them;
   some features may still need Google Play services.

## Open-source projects worth knowing

| Project | What it is | Licence | Use for GenDrive |
|---|---|---|---|
| [yash-srivastava/Overdrive-release](https://github.com/yash-srivastava/Overdrive-release) | Full source of Overdrive | MIT (with bundled GPL/AGPL/closed parts) | Method names for car data; later: cameras, key mapping, DiLink 5 |
| [wheregoes/byd-dolphin-hacking](https://github.com/wheregoes/byd-dolphin-hacking) | DiLink 3 reverse-engineering notes | No licence (read only, facts used) | Install folder names, car API map, ADB steps |
| [wheregoes/byd-apps](https://github.com/wheregoes/byd-apps) | Small BYD apps (Cabin, sounds) | No licence | Confirmed the permission and targetSdk pattern |
| [DottoreTozzi/BYD-ADB-Unlock](https://github.com/DottoreTozzi/BYD-ADB-Unlock) | Keeps ADB switched on after reboots | MIT | Recommend alongside GenDrive's ADB features |
| [shihabal3amri/DiAuto](https://github.com/shihabal3amri/DiAuto) | Android Auto receiver on the BYD screen | AGPL-3.0 | Recommend, don't copy (AGPL would force GenDrive open) |
| [mobile-dev-inc/dadb](https://github.com/mobile-dev-inc/dadb) | ADB client in Kotlin | Apache-2.0 | Used for one-tap setup and ADB installs |
| [LRCLIB](https://lrclib.net) | Free synced lyrics | Server MIT; lyrics are user-contributed | Used for lyrics |
| [Aurora Store](https://auroraoss.com) | Play Store client without Google | GPL-3.0 | Recommended in the App Hub |

## Roadmap

**Phase 2 (comfort and connection)**
- Steering-wheel voice button and an optional wake word ("Hey Gen")
- Phone companion page with the same savings and trip view
- Home Assistant MQTT and ABRP live data
- Filipino (Tagalog) language
- DiLink 5 car data
- Battery health estimate

**Phase 3 (control, with safety rules)**
- Parked-only actions: pre-cool the cabin, open windows a crack, seat ventilation
- Automations with a strict allow-list (nothing that affects driving)

**Phase 4 (security)**
- Sentry and dashcam: adopt Overdrive's MIT camera pipeline with credit, or
  recommend running Overdrive alongside

## Sources

- Overdrive README, changelog and code: github.com/yash-srivastava/Overdrive-release
- Electro: electro.app.br; A Crítica, "App brasileiro Electro..." (acritica.net)
- BYD install internals: github.com/wheregoes/byd-dolphin-hacking (docs/sideloading-guide.md, docs/sideloading-internals.md, docs/bydauto-api.md)
- BYD ADB guide: github.com/ahmada3mar/BYD
- Google Maps Platform EEA FAQ (removal of "No Use in Embedded Vehicle Systems" for EEA only): developers.google.com/maps/comms/eea/faq
- RA 10913 coverage: Interaksyon, Vera Files, AutoIndustriya (2017 DOTr working group)
- Plug Power GenDrive®: Plug Power SEC filings (10-K 2012)
