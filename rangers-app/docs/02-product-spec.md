# 02. Product specification

What the Rangers App does, for whom, and how we know each feature works. The phase in brackets after each module says when it is built (see `05-build-roadmap.md`).

## 1. Users

| User | Who | Device and setting | What they need most |
|---|---|---|---|
| **Head coach** | Coach James; later each programme lead (Coach Jabez, Coach Ralph) | Android phone, sometimes a tablet; pitch side, sun, dust, no signal | Plan fast, show the kids the plan, keep minutes fair, see the whole club |
| **Coach** | Kurt, Kim, Ralph, Jabez, Steve, Ivan; volunteers learning on the job | Own phone, one hand, under a minute per task | A ready session, who is coming, who goes on next |
| **Kids (viewers)** | Ages 7 to 16, watching a tablet or TV | Three metres away, bright sun or a clubhouse TV | Big numbers, names, colours, one idea at a time |
| **Parent or guardian** | Mostly prepaid data, Facebook Lite and Messenger, some share one phone per family | Cheap Android, occasional iPhone | When and where, reply Going or Not going, see their own child's progress |
| **Player 13+** (optional, Phase 7) | Older players with parent permission | Own or family phone | Own goals, progress, schedule; read-only |
| **Club admin** | You (Jan) plus one co-admin | Laptop or phone | Set up programmes, teams, coaches, settings, backups |
| **Treasurer** (optional, Phase 6) | A trusted parent or coach | Phone | Confirm contributions privately |

## 2. Product principles (use these to settle any argument)

1. **One minute, one hand.** Any touchline task takes under a minute on a phone held in one hand.
2. **Offline first on match day.** No signal must never stop a match screen.
3. **Kids first on the big screen.** Three messages at most; big numbers; colour plus shape; no clutter.
4. **Every child matters equally.** Fair minutes, no rankings, recognition that reaches everyone.
5. **Collect less.** If we do not need a piece of data, we do not store it.
6. **Do not replace what works.** Facebook page and Messenger stay; the app feeds them.
7. **Free forever, light on data.** Parent pages load fast on prepaid data; nothing is paywalled; taking part never depends on the app.
8. **Coach the coach.** Every screen nudges good practice (ask questions first, praise effort, rotate positions) without lecturing.
9. **Safety is a default, not a setting.** Heat, lightning, concussion and growth checks are on unless the head coach switches them off.
10. **Smaller over time.** Features nobody uses after a month are removed.

## 3. App map

```
app.rangersfc.net
├── Sign in (Phase 2+)            Google, or a 6-digit code by email
├── COACH SIDE (bottom tabs)
│   ├── Today          next event, heat check, who is coming, quick actions
│   ├── Match          lineup, rotation plan, live match, report
│   ├── Board          tactics and set-piece library, editor, Match Day Board
│   ├── Train          session builder, run mode, drills, curriculum
│   ├── Squad          players, development, wellbeing, attendance
│   └── More           announcements, club support, settings, help
├── PARENT SIDE (bottom tabs)
│   ├── Home           my children, next event, reply buttons, alerts
│   ├── Schedule       events, replies, venue, heat notes
│   ├── Progress       each child: strengths, working on, goals, badges
│   └── More           announcements, contributions, privacy, help
├── TV / PRESENT MODE   full-screen Match Day Board, swipe or remote
└── ADMIN               programmes, teams, seasons, coaches, settings, exports
```

Phase 1 ships only the coach side's Match and Board tabs plus a local Squad, with no sign-in.

## 4. Modules, features and acceptance criteria

### M1. Squad (Phase 1 local, Phase 2 cloud)

- Add players: first name or nickname, optional last name (never shown to kids), shirt number, birth date (coach and guardian only), preferred positions (up to three), "happy to try in goal" flag, photo consent flag.
- Bulk add by pasting a list ("7 Ana", "10 Ben").
- Demo team ("Rangers Demo", invented names) loads in one tap for training and screenshots.

**Accepted when**
- [ ] A coach can add 16 players by paste in under 2 minutes on a phone.
- [ ] Without photo consent, every kid-facing view shows initials, never a photo.
- [ ] Last names never appear on Match Day Board, TV or motivation screens.

### M2. Board engine and strategy library (Phase 1)

One engine renders tactics, set pieces, drill diagrams and the half-time board.

