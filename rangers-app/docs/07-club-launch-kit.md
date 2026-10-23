# 07. Club launch kit

Everything you (Jan) need that is not code: the coach interview, ownership and domain setup, accounts, the privacy notice, parent messages and a one-page guide for coaches.

---

## 1. Interview with Coach James (30 minutes)

Do this before any building. Write the answers into `docs/decisions.md`. Their answers can reorder the whole roadmap.

**Time and pain (10 min)**
1. What takes most of your time each week for the club?
2. What is the most annoying thing on a match day?
3. How do you decide who plays and for how long today? Do any parents complain about minutes?
4. How do you tell parents about training and matches now? What goes wrong?

**Teams and matches (8 min)**
5. Which age groups do Rangers, FC New Mabu and Gila have, and roughly how many children in each?
6. Which leagues and tournaments do you play? What format (4v4, 7v7, 8v8, 9v9, 11v11, futsal), how long are the matches, and how do substitutions work in each?
7. How big is the Yam 1 pitch? Do you have goals, how many balls, cones and bibs?

**Kids and safety (6 min)**
8. What do you do on very hot days? Have you had a child get sick from heat?
9. What happens when a child gets a knock to the head?
10. Who keeps emergency numbers for each child? Is there a first-aid kit at every session?

**Money and support (3 min)**
11. Do families pay anything? Tournament fees? Who collects it and how? Would you want this in an app, or would it make families feel bad?
12. What does the club need most right now: boots, balls, transport, tournament fees?

**Priorities (3 min)**
13. If the app could only do two things every week, what should they be?
14. Is there a TV or projector anywhere we could use before matches?
15. Who else should be an admin besides me?

Close with: "We will test it with one team first. If it does not help, we stop."

## 2. Five-question survey for the other coaches

Send in Messenger (casual):

> Hi Coach! I'm building a free app for Rangers, New Mabu and Gila to make match days and training easier. Can you answer 5 quick questions? Just reply here:
> 1. What phone do you use (brand and model)?
> 2. What's the hardest part of match day for you?
> 3. How do you plan your training sessions now?
> 4. Would you use a tablet or TV to show the kids the lineup and tactics before games?
> 5. If the app did only one thing for you, what should it be?
> Salamat!

## 3. Choose the pilot

