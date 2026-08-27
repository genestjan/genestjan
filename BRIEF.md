# genestjanramirez.com
## Website Story, Copy Deck and Claude Code Build Brief

**Owner:** Genest Jan Ramirez II
**Domain:** genestjanramirez.com
**Replaces:** admin76429.wixsite.com/mysite
**Stack:** Next.js (App Router) + Tailwind CSS + Three.js (@react-three/fiber, @react-three/drei) + Framer Motion
**Contact on site:** genestjan@genestjanramirez.com

---

# PART 0 — How to use this document

This file does three jobs.

1. **Parts 1 to 5** are the *story*: positioning, voice, and every word of copy that goes on the page. Read these to check the message is right before a single line of code exists.
2. **Part 6** is the *design system*: colours, type, motion rules, performance budget.
3. **Part 7** is the *build prompt*. Copy that block straight into Claude Code. It references this document, so keep the whole file in the repo root as `BRIEF.md`.

Parts 8 and 9 cover deployment and the assets still needed.

**Non-negotiable rule for anyone writing copy for this site:** every word is first person, Jan's own work, Jan's own voice. There is no team, no agency, no "we". The site says "I".

---

# PART 1 — The Brand Story

## 1.1 The one-sentence positioning

> **I build the system behind the marketing, then I run it.**

Not "virtual assistant". Not "social media manager". Those undersell nine years of work and they anchor the price low. The site sells a **digital marketing operator**: someone who designs the machine, builds it, runs it, and reports on whether it actually made money.

## 1.2 The core narrative (the story the whole site tells)

Jan trained as an **Industrial Engineer**. Industrial engineering is the discipline of making a process produce more with less waste. You map the flow, find the bottleneck, fix the constraint, standardise it, then measure it again.

Then he spent nine years inside small businesses doing digital marketing, and found the same thing over and over: the marketing was not broken because the ads were bad or the content was bad. It was broken **in the gaps between the parts**. The ad worked and the landing page leaked. The form worked and the CRM never tagged the lead. The email sent and nobody knew if it produced a booking. Every piece existed. Nothing was connected.

So the pitch is not "I do Meta ads" or "I edit video". It is:

> Most businesses do not have a marketing problem. They have a **handoff** problem. I find where your customer journey breaks between one step and the next, I fix it, and then I build it so it runs without you.

That is the whole website in one idea. Everything else is proof.

## 1.3 What makes this defensible

Most freelancers own one link in the chain. Jan owns the chain:

```
Strategy → Content → Social → Meta Ads → Landing Page → Funnel
   → Form → CRM → Tag → Workflow → Email → Booking → Sale → Report
```

That means no coordination tax, no "that's not my scope", no three contractors blaming each other. One person who can see the whole route and is willing to do the hands-on work at every stop on it.

## 1.4 Brand voice rules

**Sounds like:** a competent person talking straight to you across a table. Warm, plain, confident without swagger. Occasionally dry. Never salesy.

**Do:**
- Short sentences. Real verbs. Second person ("your ads", "your leads").
- Name the specific frustration before naming the fix.
- Admit what is hard and what takes time.
- Use numbers where they exist, and nowhere else.

**Do not:**
- No corporate jargon. No "leverage", "synergy", "solutions provider", "results-driven professional".
- No motivational filler. No "unlock your potential", "take your business to the next level", "in today's fast-paced digital world".
- No em dashes anywhere on the site. Use commas, colons, or split the sentence.
- No fake urgency, no countdown timers, no "only 3 spots left" unless it is literally true.
- No invented statistics. If a number is not verified, it does not go on the page.

**Spelling:** British English throughout (optimise, organisation, programme, colour). Most of the client base is UK and Australian.

---

# PART 2 — Audience and Message Strategy

## 2.1 Who this site is written for

**Primary:** Founders and practitioners running a small service business, usually solo or with one or two staff. Coaches, consultants, allied health practice owners, course creators, agency owners. Revenue somewhere between just-starting and comfortably established. They are the bottleneck in their own business.

**Secondary:** Startup founders with an offer and no system. They have an idea and a logo and nothing that turns attention into money.

## 2.2 The pain points to write against

These are the exact sentences the audience says out loud. The copy should echo them back before offering anything.

- "I post every single day and nothing happens."
- "I'm paying for ads and getting leads, but nobody books."
- "I've got five different tools and none of them talk to each other."
- "I have no idea which part of my marketing actually made money."
- "I'm doing all of it myself and I've run out of hours."
- "I hired a VA and now I have a second job: managing the VA."
- "I know what I want to build. I don't know how to make it run without me."
- "Every time I stop marketing, the leads stop. There's no machine, just me."

## 2.3 The desires underneath those

- To stop being the bottleneck.
- To trust their own numbers.
- To hand something over once and have it stay handed over.
- To see the business work while they are asleep.
- To have one person who understands the whole thing instead of five who understand a piece.

## 2.4 The single job of this website

**Book a call.** Every section ends pointing at the same place. Not "learn more". Not "download my guide". No resume download. One conversion goal, one primary CTA, repeated without apology.

There is deliberately no secondary conversion. A resume download invites people to treat this as a job application and prices you as a hire rather than an operator.

---

# PART 3 — Site Map and Full Copy Deck

## Site map

| # | Section | Purpose | Primary CTA |
|---|---------|---------|-------------|
| 01 | Hero | Thesis + signature 3D | Book a call |
| 02 | The Gap | Name the pain | (scroll) |
| 03 | The System | Interactive pipeline diagram | (scroll) |
| 04 | About Jan | Credibility + human | (scroll) |
| 05 | What I Do | All 10 service pillars | Book a call |
| 06 | Selected Work | Portfolio, filterable | View case |
| 07 | Industries | Sector proof | (scroll) |
| 08 | Stack | Tools and platforms | (scroll) |
| 09 | How We'd Work | Process, 4 steps | (scroll) |
| 10 | Experience | Full career timeline | Book a call |
| 11 | Testimonials | Social proof | (scroll) |
| 12 | FAQ | Objection handling | (scroll) |
| 13 | Contact | Convert | Send / WhatsApp |
| 14 | Footer | Nav, legal, socials | — |

---

## 01 — HERO

**Eyebrow (mono, small caps, cyan):**
`GENERAL SANTOS CITY, PHILIPPINES / WORKING UK, AU, US HOURS`

**H1 (Space Grotesk, oversized, staggered word reveal):**

> ### Your marketing isn't broken.
> ### The wiring between the pieces is.

**Sub (Inter, muted):**

> I'm Jan. I build and run the systems that connect your ads, funnels, content and CRM into one machine that actually produces bookings. Industrial Engineer by training. Nine years inside other people's businesses, fixing the parts nobody else wanted to touch.