- **Pitches**: 4v4, 5v5 futsal court, 7v7, 8v8, 9v9, 11v11; full, half and final-third views; vertical (phone) or horizontal (TV). Dimensions are editable per club (the Yam 1 home pitch should be measured and saved).
- **Pieces**: our players (circle, Rangers red, white number, first name below), opponents (rounded square, cream with navy number), ball, cones, mini-goals, zones.
- **Tools**: select and drag; solid arrow = run without the ball; dashed arrow = pass; wavy arrow = dribble; double-head arrow = shot; shaded zone = space; pen = freehand; undo, redo, clear. A small key in the corner explains the arrows.
- **Steps (scenes)**: a strategy has numbered steps. Each step stores positions, arrows and who has the ball. Play animates slowly between steps on a loop (default 1.2 s move, 1.5 s pause), adjustable.
- **Save**: name, format, age bands, steps, "Why it works" (written for kids, max 2 sentences), coach note (coach only), tags. Presets from the playbook are read-only originals; editing creates the coach's own copy.
- **Fill from lineup**: one tap replaces placeholder pieces with today's players by position.

**Accepted when**
- [ ] Dragging stays smooth with 16 pieces and 10 arrows on a mid-range Android phone.
- [ ] A coach can draw a 3-step overlap in under 2 minutes.
- [ ] The same strategy renders correctly on a phone (vertical) and a TV (horizontal).
- [ ] All playbook presets for the chosen format appear, and only those suited to the team's age band.

### M3. Match Day Board (Phase 1)

Full-screen presentation for kids. Swipe, tap the edges, or use a keyboard or TV remote arrows.

| Slide | Kids see | Coach does |
|---|---|---|
| **Lineup** | Pitch with each starter's first name and number in position; bench below | Drags players into place or accepts the rotation plan |
| **Our 3 keys** | Up to three short messages with icons ("Win it back fast", "Spread wide", "Talk to each other") | Picks from saved phrases or types; more than three is blocked |
| **The move** | One animated strategy on loop | Picks from the library |
| **Set pieces** | Who stands where for corners, kick-offs, goal kicks | Picks saved set pieces |
| **Our values** | The programme's values (Rangers: Play With Your Heart and the seven values; FC New Mabu: MABU; Gila: GILA) with today's focus value highlighted | Picks today's focus value |
| **Half-time** | The pitch, one thing going well, one thing to change | Prompt first: "Ask them first: what is working?" Then adds two lines in under a minute |
| **Next on** | Sub clock: who comes on next and when | Runs from the live match (M4) |
| **Celebrate** | After the match, one team moment, win or lose | Picks the moment (effort, a pass, a save) |

- **Display modes**: Club (navy and red, default for TV indoors), Sun (high contrast cream background for outdoor tablets).
- **Text size** scales for TV; minimum 6% of screen height for names.

**Accepted when**
- [ ] On a 1920x1080 screen viewed from 3 m, names and numbers are readable (checked in person at the field test).
- [ ] The whole board works in airplane mode after the app has been opened once online.
- [ ] Going from Lineup to Half-time takes one swipe or one tap per slide; no slide needs more than one tap to reach.

### M4. Match: lineup, fair minutes and live match (Phase 1)