- One team (ideally your son's), one pilot coach, three pilot families who are comfortable trying new things.
- Pilot runs through Phases 1 to 3 before other teams join.

## 4. Ownership setup (free, one evening)

Goal: the club owns its app, not one person's account.

1. **Club Google account**: create one (for example `rangersfc.app@gmail.com`) to own the Google Cloud, Supabase and Resend accounts. Share access with the co-admin.
2. **Password manager**: Bitwarden's free plan includes a free organisation for two people. Store every login and recovery code there, shared between you and the co-admin.
3. **GitHub organisation** (free): name `rangersfc`; owners: you and the co-admin; turn on two-factor authentication for both.
4. **Repositories**:
   - `rangersfc/rangers-app` (public): copy this whole plan folder to its root.
   - `rangersfc/rangers-app-backups` (private): created in Phase 2.
   - Recommended: **transfer the club website repository into the organisation too.** GitHub domain verification covers the domain and its immediate subdomains for one account or organisation, so the website and the app should live under the same owner. After a transfer, check the website's Pages custom domain is still `rangersfc.net`.
5. **Connect Claude Code** to `rangersfc/rangers-app` (install the Claude GitHub app on the organisation and select the repository).
6. **Supabase organisation** (Phase 2): owned by the club Google account, with you and the co-admin as owners.

## 5. Domain setup for `app.rangersfc.net`

Your domain's DNS is at Onamae.com (the nameservers are `dnsv.jp`). The club website already points at GitHub Pages.

1. In GitHub: `rangersfc/rangers-app`, **Settings, Pages**: Source = GitHub Actions. Custom domain = `app.rangersfc.net`. Save.
2. In Onamae.com, open the DNS records for `rangersfc.net` and add:
   - Type `CNAME`, Host `app`, Value `rangersfc.github.io`, TTL `3600`.
   - (If the app repository ends up under a different GitHub account, the value is `<that-account>.github.io`.)
3. Wait 10 minutes to a few hours. Back in **Settings, Pages**, tick **Enforce HTTPS** once it becomes available.
4. **Verify the domain**: organisation **Settings, Pages, Add a domain**: `rangersfc.net`. GitHub shows a TXT record (`_github-pages-challenge-rangersfc` host with a code). Add it in Onamae.com, then press Verify. Do this in the account that owns the website repository (see 4.4).
5. Test: open `https://app.rangersfc.net` on your phone.

## 6. Accounts and secrets for Phase 2 and 3

The Planner's Phase 2 spec will list exact steps; this is the overview.

| What | Where | Secret? | Stored in |
|---|---|---|---|
| Supabase project URL, anon key (staging and prod) | Supabase dashboard | Not secret | GitHub repository variables |
| Supabase access token, database passwords | Supabase dashboard | **Secret** | GitHub secrets (and Bitwarden) |
| Google OAuth client ID and secret | Google Cloud console (club Google account) | Secret | Supabase Auth settings |
| Resend SMTP key; DNS records for `rangersfc.net` (SPF, DKIM) | Resend dashboard, Onamae.com | Secret | Supabase Auth SMTP settings |
| VAPID key pair (push) | Generated once by the Builder's script | Private key secret | Supabase Edge Function secrets |
| Backup encryption key pair (`age`) | Generated on your computer | Private key secret, **kept offline** by you and the co-admin | Public key in backups repo secrets |

Never paste a secret into a Claude prompt, a chat, or a file in the repository.

## 7. Privacy notice (draft for review)

Have someone familiar with the Data Privacy Act review this before parents sign up. Show it in English and Filipino in the app, with a short version for children.

### 7.1 Parents' notice (English)

**Rangers App: how we look after your child's information**

The Rangers App is run by volunteers of Rangers Football Club (with FC New Mabu and Gila Academy) to organise training and matches. It is free and has no ads.

**What we collect**
- Your name, email address, and how you are related to your child.
- Your child's first name, nickname, last name, birth date, shirt number, the positions they like, and the team they play in.
- Training and match information: attendance, minutes played, coach notes about football progress, goals, badges and term reviews.
- Safety information: up to two emergency contacts, allergies, inhaler, a health condition coaches should watch for, injuries at training or matches, and height (to spot growth spurts).
- Your child's photo, only if you say yes.

**Why**: to plan training and matches, keep playing time fair, help your child improve, keep them safe, and tell you about events.

**Who can see it**: your child's coaches and the club administrators. You see only your own child's information. Other parents never see your child's reviews, health information, or contributions. Kids' screens show first names and numbers only.

**Where it is kept**: in the app's database (Supabase), protected by access rules, with an encrypted backup. We do not sell or share it with anyone else.

**How long**: while your child is with the club, and deleted 12 months after they leave. Contribution details are deleted at the end of each season.

**Your choices**: you can change photo and video permissions at any time, download your child's information, correct it, or ask us to delete it, from the app's Privacy screen or by asking Coach James.

**If something goes wrong**: if your child's information is ever exposed, we will tell you and your child in plain language, as the National Privacy Commission requires.

**Contact**: Coach James, +63 993 291 0764, or the club admin through the app.

### 7.2 Parents' notice (Filipino, draft: have a native speaker check)

**Rangers App: paano namin pinangangalagaan ang impormasyon ng inyong anak**

Ang Rangers App ay pinapatakbo ng mga volunteer ng Rangers Football Club (kasama ang FC New Mabu at Gila Academy) para ayusin ang training at mga laro. Libre ito at walang ads.

**Ano ang kinokolekta namin**: ang inyong pangalan at email; ang pangalan, birthday, numero sa jersey at team ng inyong anak; attendance, minuto sa laro, at progreso sa football; impormasyong pangkaligtasan (emergency contacts, allergy, inhaler, injury, at taas para malaman kung mabilis ang paglaki); at litrato kung papayag kayo.

**Bakit**: para maayos ang training at laro, patas ang oras ng paglalaro, matulungan ang bata na gumaling, at mapanatili siyang ligtas.

**Sino ang makakakita**: ang mga coach ng inyong anak at ang mga admin ng club. Kayo lang ang makakakita ng impormasyon ng sarili ninyong anak.

**Gaano katagal**: habang kasali ang bata sa club, at buburahin 12 buwan pagkatapos niyang umalis.

**Ang inyong karapatan**: puwede ninyong baguhin ang pahintulot sa litrato, i-download, itama, o ipabura ang impormasyon anumang oras.

### 7.3 Children's version (shown to players 13+ and readable by younger children with a parent)

> **What the Rangers App knows about you**
> Your coaches use the app to plan training, keep game time fair, and track how you're getting better. It knows your first name, your number, your team, how many minutes you played, your goals and badges, and things that keep you safe, like who to call if you get hurt. Only your coaches and your family can see your progress. Other kids can't. If you don't want your photo in the app, tell your parent or coach. You can always ask what the app knows about you.

### 7.4 Consent choices (stored with date and notice version)

| Choice | Required? | Default |
|---|---|---|
| I agree to the club using my child's information as described | Required to join | Not ticked |
| Show my child's photo on team screens (Match Day Board, profile) | Optional | Off |
| Use video of my child in the club's drill library | Optional | Off |
| Include my child in team photos shown in the app | Optional | Off |

## 8. Parent onboarding messages (Messenger)

**Private message with the invite link** (one per child):

> Hi! This is Coach <name> from Rangers. We now have a free club app for training times, match reminders and your child's progress. Here's <child first name>'s private link to join (please don't share it, it only works once): <link>
> It takes 2 minutes. You can sign in with Google or with a code sent to your email. Message me if you get stuck. Salamat!

