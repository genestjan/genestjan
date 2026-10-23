# Rangers App: the plan (START HERE)

A free coach and parent web app for **Rangers Football Club** (Barangay Mabuhay, General Santos City, est. 14 June 1996) and its sister teams **FC New Mabu** and **Gila Academy**. It lives at **https://app.rangersfc.net**, hosted free on GitHub Pages, with a free Supabase backend for logins and data.

This folder is the complete plan. It is written for three readers:

| Reader | What they use | Files |
|---|---|---|
| You (Jan) | The step-by-step path below, the launch kit, the decisions sheet | This README, `docs/07-club-launch-kit.md`, `docs/decisions.md` |
| The **Planner** session (your stronger model) | Everything, to write one detailed technical spec per phase | All files |
| The **Builder** session (your faster model) | `CLAUDE.md` plus the phase spec the Planner writes | `CLAUDE.md`, `docs/specs/phase-N.md`, and the docs they link to |

---

## 1. The idea in one paragraph

Coaches open the app on a phone or tablet at the pitch, with or without signal. Before kick-off they show the kids a **Match Day Board** on a tablet or TV: the lineup, three key messages, one animated move, and the club values, all in Rangers red and navy. During the match the app keeps **fair minutes** for every child and tells the coach who goes on next. At training it builds a **session in five minutes** from a drill library matched to the age group, checks the **heat index**, and runs the timer. Over the term it keeps a light **development profile** per child (strengths, what they are working on, goals, growth spurts) that parents can see for their own child only. Parents get the schedule, can reply Going or Not going, and receive reminders. Everything else stays where it already works: the Facebook page and Messenger groups.

## 2. What changed from your first plan, and why

Your first plan was strong. The research (see `docs/01-research-and-benchmark.md`) changed these things:

| # | Change | Why |
|---|---|---|
| 1 | **Build a no-login, offline "Match Day Kit" first** (board, tactics, fair minutes), used at a real match within about two weeks, before any accounts | Fastest proof that coaches will use it, zero child data in the cloud, and two free open-source apps (BenchAssist, Hirdir) show coaches adopt exactly this kind of tool. Accounts, messaging and fees come after it earns its place. |
| 2 | **Philippine match formats**, not US ones: 8v8 is the PFF standard for 13 and under; futsal is first-class | PFF runs its RFA Youth League as 8v8 for U11 and U13, and the 2026 Palarong Pambansa used 8v8 for elementary boys. FC New Mabu and Gila both train futsal. |
| 3 | **Fair minutes engine**, not just a sub timer: auto rotation plan, Now/Next on screen, season carry-over | Playing time is the biggest fairness issue in youth football and a known dropout driver. Paid apps (SubTime, Pitch Time) and BenchAssist all centre on this. |
| 4 | **One board engine** for tactics, set pieces, drill diagrams and the half-time board, drawn in SVG, not Konva | Crisp on a TV at any size, easy to test, simpler for the Builder. Ideas borrowed from Pitchboard and BoardX (both MIT licensed). |
| 5 | **New safety module**: heat index check per session, lightning rule, concussion "remove and record" with return-to-play lock, heading rules by age, goal-post anchoring | General Santos regularly hits PAGASA "danger" heat levels. None of this was in the first plan and it is the part a parent will thank you for. |
| 6 | **Psychology designed in** (mastery climate / TARGET), not added on: recognition by club values, badges that inform rather than bribe, a coach nudge when a child has not been recognised in weeks | Research on fun in youth sport ranks trying hard, positive coaching and being a good sport far above winning (winning was 40th of 81). |
| 7 | **Development ratings in words, not numbers**: Learning it, Getting it, Got it, Can teach it | Words stop parents and kids comparing scores and keep the focus on each child's own progress. |
| 8 | **Fees moved late and made optional**. Replaced first by a **tournament fund and boot bank** | The club website says most families cannot spend on football and the shop deliberately takes no payments. Chasing fees through an app may hurt more than help. Ask Coach James first. |
| 9 | **Messenger stays the main channel.** The app adds a "Share to group chat" button that writes the message for you | Parents already live in Messenger and Facebook (often on free or cheap data). A second chat app goes unread. |
| 10 | **Subdomain `app.rangersfc.net`, separate repository**, not a folder of the club website | A separate origin keeps login tokens away from scripts on the public site, a broken app build cannot take the club website down, and the club can own the repo outright. |
| 11 | **Per-child family invite links** instead of one team code | A team code pasted in a group chat can leak. A single-use link per child is safer and simpler for parents. |
| 12 | **Bus factor plan**: a free GitHub organisation and Supabase organisation with two adult owners, encrypted weekly backups | If you are busy or step away, the club still owns and can run its app. |

## 3. Honest check before you build

You could run a season today for ₱0 and zero build hours with **Heja** (free team schedule, availability and chat, available worldwide), **BenchAssist** (free rotation planner) and a free tactics board. Spond, the other big free app, is not in the Philippine app stores.

Building your own is still worth it because none of those gives you: a kid-facing Match Day Board in Rangers branding, Philippine formats and futsal, heat safety for Mindanao, development profiles tied to the club's own values, one view across Rangers, FC New Mabu and Gila, and a design that works on a dusty field with no signal. The cost is your evenings and a long-term responsibility for children's data. That is why the plan ships the small, offline Match Day Kit first and only grows when coaches actually use it.

## 4. The step-by-step path

Each step says who does it. Tick them off in order.

### Stage A: Prepare (about one week of evenings)

