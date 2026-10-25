# Decisions

Fill in the **Answer** column after talking to Coach James and the coaches. Leave it blank to accept the recommended default. The Planner reads this file before every spec; an answer here overrides any default in the other docs.

## Setup and ownership

| # | Question | Recommended default | Answer |
|---|---|---|---|
| D1 | Where does the app live? | `app.rangersfc.net`, separate repository | |
| D2 | Who owns the code and accounts? | GitHub organisation `rangersfc` and a club Google account, with Jan and one co-admin as owners | |
| D3 | Who is the co-admin? | A trusted adult who is not a coach (spreads the load) | |
| D4 | Move the club website repository into the organisation? | Yes (needed for clean domain verification) | |
| D5 | Name on the phone's home screen | "Rangers FC" (short name "Rangers") | |

## Pilot and scope

| # | Question | Recommended default | Answer |
|---|---|---|---|
| D6 | Pilot team and pilot coach | Jan's son's team; its regular coach | |
| D7 | Programmes at launch | Rangers first; FC New Mabu and Gila join after Phase 3 | |
| D8 | Coach James's top two weekly needs (from the interview) | (fill in) | |
| D9 | Is there a TV or projector we can use? Where? | Tablet held up outdoors; HDMI where a TV exists | |

## Teams and matches

| # | Question | Recommended default | Answer |
|---|---|---|---|
| D10 | Age groups per programme and number of children | (fill in a row each) | |
| D11 | Format, match length and sub rule for each league or tournament | 8v8 for U11 to U13; check each competition | |
| D12 | U8 and U10 formats | U8: 4v4 or 5v5; U10: 7v7 or 8v8 | |
| D13 | Yam 1 pitch size and goal size | (measure) | |
| D14 | "Competitive mode" minimum share of minutes in knockouts | 40% for every available child | |
| D15 | Rotate positions until which age? | U12 | |
| D16 | Record goals scored for U10 and below? | Team total only, no individual scorers | |

## Families and communication

| # | Question | Recommended default | Answer |
|---|---|---|---|
| D17 | Training availability default | "Going unless you say otherwise" for training; ask every time for matches | |
| D18 | Main channel | Messenger group plus "Share to group chat"; push reminders as a bonus | |
| D19 | Languages | English first; Filipino and Cebuano in Phase 7 | |
| D20 | Photo consent default | Off until a parent says yes | |

## Money and support

| # | Question | Recommended default | Answer |
|---|---|---|---|
| D21 | Contributions or fees in the app? | No, until Coach James asks for it | |
| D22 | Tournament fund and boot bank? | Yes, in Phase 6 | |
| D23 | Who confirms money, if anything is collected? | A treasurer who is not the head coach | |

## Safety and development

| # | Question | Recommended default | Answer |
|---|---|---|---|
| D24 | Heat thresholds and actions (playbook 9.1) | Approve as written | |
| D25 | Heading rules (playbook 9.4) | Approve as written | |
| D26 | Concussion minimum days before a competitive match | 21 days, plus medical clearance | |
| D27 | Club welfare contact | (name a person) | |
| D28 | Who measures height, and where? | One coach per team, at the club wall chart, every 3 months | |
| D29 | Wellness check for 13+ | Off at launch; try with one U14 or U16 team later | |
| D30 | Development skills per band (playbook 7.2) | Approve, or edit with Coach James | |
| D31 | Values used for recognition | Each programme's own values (Rangers 8, MABU, GILA) | |
| D32 | Mistake reset signal | Tap the badge, "Play with your heart", next play | |
| D33 | FC New Mabu and Gila colours | (ask Coach Jabez and Coach Ralph) | |
| D38 | Handing the club over | Admin invite links (one person, one use, 3 days). The new admin is active at once; the old admin can step down to coach. The club always keeps one admin. | Jan, Oct 2026 |
| D39 | Feedback | Everyone signed in can send feedback (idea, problem, praise; optional face rating). Admins and chosen readers see it in the app with an alert; email via Apps Script webhook. Kept 2 years, 20 a day per person. | Jan, Oct 2026 |
| D44 | Age groups | U6 to U19, 20+, 30+ and 40+. A team or a training session can mix several. Plans and safety rules (heading only from 12) follow the youngest; each child's review uses their own age group when the birthday is known. The coaching content is written for U8, U10, U12, U14 and U16, so every other age group uses the nearest one (U6 and U7 use U8, U9 uses U10, U11 uses U12, U13 uses U14, U15 and older use U16). Content written for adults (20+, 30+, 40+) would need Jan's approval. | Jan, Oct 2026 |
| D41 | Coaches' own drills | Any coach can create a drill (set-up, instructions, coaching points, easier/harder, photos, a video, a saved board). Coaches only, never families. Only its author or an admin can change or remove it; others make their own version (words copied, not photos or video). Usable in session plans. Heading drills only from age 12. | Jan, Oct 2026 |
| D42 | Coaches' videos in the app | Uploaded inside the app to the club's Google Drive through a Google Apps Script on the club account (drive.file scope: it sees only its own files). Coaches only; checked with the Rangers sign-in. Anyone with a video's link can watch it (like unlisted YouTube); links are shown only in the app. Removed videos go to the Drive bin (30 days). Children's task videos stay in the private app storage (D40). | Jan, Oct 2026 |
| D43 | Alerts and sound | Push alerts set up from Settings (keys made on the admin's device; alerts sent every minute, high priority). The club song "We move as one" plays for new messages and announcements while the app is open; Android users can set it as the alert sound by hand. Web apps cannot choose the alert sound when closed (iPhone never). | Jan, Oct 2026 |
| D40 | Videos (free) | Long and how-we-work videos: Unlisted YouTube links in the in-app Video library (coaches only, one team, or the whole club). Short videos (up to 30 s, made small on the phone) for task proofs and coach demos, in a private bucket with a 600 MB club cap: when full, new ones are refused, nothing is deleted. Children's task videos are deleted 14 days after the coach checks them. Coaches' videos never expire and are removed only by a coach or admin, with a confirm. Children appear in coach videos only with the family's video permission, which coaches can now see. | Jan, Oct 2026 |
| D37 | Tactics board | Free draw (finger pen: Run, Pass or Line, four colours) beside Step by step (moves that play). Players are small human figures: red shirts for us, white for opponents, yellow for keepers. Upright pitch that fits the phone, and a Big (full screen) button. | Jan, Oct 2026 |

## Data

| # | Question | Recommended default | Answer |
|---|---|---|---|
| D34 | Keep data after a child leaves for | 12 months | |
| D35 | Store payment screenshots? | No; reference numbers only | |
| D36 | Who reviews the privacy notice? | Someone familiar with the Data Privacy Act (a lawyer parent or the barangay's data protection officer, if any) | |

## Open questions (the Planner adds these)

| # | Question | Planner's recommended default | Answer |
|---|---|---|---|
| | | | |
