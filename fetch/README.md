# Fetch GenSan

Ride, pabili, pick-up and delivery for General Santos City and the rest of Mindanao.

| App | Web address (after merge to `main`) | Android APK |
|---|---|---|
| Customer | https://genestjanramirez.com/fetch/ | `FetchGenSan-customer.apk` from the `fetch-android` release |
| Driver | https://genestjanramirez.com/fetch/driver/ | `FetchGenSan-driver.apk` from the `fetch-android` release |

APK links (built by `.github/workflows/fetch-android.yml`):
- https://github.com/genestjan/genestjan/releases/download/fetch-android/FetchGenSan-customer.apk
- https://github.com/genestjan/genestjan/releases/download/fetch-android/FetchGenSan-driver.apk

iPhone: open the web address in Safari, tap Share, then Add to Home Screen.

## What it does

| Feature | Customer | Driver |
|---|---|---|
| Email login with a one-time code | ✅ | ✅ |
| Real name, PH mobile number, valid ID photo and selfie (required) | ✅ | ✅ |
| Real vehicle: type, make, model, colour, plate, photo | | ✅ |
| Ride, Pabili (buy for me, with item budget) and Delivery | ✅ | ✅ |
| Choose the driver by vehicle, plate, rating and price | ✅ | |
| Driver sets their own flag-down, per km, per minute and minimum | | ✅ |
| Automatic GPS meter, or a fixed price agreed in chat, with counter-offers | ✅ | ✅ |
| Live map: customer sees the driver coming; driver sees the customer | ✅ | ✅ |
| Free in-app chat with quick replies, one-tap phone call | ✅ | ✅ |
| Cash, GCash or bank transfer (paid direct to the driver, with reference number) | ✅ | ✅ |
| Tips, star ratings and comments, both ways | ✅ | ✅ |
| Suki points (1 per ₱10) and tiers: Suki 5%, Gold 8%, Platinum 10% off | ✅ | |
| George voice assistant (English, Tagalog and Bisaya keywords) | ✅ | ✅ |
| Share trip, SOS 911, Google Maps navigation | ✅ | ✅ |
| Animated logo intro, installable app (PWA), offline screen | ✅ | ✅ |
| Mindanao only: searches and bookings are limited to Mindanao | ✅ | |

## Demo mode and live mode

Without any settings the apps run in **demo mode**: everything is saved on the phone only, any
6-digit code logs you in, IDs are auto-approved, and sample drivers (with a robot that accepts,
drives and finishes) let one person try the whole flow. The driver app has a "Send me a test
booking" button. Demo mode is for testing and for the tutorial videos. **It is not for real
customers**: two different phones cannot see each other.

**Live mode** turns on when three settings are added (steps below). It uses Supabase (free tier):
real email codes, a shared database with security rules, and live updates between phones.

## Turning on live mode (step by step)

You need about 30 minutes. Cost: ₱0 on the Supabase free plan.

### Part 1. Make a Supabase project

1. Open https://supabase.com on your computer.
2. Click the green **Start your project** button.
3. Click **Continue with GitHub** and log in with your GitHub account.
4. Click **New project**.
5. In **Name**, type `fetch-gensan`.
6. In **Database Password**, click **Generate a password**, then click **Copy** and paste it into a safe note. You will not need it often.
7. In **Region**, choose **Southeast Asia (Singapore)**.
8. Click **Create new project**. Wait until the spinning circle stops (about 2 minutes).

### Part 2. Create the tables

1. In the left menu, click the icon that looks like `>_` called **SQL Editor**.
2. Click **+ New query**.
3. On GitHub, open the file `fetch/supabase/schema.sql` in this repository. Click the **Copy raw file** button (two squares) at the top right of the file.
4. Go back to Supabase. Click inside the big empty box and paste (Ctrl+V on Windows, Cmd+V on Mac).
5. Click the green **Run** button at the bottom right. You should see **Success. No rows returned**.