**Before the match**
- Choose who is available (Phase 1: tick on the device; Phase 3: from parents' replies).
- Set the format, number of periods, period length and how subs work (rolling subs every N minutes, or only at breaks; set per competition).
- **Rotation plan**: the app proposes who starts and who goes on at each sub window so planned minutes are as equal as possible, keeps the keeper fixed within a period, avoids benching anyone twice in a row, rotates positions for U12 and below, excludes injured or concussion-blocked players, and gives priority to children owed minutes from recent matches (season carry-over, adjustable: off, gentle, strong). The coach can lock any cell (this player starts, this player in goal for period 2) and re-run.
- Plan view: a grid (players by windows) with planned minutes per child and the spread (most minus least).

**During the match**
- Big clock that follows wall time (keeps running if the phone locks). Start, pause for breaks, end period, end match.
- **Now / Next** view: who is on, who is due on next, minutes played, and "owed" time for children on the bench (shown once they are a full minute behind).
- Sub alert: vibration and a short sound one minute before each planned window, again at the window.
- One-tap events: sub (tap off, tap on), goal (optional, team-level only for U10 and below), coach mark per child (star: doing great; shy: needs encouragement; help: needs attention; a note).
- Late arrival or child leaves: the plan re-runs from now, keeping locks.
- Injury button: records the injury; "Suspected head injury?" opens the concussion flow (M9).
- Undo on every action. "Forgotten whistle" guard: if a match has run over two hours, ask when it actually ended.

**After the match**
- Report: minutes per child, positions played, the coach's marks and notes, goals if recorded. Export as CSV and JSON. In Phase 2+ it syncs and updates each child's season minutes.

**Accepted when**
- [ ] With 12 players in an 8v8 match of 2 x 25 minutes and rolling subs every 5 minutes, the plan's spread is at most 5 minutes with no locks.
- [ ] Locking the keeper for the full match still produces a valid plan and shows the spread honestly.
- [ ] The clock is correct after the phone is locked for 10 minutes mid-period.
- [ ] Every tap during a match works with no signal; nothing is lost if the browser is closed and reopened.

### M5. Schedule, availability and attendance (Phase 3)

- Event types: training, match, tournament, festival, meeting, other. Recurring training (for example every Saturday 7:00 to 8:30).
- Each event: date and time, venue (map link, nearest hospital, shelter), opponent, what to bring, kit, meeting time, transport note.
- **Availability**: parents tap Going, Not going or Maybe for each child. For recurring training, the default can be "Going unless you say otherwise" (set per team). Coaches can answer for a family that has no phone.
- **Attendance**: at training, one screen with every child; tap who is present. Under 30 seconds for 20 children.
- Coach dashboard: replies so far, who has not replied (one tap to remind).

**Accepted when**
- [ ] A parent can reply for two children in two taps from the home screen.
- [ ] A coach can take attendance for 20 children in under 30 seconds.

### M6. Announcements, reminders and "Share to group chat" (Phase 3)

- One-way announcements to a team, a programme or the whole club, with an optional "Seen by" count for coaches.
- Direct note from a coach to one family (development comment, a missed pickup). Parents can reply to a direct note; there is no group chat.
- Automatic reminders: the day before each event, and two hours before matches; one reminder to non-repliers.
- Channels: in-app banner (always), Web Push (if the parent allowed it; on iPhone only after "Add to Home Screen").
- **Share to group chat**: every event and announcement has a button that writes a ready message (date, time, venue, what to bring, reply link) and opens the phone's share sheet (Messenger, Viber, SMS, Facebook).

**Accepted when**
- [ ] A coach can post an announcement and share it to the Messenger group in under one minute.
- [ ] The shared message reads well as plain text with no app installed.

### M7. Training (Phase 4)

- **Session builder**: choose age band, number of players, minutes available, theme (or "this week's curriculum theme"), equipment available (balls, cones, bibs, goals). The app fills the template from the playbook (Arrival play, Warm-up, Skill, Game-like practice, Play, Huddle) with suitable drills and timings. Swap any drill; each shows its diagram, setup, rules, three coaching points, "make it easier / harder" (STEP), and an optional video.
- **Run mode**: big block timer, current drill diagram, coaching points, a buzz at block changes, water-break prompts from the heat check.
- **Curriculum**: a 12-week plan per age band from the playbook; the builder suggests the current week's theme.
- **Drill library**: seeded with the playbook drills, filterable by age, theme, players, space and equipment. Coaches add their own (diagram drawn in the board engine).
- **Heading rules**: drills with heading are hidden for U11 and below and limited for U12 to U16 (configurable).
- **Coach reflection**: after a session, two taps: energy (low, OK, high) and "Kids enjoyed it?" (yes, partly, no), plus an optional note. Used to improve future suggestions.

**Accepted when**
- [ ] A coach gets a complete, age-appropriate 60-minute session in under 5 minutes, with only the equipment they said they have.
- [ ] Run mode works offline and survives the screen locking.

### M8. Player development (Phase 5)

- **Profile**: four corners (Technical, Tactical, Physical, Psychological and Social). Each age band has about six skills (playbook section 7).
- **Levels in words**: Learning it, Getting it, Got it, Can teach it. Stored as 1 to 4; parents and kids only ever see the words.
- **Term review**: a swipe-through screen, about two minutes per child: set levels, pick one strength to celebrate, one thing to work on, one or two sentences for the family. Coach-only notes stay coach-only.
- **What the family sees**: "You then, you now" for each skill; Strengths first; Working on (with a linked drill and video to try at home); "Fastest developing" skill; goals; badges; attendance and minutes summary. Never a total score, never a comparison.
- **Goals**: one goal the child chooses with the coach ("Use my left foot in games"), reviewed monthly.
- **Self-rating 11+**: the child rates the same skills; the coach sees both side by side to start a conversation.
- **Recognition**: after each session or match, the coach can recognise one or more children for a club value (for Rangers, one of the eight values). A coach-only nudge lists children not recognised in the last six weeks.
- **Badges**: skill badges (learned a named move, see playbook) and value badges. Awarded after the fact, never promised in advance; nothing for goals scored or wins.
- **Coach marks** from matches (star, shy, help) appear on the coach's view of the profile as prompts.

**Accepted when**
- [ ] A coach can finish a term review for a 16-player squad in under 40 minutes.
- [ ] A parent sees only their own child; there is no screen anywhere that lists children's levels side by side.

### M9. Wellbeing and safety (Phase 3 heat and lightning; Phase 5 the rest)

- **Heat check** on every outdoor event: hourly heat index for the venue during the event (Open-Meteo), PAGASA category, and the playbook's actions (water breaks, shade, shorter session, reschedule, cancel). Shown on the event card, in run mode and in parent reminders.
- **Lightning rule**: if thunderstorms are forecast, the event card shows the shelter plan. A "Thunder heard" button starts a 30-minute countdown that resets each time it is tapped again.
- **Concussion flow**: "Suspected head injury" opens the CRT6-based checklist (signs, symptoms, red flags). Red flag: call for medical help now. Any sign or symptom: remove from play, no return today, notify the family, block from lineups until a head coach records medical clearance and the return steps. Default minimum 21 days before a competitive match (configurable).
- **Injury log**: what happened, body part, action taken, family notified (yes, no). Coach and family only.
- **Growth**: height every three months (measured at the club, shoes off, same wall chart). If growth is 7.2 cm a year or faster (from two measurements at least 8 weeks apart), flag "Growth spurt" for coaches and family, with load advice. Implausible values ask for a re-measure.
- **Wellness check 13+** (optional): before training, three taps: sleep, soreness, mood (1 to 5). A conversation starter, never a selection tool.
- **Emergency info**: per child, up to two emergency contacts, allergies, inhaler, a condition to watch. Offline on the coach's device for match days.
- **Match-day checklist**: water, first-aid kit, ice, shade, goals anchored, emergency contacts downloaded, nearest hospital known.

**Accepted when**
- [ ] A child flagged with a suspected concussion cannot be placed in a lineup or rotation plan by any coach until cleared.
- [ ] Heat guidance appears on every outdoor event created at least one day ahead.

### M10. Club support (Phase 6)

- **Tournament fund**: for each tournament, the total needed (entry fee, transport, food), what has come in from sponsors and contributions, and what is still needed. Visible as totals only, never per family.
- **Boot bank and kit**: inventory of balls, bibs, cones, goals and donated boots by size; children who need boots record their size privately; coaches match boots to children.
- **Needs list**: a public-friendly list the club can share on Facebook ("We need 10 size 4 balls").
- **Optional contributions** (only if the club decides it wants them): per programme, the coach shows a GCash QR; the parent pays in GCash, enters the 13-digit reference number; a treasurer or coach taps Confirm. Scholarship or waived status is set privately and is invisible to other families. No payment screenshots are stored unless the club insists, and those are deleted at season end.

**Accepted when**
- [ ] No parent can see any other family's payment status, waiver or boot request.
- [ ] A treasurer can confirm 10 payments in under 3 minutes.

### M11. Accounts, families and privacy (Phase 2)

- Sign in with Google or with a 6-digit code sent by email. No passwords.
- **Family invite link** per child, created by a coach, single-use, valid 14 days, sent privately (Messenger). Opening it on a signed-in parent account links that child; a second link adds a sibling.
- New parents see the privacy notice (English and Filipino) and consent choices: data processing (required), photo on team screens, video in the drill library, team photo wall. Each choice is stored with the date and notice version and can be changed any time.
- Coaches join through an admin invite; the admin approves.
- A parent can download their child's data and ask for deletion from the app.

**Accepted when**
- [ ] A parent goes from tapping the invite link to seeing their child's next event in under 2 minutes.
- [ ] Reusing or forwarding an invite link after use fails with a friendly message.

### M12. Admin (Phase 2, extended later)

- Programmes (Rangers FC, FC New Mabu, Gila Academy) with crest, colours, values and contact.
- Teams per programme and season, with age band and default format.
- Coaches and their teams; roles (head coach, coach, treasurer, admin).
- Club settings: heat thresholds, heading rules, concussion minimum days, availability default, data retention.
- Season rollover: archive the season, move children up an age band, keep development history.
- Data retention: player data removed 12 months after a child leaves (configurable); payment details removed at season end.

### M13. Motivation corner (Phase 5)

On the big screen before or after training:
- **Move of the week**: one skill video and a challenge to show it next session.
- **Our values**: the programme's values; the team picks one to focus on this month.
- **Comeback stories**: two or three lines about real players who were late developers or were cut and kept going (each story checked by the head coach for accuracy).
- **Team moment**: a photo or a sentence after each match (photos only for children with consent).

## 5. Branding and design system

Taken from rangersfc.net so the app feels like the club.

| Token | Value | Use |
|---|---|---|
| `--rfc-red` | `#C31E24` | Primary buttons, our players on the board, highlights |
| `--rfc-navy` | `#051A31` | Cards, pitch background in Club mode |
| `--rfc-deep` | `#03080F` | App background in Club mode |
| `--rfc-cream` | `#F9F6EF` | Text in Club mode; background in Sun mode |
| `--rfc-theme` | `#05101F` | Browser theme colour |
| Heading font | Bebas Neue | Titles, board numbers, the clock |
| Body font | Barlow | Everything else |
| Radius | 20 px cards, 999 px (pill) buttons | Matches the site |

**Modes**
- **Club mode** (dark navy, default indoors and on TV).
- **Sun mode** (cream background, navy text, red accents) for outdoor phones and tablets. One tap from any screen header; remembered per device.
- **Programme skins**: FC New Mabu and Gila use their own crest and accent colour (confirm colours with Coach Jabez and Coach Ralph); the layout stays the same.

**Board colours and colour blindness**: red-green colour blindness affects several percent of boys, so expect at least one or two in the club. The board never relies on red versus green. Our players are red circles with a white outline and number; opponents are cream rounded squares with navy numbers; the pitch is navy with cream lines in Club mode. Shape always differs, not just colour.

**Typography on match screens**: clock and shirt numbers in Bebas Neue at large sizes; nothing below 18 px on phones or 4% of screen height on TV.

**Icons**: lucide icons, always with a text label on first use.

**Crest**: use the high-resolution original from the club (ask for a PNG at least 1024 px or a vector). PWA icons at 192, 512 and maskable 512 are generated from it.

## 6. Words and tone

- Plain, warm, short. "Who is coming?" not "Attendance management".
- Talk about effort and learning: "Working on", never "Weakness". "Got it", never "Passed".
- Kids' screens use "we" and "our": "Our 3 keys", "Our values".
- Safety wording is fixed in the playbook; do not soften or embellish it.
- Languages: English first; Filipino (Tagalog) and Cebuano in Phase 7, translated by club volunteers and checked by a coach.

## 7. Non-functional requirements

| Area | Requirement |
|---|---|
| Devices | Android 10+ Chrome, iOS 16.4+ Safari, desktop Chrome or Edge; TV via HDMI, screen mirroring, or a TV browser |
| Speed | Parent home under 3 seconds on a slow 4G connection; under 250 KB of JavaScript for parent routes |
| Offline | Match, board, squad, current session and emergency info work with no signal |
| Data use | A parent checking the schedule uses under 200 KB after the first visit |
| Accessibility | WCAG 2.2 AA contrast in both modes; 48 px touch targets (56 px on match screens); works with system font size increased |
| Privacy | Data Privacy Act; NPC child-oriented transparency; minimum data; RLS on everything; retention rules |
| Reliability | Weekly encrypted backup; keep-alive job; status of last backup visible to admins |
| Maintainability | Plain stack, tests on all logic, docs updated with each phase |

## 8. Out of scope (on purpose)

- Group chat, social feed, comments.
- Public league tables, player rankings, "best player" lists.
- App store release (it is an installable web app).
- Automatic payment gateways (PayMongo and similar charge 1.5 to 2.5% and need a business account; revisit only if manual confirmation becomes a burden).
- Video hosting (link YouTube instead).
- GPS tracking, wearables, body weight, body fat.
- Scouting or selection tools.