**Primary CTA:** `Book a call` (magnetic hover, amber fill)
**Secondary CTA:** `See how it works` (ghost, scrolls to section 03)

**Trust strip (mono, muted, beneath CTAs):**
`9+ YEARS · 25+ BUSINESSES · META ADS · KAJABI · GOHIGHLEVEL · FUNNELS · AUTOMATION`

**Signature 3D element:** see Part 6.5. This is the one thing the site is remembered by.

---

## 02 — THE GAP

**Eyebrow:** `01 / THE PROBLEM`

**H2:**
> Everything works. Nothing connects.

**Body:**

> Here is what usually happens.
>
> You run an ad. It gets clicks, so the ad is fine. The landing page loads, so the page is fine. Someone fills in the form, so the form is fine. And then the lead lands somewhere nobody checks, no tag gets applied, no email goes out, no booking happens, and three weeks later you are looking at your ad spend wondering what you paid for.
>
> Every individual piece passed its own test. The customer still fell through the floor.
>
> That gap between the pieces is where almost all of the money goes. It is also the part nobody wants to own, because owning it means understanding ads *and* pages *and* email *and* CRM *and* tracking at the same time.
>
> That is the part I own.

**Pain cards (glassmorphism, floating, tilt on hover, staggered reveal). Six cards, each a quote and a one-line diagnosis:**

| Quote | Diagnosis |
|---|---|
| "I post every day and nothing happens." | No path from the post to anywhere. Content without a funnel is a hobby. |
| "I get leads but nobody books." | The problem is almost never the ad. It is the twenty minutes after the click. |
| "None of my tools talk to each other." | Five subscriptions, zero integrations. You are the integration. |
| "I don't know what actually made money." | Attribution was never set up, so every decision is a guess. |
| "I've run out of hours." | You are doing work that a workflow should be doing. |
| "If I stop, the leads stop." | You have a job with extra steps. You do not have a system yet. |

---

## 03 — THE SYSTEM

**Eyebrow:** `02 / THE APPROACH`

**H2:**
> One route. Fourteen stops. I work all of them.

**Body:**

> Industrial engineering has one core habit: before you fix anything, you map the flow and find the constraint. Everything else is guessing with confidence.
>
> Your customer takes a route through your business. It starts with attention and it ends with money, and there are more steps in between than most people count. Here is the route. Click any stop to see what I do there.

**Interactive pipeline (the signature element, see Part 6.5).** Fourteen nodes, clickable, each opens a glass panel:

| Node | What I do there |
|---|---|
| Strategy | Work out who we are actually talking to and what the offer needs to be before spending anything |
| Content | Plan and produce the posts, videos, articles and lead magnets that earn the attention |
| Social | Publish, engage, manage community, track what performs and why |
| Meta Ads | Build, launch and optimise Facebook and Instagram campaigns for leads, sales and DM conversations |
| Landing Page | Design and build the page the click lands on, written for conversion not decoration |
| Funnel | Lead magnet, tripwire, webinar or booking funnel, mapped end to end |
| Form | Capture the lead cleanly, with the fields that qualify and none that scare people off |
| CRM | Route the contact into the right pipeline stage in GoHighLevel, Kajabi or HubSpot |
| Tag | Segment on the way in, so the follow-up can be specific instead of generic |
| Workflow | Trigger the automation: notifications, sequences, task creation, pipeline moves |
| Email | Write and build the nurture sequences that do the selling while you sleep |
| Booking | Calendar integration, reminders, no-show follow-up, show-up rate tracking |
| Sale | Checkout, payment options, offer structure, order bumps, delivery |
| Report | Tell you honestly what worked, what did not, and what I would change next month |

**Closing line under the diagram:**

> Most people can do three or four of these. The gaps between the ones they *cannot* do are exactly where your business is leaking.

---

## 04 — ABOUT JAN

**Eyebrow:** `03 / WHO YOU'D BE WORKING WITH`

**H2:**
> I'm Jan. I like finding out why things are broken.

**Body (2 columns: photo left with cinematic grain and glow, copy right):**

> I'm Genest Jan Ramirez, based in General Santos City in the southern Philippines. I've worked remotely for over nine years, and before that I trained and worked as an Industrial Engineer.
>
> That background is not decoration. Industrial engineering is the study of processes: how work flows, where it jams, what it costs, and how to make it repeatable so it does not depend on one heroic person. Swap "factory floor" for "customer journey" and it is the same discipline.
>
> It is also why I'm probably not the right person for you if you want someone to just post three times a week and never ask questions. I ask a lot of questions. Where did this lead come from, what happens after they submit, who follows up, what does success look like in numbers. It is annoying at the start and it is the reason things work later.
>
> I started where most people start: administrative work, then social media, then video, then ads. Over the years the work kept moving upstream, from "do this task" to "design the thing that makes the task unnecessary". Today I run full digital operations rather than doing scattered tasks, and I go deep with a small number of businesses instead of thin across many.
>
> I keep the roster deliberately small. Around 65 hours a week of capacity, total, across everything. That means I say no more than I say yes, and the businesses I do take on get someone who actually knows their numbers.
>
> Outside of work I'm a husband and a father of four, I build small side projects for fun (including a mobile football game and a grassroots youth club's entire digital setup), and I have an ongoing obsession with local AI models and EVs that my wife has learned to live with.

**Fact strip (mono, animated counters):**

| 9+ | 25+ | 65 | 3 |
|---|---|---|---|
| years remote | businesses supported | hours/week capacity | languages spoken |

**Languages line:** `English (UK and US conventions) · Filipino · Cebuano`

---

## 05 — WHAT I DO

**Eyebrow:** `04 / SERVICES`

**H2:**
> Ten things. All of them connected.

**Intro:**
> You do not have to take all of it. Most people start with one broken thing and it grows from there. But it is worth knowing that whichever one you start with, I understand what it plugs into.

**Ten service cards (glassmorphism, tilt, staggered reveal, expandable):**

### 01 · Digital Marketing Strategy
The part everyone skips. Who we're targeting, what the offer is, what the customer journey looks like, what we measure, and what we do first. Before anything gets built or boosted.
`Audience research · Offer positioning · Customer journey mapping · Campaign planning · Channel strategy · Budget allocation`

### 02 · Meta Ads and Media Buying
Facebook and Instagram campaigns built for a business outcome, not a vanity metric. I will show you CTR and CPC because you'll ask, but the conversation I want to have is about cost per booked call, lead quality, and where the funnel is losing people after the click.
`Campaign strategy and build · Audience segmentation and testing · Creative direction · Lead gen, conversion, DM and tripwire campaigns · Pixel and CAPI setup · Budget management · Honest monthly reporting`

