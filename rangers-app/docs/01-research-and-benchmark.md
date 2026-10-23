# 01. Research and benchmark

Research date: 23 October 2026. Vendor claims come from their own listings unless marked otherwise; treat ratings and feature lists as marketing until tested. Sources are linked inline and listed at the end.

## 1. The club we are building for

From [rangersfc.net](https://rangersfc.net/) and its sister pages:

- **Rangers Football Club**, Yam 1, Purok 27, Barangay Mabuhay, General Santos City. Founded 14 June 1996 by Roberto P. Barrientos. Thirtieth year in 2026.
- **Seven volunteer coaches**: Coach James (head coach, club contact), Kurt, Kim, Ralph, Jabez, Steve, Ivan.
- **Three programmes**: Rangers FC; **FC New Mabu** (est. 2026 by Coach Jabez and Coach Ralph at New Mabuhay Elementary School, football and futsal, values MABU: Mindset, Attitude, Belief, Unity); **Gila Academy** (Coach Ralph's skills academy, football and futsal, values GILA: Grind, Improve, Learn, Achieve).
- **Rangers values**: Play With Your Heart (motto), Teamwork, Sportsmanship, Perseverance, Respect, Integrity, Discipline, Community.
- **Context that shapes the design**: most players come from underprivileged families; training is on a simple, dusty field with worn equipment; the biggest needs are boots, balls, bibs and tournament fees; the bus or jeepney fare is a real barrier; the club shop takes orders but deliberately takes no payments; the Facebook page is where schedules are posted.
- **Branding**: red `#C31E24`, navy `#051A31`, deep background `#03080F`, cream text `#F9F6EF`, Bebas Neue headings, Barlow body text, pill-shaped buttons, crest at `rangersfc.net/assets/crest.webp`.
- **Hosting**: `rangersfc.net` already points at GitHub Pages (A records 185.199.108-111.153). The nameservers are `dnsv.jp`, which is Onamae.com (GMO) DNS, so a new `app` subdomain is one CNAME record there.

**Design consequences**: free to every family forever; works on cheap Android phones and slow prepaid data; never required for a child to take part (coaches can record on a family's behalf); equipment-light drills; multi-programme from day one; Messenger and Facebook stay the main broadcast channels.

## 2. Team management apps (schedule, availability, chat)

| App | What it does well | Price | Fit for Rangers |
|---|---|---|---|
| **Heja** ([site](https://heja.io), [App Store](https://apps.apple.com/app/id1157335714)) | Schedule, attendance replies, reminders, team and private chat, file sharing, carpool coordination. Safeguarding feature stops adult-to-minor contact without a parent knowing. | Free for the team; Heja Pro adds stats, payment tracking, desktop | Good free option today. Generic, not branded, no tactics, no development, no Philippine context. |
| **Spond** ([availability](https://help.spond.com/app/en/articles/121230-about-the-spond-app)) | Free scheduling, availability, messaging, guardian controls; charges only on payments | Free | **Not in the Philippine app stores** (browser only). Rules it out for most parents. |
| **TeamSnap** ([comparison](https://www.softwareadvice.com.au/compare/22766/346056/teamsnap/vs/playmetrics)) | Mature scheduling, availability, rosters, chat | From about USD 9.99 | Paid, US-centred. |
| **PlayMetrics** (same source) | Club-level soccer operations | Sales-led pricing | Built for large US clubs. |

**Borrow**: availability replies with a default (Spond lets recurring trainings default to "attending" and only asks for exceptions); reminders that chase non-repliers; Heja's rule that adults never contact minors without parents seeing it.
**Avoid**: building a chat. Every one of these apps competes with the group chat parents already use, and in the Philippines that group chat is Messenger.

## 3. Playing-time and substitution apps

| App | Notable feature |
|---|---|
| **SubTime** ([App Store](https://apps.apple.com/app/id1248650528)) | Tracks play and bench time; auto-generates an equal-time rotation |
| **Pitch Time: Fair Lineups** ([listing](https://mwm.ai/apps/pitch-time-fair-lineups/6758683417)) | Tracks cumulative minutes across the season and **compensates players who got fewer minutes in past matches**; low, standard or high rotation volume |
| **Fairplay FC** ([listing](https://mwm.ai/apps/fairplayfc/6755611235)) | Substitution calculator, timed and rolling subs, season export |
| **SubHero** ([App Store](https://apps.apple.com/vc/app/subhero/id6739369245)) | Free, iPad-first, works fully offline |
| **allPlay Soccer** ([listing](https://mwm.ai/apps/allplay-soccer/6761655708)) | One-time purchase instead of a subscription |
| **Pitch Planner** ([Product Hunt](https://www.producthunt.com/posts/pitch-planner-app)) | Free; lineups, rotations, minutes, match-day recap |

**Borrow**: season carry-over (Pitch Time), offline-first (SubHero), a match-day recap.

## 4. Tactics boards

| Board | Notable feature | Licence / price |
|---|---|---|
| **Tactics Manager** by SoccerTutor ([site](https://www.soccertutor.com/tacticsmanager/)) | Huge library of pitch angles and player actions; works offline | One-time purchase; animation, cloud save and sharing are paid add-ons |
| **TacticalPad** ([review](https://worldsoccertalk.com/product-reviews/tacticalpad-helps-visualize-soccer-tactics-with-quick-and-easy-to-use-software-20130725-CMS-80038.html)) | Animated plays, 3D view, video export | Paid |
| **TacticsBoard** ([listing](https://www.getapp.com/all-software/a/tacticsboard/)) | Browser-based; runs, passes, dribbles, shots; frame-by-frame; PNG/GIF/PDF export | Free tier |

**The gap all of them share**: tactics stay on the coach's device. None is designed for **seven-year-olds looking at a TV from three metres away**, with the club's colours, the club's values and three messages at most. That is the Rangers App's signature feature.

## 5. Open-source projects on GitHub (the most useful benchmarks)

| Project | What it is | What we take from it |
|---|---|---|
| **BenchAssist** ([repo](https://github.com/matthewevans/benchassist), MIT) | Free PWA sideline rotation manager. No backend, no accounts. Rotation solver in a Web Worker (MIP via HiGHS WASM, then position search) with constraints such as no consecutive bench and minimum play. Live game mode with period timers, audio sub alerts and a Now/Next focus view. Practice planner with about 100 drills by age bracket. English and Spanish. 8-second undo on destructive actions. | The Now/Next view; audio and vibration sub alerts; "lock" cells the solver must respect; undo everywhere; drill filtering by age and player count. We start with a simpler greedy solver (section 4.2 of the blueprint) and only add an optimiser if tests show it is needed. |
| **Hirðir** ([repo](https://github.com/SiliconSaga/hirdir)) | Static, offline field app for youth games. **Append-only event log**; everything on screen is derived from it. Clock anchored to wall time. Fair share formula. Coach marks per child: star (doing great), shy (needs encouragement), help (needs attention). Export to CSV and JSON. Printable paper fallback. Rule: "team data never enters this repo". | Event-sourced match log; the fair-share maths; the coach marks (they feed development notes later); the paper fallback; the "forgotten whistle" guard; the honest warning that one device equals one match log until there is sync. |
| **Pitchboard** ([repo](https://github.com/migueljfsc/pitchboard), MIT) | Animated tactics board for several sports on one engine. Renderer is a pure function of document, time and view, so preview and export cannot differ. Coordinates in metres, never pixels. Scenes on a timeline; a run is a curve into the next scene; **the ball is attached to a carrier, so a pass is a carrier change**. Share a frozen board through a compressed URL fragment. | Board units in metres; pure render function; scenes model; carrier-based ball; schema with optional fields so old boards keep opening; URL-fragment sharing for presets. |
| **BoardX** ([repo](https://github.com/caztangpro/boardx)) | React, Konva, zustand. Keyframe animation with easing, 13 formation presets, arrows and zones, PNG, WebM and GIF export, CSV roster import. | Formation presets; easing between steps; export ideas for Phase 7. |
| **Board by Tactics Journal** ([repo](https://github.com/TacticsJournal/board)) | Konva-based mobile-friendly editor, sequences to GIF or video, screenshot import, self-host build. | Proof that a mobile tactics editor in the browser is practical. Check its licence before reusing any code. |
| **tactics-board** ([repo](https://github.com/gljubojevic/tactics-board)) | SVG-based futsal board, 1 SVG unit = 1 cm, b-spline runs, keyframes | Confirms SVG works well for a board and for futsal courts. |
| **11-builder** ([repo](https://github.com/remidej/11-builder)) | React lineup creator, the most-starred lineup builder found | Simple lineup UX reference. |
| soccer-coaching-app, FairPlay, touchline, upro-mobile | Early or abandoned youth coaching projects | Little to reuse; shows how common this need is. |

**Licence rule**: MIT code may be reused with its copyright notice kept in a `THIRD_PARTY_NOTICES.md`. Do not copy code from repositories without a licence. Prefer re-implementing ideas over copying code; our needs are simpler.

## 6. Player development apps

- **The FA's Four Corner Model** ([The FA](https://www.thefa.com/bootroom/resources/coaching/the-fas-4-corner-model)): technical, physical, psychological, social; a thinking tool, not a fixed programme; consider maturity as well as age.
- **iCoach** ([club news](https://darlingtonfc.co.uk/news/thanks-to-our-match-sponsors-34)): coaches score attributes against the FA model and the app flags each player's most developed, least developed and **fastest developing** areas.
- **Football Sessions Coach** ([App Store](https://apps.apple.com/us/app/id1495636739)): practice sessions and player reports on the four-corner model, shareable with technical directors.

**Borrow**: "fastest developing" is a powerful, positive message for a child and parent. **Avoid**: numeric scores that invite comparison.

## 7. Philippine football context

- **8v8 is the PFF standard for 13 and under.** The PFF calls 8v8 the global standard for children 13 and below ([PFF](https://pff.org.ph/?p=14695)). Its RFA Youth League runs **U11 and U13 in 8v8 and futsal**, with over 10,000 players ([PFF](https://pff.org.ph/?p=15710)). The 2026 Palarong Pambansa used 8v8 for elementary boys for the first time ([PFF](https://pff.org.ph/?p=15422)).
- The PFF plans **40 x 20 m quarter pitches** for small-sided games ([PFF](https://pff.org.ph/?p=15098)).
- **Not found**: an official PFF chart for U7 to U10 formats, or exact 8v8 pitch size, match length and ball size. Local tournaments vary (one Cebu tournament played 8-a-side and 9-a-side with no offside). **The app must let a coach set the format per competition.** Ask Coach James which leagues and tournaments Rangers plays.

## 8. The science behind the features

### Motivation and psychology
- **What makes sport fun**: Visek's fun integration study (142 players, 37 coaches, 57 parents) found 81 determinants of fun; trying hard, positive coaching and being a good sport ranked at the top; **winning ranked about 40th** ([GW Today](https://gwtoday.gwu.edu/node/4492), [theory paper](https://scholars.georgiasouthern.edu/en/publications/the-fun-integration-theory-toward-sustaining-children-and-adolesc/)).
- **Mastery climate (TARGET)**: Epstein's six dimensions (Task, Authority, Recognition, Grouping, Evaluation, Time) are how coaches build a climate focused on effort and individual improvement rather than comparison ([textbook chapter](https://med.libretexts.org/Bookshelves/Sports_and_Exercise/Essentials_of_Exercise_and_Sport_Psychology__-_An_Open_Access_Textbook_(Zenko_and_Jones)/21%3A_Motivation_in_Coaching-_Promoting_Adaptive_Psychological_Outcomes/21.02%3A_Frameworks_Used_to_Support_Adaptive_Psychological_Climates)). A 12-week TARGET intervention with 14 to 18 year olds kept its effects six months later ([Cecchini et al.](https://digibuo.uniovi.es/dspace/handle/10651/30963)).
- **Rewards can backfire**: material or contingent rewards can crowd out playing for fun, and removing them later can lower interest ([UW, Frank Smoll](https://psych.uw.edu/news/2827)). The classic evidence is Deci, Koestner and Ryan's 1999 meta-analysis. Evidence on digital badges specifically is thin. Design rule: badges recognise learning and values after the fact; they are never promised as payment for behaviour.
- **Self-determination** (feeling competent, having choice, belonging) and **effort-based praise** are covered in the first plan's sources and kept.
- **Half-time talk**: younger players' coaches asked more open questions (first plan's source, kept).

### Injury prevention and physical development
- **FIFA 11+ Kids** (under 14): in a multinational cluster trial with U11 and U13 teams, injury rates were about half the control group's (hazard ratio 0.52), with a 74% reduction in severe injuries ([trial summary](https://medicalresearch.com/11-kids-program-reduces-soccer-injuries-in-children/), [record](https://lida.sport-iat.de/ta/Record/4043643)). Benefits grow with more sessions per week.
- **Growth spurts**: growth above about 7.2 cm a year is linked to more injuries, and the period around peak growth is the riskiest (first plan's sources, kept).
- **Heading**: The FA removed deliberate heading from U7 to U9 matches in 2024-25, adding U10 in 2025-26 and U11 in 2026-27. Its training guidance has no heading for primary-age children and a limited, graduated approach from U12 to U16 ([The FA](https://www.thefa.com/news/2024/may/17/new-heading-rules-for-grassroots-football-youth-matches)). The Philippines has no equivalent rule that this research found; the app adopts the FA approach as a configurable default.
- **Concussion**: the Concussion Recognition Tool 6 (CRT6) is for non-medical people: anyone with a sign or symptom is assumed concussed, removed immediately, and does not return that day ([BJSM](https://bjsm.bmj.com/content/57/11/689)). UK grassroots guidance ("If in doubt, sit them out", 2023) says no return to sport within 24 hours and a **minimum of 21 days before competitive sport** ([Sport England](https://www.sportengland.org/new-concussion-guidelines-grassroots-sport)). Red flags (loss of consciousness, worsening headache, vomiting, seizure, confusion) need urgent medical care.
- **Heat**: PAGASA heat index categories are Caution 27 to 32°C, Extreme caution 33 to 41°C, Danger 42 to 51°C, Extreme danger 52°C and above ([Inquirer](https://newsinfo.inquirer.net/?p=1766684)). DOH Central Luzon advised cooler hours, more rest and water breaks and more substitutions at Danger, and cancelling organised outdoor athletic activity at Extreme danger ([PNA](https://alpha.pna.gov.ph/articles/1224717)). Mindanao recorded danger-level heat index values (43°C) in August 2026 ([Tribune](https://tribune.net.ph/2026/08/16/danger-level-heat-index-recorded-in-mindanao-4-areas-hit-43c-on-sunday-pagasa)).

### Session design
- **Play-Practice-Play** (US Soccer grassroots): start with games as kids arrive, a game-like practice in the middle, a scrimmage at the end ([model PDF](https://www.soccermaine.com/wp-content/uploads/sites/230/2023/11/play-practice-play_model.pdf)). Critics say it leaves too little time for technique ([SimpliFaster](https://simplifaster.com/articles/usa-soccer-play-practice-play/)). The Rangers template blends it with a short skill block and the 11+ Kids warm-up (playbook, section 3).

## 9. Technology facts checked

| Fact | Detail | Source |
|---|---|---|
| Supabase Free plan | 500 MB database, 1 GB files, 5 GB egress, 50,000 monthly active users, 500,000 Edge Function calls, 200 realtime connections and 2 million realtime messages a month, 2 active projects, **paused after one week of inactivity, no backups** | [supabase.com/pricing](https://supabase.com/pricing) |
| Supabase built-in email | Reported as about 2 emails an hour and only to project team addresses; production needs custom SMTP (third-party sources, verify in the dashboard) | [SendLayer guide](https://sendlayer.com/blog/supabase-custom-smtp-and-email-configuration-guide/) |
| Resend Free | 100 emails a day, 3,000 a month | [Resend docs](https://resend.com/docs/knowledge-base/resend-sending-limits) |
| Open-Meteo | Free for non-commercial use without a key under 10,000 calls a day; hourly `temperature_2m`, `relative_humidity_2m`, `apparent_temperature`, `precipitation_probability`, `cape`, `weather_code` | [open-meteo.com/en/docs](https://open-meteo.com/en/docs) |
| iOS web push | Works only for web apps added to the Home Screen (iOS 16.4+); permission must follow a user tap; some reports of subscriptions silently stopping | [Pushpad](https://pushpad.xyz/blog/ios-special-requirements-for-web-push-notifications), [OneSignal](https://documentation.onesignal.com/docs/web-push-for-ios) |
| PayMongo | GCash 2.5%, QR Ph 1.5% (VAT inclusive), no monthly fee | [PayMongo fees](https://developers.paymongo.com/docs/fees-and-rates) |
| Philippine privacy | NPC Advisory 2024-03 on child-oriented transparency: age-appropriate privacy notices, child privacy impact assessment, breach notices to child and parent in plain language | [NPC FAQ](https://privacy.gov.ph/wp-content/uploads/2024/12/FAQs-Advisory-on-Guidelines-on-Child-Oriented-Transparency.pdf) |
| GitHub Pages | Free for public repositories; custom domain with free HTTPS | GitHub documentation |

## 10. Where the Rangers App is different (our edge)

1. **Kid-facing Match Day Board** on a tablet or TV in club branding, with the club's values on screen.
2. **Philippine formats** (8v8, futsal) and **Mindanao heat safety** built in.
3. **Fair minutes with season memory**, offline on a dusty field.
4. **One club, three programmes**: Rangers, FC New Mabu, Gila, each with its own crest and values, shared coaches and drill library.
5. **Poverty-aware**: free forever, light on data, never required to play, tournament fund and boot bank instead of fee chasing.
6. **Psychology and safety designed in**, not bolted on.

## 11. Gaps and things not verified

- Exact PFF formats for U7 to U10 and exact 8v8 dimensions and match length: confirm with Coach James and the league.
- 360Player and Coachbetter features were not verified in this research.
- iOS push reliability in 2026 is mixed in reports; the plan treats push as a bonus, never the only channel.
- Supabase email limits come from third-party guides; check the Auth rate limits page in the dashboard during Phase 2.
- The NPC advisory was read in summary; have someone familiar with the Data Privacy Act review the privacy notice before parents sign up.

## 12. Sources

Club: [rangersfc.net](https://rangersfc.net/), [FC New Mabu](https://rangersfc.net/new-mabu/), [Gila](https://rangersfc.net/gila/), [Shop](https://rangersfc.net/shop/)

Apps: [Heja](https://heja.io), [Heja App Store](https://apps.apple.com/app/id1157335714), [Spond availability](https://help.spond.com/app/en/articles/121230-about-the-spond-app), [TeamSnap vs PlayMetrics](https://www.softwareadvice.com.au/compare/22766/346056/teamsnap/vs/playmetrics), [SubTime](https://apps.apple.com/app/id1248650528), [Pitch Time](https://mwm.ai/apps/pitch-time-fair-lineups/6758683417), [Fairplay FC](https://mwm.ai/apps/fairplayfc/6755611235), [SubHero](https://apps.apple.com/vc/app/subhero/id6739369245), [allPlay Soccer](https://mwm.ai/apps/allplay-soccer/6761655708), [Pitch Planner](https://www.producthunt.com/posts/pitch-planner-app), [Tactics Manager](https://www.soccertutor.com/tacticsmanager/), [TacticalPad review](https://worldsoccertalk.com/product-reviews/tacticalpad-helps-visualize-soccer-tactics-with-quick-and-easy-to-use-software-20130725-CMS-80038.html), [TacticsBoard](https://www.getapp.com/all-software/a/tacticsboard/), [iCoach](https://darlingtonfc.co.uk/news/thanks-to-our-match-sponsors-34), [Football Sessions Coach](https://apps.apple.com/us/app/id1495636739)

Open source: [BenchAssist](https://github.com/matthewevans/benchassist), [Hirðir](https://github.com/SiliconSaga/hirdir), [Pitchboard](https://github.com/migueljfsc/pitchboard), [BoardX](https://github.com/caztangpro/boardx), [Board](https://github.com/TacticsJournal/board), [tactics-board](https://github.com/gljubojevic/tactics-board), [11-builder](https://github.com/remidej/11-builder), [soccer-coaching-app](https://github.com/martyrheaume-librarian/soccer-coaching-app), [FairPlay](https://github.com/tony-coder-18/FairPlay)

Football bodies: [PFF 8v8 explained](https://pff.org.ph/?p=14695), [PFF 8v8 Palaro debut](https://pff.org.ph/?p=15422), [RFA Youth League](https://pff.org.ph/?p=15710), [PFF grassroots plan](https://pff.org.ph/?p=15098), [FA heading rules](https://www.thefa.com/news/2024/may/17/new-heading-rules-for-grassroots-football-youth-matches), [FA Four Corner Model](https://www.thefa.com/bootroom/resources/coaching/the-fas-4-corner-model)

Science: [Fun in youth sport](https://gwtoday.gwu.edu/node/4492), [Fun integration theory](https://scholars.georgiasouthern.edu/en/publications/the-fun-integration-theory-toward-sustaining-children-and-adolesc/), [TARGET framework](https://med.libretexts.org/Bookshelves/Sports_and_Exercise/Essentials_of_Exercise_and_Sport_Psychology__-_An_Open_Access_Textbook_(Zenko_and_Jones)/21%3A_Motivation_in_Coaching-_Promoting_Adaptive_Psychological_Outcomes/21.02%3A_Frameworks_Used_to_Support_Adaptive_Psychological_Climates), [TARGET intervention](https://digibuo.uniovi.es/dspace/handle/10651/30963), [Rewards in youth sport](https://psych.uw.edu/news/2827), [11+ Kids trial](https://medicalresearch.com/11-kids-program-reduces-soccer-injuries-in-children/), [CRT6](https://bjsm.bmj.com/content/57/11/689), [UK concussion guidance](https://www.sportengland.org/new-concussion-guidelines-grassroots-sport), [Play-Practice-Play](https://www.soccermaine.com/wp-content/uploads/sites/230/2023/11/play-practice-play_model.pdf), [PPP critique](https://simplifaster.com/articles/usa-soccer-play-practice-play/)

Philippines: [Heat index categories](https://newsinfo.inquirer.net/?p=1766684), [DOH heat advice](https://alpha.pna.gov.ph/articles/1224717), [Mindanao heat 2026](https://tribune.net.ph/2026/08/16/danger-level-heat-index-recorded-in-mindanao-4-areas-hit-43c-on-sunday-pagasa), [NPC child transparency](https://privacy.gov.ph/wp-content/uploads/2024/12/FAQs-Advisory-on-Guidelines-on-Child-Oriented-Transparency.pdf)

Technology: [Supabase pricing](https://supabase.com/pricing), [Supabase SMTP guide](https://sendlayer.com/blog/supabase-custom-smtp-and-email-configuration-guide/), [Resend limits](https://resend.com/docs/knowledge-base/resend-sending-limits), [Open-Meteo](https://open-meteo.com/en/docs), [iOS push requirements](https://pushpad.xyz/blog/ios-special-requirements-for-web-push-notifications), [OneSignal iOS push](https://documentation.onesignal.com/docs/web-push-for-ios), [PayMongo fees](https://developers.paymongo.com/docs/fees-and-rates)

First plan's sources (still valid): US Youth Soccer Player Development Model, 11+ Kids injury study, half-time talks in youth football, The FA Playmaker, growth rate and injury risk, maturation and training load review, wellness measure reliability, self-determination in young athletes, coaching climate in grassroots football, playing time and maturity, relative age and dropout, Coerver ball mastery.