### Part 3. Allow email codes

1. In the left menu click **Authentication**, then **Sign In / Providers**, then **Email**. Make sure **Enable Email provider** is on.
2. Click **Emails** in the Authentication menu, then **Magic Link** template. In the message box, make sure it contains `{{ .Token }}`. If not, add this line: `Your Fetch GenSan code is {{ .Token }}`. Click **Save**.
3. Click **URL Configuration**. In **Site URL** type `https://genestjanramirez.com/fetch/` and click **Save**.

Note: the free plan sends only a few emails per hour. Before launch, connect a free email
sender (Resend: 3,000 emails a month free) under **Authentication > Emails > SMTP Settings**.

### Part 4. Copy the two keys into GitHub

1. In Supabase, click the **gear icon** (Project Settings) at the bottom left, then **API**.
2. You will see **Project URL** and **anon public** key. Keep this page open.
3. In another tab open https://github.com/genestjan/genestjan/settings/variables/actions
4. Click **New repository variable**. Name: `FETCH_SUPABASE_URL`. Value: paste the **Project URL**. Click **Add variable**.
5. Click **New repository variable** again. Name: `FETCH_SUPABASE_ANON_KEY`. Value: paste the **anon public** key. Click **Add variable**.

These two values are safe to be public. The security rules in the database protect the data.

### Part 5. Approve IDs

New users wait on "We are checking your ID" until you approve them.

1. In Supabase click **Table Editor**, then the **profiles** table.
2. Click the row of the person. In the **data** column, look at the ID photo and selfie (they are long text starting with `data:image`; click the cell and copy into a browser address bar to view).
3. Change `"verified": "pending"` to `"verified": "approved"` (or `"rejected"`). Click **Save**.

### Part 6 (optional). Give George the ElevenLabs "George" voice

Without this, George uses the phone's built-in British male voice (free).

1. Sign up at https://elevenlabs.io (Starter plan, about US$5 a month).
2. Click your profile icon, then **API Keys**, then **Create API key**. Copy it.
3. On your computer install the Supabase command line tool, then in the `fetch` folder run the commands below, one at a time:

```bash
npx supabase login
```

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```

```bash
npx supabase secrets set ELEVENLABS_API_KEY=PASTE_YOUR_KEY ALLOWED_ORIGIN=https://genestjanramirez.com
```

```bash
npx supabase functions deploy tts --no-verify-jwt
```

4. Add one more GitHub variable: `FETCH_TTS_URL` = `https://YOUR_PROJECT_REF.supabase.co/functions/v1/tts`

### Part 7. Publish

Merge this branch into `main`. The site rebuilds itself in about 3 minutes.

## Development

```bash
cd fetch
npm install
npm run dev     # http://localhost:5173/fetch/ and /fetch/driver/
npm test        # unit tests (fares, suki points, George's commands)
npm run build
```

Code map: `src/lib` (data layer, fares, points, George, demo robot), `src/ui` (shared screens),
`src/customer`, `src/driver`, `supabase/schema.sql`, `supabase/functions/tts`.

## Research and benchmarks

Searched GitHub before building (per CLAUDE.md). Main references:

| Project | Stack | What was taken |
|---|---|---|
| tapiwamakandigona/tapride | React, TS, Supabase, Capacitor | Same architecture: one web codebase, Supabase realtime, Capacitor for Android |
| alberdaniosilva15-arch/zenith-para-terminar | React, Vite, Supabase, Capacitor | Separate driver and rider roles, RLS-first schema |
| caimdeveloper/k2-taxi | React, React-Leaflet | Free OpenStreetMap maps instead of paid Google Maps |
| leaflet-drift-marker (idea) | Leaflet | Smooth moving vehicle markers (done here with a CSS transition) |
| Supabase "Uber clone" guide | Flutter, Supabase | Live location through Realtime |

No code was copied: licences on these repositories were not all clear, so they were used as
design benchmarks only. Map data © OpenStreetMap contributors.
