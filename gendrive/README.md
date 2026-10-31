# GenDrive

An in-car app for BYD head units (DiLink): a calm driver-first home screen, live
car data, trip costs and savings, music with synced lyrics, Google Maps handoff,
an app hub, a talking assistant called Gen, and a safe video rule.

- **Install it:** [docs/INSTALL.md](docs/INSTALL.md)
- **How it compares with Overdrive and Electro:** [docs/BENCHMARK.md](docs/BENCHMARK.md)
- **Download:** `https://github.com/genestjan/genestjan/releases/download/gendrive-android/GenDrive.apk`
  (built by `.github/workflows/gendrive-android.yml` on every push to `gendrive/`)

## Layout

| Folder | What's in it |
|---|---|
| `core/` | Plain Kotlin, no Android: lyrics (LRC parser, LRCLIB client), trips and charging recorders, cost and savings maths, drive state and video rule, Google Maps links, next-turn parser, the assistant's persona, offline commands and Gemini request/response handling. Unit-tested. |
| `android/` | The app (Jetpack Compose). Uses `core` through `includeBuild("../core")`. |
| `docs/` | Install guide and benchmark. |

## Build

```bash
cd gendrive/core && gradle test          # or ../android/gradlew -p ../core test
cd gendrive/android && ./gradlew :app:assembleRelease
```

Needs JDK 17+ and the Android SDK (compileSdk 35). The app targets SDK 29 on
purpose: BYD's installer accepts targetSdk 33 or lower, and 29 matches the
community apps proven to reach the car's services on DiLink 3.

## Safety and privacy rules (keep these when you change things)

1. **Read only.** GenDrive never sends commands to the car. Any future control
   feature must be parked-only and allow-listed.
2. **Video picture only in Park.** Video apps keep their sound while the car can
   move; the picture is covered until the gear is P.
3. **While moving:** no typing, lyrics show two lines, settings are locked.
4. **Nothing leaves the car** except lyrics lookups (title and artist to LRCLIB)
   and, with the owner's key, voice requests to Gemini.
5. **ADB use is fixed:** a short list of commands about GenDrive itself, plus
   installing an APK the owner picked. No free-form shell.

## Credits

Car-data method names: public research by OverDrive (MIT) and
byd-dolphin-hacking. ADB client: dadb (Apache-2.0). Lyrics: LRCLIB. Font: Inter
(SIL OFL 1.1, licence in `android/app/src/main/assets`). See
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Not made or endorsed by BYD.
