# Go-live guide (about 2 hours, once)

The app already works on one phone with no setup (local mode). These steps turn on **coach and parent logins, sync, messaging reminders and the TV link**. Do them in order. Never paste a secret into a chat or a file in the repository.

## 1. Accounts (free)
1. Create a club Google account (e.g. `rangersfc.app@gmail.com`). Store logins in Bitwarden, shared with a co-admin.
2. GitHub organisation `rangersfc` (two owners, two-factor on). Repository `rangersfc/rangers-app` (public). Copy the contents of `rangers-app/app/` to its root, and `github-workflows/*.yml` to `.github/workflows/`.
3. Supabase: new organisation, then two projects: `rangers-staging` and `rangers-prod` (region: Singapore). Free plan is enough.

## 2. Database (per project)
1. Dashboard, SQL editor: run `supabase/migrations/0001_core.sql`, then `0002_notifications.sql`. (Or `supabase db push` with the CLI.)
2. Authentication, URL Configuration: Site URL `https://app.rangersfc.net`; add redirect URLs `https://app.rangersfc.net/**` and `http://localhost:5173/**` (staging only).
3. Authentication, Providers: turn on **Email** (one-time code) and **Google**.
   - Google: console.cloud.google.com, new project, OAuth consent screen (External), **Publish to production**, create OAuth client (Web). Authorised redirect URI: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`. Paste client ID and secret into Supabase.
4. Authentication, SMTP: the built-in email sender is for testing only. Create a free Resend account, verify `rangersfc.net` (add the SPF and DKIM records it shows at Onamae.com DNS), and enter the SMTP details; sender `no-reply@rangersfc.net`. Edit the "Magic Link" email template so it shows the 6-digit code (`{{ .Token }}`).
5. Database, Extensions: enable `pg_cron` (the reminder job in 0002 schedules itself).
6. Project Settings, API: copy the Project URL and the **anon** key (public). Never use or share the service_role key in the app.

## 3. Push reminders
1. Generate keys once: `npx web-push generate-vapid-keys`. Public key goes in the app as `VITE_VAPID_PUBLIC_KEY`. Keep the private key secret.
2. `supabase functions deploy send-push`, set secrets `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:you@rangersfc.net`.
3. Schedule `send-push` every 10 minutes (Dashboard, Edge Functions, Schedules).
4. **Check** it works on a real Android phone and an iPhone (iPhone only after Add to Home Screen). If `npm:web-push` does not run on the Edge runtime, swap in another Web Push library: the function is the only thing to change.

## 4. GitHub
1. Repository, Settings, Pages: Source = GitHub Actions; custom domain `app.rangersfc.net`; Enforce HTTPS.
2. Settings, Secrets and variables, **Variables**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (production values), `VITE_VAPID_PUBLIC_KEY`.
3. Secrets (backups): `SUPABASE_DB_URL`, `AGE_PUBLIC_KEY` (`age-keygen`; keep the private key offline), `BACKUP_REPO_TOKEN`. Create the private repo `rangersfc/rangers-app-backups`.
4. Push to `main`: the deploy workflow builds and publishes.

## 5. DNS (Onamae.com)
Add a CNAME record: host `app`, value `rangersfc.github.io` (or your account's `.github.io`). Then add the GitHub Pages domain-verification TXT record if GitHub asks.

## 6. First sign-in
1. Open `https://app.rangersfc.net`, sign in, and tap **Set up the club (admin)**. The first person to do this becomes the admin; it locks after that.
2. Settings: add your teams (Rangers, FC New Mabu, Gila), set the GCash number only if Coach James wants contributions.
3. Add players (Squad), open a child, **Create invite link**, send it to that child's parent privately.
4. Settings, **Create a coach invite link** for each coach; approve them when they sign in; **Add to team**.

## 7. Before real families join
- Have someone familiar with the Data Privacy Act read the privacy text in `docs/07-club-launch-kit.md` section 7 and the Privacy screen.
- Test on staging first: two coach logins and two parent logins on real phones; confirm a parent cannot see another family's child (the database tests prove the rules, but check once by eye).
- Do one restore test from a backup into a scratch project.

## Local development
```
cp .env.example .env     # leave blank to run in local-only mode
npm install && npm run dev
PGHOST=... PGUSER=... bash supabase/run-tests.sh    # database access tests on any Postgres 14+
```
