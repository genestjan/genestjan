# Money Hub: research and decisions

Checked on 30 October 2026, before writing any code (CLAUDE.md rule).

## 1. Can GCash, BPI, credit cards, Wise and PayPal be linked automatically?

Short answer: **not the way Plaid links US banks.** No Philippine bank or e-wallet offers an API that
an individual can connect to their own account. What does work is reading the notifications and
texts your phone already receives, plus PayPal's own API.

| Account | Official API for you? | What Money Hub does | How fast |
|---|---|---|---|
| GCash | No. GCash APIs are for merchants accepting payments. | Reads GCash app notifications and GCash texts on the phone | Seconds |
| Maya | No (merchant APIs only) | Reads Maya notifications | Seconds |
| BPI | No personal API | Reads BPI app notifications and BPI texts; CSV statement import | Seconds |
| Credit cards (BDO, UnionBank and others) | No | Reads the card's SMS and app alerts, matched by the card's last 4 digits; tracks the balance owed and the due date | Seconds |
| Wise | **No for a Philippine account.** Personal API tokens are now a business-account feature, limited to quotes, recipients and transfers. Balance statements by API only work for accounts in the US, Canada, Australia, New Zealand, Singapore and Malaysia. | Reads Wise app notifications; CSV statement import | Seconds |
| PayPal | **Yes, with a PayPal Business account** (free upgrade): a REST app with "Transaction search" enabled | Pulls transactions through the API, including fees, and treats withdrawals to your bank as transfers | Up to 3 hours behind (PayPal's delay); the phone catches it sooner |

Sources: [Wise personal API tokens](https://docs.wise.com/guides/developer/auth-and-security/personal-api-token.md),
[PayPal Transaction Search](https://developer.paypal.com/docs/transaction-search),
[Philippines Open Finance overview](https://openbankingtracker.com/regulation/philippines-open-finance),
[BIS speech on the BSP Open Finance pilot](https://www.bis.org/review/r250911b.pdf).

**Open Finance in the Philippines.** The BSP's Open Finance Framework (Circular 1122, 2021) is real,
but still in its pilot stage (tied to PERA accounts), with full compliance expected around 2027.
When banks open consent-based APIs to the public, Money Hub can add them. Until then, nothing
better exists for an individual.

**Aggregators.** Open Banking Tracker lists 13 aggregators with some Philippine coverage
([list](https://openbankingtracker.com/api-aggregators?country=PH)). They sell to businesses under
contract, I could not confirm GCash or BPI coverage or any pricing for individuals, and most work
by storing your bank login. Handing a third party your bank password is a bigger risk than reading
your own notifications, so this route was rejected.

**What the mockup promised that is not possible:** "Plaid, Finicity" do not cover Philippine banks
or GCash. The "Connected" status in the app means what it says: auto-capture from the phone, or
the PayPal API.

## 2. Existing projects benchmarked

Stars as of 30 October 2026.

| Project | Stars | Licence | Platforms | Sync | Automatic capture | Fit for you |
|---|---|---|---|---|---|---|
| [Maybe](https://github.com/maybe-finance/maybe) | 54.2k | AGPL-3.0 | Web (self-host) | Server | US/EU bank sync | **Archived**: no longer maintained |
| [Actual Budget](https://github.com/actualbudget/actual) | 29.9k | MIT | Web, desktop | Own sync server, optional end-to-end encryption | GoCardless (EU/UK), SimpleFIN (US) only | Strong design, no PH banks, needs a server |
| [Firefly III](https://github.com/firefly-iii/firefly-iii) | 25.0k | AGPL-3.0 | Web (self-host) | Server | EU banks via importer | Needs a server; no phone app of its own |
| [ezBookkeeping](https://github.com/mayswind/ezbookkeeping) | 5.9k | MIT | Web (self-host), mobile web | Server | None | Needs a server |
| [Cashew](https://github.com/jameskokoska/Cashew) | 4.8k | GPL-3.0 | Android, iOS, web | Google Drive | **Yes: Android notifications and email** | Closest match. No Windows app; generic parsing, not PH-tuned; development slowed (last push March 2026) |
| [BeeCount](https://github.com/TNT-Likely/BeeCount) | 2.7k | Custom (not open source) | Android, iOS, web | Supabase, WebDAV, S3 | AI capture | Licence blocks reuse |
| [hisabi](https://github.com/hisabi-app/hisabi) | 460 | Open source | Web (self-host) | Server | Pasted SMS parsing | Shows the SMS approach; UAE banks |
| [Wallos](https://github.com/ellite/Wallos) | 8.8k | GPL-3.0 | Web (self-host) | Server | None | Subscriptions and bills only |
| GCash PDF-to-CSV scripts ([1](https://github.com/joshuactk/GCash-Transaction-History-Extraction), [2](https://github.com/PagP332/GCash-TransactionHistory-to-CSV)) | under 5 | not stated | Scripts | None | None | Confirms GCash history can be exported |

**Nothing found covers all of:** Philippine bank, card and e-wallet capture; an Android app plus a
Windows app; end-to-end encrypted sync; and bills, cards and loans the way your Budgeting tab
tracks them.

**What was borrowed (ideas, not code, so no licence obligations):**
local-first storage and end-to-end encrypted sync (Actual), reading notifications on Android
(Cashew), automatic categorising by payee and rules (Firefly III), a bills-and-due-dates view
(Wallos), Supabase as the sync backend (BeeCount, and your own RideWise). The crypto settings
come from your own Work Hub (PBKDF2-SHA256 at 600,000 rounds, AES-256-GCM, 3-minute idle lock).

**The honest alternative:** if you only wanted a phone app today, Cashew from the Play Store is
free and does basic notification capture. You asked for your own, with Windows, encryption and
your branding, so Money Hub was built.

## 3. How Money Hub is built, and why

- **One shared screen, two thin apps.** The screen
  is a web app (Vite, React, TypeScript, Tailwind, the RideWise stack), shown inside an Android
  app (WebView) and a Windows app (WebView2). One codebase for every screen; the native apps only
  do what a web page cannot (notification capture, fingerprint, Windows Hello, files, PayPal).
- **Builds on GitHub.** Each push builds the APK and the Windows installer and publishes them at
  fixed download links.
- **Supabase for sync**, with only ciphertext stored. Free tier; a daily keep-awake job stops the
  free plan pausing it.
- **Local-first.** Everything works offline; changes sync when there is internet.
- **Bill reminders** without a Google Cloud project: phone alarms (Android AlarmManager, restored
  after a restart), Windows' own scheduled notifications, and an Apps Script that runs in your
  Google account and keeps a private "Money Hub bills" calendar in step. Apps Script was chosen
  over Google's OAuth API because a personal OAuth app in testing mode loses its sign-in every
  7 days; the script never expires.

## 4. Security model

| Threat | Protection |
|---|---|
| Someone gets into Supabase (or Supabase itself) | Every record is encrypted on your device with a 256-bit key the server never sees. The server cannot read amounts, names or notes. |
| Supabase sees your password | It does not. The app turns your password into a separate sign-in secret (PBKDF2 then HKDF), so the real password never leaves the device. |
| Someone guesses your account | Sign-ups are switched off after you create yours; Row Level Security limits every row to its owner. Two-factor rules are already in the database for later. |
| Lost or stolen phone | The app locks after 3 minutes. Opening it needs your fingerprint or password. Changing your password signs every other device out of the cloud. |
| Screenshots or the recent-apps preview | The recent-apps preview is always blank on Android 13 and later. Screenshots are allowed by default so problems can be sent for help; **Settings & security > Allow screenshots** blocks them and screen recording (FLAG_SECURE on Android, capture exclusion on Windows). |
| Problem reports leaking data | The problem log stays on the device and holds error messages, app version and phone model only. It is copied only when you tap Copy. |
| Notification capture reading private things | Only apps you tick are read. One-time PINs, promos and texts from people are dropped on the phone. Captured text is sealed with the app's public key before it touches storage, so even the phone's own queue is unreadable without unlocking. |
| A malicious web page talking to the app | The Android bridge is injected only into Money Hub's own page (origin check); the Windows app accepts messages only from its own virtual host; no outside page can load inside either app. |
| Phone backups leaking data | Android cloud backup and device transfer are switched off for the app. |
| Forgetting the password | The recovery key. Without the password and the recovery key, the data cannot be opened by anyone. That is the price of real end-to-end encryption. |

Checked by tests: 66 tests (encryption, parsers, capture pipeline, maths, CSV, two-device
sync), plus a check that 20 captures sealed by the Android Java code open in the web app.

## 5. Costs

| Item | Cost | Free alternative / note |
|---|---|---|
| Supabase | Free (500 MB is decades of transactions) | Pro is US$25 a month; not needed |
| GitHub Actions builds | Free (public repo) | |
| PayPal API | Free | Needs a Business account (free) |
| Windows code-signing certificate | Optional, about US$10 a month (Azure Trusted Signing) | Without it, Windows shows "More info, Run anyway" once |
| Google Play listing | Not used | Installing the APK directly is free |

## 6. Risks and limits

- **Notification wording changes.** The parser reads meaning, not exact templates, and anything
  unclear waits in **To review** rather than being guessed. Expect to tick a few items in the first weeks.
- **Samsung battery management** can stop background apps. The setup guide sets Money Hub to
  Unrestricted.
- **Android 13+ "restricted settings"** blocks notification access for apps installed outside the
  Play Store until you allow it once (in the setup guide).
- **Some package names are best guesses** (BPI, BDO, UnionBank, Metrobank apps). The Captured
  screen lists every app that actually posts notifications on your phone, so you can tick the right one.
- **Not yet tested on your actual phone and laptop.** The code is tested here and both apps build on
  GitHub, but the first real run is on your devices. Report anything odd and it gets fixed.

## 7. Tools, plugins and MCP servers checked

| Tool | Result |
|---|---|
| Supabase plugin and MCP server (official) | Available in the plugin directory. **Not installed**: it needs your Supabase login (CLAUDE.md: ask first). With it, a future session could create the project and run the SQL for you. |
| context7 (library docs) | Installed but failed to connect from this container (network policy blocks mcp.context7.com). |
| Android Emulator QA plugin | Not useful here: cloud containers cannot run an emulator. |
| Finance plugins (Sprout, Era, Finance) | US bank connections or accounting work; nothing for Philippine accounts. |
| Built in, used | dataviz skill (chart palette validated for colour blindness and contrast), Playwright (screenshots of every screen), Postgres's own parser (schema check). |
