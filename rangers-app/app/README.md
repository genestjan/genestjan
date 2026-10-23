# Rangers App (Phase 0 + Phase 1: Match Day Kit)

Offline-first PWA for coaches: squad, fair-minutes rotation plan, live match with Now/Next and sub alerts, and a kid-facing Match Day Board (lineup, 3 keys, animated move, values, half-time, next on, celebrate). No logins, no server: everything is stored on the device (IndexedDB) and can be backed up to a file.

```
npm install
npm run dev        # http://localhost:5173
npm test           # logic tests (fair share, rotation properties, heat index, board engine, clock)
npm run build      # type-check + production build into dist/
```

Plan and rules: `../README.md`, `../CLAUDE.md`, `../docs/`. Deploys to `app.rangersfc.net` once it is moved into its own repository (see `../docs/07-club-launch-kit.md`, sections 4 and 5; `public/CNAME` is already set).

## Known gaps (tracked for the next field test)
- **Icons are placeholders** (red and cream rings). Replace `public/icons/icon-192.png` and `icon-512.png` with the crest.
- **Rotation spread**: 9 to 13 players in 8v8 gives a gap of 5 min or less; 14 or 15 players gives 15 min because each keeper plays a whole period. Options for the Planner: allow keeper changes mid-period, or an optimiser.
- **Board editor is not built yet**: the board shows three preset moves (give-and-go, overlap, switch play). Drawing your own, saving and the full preset set are next.
- No photos, no sync, English only, no automated browser tests in CI yet (smoke tested by hand with Playwright at phone and TV sizes).
- Heat index logic and tests exist (`src/lib/heatIndex.ts`) but are not wired to a weather fetch until Phase 3.