### 03 · Website Design and Development
Dynamic, fast, modern websites that are built to convert rather than just to look nice. Including the technical end most people would rather not touch.
`Custom site builds · Squarespace, Wix, Kajabi, GoHighLevel · Conversion-focused structure · Copywriting · Domain, DNS and CNAME setup · Speed and mobile optimisation · Analytics and tracking`

### 04 · Landing Pages and Funnels
Lead magnets, tripwires, webinar funnels, mini courses, sales funnels, booking funnels. Built as a full journey, because a great page attached to a broken follow-up sequence is still a broken funnel.
`Lead magnet funnels · Tripwire offers · Evergreen and live webinar funnels · Sales pages · Booking funnels · Checkout and payment structuring · Conversion tracking · A/B testing`

### 05 · Basic App Development
Simple, useful applications for the times a website is not the right shape for the job. Web apps, mobile-friendly tools, HTML5 builds, interactive calculators and quizzes.
`Web app builds · HTML5 games and interactive tools · Mobile-responsive apps · Lead capture apps · Calculators and quizzes`

### 06 · Lead Generation
Filling the top of the funnel deliberately instead of hoping. Prospecting, outreach, qualification and appointment setting, in your voice and inside your boundaries.
`Prospect research and list building · Apollo and LinkedIn Sales Navigator · Personalised cold email · Instagram and Facebook DM outreach · LinkedIn outreach · Lead qualification · Appointment setting · Reply, booking and show-up rate tracking`

### 07 · Social Media Marketing
Strategy, content, publishing, community and reporting across the platforms that actually matter for your business rather than all of them at once.
`Facebook · Instagram · LinkedIn · YouTube · TikTok · X · Medium`
`Content strategy and calendars · Copywriting · Graphic design · Community management · Customer service · Audience growth · Analytics and reporting`

### 08 · Video and Photo Editing
Short form and long form, cut for the platform it is going on. Plus the repurposing pipeline that turns one recording into a month of content.
`Reels, Shorts and TikToks · YouTube long form · Talking head and promotional video · Captions and subtitles · Motion graphics · Photo retouching and product imagery · Thumbnails · Repurposing workflows`

### 09 · Podcast Production
Full pipeline, from raw recording to published episode to the clips that promote it. I currently manage a weekly podcast end to end.
`Audio and video editing · Show notes and descriptions · Episode scheduling and publishing · Guest coordination · Clip and Reel extraction · Podcast SEO · Distribution`

### 10 · Marketing Automation and Virtual Assistance
The connective tissue, plus the day to day operations work that keeps everything moving. This is where the leverage lives.
`GoHighLevel and Genie AI · Kajabi · Zapier and native integrations · CRM pipeline builds · Email automation · Webhooks · Commission and affiliate tracking · SOP creation · Project coordination · Inbox and calendar management · Reporting infrastructure`

---

## 06 — SELECTED WORK

**Eyebrow:** `05 / PROOF`

**H2:**
> Things I've built.

**Intro:**
> A working sample of the last few years. Where a client's numbers are commercially sensitive I've described what was built rather than what it earned, because publishing someone else's revenue without asking is a fast way to lose them.

**Filter tabs (mono, pill, cyan underline on active):**
`All · Websites · Funnels · Meta Ads · Automation · Content · Video · Podcast · Apps`

**Case study card structure (each opens a modal or detail page):**
```
[ Visual / device mockup / video loop ]
CATEGORY TAG
Client or sector
── Title of the build ──
The problem:   (1 sentence)
What I built:  (2 to 3 sentences)
The result:    (verified numbers only, or omit)
Stack:         [tool chips]
```

### Case studies to feature

**A. Full digital operations for a UK occupational therapy coaching brand**
`Websites · Funnels · Meta Ads · Automation · Podcast`
`Ongoing since 2024`
The problem: Ads were performing but the post-click experience was not converting, and revenue reporting across a membership, a course library and an affiliate programme was not trustworthy.
What I built: End to end digital operations. Meta ads strategy and management, a tripwire funnel live in Kajabi for the US market and rebuilt in GoHighLevel for the UK, a rewritten email nurture funnel repositioned to a wider audience, weekly podcast production, YouTube and blog pipelines, commission tracking, and monthly reporting that separates ad performance from funnel performance so the right thing gets fixed.
Stack: `Meta Ads` `Kajabi` `GoHighLevel` `Genie AI` `Descript` `Google Workspace`

**B. Evergreen webinar funnel and course build for a paediatric sensory health practice (Melbourne)**
`Funnels · Websites · Automation`
The problem: A practitioner with strong clinical expertise and no scalable way to sell it.
What I built: A complete Kajabi coaching course, including drip scheduling, custom subdomain, and a checkout with three payment options. Then an evergreen webinar funnel around it: registration page, watch page, replay sequence, and full funnel QA. Also diagnosed and resolved a long-running email automation fault that was silently sending nothing.
Stack: `Kajabi` `Meta Ads` `Google Workspace`

**C. Group programme launch system for an Australian allied health practice**
`Funnels · Content · Automation · Websites`
The problem: A practice moving from one-to-one delivery to group and membership models, needing the marketing infrastructure to support the shift.
What I built: Launch campaigns for two group programmes across in-person and online intakes, a B2B sales approach for a proprietary programme aimed at rehabilitation consultants and insurers, exhibition collateral for two national conferences, and a branded operational playbook documenting the full customer journey so the process survives staff turnover.
Stack: `Kajabi` `Squarespace` `MailerLite` `Meta Business Suite` `LinkedIn` `Stripe`

**D. Authority marketing and lead generation for a healthcare cybersecurity brand**
`Lead Gen · Content · Ads`
The problem: A compliance and cybersecurity offer aimed at healthcare practice owners, a market that buys on trust rather than on discounts.
What I built: Educational and thought leadership content positioning the founder as the authority in the space, plus a multi-state dental practice lead generation programme covering prospect research, list building, compliant outreach and appointment setting.
Stack: `Apollo` `LinkedIn Sales Navigator` `Meta Ads` `Email automation`

**E. Complete digital setup for a grassroots youth football club**
`Websites · Apps · Content`
The problem: A community club with no digital presence, no governance documentation and no way to reach parents.
What I built: A full club website, certificate and governance documentation, and a mobile HTML5 football game built as an engagement piece. Unpaid community work, included here because it shows the full range in one project.
Stack: `HTML5` `JavaScript` `Canva`

**F. Property video editing programme (Melbourne real estate)**
`Video`
What I built: A recurring pipeline of listing walkthrough videos for agents across Melbourne's north and west, cut for social and portal distribution.
Featured pieces: 23 Bellfield Dr Craigieburn · 30 Skyline Drive South Morang · 8 Sugarloaf Grove Werribee · 4 Worrowing Court Kurunjang
Stack: `Descript` `Adobe` `Canva`