**Group message once families have joined:**

> Hi Rangers families! From now on training and match details will be in the app, and I'll still post them here too. Please tap Going or Not going for each event so we know who's coming. If you haven't joined yet, message me and I'll send your link.

**How to add the app to the home screen:**
- Android (Chrome): open the link, tap the three dots, then **Add to Home screen** or **Install app**.
- iPhone (Safari): open the link in Safari (not inside Messenger), tap the Share button, then **Add to Home Screen**. Reminders on iPhone only work after this step.

**Common questions**
- *Do I have to use the app for my child to play?* No. Coaches can record replies for you.
- *Does it use a lot of data?* No. After the first visit it uses very little.
- *Who can see my child's information?* Only their coaches, the club admins and you.

## 9. One-page coach guide (print it, or keep it in the app's help)

**Match day in five steps**
1. **Match, New match**: pick the format, periods, minutes and sub rule.
2. Tick who is here. Tap **Plan minutes**. Lock anything you want fixed, like the keeper.
3. **Show the kids**: Lineup, Our 3 keys, The move, Our values. Swipe through.
4. **Start**: the app buzzes before each sub. Tap off, tap on. Use star, shy or help to note how kids are doing.
5. Half-time: **ask them first** what is working. After the match: Celebrate slide, then the report saves itself.

**Training in four steps** (from Phase 4)
1. **Train, New session**: age group, how many kids, how long, what equipment you have.
2. Check the heat badge. Swap any drill you don't like.
3. **Run**: the timer tells you when to change and when to give water.
4. Huddle: two questions, recognise a value, give next week's challenge.

**Remember**: every child plays, praise effort by name, if in doubt about a head knock sit them out.

## 10. Showing the board on a TV

| Option | What you need | Notes |
|---|---|---|
| Hold up the tablet | Nothing | Best for small groups outdoors; use Sun mode |
| HDMI cable | USB-C to HDMI adapter (most Android tablets and phones with USB-C support it; check the model), HDMI cable | Most reliable; no internet needed |
| Screen mirroring | Smart TV or casting stick and the same Wi-Fi | Works if the venue has Wi-Fi or a phone hotspot |
| TV browser + TV link | TV with a browser, internet | Phase 7; coach's phone becomes the remote |

## 11. Monthly 15-minute check with Coach James

1. Look at the admin usage panel (from Phase 7; before that, ask the coaches): are coaches using it weekly? Are families replying?
2. Minutes fairness: any child consistently getting less time?
3. One thing to fix next month.
4. One thing to remove because nobody uses it.

## 12. If Jan is unavailable

Keep a printed copy of this in Bitwarden notes and with Coach James:
- The app keeps running on its own: GitHub Pages and Supabase need no daily care.
- The weekly keep-alive and backups run automatically. If the admin screen says the last backup is older than two weeks, the co-admin follows the recovery guide (written in Phase 7).
- The co-admin has owner access to GitHub, Supabase, Google and Resend through the club account and Bitwarden.
- Domain renewal for `rangersfc.net` must stay paid; note the renewal date and who pays it.
