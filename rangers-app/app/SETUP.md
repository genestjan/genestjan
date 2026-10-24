# Go-live guide

The app is published at **https://rangersfc.net/app/** from the club website repository (`ayakent/RangersFc`, folder `app/`). It works on each phone straight away. These steps switch on **coach and parent logins, sync between phones, messaging alerts and the TV link**.

Never paste a secret (service_role key, database password, SMTP password, VAPID private key) into a chat or a file in the repository. The Project URL, the anon key and the VAPID public key are public and safe to share.

## 1. Supabase project (about 15 minutes, you)
1. Go to supabase.com, sign in with the club Google account, **New project**: name `rangers`, region **Southeast Asia (Singapore)**, Free plan. Save the database password in Bitwarden.
2. **Database > Extensions**: turn on `pg_cron`.
3. **SQL Editor > New query**: paste the whole of `supabase/setup.sql`, press **Run**. It should say "Success. No rows returned".
4. **Project Settings > API**: copy the **Project URL** and the **anon public** key and send them to me (or put them in `.env.production`, see `.env.example`).

## 2. Sign-in settings (about 10 minutes, you)
1. **Authentication > URL Configuration**: Site URL `https://rangersfc.net/app/`; Redirect URLs: add `https://rangersfc.net/app/**` (and `http://localhost:5173/**` if you test locally).
2. **Authentication > Sign In / Providers**:
   - **Google (recommended first, no email setup needed)**: console.cloud.google.com with the club Google account, new project "Rangers App", **OAuth consent screen**: External, app name "Rangers FC", then **Publish app** (basic profile and email need no review; leaving it in Testing caps users and logs people out weekly). **Credentials > Create OAuth client ID > Web application**, authorised redirect URI: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`. Paste the client ID and secret into Supabase's Google provider and enable it.
   - **Email code**: Supabase's built-in sender only reaches your own team's addresses and a couple of emails an hour, so parents would not get codes. Before relying on email: create a free Resend account, add domain `rangersfc.net` (it shows SPF and DKIM records; add them at Onamae.com DNS), then **Authentication > SMTP Settings**: host `smtp.resend.com`, port 465, user `resend`, password = your Resend API key, sender `no-reply@rangersfc.net`, name `Rangers FC`. Then **Authentication > Email Templates > Magic Link**: make the body show the code, for example `Your Rangers FC sign-in code is {{ .Token }}`.
3. **Authentication > Rate Limits**: leave the defaults.

## 3. Publish
The website deploys from the `main` branch of `ayakent/RangersFc` with no build step, so publishing is adding the built `app/` folder there.

**Option A, you (no access needed, 5 minutes on a computer):** unzip `rangers-app-upload.zip` (it contains one folder, `app`). On github.com, signed in as ayakent, open `RangersFc`, **Add file > Upload files**, drag the whole `app` folder in, choose **Commit directly to the main branch**, **Commit changes**. After a minute or two it is live at https://rangersfc.net/app/. To update later, delete the old `app` folder in the same way and upload the new one.

**Option B, me:** give the genestjan account write access to `RangersFc` (Settings > Collaborators) and install the Claude GitHub App on it. Then `scripts/publish-to-site.sh` builds and copies it, and I push.

Logins switch on when the build includes your Supabase Project URL and anon key: send them to me and I produce a new upload (or run `VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... scripts/publish-to-site.sh <site>`). Until then the published app runs in on-device mode: everything works on each phone, with no logins or syncing.

## 4. First sign-in (you, 5 minutes)
1. Open https://rangersfc.net/app/ and sign in.
2. Tap **Set up the club (admin)**. The first person to do this becomes the admin; it locks after that.
3. **More > Settings**: add your teams (Rangers, FC New Mabu, Gila). Set the GCash number only if Coach James wants contributions.
4. **Settings > Coaches > Create a coach invite link** for each coach; when they sign in, **Approve**, then **Add to team** or **Head coach of** the team. Only head coaches (and you) can clear a child after a head injury.
5. Coaches add their players (Squad), open a child, **Create invite link**, and send it privately to that child's parent. The parent signs in, reads the privacy notice and gives consent, then sees only their own child.

## 5. Push alerts (optional, 20 minutes)
1. On a computer: `npx web-push generate-vapid-keys`. Send me the **public** key (it goes into the app). Keep the private key secret.
2. Install the Supabase CLI, then `supabase functions deploy send-push --project-ref YOUR-REF` and `supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@rangersfc.net`.
3. SQL Editor, run once (replace the two values):
   ```sql
   select cron.schedule('rangers-send-push', '*/10 * * * *', $$
     select net.http_post(url := 'https://YOUR-PROJECT.supabase.co/functions/v1/send-push',
                          headers := '{"Authorization": "Bearer YOUR-ANON-KEY"}'::jsonb) $$);
   ```
   (Turn on the `pg_net` extension first if it is off.)
4. Test on a real Android phone and an iPhone (iPhone only after **Add to Home Screen**). If the function errors on `npm:web-push`, tell me: it is the only part not yet run against a live project.

## 6. Keep it healthy
- The free plan pauses a project after a week with no use. During the season, normal use keeps it awake. For breaks, `github-workflows/keepalive.yml` pings it twice a week (copy it into a repository's `.github/workflows/` and set the two repository variables).
- Free projects have no automatic backups. `github-workflows/backup.yml` makes an encrypted weekly copy into a private repository; set it up before real families join.

## 7. Before real families join
- Have someone familiar with the Data Privacy Act read the privacy text (in the app: More > Privacy).
- Try it with two coach phones and two parent phones on the pilot team. Check by eye that a parent cannot see another family's child (the database tests prove it, but look once).

## Local development
```
cp .env.example .env     # leave the values empty to run in on-device mode
npm install && npm run dev
npm test                 # logic
npm run test:e2e         # browser run of coach and parent flows
PGHOST=... PGUSER=... npm run test:db   # database access rules on any Postgres 14+
```