**G. Multi-year podcast and video editing for two independent shows**
`Podcast · Video`
What I built: Four years of ongoing production for a long-form interview podcast and a separate interview show, covering audio and video editing, show notes, publishing and clip extraction for social.
Stack: `Descript` `Canva`

**H. Social media growth for a cooking club and food brand**
`Content · Social`
What I built: A rebuilt social presence across YouTube and other channels, a full content calendar, and original video and still content, alongside email campaign support. Documented in the client's own testimonial below.
Stack: `Canva` `YouTube` `Email platform`

**Gallery block below the case studies:**
Social media post samples carried over and upgraded from the current portfolio, presented in a cinematic masonry grid with hover zoom. Plus a link out to the full Google Drive portfolio.

---

## 07 — INDUSTRIES

**Eyebrow:** `06 / WHERE I'VE WORKED`

**H2:**
> Sectors I already understand.

**Body:**
> Industry knowledge saves you weeks. These are the ones where I already know the vocabulary, the regulations, the buying cycle and the objections.

**Grid of industry tiles (icon, name, one line):**

| Industry | Note |
|---|---|
| Occupational therapy and allied health | Full digital operations for OT-led coaching, membership and clinical brands across the UK and Australia |
| Paediatric and sensory health | Course builds, webinar funnels and parent-facing marketing |
| Healthcare compliance and cybersecurity | Authority and educational marketing to practice owners and decision makers |
| Coaching and consulting | Funnels, memberships, launches and evergreen offers |
| Course creators and educators | Kajabi course architecture, drip delivery, checkout and community |
| Real estate | Listing video, agent branding and social content across Australian agencies |
| Property investment and finance | Social media and content for investment-focused brands |
| Podcasting and media | End to end production for independent shows |
| Food, hospitality and lifestyle | Content, video and channel growth |
| Ecommerce and dropshipping | Store operations, product content and paid social |
| Logistics and industrial | B2B content and social for supply chain businesses |
| Community and grassroots sport | Websites, governance documentation and engagement tools |

---

## 08 — THE STACK

**Eyebrow:** `07 / TOOLS`

**H2:**
> Platforms I actually use, not ones I've read about.

**Body:**
> I split these honestly. "Daily" means I am in it most weeks and can build in it without a tutorial open. "Working knowledge" means I have built real things in it and would need a short ramp for anything unusual.

**Category rows with logo chips, each chip glowing on hover:**

**Advertising and social:** Meta Ads Manager · Meta Business Suite · Facebook · Instagram · LinkedIn · YouTube · TikTok · X

**CRM and automation:** GoHighLevel · Genie AI · Kajabi · HubSpot · Zapier · Klaviyo · MailerLite · Webhooks

**Sites and funnels:** Kajabi · Squarespace · Wix · GoDaddy · DNS and CNAME configuration · HTML · CSS · JavaScript

**Content and video:** Descript · Canva · Adobe · CapCut

**Lead generation:** Apollo · LinkedIn Sales Navigator · Instagram DM · Facebook · Cold email platforms

**Project and comms:** Monday.com · ClickUp · Notion · Slack · Zoom · Google Workspace

**Commerce and scheduling:** Stripe · Calendly · Zanda

**AI and emerging:** Claude · ChatGPT · Ollama · Llama · Qwen · Docker · WSL · AI content and lead workflows

---

## 09 — HOW WE'D WORK

**Eyebrow:** `08 / PROCESS`

**H2:**
> Four steps. No mystery.

**Numbered steps, connected by an animated line that draws on scroll (numbering is justified here, it is a real sequence):**

**01 · Map**
We get on a call and I ask a lot of questions about how your business actually works right now. Where leads come from, what happens to them, what you're paying for, what you're guessing about. Free, no pitch deck, usually 45 minutes.

**02 · Find the constraint**
I go away and map your current customer journey properly, then come back with where I think the money is leaking and what I would fix first. You get this whether or not you hire me. If the fix is something you can do yourself in an afternoon, I will tell you that.

**03 · Build**
We agree a scope and I build it. You get visibility as it happens rather than a big reveal at the end, because the worst version of this work is finding out at handover that we understood the brief differently.

**04 · Run and report**
Most of this work does not finish. It runs. I manage it ongoing, and once a month you get a report that tells you what happened in plain language, including the parts that did not work.

---

## 10 — EXPERIENCE

**Eyebrow:** `09 / TRACK RECORD`

**H2:**
> Nine years, twenty-five plus businesses.

**Display note for the developer:** Three tiers. The **Current** group sits at the top, visually emphasised with an amber live-status dot and a subtle glow, because it is the only active engagement. The **Recent and Featured** group renders directly beneath it in the standard style. The **Full History** and **Before Freelancing** groups sit behind a `Show full history` toggle that expands with a smooth height animation. Do not dump all thirty entries on first paint.

Do not label the Current group with a count or write anything like "one active client". One long-running engagement presented confidently reads as selectivity. The same fact quantified reads as a gap.

### Current

| Period | Client | Role |
|---|---|---|
| 2024 – present | OT Freedom Collective (UK) | Digital Marketing Operator, full digital operations |

### Recent and featured

