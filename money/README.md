# Money Hub

Jan's personal budgeting app: income against expenses, budgets, bills, cards and loans, filled in
automatically from the phone's bank, card and e-wallet notifications, and synced end-to-end
encrypted between the Samsung phone and the Windows laptop. Reminds you 5 days before each bill
is due (phone notification, optional laptop notification, optional all-day Google Calendar event).

- **Set it up:** [SETUP.md](SETUP.md) (step by step, about 45 minutes once)
- **Why it is built this way, and what can and cannot be linked:** [RESEARCH.md](RESEARCH.md)
- **Downloads** (after a green build):
  [Android APK](https://github.com/genestjan/genestjan/releases/download/money-android/MoneyHub.apk) ·
  [Windows installer](https://github.com/genestjan/genestjan/releases/download/money-windows/Money-Hub-Setup.exe)

## How it fits together

```
 Samsung phone                                  Windows laptop
 ┌──────────────────────────────┐               ┌──────────────────────────────┐
 │ Android app (money/android)  │               │ Windows app (money/windows)  │
 │  WebView ─ shared screen     │               │  WebView2 ─ shared screen    │
 │  CaptureService reads bank   │               │  Windows Hello unlock        │
 │  notifications, seals them   │               │                              │
 │  Fingerprint unlock          │               │                              │
 └─────────────┬────────────────┘               └──────────────┬───────────────┘
               │ encrypted records, sealed captures            │
               └──────────────► Supabase (money/supabase) ◄────┘
                                only ciphertext, Row Level Security
```

| Folder | What it is |
|---|---|
| `web/` | The shared screen and all logic: Vite, React, TypeScript, Tailwind, zustand. Encryption, sync, parsers and maths live in `web/src/lib`. |
| `android/` | Java app: WebView host, notification capture, fingerprint unlock, PayPal calls. |
| `windows/` | .NET 8 WinForms app with WebView2, Windows Hello, Inno Setup installer. |
| `supabase/schema.sql` | Tables, Row Level Security, the phone's drop-off inbox and password recovery. |
| `web/src/lib/calendarScript.ts` | The Google Apps Script that puts bill reminders in Google Calendar (pasted by you at script.google.com). |

## Working on it

```bash
cd money/web
npm ci
npm test            # 66 tests
npm run dev         # http://localhost:5173 ; add ?demo for sample data
npm run build       # dist/, packed into both apps by their builds
```

Both apps are built by GitHub Actions on every push to `money/**`:
`.github/workflows/money-android.yml` and `money-windows.yml`. The Android app is signed with
Money Hub's key from the `MONEY_KEYSTORE_BASE64` and `MONEY_KEYSTORE_PASSWORD` secrets.

Screenshots of every screen with the sample data:

```bash
npm run build && (npx vite preview --port 4173 &) && node scripts/screenshots.cjs
```

## Brand

genestjanramirez.com tokens (BRIEF.md 6.2): ink `#06080D`, amber `#FFB03A` for actions, cyan
`#4FD1E0` for structure, the gold GJR mark. Space Grotesk, Inter and JetBrains Mono. Chart colours
were validated for colour-blind separation and contrast on the card surface.