1. **Talk to Coach James (30 minutes).** Use the interview script in `docs/07-club-launch-kit.md`, section 1. Write the answers into `docs/decisions.md`. *You.*
2. **Send the 5-question survey to the other six coaches** (Kurt, Kim, Ralph, Jabez, Steve, Ivan). Same file, section 2. *You.*
3. **Pick one pilot team**, ideally your son's, and one pilot coach. Everything is tested there first. *You and Coach James.*
4. **Set up ownership** (free): a GitHub organisation (suggested name `rangersfc`) with you and one more trusted adult as owners. Steps in `docs/07-club-launch-kit.md`, section 4. *You.*
5. **Create the repository** `rangersfc/rangers-app` (public, so GitHub Pages stays free) and copy this whole `rangers-app/` folder into its root. Connect it to Claude Code. *You.*

### Stage B: Plan with the Planner session (one session per phase)

6. **Run the Planner kickoff prompt** from `docs/06-ai-workflow-and-prompts.md`, prompt P1. It reads every doc plus your decisions and writes `docs/specs/phase-0.md` and `docs/specs/phase-1.md`. Read the specs; answer any questions it raises in `docs/decisions.md`. *Planner, then you.*

### Stage C: Build in small, tested phases

7. **Phase 0, Setup:** scaffold, branding, PWA shell, CI, deploy to `app.rangersfc.net` (you add one DNS record at Onamae.com; steps in the launch kit, section 5). Builder prompt B1. *Builder, then you check the live URL on your phone.*
8. **Phase 1, Match Day Kit (offline, no logins):** tactics board, Match Day Board, fair minutes. Builder prompt B1, review prompt R1. *Builder, Planner reviews, you test.*
9. **Field test at two real matches** with the pilot coach. Use the field-test checklist in `docs/05-build-roadmap.md`. Feed problems back with prompt F1. **Do not start Phase 2 until coaches say they want to keep using it.** *You and the pilot coach.*
10. **Phases 2 to 7**, one at a time, same loop: Planner writes the spec, Builder builds, Planner reviews, you field test, then the next phase.
    - Phase 2: Accounts, families and privacy (Supabase)
    - Phase 3: Schedule, availability, reminders, heat check
    - Phase 4: Training sessions and drill library
    - Phase 5: Player development and wellbeing
    - Phase 6: Club support (tournament fund, boot bank, optional fees)
    - Phase 7: TV link, translations, player logins, backups, handover

### Stage D: Launch and keep it running

11. **Onboard parents in waves** using the Messenger templates and privacy notice in the launch kit. Pilot team first, then the rest of Rangers, then FC New Mabu and Gila. *You and coaches.*
12. **Monthly 15-minute check** with Coach James: the usage numbers, one thing to fix, one thing to drop. The app should get simpler over time, not bigger. *You.*

Rough timing for evenings-only work with AI building: Phase 0 in one evening, Phase 1 in one to two weeks, each later phase one to three weeks. Testing on real devices is the slow part, not the code. These are guesses, not quotes.

## 5. Cost

| Item | Tool | Cost |
|---|---|---|
| Hosting | GitHub Pages on `app.rangersfc.net` | Free (public repo) |
| Domain | `rangersfc.net` (already owned, DNS at Onamae.com) | Existing renewal only |
| Logins, database, files | Supabase Free: 500 MB database, 1 GB files, 50,000 monthly users, 2 projects | Free |
| Login emails | Resend Free: 100 emails a day, 3,000 a month | Free |
| Weather and heat index | Open-Meteo, no key, free for non-commercial use under 10,000 calls a day | Free |
| Push notifications | Web Push, sent by a Supabase Edge Function | Free |
| Videos | YouTube links (privacy-enhanced embeds) | Free |
| Backups | GitHub Actions to a private backup repo, encrypted | Free |

Only paid option worth knowing: Supabase Pro (USD 25 a month) removes the 7-day inactivity pause and adds backups. You should not need it; the plan includes a keep-alive job and its own backups.

## 6. File map

| File | What it holds |
|---|---|
| `CLAUDE.md` | Standing rules for every build session: stack, conventions, non-negotiables |
| `docs/01-research-and-benchmark.md` | What exists, what to borrow, what to avoid, the science, all sources |
| `docs/02-product-spec.md` | Users, principles, every feature with acceptance criteria, screens, branding |
| `docs/03-coaching-playbook.md` | Age bands, formats, session template, curriculum, drills, strategies, development rubric, psychology and safety rules |
| `docs/04-technical-blueprint.md` | Architecture, offline sync, data model, access rules, algorithms, security, testing, deployment |
| `docs/05-build-roadmap.md` | Phases 0 to 7 with tasks, acceptance criteria, tests and field-test gates |
| `docs/06-ai-workflow-and-prompts.md` | Exactly how to run Planner and Builder sessions, with copy-paste prompts |
| `docs/07-club-launch-kit.md` | Coach interview, survey, ownership setup, DNS steps, privacy notice, consent, parent messages, coach quick start |
| `docs/decisions.md` | Open questions with recommended defaults. You fill it in; the Planner reads it |
| `docs/specs/` | Empty for now. The Planner writes one spec per phase here |
| `docs/adr/` | Architecture decision records, written by the Planner |
| `docs/field-tests/` | Notes from each real match or training test |

## 7. Status

Update this table at the end of every phase.

| Phase | Status | Date | Notes |
|---|---|---|---|
| Plan and research | Done | 23 Oct 2026 | This folder |
| Coach interview and decisions | Not started | | |
| 0. Setup | Built (code in `app/`); domain and crest still to do | 23 Oct 2026 | Placeholder icons |
| 1. Match Day Kit | Built, needs a field test | 23 Oct 2026 | Board editor still to build; see app/README.md |
| 2. Accounts, families, privacy | Not started | | |
| 3. Schedule and reminders | Not started | | |
| 4. Training | Not started | | |
| 5. Development and wellbeing | Not started | | |
| 6. Club support | Not started | | |
| 7. Polish and scale | Not started | | |