| Period | Client | Role |
|---|---|---|
| Feb 2023 – Dec 2024 | [Tyran Mobray](https://www.tyranmowbray.com/) | Social Media Marketing Specialist |
| May 2020 – Dec 2024 | [The Speed Up Co.](https://thespeedupco.com/) | Social Media Marketing Specialist |
| Jan 2021 – Dec 2024 | [Brendan D. Murphy / Truthiverse](https://truthiverse.com/) | Video and Podcast Editor |
| Apr 2022 – Dec 2024 | [The Vijay Kailash Show](https://vijaykailash.com/) | Video and Podcast Editor |
| Jul 2022 – Dec 2024 | [Dirty Boots Capital](https://dirtybootscapital.com/) | Social Media Marketing Specialist |

### Full history

| Period | Client | Role |
|---|---|---|
| Mar 2023 – Jun 2023 | [Bonicelli Cooking Club](https://bonicellicookingclub.com/) | Social Media Marketing Specialist |
| Mar 2023 – Jun 2023 | [Merchant Mastery](https://merchantmastery.io/) | Social Media Marketing Specialist |
| Apr 2023 – May 2023 | [Tara Fischer](https://www.tarafischer.com/) | Graphic Artist |
| Oct 2022 – Jun 2023 | [Dynamics of Conversation](https://www.dynamicsofconversation.com/) | Social Media Marketing Specialist, Android and iOS App Creator, Website Manager |
| Mar 2022 – Jul 2022 | [The Video Mentor](https://videomentor.org/) | Social Media Marketing Specialist |
| Nov 2021 – Aug 2022 | [Simona Brath MacNally](https://www.simonabrathmcnally.com/sbm-home) | Social Media Marketing Specialist |
| Nov 2021 – Feb 2022 | [Lola White Real Estate](https://www.lolawhiterealestate.com/) | Social Media Marketing Specialist |
| Jul 2021 – Mar 2022 | [Century 21 Novocastrian](https://c21novocastrian.com.au/) | Social Media Marketing Specialist |
| Jul 2020 – Dec 2021 | [Forging Excalibur](https://forgingexcalibur.com.au/) | Social Media Marketing Specialist |
| Jun 2020 – Dec 2020 | [Rank Local Marketing](https://www.instagram.com/rank.local.marketing/) | Social Media Manager |
| Nov 2019 – Aug 2021 | [Logisequence](https://www.linkedin.com/company/logisequence/) | Social Media Marketing Specialist |
| Jan 2017 – Dec 2019 | [Kumoten Online Dropshipping](https://www.kumoten.com/) | Virtual Assistant and Dropshipper |
| Jun 2017 – Jul 2018 | [Guido and Coop](http://guidoandcoop.com/) | Social Media Marketing Specialist |
| Mar 2016 – Jun 2018 | [eCashy.com](http://ecashy.com) | Social Media Marketing Specialist |

### Before freelancing

| Period | Organisation | Role |
|---|---|---|
| May 2017 – Jan 2021 | [Department of Education, Region XII](https://www.deped.gov.ph/regions/region-xii/) | Administrative Assistant II |
| Jan 2016 – May 2017 | [LGU General Santos City, HRMDO](https://gensanhrmdo.org/home/) | Administrative Assistant II |
| Oct 2015 – Dec 2015 | [LGU General Santos City, CEMCDO](https://cemcdo.gensantos.gov.ph/) | Project Evaluation Officer II |
| Jul 2014 – Aug 2015 | [Coca-Cola Beverages Philippines](https://www.coca-cola.com.ph/) | Preseller |
| Oct 2013 – Jul 2014 | [Gensan Shipyard and Machine Works](https://www.linkedin.com/company/gensan-shipyard-and-machine-works-inc/) | Senior Purchasing Canvasser |
| Mar 2013 – May 2013 | [Commission on Elections, Philippines](https://comelec.gov.ph/) | PCOS Technician |
| Sep 2011 – Jan 2013 | [San Miguel Brewery Inc.](https://www.sanmiguelbrewery.com.ph/welcome) | Sales Logistics Specialist |

**Line under the toggle:**
> The corporate and government roles are here for a reason. Purchasing, project evaluation and sales logistics are where I learned that a process either has a measurable output or it does not exist.

**CTA:** `Book a call`

---

## 11 — TESTIMONIALS

**Eyebrow:** `10 / IN THEIR WORDS`

**H2:**
> What it's like to work with me.

**Cards (glass, cinematic, slow auto-advance carousel with manual control):**

**Chef Laura Bonicelli**, Bonicelli Cooking Club
> "I strongly recommend Genest for social media management and website/admin support. Genest revamped my social media presence and significantly grew my social media numbers on YouTube and other channels. He evaluated and updated all of my platforms and used his strong organizational skills to develop a creative and achievable social media calendar. From there, he created the video and still content. Genest also successfully worked with my email campaigns and kept all of our projects on track. I know Genest would be an asset to any organization he works with."

**Rogel Bito-on**
> "Genest is highly knowledgeable in Social Media Marketing and very capable of quickly understanding his clients' business models. He always commits to deadlines and puts client satisfaction first. I am glad to have worked with Genest as I can work with him in several business functions without a worry and at a reasonable cost. I highly recommend Genest Jan."

**Slot 3 and 4:** reserved. See the asset checklist in Part 9. One further testimonial exists on the current site and needs attribution and permission confirmed before it is republished.

---

## 12 — FAQ

**Eyebrow:** `11 / STRAIGHT ANSWERS`

**H2:**
> The questions people actually ask.

**Accordion, glass panels, smooth height animation:**

**What does it cost?**
It depends entirely on scope, so anyone giving you a number before understanding your business is guessing. What I can tell you is that I work on retainers for ongoing operations work and fixed scope for one-off builds, and I will always tell you which one I think is right for your situation, even when it is the cheaper one.

**Are you a full agency?**
No, and that is deliberate. You work with me directly. There is no account manager between you and the person doing the work, which is why I keep the client roster small.

**What are your hours?**
I'm in the Philippines and I regularly work with UK, Australian and US clients. Overlap is normally not a problem. I'll tell you honestly at the start what hours I can commit to, rather than promising 24/7 and then disappointing you.

**Do you work with startups?**
Yes, and it is some of my favourite work. If you're at the stage of having an idea and no system, that is exactly the point where the right structure saves you two years.

**How quickly can you start?**
Depends on current capacity. I run at around 65 hours a week total, so sometimes there is room immediately and sometimes there is a wait. I would rather tell you there is a two-week wait than take you on and do it badly.

**Can you take over something someone else built?**
Usually yes. Inherited funnels, half-finished Kajabi sites and abandoned automations are a large part of what I get asked to fix. I will audit it first and tell you honestly whether repairing it or rebuilding it is cheaper.

**What if I only need one thing?**
That is fine. Most engagements start with one broken thing. You do not have to buy a whole system to get a landing page fixed.

**What don't you do?**
I do not do SEO at a specialist level, I do not do complex custom software engineering, and I do not do print and brand identity design from scratch. I will tell you when something is outside my range rather than learning on your budget.

---

## 13 — CONTACT

**Eyebrow:** `12 / LET'S TALK`

**H2:**
> Tell me what's broken.

**Body:**
> The first call is free and there is no pitch at the end of it. Bring the messy version. I would rather hear "I don't really know what's wrong, it just isn't working" than a tidy brief that skips the actual problem.

**Form fields (glass inputs, cyan focus glow):**
- Your name
- Email
- Business or website (optional)
- What's the main thing you want fixed? (long text)
- What have you already tried? (long text, optional)
- Where are you based? (for timezone)

**Button:** `Send it` (amber, magnetic)
**Success state:** `Got it. I'll come back to you within one business day.`
**Error state:** Name the field that failed and how to fix it. No generic "something went wrong".

**Direct contact block:**
- Email: genestjan@genestjanramirez.com
- WhatsApp: +63 905 470 5915
- LinkedIn: linkedin.com/in/genestjan
- Facebook: facebook.com/genestjanramirez
- Based in General Santos City, Philippines

---

## 14 — FOOTER

- Logo (GJR mark) with subtle glow
- Nav: Home · About · Services · Work · Experience · Contact
- Socials: LinkedIn, Facebook, YouTube
- `Digital Marketing · Websites · Funnels · Meta Ads · Automation · Content`
- `© 2016 – 2026 Genest Jan Ramirez. Built and maintained by me, which is rather the point.`
- Small print: Privacy · Terms

---

# PART 4 — Proof Inventory to Migrate

Carry these across from the current Wix site and upgrade the presentation:

| Asset | Current location | Action |
|---|---|---|
| Logo (GJR mark, PNG) | Wix media library | Export at 2x and as SVG if possible |
| Profile photograph | Wix media library | Re-export at high resolution for cinematic treatment |
| 12 social media post samples | Wix gallery | Re-export, present in masonry grid |
| 4 real estate video edits | Wix video player | Host on YouTube or Vimeo unlisted, embed lazily |
| Google Drive portfolio folder | Linked from Wix | Keep as a secondary "full archive" link |
| 3 testimonials | Wix | 2 ready, 1 needs confirmation |
| Google site verification meta tag | Wix head | Carry across to preserve Search Console |
| Meta description and OG tags | Wix head | Rewrite for the new positioning |

---

# PART 5 — SEO and Metadata

**Title:** `Genest Jan Ramirez | Digital Marketing Operator, Funnels, Meta Ads and Automation`

**Meta description:** `I build and run the systems that connect your ads, funnels, content and CRM into one machine that produces bookings. Digital marketing, websites, funnels, Meta ads, automation and content, from strategy to reporting.`

**Target keywords:** digital marketing operator · funnel builder · Meta ads manager · Kajabi specialist · GoHighLevel specialist · marketing automation consultant · virtual assistant Philippines · podcast editor · landing page builder

**Required:** `next/metadata` on every route, OG and Twitter cards with a custom generated OG image, JSON-LD `Person` and `ProfessionalService` schema, `sitemap.xml`, `robots.txt`, canonical to `https://genestjanramirez.com`.

---

# PART 6 — Design System

## 6.1 Design thesis

The subject is an engineer who makes systems flow. So the visual language is **an instrument panel for a live system**, not a generic dark portfolio. Near-black ground, a faint blueprint grid, cool cyan for structure and idle state, warm amber for current and action. It should feel like watching a well-built machine run at night.

**Deliberately avoided:** acid-green-on-black, terracotta-on-cream, neon purple SaaS gradients. Those are defaults, not decisions.

## 6.2 Colour tokens

```css
--ink:        #06080D;  /* base background, near-black with blue bias */
--ink-2:      #0C1119;  /* elevated surface */
--ink-3:      #141B27;  /* card base before glass treatment */
--blueprint:  #1E3A5F;  /* structural lines, grid, dividers */
--signal:     #FFB03A;  /* amber. PRIMARY ACCENT. CTAs, active flow, key numbers */
--signal-dim: #B87A1F;  /* amber pressed/muted */
--current:    #4FD1E0;  /* cyan. SECONDARY. system labels, links, focus rings */
--paper:      #E8EDF2;  /* primary text */
--muted:      #7C8BA1;  /* secondary text */
--line:       rgba(232,237,242,0.08);
--glass:      rgba(20,27,39,0.55);
--glass-edge: rgba(232,237,242,0.10);
```

**Ratio discipline:** roughly 80% near-black, 15% cyan and cool structure, 5% amber. Amber is scarce on purpose. If everything glows, nothing reads as important.

> **If Jan's actual brand hex codes differ, swap `--signal` and `--current` only.** Keep the ink scale, keep the ratio.

## 6.3 Typography

| Role | Face | Usage |
|---|---|---|
| Display | **Space Grotesk** 700 | H1, H2, section numbers. Tight tracking at large sizes (`-0.03em`). |
| Body | **Inter** 400 / 500 | All paragraphs and UI. `1.65` line height. Max 68 characters per line. |
| Utility | **JetBrains Mono** 400 | Eyebrows, node labels, stat units, tool chips, timestamps. Uppercase, `0.12em` tracking. |

The mono face is not decoration. It carries the system and data language, which is the brand's actual subject.

**Scale (clamp for fluid response):**
```
h1: clamp(2.75rem, 7vw, 6.5rem)
h2: clamp(2rem, 4.5vw, 3.75rem)
h3: clamp(1.25rem, 2vw, 1.75rem)
body: clamp(1rem, 1.1vw, 1.125rem)
mono-label: 0.75rem
```

## 6.4 Glassmorphism recipe

```css
background: var(--glass);
backdrop-filter: blur(16px) saturate(140%);
border: 1px solid var(--glass-edge);
border-radius: 16px;
box-shadow: 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05);
```

Add a 1px top edge highlight so cards catch light from above. On hover, brighten the border toward `--current` and lift `translateY(-4px)`.

**Warning:** `backdrop-filter` is expensive. Cap it to roughly 12 simultaneously visible glass elements and never stack it over the live canvas without a solid backing layer.

## 6.5 The signature element

**A live 3D pipeline in the hero that becomes an interactive diagram in section 03.**

This is the one bold move and everything else stays quiet around it.

**In the hero:** a slow-drifting field of connected nodes in 3D space, rendered in `--blueprint` and `--current`, with thin lines between them. Pulses of `--signal` travel along the connections at irregular intervals, like current moving through a circuit. The whole mesh subtly warps toward the cursor with easing and momentum, so it feels like a physical thing under glass rather than a background loop. Depth fog at the far plane so nodes fade into the dark instead of ending abruptly.

**In section 03:** the same visual language resolves into the actual fourteen-stop customer journey. Nodes are labelled in mono. On hover a node scales up and the connected edges brighten. On click, a glass panel slides in with what Jan does at that stop. The line between the previous node and the next one animates with a travelling amber pulse.

**Why this and not floating particles:** particles say "generic tech site". A live pipeline says exactly what he sells, in the first two seconds, without a word of copy. The signature element and the sales argument are the same object.

## 6.6 Motion rules

| Element | Behaviour |
|---|---|
| Text entrance | `opacity 0→1`, `y 20→0`, `duration 0.6`, `ease [0.22,1,0.36,1]`, stagger `0.08` per child |
| Section reveal | `whileInView`, `viewport={{ once: true, margin: "-100px" }}` |
| Ambient cards | Continuous float, ±8px, 6 to 9 second period, desynchronised offsets |
| Buttons | Magnetic pull toward cursor within 80px radius, max 12px offset, spring `stiffness 150, damping 15` |
| Cards | Tilt max 8 degrees, `perspective 1000`, `scale 1.02`, `transition 400ms` |
| Cursor | Custom glow, 400px radial `--signal` at 6% opacity, `mix-blend-mode: screen`, 60ms lag |
| Page load | Orchestrated: canvas fades in → H1 words stagger → sub → CTAs → trust strip. Roughly 1.4s total. |
| Section numbers | Count up on enter |
| Process line (sec 09) | SVG `pathLength` draws 0→1 on scroll |

**Everything animates `transform` and `opacity` only.** No animating `width`, `height`, `top`, `left`, `margin` or `box-shadow`.

## 6.7 Performance budget (hard limits)

- **60 FPS** on a mid-range Android over 4G. Test on a real device, not just desktop Chrome.
- **LCP under 2.5s.** The H1 must be server-rendered HTML and painted before the canvas mounts. The canvas is never the LCP element.
- Canvas is `dynamic(() => import(...), { ssr: false })` with a static gradient poster as the fallback.
- `<Canvas dpr={[1, 2]}>` capped. `frameloop="demand"` where possible. `powerPreference: "high-performance"`.
- Pause the render loop when the canvas is off screen (`IntersectionObserver`) and when the tab is hidden (`visibilitychange`).
- Particle count scales with device: roughly 3000 desktop, 1200 tablet, 600 mobile. Detect once, do not re-detect per frame.
- Debounce resize at 150ms and update camera aspect plus renderer size together.
- All images `next/image`, AVIF and WebP, explicit dimensions, lazy below the fold.
- Fonts via `next/font/google` with `display: swap` and preload on the display face.
- Total JS budget under 250KB gzipped for the initial route.

## 6.8 Accessibility floor

- Respect `prefers-reduced-motion: reduce`. When set: kill the canvas entirely and serve a static gradient, disable parallax, tilt, magnetic hover and float, reduce entrances to a simple fade under 200ms. This is not optional.
- Visible focus ring on every interactive element, 2px `--current` with 2px offset.
- Body text against `--ink` must clear 4.5:1. Check `--muted` specifically; lighten it if it fails.
- Full keyboard navigation including the pipeline nodes. Every node is a real focusable button.
- Semantic landmarks, one `h1`, correct heading order, alt text on every image, `aria-hidden` on the decorative canvas.
- Skip-to-content link.

## 6.9 Responsive

| Breakpoint | Behaviour |
|---|---|
| `< 640px` | Single column. Canvas reduced or replaced with a lighter shader. Pipeline becomes a vertical scroll-through list. Tilt and magnetic hover disabled. Font scale drops one step. |
| `640 – 1024px` | Two column where sensible. Canvas at medium particle count. |
| `> 1024px` | Full experience. |
| `> 1536px` | Cap content at `max-w-[1400px]`, let the canvas run full bleed. |

Mobile is the majority of this traffic. Build mobile first, then add the effects upward.

---

# PART 7 — THE CLAUDE CODE BUILD PROMPT

> Copy everything inside the block below into Claude Code, with `BRIEF.md` (this file) in the repo root.

---

```
Build a cinematic, immersive personal website for Genest Jan Ramirez at
genestjanramirez.com. The complete copy deck, brand story, colour tokens,
typography, motion spec and performance budget are in BRIEF.md in this repo
root. Read BRIEF.md in full before writing any code and follow it exactly.
Do not invent copy, statistics, client names or testimonials that are not
in BRIEF.md.

=== STACK ===
- Next.js 14+ with App Router, TypeScript
- Tailwind CSS with the colour tokens from BRIEF.md section 6.2 mapped into
  tailwind.config.ts as named theme colours
- Three.js via @react-three/fiber and @react-three/drei
- Framer Motion for all 2D animation
- vanilla-tilt (or Framer Motion equivalent) for card tilt
- next/font/google for Space Grotesk, Inter and JetBrains Mono
- lucide-react for icons

Set up the project from scratch, install every dependency, and produce a
fully working multi-section landing page.

=== DESIGN REQUIREMENTS ===
- Dark, near-black theme using the exact tokens in BRIEF.md 6.2. Amber
  (--signal) is the primary accent and must stay scarce, roughly 5% of the
  visual field. Cyan (--current) carries structure, labels and focus states.
- Glassmorphism on all cards, panels and form inputs using the exact recipe
  in BRIEF.md 6.4, including the inset top-edge highlight.
- Premium, cinematic feel: deep gradients, film grain overlay at very low
  opacity, subtle vignette, generous whitespace, high contrast typography.
- Typography exactly as specified in BRIEF.md 6.3. The mono face carries
  eyebrows, node labels, stat units and tool chips. It is a load-bearing
  part of the design, not decoration.
- Responsive per BRIEF.md 6.9. Build mobile first.

=== 3D BACKGROUND AND SIGNATURE ELEMENT ===
This is the most important part of the build. Read BRIEF.md 6.5 carefully.

Hero: a full-screen fixed React Three Fiber Canvas behind the content
rendering a drifting 3D field of connected nodes with thin lines between
them, in blueprint blue and cyan. Amber pulses travel along the connections
at irregular intervals like current through a circuit. The mesh warps
toward the cursor with eased momentum, not 1:1 tracking. Depth fog at the
far plane. Dynamic point lighting that moves slowly.

Section 03: the same visual language resolves into the actual 14-stop
customer journey pipeline listed in BRIEF.md section 03. Nodes labelled in
mono, hoverable (node scales, connected edges brighten), clickable (a glass
panel slides in with the detail text from the table). An amber pulse
animates along the edge between the previous and next node. Every node must
be a real focusable button with full keyboard support. On mobile this
becomes a vertical scroll-through list, not a 3D scene.

Do not use generic floating particles as the hero visual. The pipeline IS
the pitch.

=== ANIMATION AND MICRO-INTERACTIONS ===
Follow BRIEF.md 6.6 exactly.
- Scroll-triggered section reveals with Framer Motion whileInView,
  viewport once: true, margin -100px
- Staggered text entrances: opacity 0 to 1, y 20 to 0, duration 0.6,
  ease [0.22, 1, 0.36, 1], 0.08s stagger between children
- Floating ambient glass cards with continuous desynchronised drift
- Magnetic hover on all primary buttons: pull toward cursor within an 80px
  radius, max 12px offset, spring stiffness 150 damping 15
- Custom interactive cursor glow: 400px radial amber at 6% opacity,
  mix-blend-mode screen, 60ms lag. Desktop only, hidden on touch devices.
- Tilt on cards, max 8 degrees, perspective 1000, scale 1.02
- Orchestrated page-load sequence: canvas fade, then H1 word stagger, then
  sub, then CTAs, then trust strip. Roughly 1.4 seconds total.
- SVG pathLength draw-on-scroll for the process line in section 09
- Count-up animation on the stat numbers in section 04

=== PERFORMANCE (HARD REQUIREMENTS) ===
Follow BRIEF.md 6.7 exactly. These are not suggestions.
- 60 FPS on a mid-range Android over 4G
- Animate transform and opacity only. Never animate width, height, top,
  left, margin or box-shadow.
- The H1 must be server-rendered and painted before the canvas mounts. LCP
  under 2.5s. The canvas must never be the LCP element.
- Lazy-load the canvas with next/dynamic and ssr: false, with a static
  gradient poster fallback
- Canvas dpr capped at [1, 2], powerPreference high-performance
- Pause the render loop when the canvas is offscreen (IntersectionObserver)
  and when the tab is hidden (visibilitychange)
- Particle/node count scales by device: ~3000 desktop, ~1200 tablet,
  ~600 mobile. Detect once on mount, not per frame.
- Debounce window resize at 150ms, update camera aspect and renderer size
  together, dispose geometries and materials on unmount
- next/image everywhere with AVIF and WebP, explicit dimensions, lazy below
  the fold
- Initial route JS under 250KB gzipped

=== ACCESSIBILITY (HARD REQUIREMENTS) ===
Follow BRIEF.md 6.8 exactly.
- prefers-reduced-motion: reduce must kill the canvas entirely and serve a
  static gradient, disable parallax, tilt, magnetic hover and float, and
  reduce all entrances to a sub-200ms fade
- Visible 2px cyan focus ring with 2px offset on every interactive element
- Body text at 4.5:1 minimum against the background. Verify the muted token
  specifically and lighten it if it fails.
- Full keyboard navigation including pipeline nodes
- Semantic landmarks, single h1, correct heading order, alt text on all
  images, aria-hidden on the decorative canvas, skip-to-content link

=== SECTIONS TO BUILD ===
Fourteen sections in this order, with copy taken verbatim from BRIEF.md
Part 3:
01 Hero, 02 The Gap, 03 The System (interactive pipeline), 04 About Jan,
05 What I Do (10 service cards), 06 Selected Work (filterable, 8 cases),
07 Industries, 08 The Stack, 09 How We'd Work, 10 Experience (grouped, with
a show-full-history toggle), 11 Testimonials, 12 FAQ (accordion),
13 Contact (form), 14 Footer

Plus a fixed glass navigation bar that becomes more opaque on scroll, with
a scroll-progress indicator in amber.

=== CONTENT RULES (CRITICAL) ===
- Every word is first person. Jan speaks as an individual. Never "we",
  never "our team", never "the agency". This is non-negotiable.
- British English spelling throughout (optimise, organisation, colour,
  programme).
- NO EM DASHES anywhere in any copy, code comment or content string. Use
  commas, colons, or split the sentence.
- Do not invent client names, statistics, results, case study numbers or
  testimonials. If BRIEF.md leaves a number as a placeholder, render the
  placeholder or omit the line. Never fabricate proof.
- Use genestjan@genestjanramirez.com as the contact email.

=== FILE STRUCTURE ===
app/
  layout.tsx           (fonts, metadata, JSON-LD, grain overlay, cursor)
  page.tsx             (composes all sections)
  globals.css          (tokens, base, reduced-motion, grain, scrollbar)
components/
  canvas/HeroField.tsx        (R3F node field, lazy)
  canvas/PipelineScene.tsx    (R3F 14-node journey, lazy)
  canvas/CanvasFallback.tsx   (static gradient poster)
  ui/GlassCard.tsx  MagneticButton.tsx  CursorGlow.tsx
  ui/Reveal.tsx  StaggerText.tsx  CountUp.tsx  ToolChip.tsx
  sections/  (one file per numbered section, 01 to 14)
  layout/Nav.tsx  Footer.tsx  ScrollProgress.tsx
lib/
  content.ts    (ALL copy from BRIEF.md as typed exports)
  motion.ts     (shared variants and easings)
  useDeviceTier.ts  useReducedMotion.ts  useMousePosition.ts
public/  (logo, photo, OG image, case study visuals)

Put every string in lib/content.ts as typed exports. No hardcoded copy
inside components. This makes the site editable without touching the
layout.

=== SEO ===
Implement the metadata, OG tags, JSON-LD Person and ProfessionalService
schema, sitemap.xml and robots.txt exactly as specified in BRIEF.md Part 5.
Carry over the existing Google site verification meta tag.

=== DELIVERABLE ===
A running Next.js app with all fourteen sections built, all animations
working, all performance and accessibility requirements met, and a README
covering local dev, how to edit copy in lib/content.ts, how to swap the
brand accent colours, and how to deploy.

Work section by section. After each one, verify it against BRIEF.md before
moving on. Do not scaffold all fourteen at once.
```

---

# PART 8 — Deployment

**Important:** GitHub Pages serves static files only. It cannot run a Next.js App Router app with server components, dynamic metadata or image optimisation. Two viable routes:

**Route A (recommended): GitHub for code, Vercel for hosting.**
1. Push the repo to the `SMM-Ayakent` GitHub account.
2. Import the repo into Vercel. Free tier is sufficient.
3. In Vercel, add `genestjanramirez.com` and `www.genestjanramirez.com` as domains.
4. In GoDaddy DNS: `A` record for `@` pointing to Vercel's IP, `CNAME` for `www` pointing to `cname.vercel-dns.com`.
5. Remove the Wix DNS records. Allow up to 48 hours for propagation.
6. Every push to `main` deploys automatically. Pull requests get preview URLs.

**Route B (if GitHub Pages is mandatory):** add `output: 'export'` to `next.config.js` and accept the trade-offs. No server components, no API routes, no `next/image` optimisation (needs `unoptimized: true`), and the contact form must post to a third party such as Formspree or Web3Forms. The 3D and animation work fine. This is workable but strictly worse.

**Before switching DNS:**
- Deploy to the Vercel preview URL and test on a real phone over mobile data.
- Run Lighthouse. Target 90+ on Performance and 100 on Accessibility.
- Add the new property to Google Search Console and submit the sitemap.
- Keep the Wix site live until the new one is verified working.

---

# PART 9 — What I Need From You

**Blocking (build cannot finish without these):**

1. **Brand hex codes.** Exact colours from the GJR logo. If there is no defined palette, say so and the amber and cyan system in 6.2 stands as the brand.
2. **Logo files.** Highest resolution PNG, plus SVG if it exists. Light version for the dark background.
3. **Profile photograph.** Highest resolution available. Ideally one on a plain or dark background so it can take a cinematic treatment.
4. **Client naming permission.** Confirm which clients can be named publicly and which need to stay anonymous. Part 3 section 06 is written anonymously by default and can be upgraded per client once you confirm. Priority here is the current engagement, since a named, live, multi-year client is the single strongest proof on the page.

**Non-blocking but improves the site:**

6. Real numbers for any case study you can verify and are permitted to publish. Percentage lift or cost reduction works even where absolute revenue is confidential.
7. Screenshots or recordings of funnels, dashboards, Kajabi builds and GHL workflows. Blur anything sensitive.
8. Two more recent testimonials. The current engagement is the strongest ask here.
9. Your Calendly or booking link.
10. Confirmation on whether the WhatsApp number should be public.
11. Confirmation of the third testimonial's attribution and permission to republish.

---

*End of brief.*
