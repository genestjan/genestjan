#!/usr/bin/env python3
"""Builds the draft of Beki's new website into site/out/ for Jan to preview at
genestjanramirez.com/BekiEakinsdraftwebsite/. Plain static HTML, relative links only,
noindex on every page, no tracking and no live forms: every button goes to the real
page it would go to on the live site (Kajabi offers, Rob's calendar, the Genie pages).

Beki's own words are kept as she wrote them (content/ and the strings below), with em
dashes turned into commas and emoji removed, per the brief.
"""
import html
import json
import re
import shutil
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
SIZES = json.loads((HERE / "assets/img/sizes.json").read_text())

# Real destinations only (checked 27 Oct: each answers, none is a 404).
ROB = "https://otfreedom.bekieakins.com/widget/booking/JfKQUgoHVwsRF5gqBs4W"
QUIZ = "https://dbf.bekieakins.com/quiz"
MINI = "https://dbf.bekieakins.com/ot-mini-course"
MAGNETIC = "https://dbf.bekieakins.com/magnetic-momentum"
ACCELERATOR = "https://dbf.bekieakins.com/accelerator-evergreen-registration-page"
LIVE = "https://www.bekieakins.com"
MEMBERSHIP_OFFER = LIVE + "/resource_redirect/offers/ebhZ2dAd"
FORMULA_LIVE = LIVE + "/Formula-event-Recording-lp"
APPLE = "https://podcasts.apple.com/gb/podcast/ot-yourself-to-freedom/id1713728830"
EMAIL = "otyourselftofreedom@gmail.com"
INSTAGRAM = "https://www.instagram.com/otyourselftofreedom/"
FACEBOOK_GROUP = "https://www.facebook.com/groups/733210681391260"


def tidy(s):
    """Brief rules: no em dashes, no emoji."""
    s = re.sub(r"\s*[—–]\s*", ", ", s)
    return re.sub(r"[✅✔⭐⬆☀-➿\U0001F300-\U0001FAFF]️?\s?", "", s).strip()


def e(s):
    return html.escape(tidy(s), quote=False)


def ext(href, label, cls="link"):
    return f'<a class="{cls}" href="{href}" target="_blank" rel="noopener">{label}</a>'


def img(name, alt, cls="", eager=False, fmt="jpg"):
    w, h = SIZES[name]
    c = f' class="{cls}"' if cls else ""
    load = 'fetchpriority="high"' if eager else 'loading="lazy"'
    return f'<img src="assets/img/{name}.{fmt}" width="{w}" height="{h}" alt="{html.escape(alt)}"{c} {load} decoding="async">'


def film(name, poster):
    return (f'<video data-loop autoplay muted loop playsinline preload="metadata" poster="assets/media/{poster}" aria-hidden="true">'
            f'<source src="assets/media/{name}.webm" type="video/webm"><source src="assets/media/{name}.mp4" type="video/mp4"></video>')


def vid(wistia, thumb, label, shape="tall"):
    return (f'<button class="vid {shape}" type="button" data-wistia="{wistia}" aria-label="Play video: {html.escape(label)}">'
            f'{img(thumb, "")}<span class="play">Play</span></button>')


def paras(*ps):
    return "".join(f"<p>{e(p)}</p>" for p in ps)


def ul(items, cls="checks"):
    return f'<ul class="{cls}">' + "".join(f"<li>{e(i)}</li>" for i in items) + "</ul>"


def bands(qa):
    out = []
    for q, a in qa:
        body = "".join(a if a.startswith("<") else f"<p>{e(a)}</p>" for a in ([a] if isinstance(a, str) else a))
        out.append(f'<div class="band"><div class="grid"><h3>{e(q)}</h3><div class="a">{body}</div></div></div>')
    return "".join(out)


def prose_from(lines):
    """Turns Beki's plain-text lines back into headings, lists and paragraphs.
    A line ending in ':' opens a list of the short lines after it; a short line with no full
    stop (or a question on its own) is a heading; numbered lines are section or step headings."""
    out, items, listing = [], [], False
    def flush(nxt=""):
        if len(items) == 1 and nxt.endswith(":"):  # a lone short line before a lead-in is a sub-heading
            out.append(f"<h3>{e(items[0])}</h3>")
        elif items:
            out.append("<ul>" + "".join(f"<li>{e(i)}</li>" for i in items) + "</ul>")
        items.clear()
    for s in (l.strip() for l in lines):
        if not s:
            continue
        heading_like = len(s) < 80 and ":" not in s and (s.endswith("?") or not re.search(r'[.,;!)"]$', s))
        if heading_like and out and out[-1].startswith("<h2>") and not items and not re.match(r"^\d+\.\s", s):
            listing = True  # two headings in a row: the second starts a list
        if listing and len(s) < 120 and not s.endswith((".", ":")) and not re.match(r"^\d+\.\s", s):
            items.append(s)
            continue
        flush(s)
        listing = False
        if re.match(r"^\d+\.\s", s) and len(s) < 90:
            out.append(f"<h3>{e(s)}</h3>" if s.endswith(".") else f"<h2>{e(s)}</h2>")
        elif heading_like:
            out.append(f"<h2>{e(s)}</h2>")
        else:
            out.append(f"<p>{e(s)}</p>")
            listing = s.endswith(":")
    flush()
    return "".join(out)


NAV = [("collective.html", "The Collective"), ("membership.html", "Membership"), ("magnetic", "Magnetic"),
       ("podcast.html", "Podcast"), ("stories.html", "Stories"), ("start-free.html", "Start free"), ("about.html", "About")]


def bar(current):
    links = []
    for href, label in NAV:
        if href == "magnetic":
            links.append(f'<li><a href="{MAGNETIC}" target="_blank" rel="noopener">{label}</a></li>')
        else:
            cur = ' aria-current="page"' if href == current else ""
            links.append(f'<li><a href="{href}"{cur}>{label}</a></li>')
    panel = "".join(re.sub(r"</?li>", "", l) for l in links)
    return f"""<p class="draft">Draft for Beki's review, not the live site. Buttons go to the real pages.</p>
<header class="bar">
  <a class="word" href="index.html">Beki Eakins</a>
  <nav aria-label="Main"><ul>{"".join(links)}</ul></nav>
  <a class="btn" href="book-a-call.html">Book a call</a>
  <details class="menu"><summary>Menu</summary><div class="menu-panel">{panel}<a href="blog.html">Blog</a><a href="faqs.html">FAQs</a><a href="{QUIZ}" target="_blank" rel="noopener">Find your stage (quiz)</a><a class="btn" href="book-a-call.html">Book a call</a></div></details>
</header>"""


FOOT = f"""<footer class="foot-site f-navy2">
  <p class="name" aria-hidden="true">Beki Eakins</p>
  <div class="grid">
    <ul class="places">
      <li><span>Ruthin, North Wales</span></li>
      <li><a href="mailto:{EMAIL}">{EMAIL}</a></li>
      <li><a href="{INSTAGRAM}" target="_blank" rel="noopener">Instagram</a></li>
    </ul>
    <div class="cols">
      <ul><li><a href="collective.html">The Collective</a></li><li><a href="membership.html">Membership</a></li><li><a href="{MAGNETIC}" target="_blank" rel="noopener">Magnetic Momentum</a></li><li><a href="{MINI}" target="_blank" rel="noopener">Package Your OT Skills</a></li><li><a href="book-a-call.html">Book a call</a></li></ul>
      <ul><li><a href="start-free.html">Start free</a></li><li><a href="formula.html">The Formula replay</a></li><li><a href="podcast.html">Podcast</a></li><li><a href="{QUIZ}" target="_blank" rel="noopener">Find your stage</a></li><li><a href="blog.html">Blog</a></li></ul>
      <ul><li><a href="about.html">About Beki</a></li><li><a href="stories.html">Stories</a></li><li><a href="faqs.html">FAQs</a></li><li><a href="privacy.html">Privacy</a></li><li><a href="kajabi-kit.html">Kajabi kit (draft)</a></li></ul>
    </div>
  </div>
  <div class="legal">
    <p>The information on this website is for general informational and educational purposes only. It is important to seek your own legal and financial advice within your own country before making any decisions, and to check you remain compliant with the occupational therapy regulations where you live.</p>
    <p>Hill footage: "Moel y Gaer, Llanfair DC Rhagfyr 2022" by Drones Over Wales, CC BY 3.0, via Wikimedia Commons. Compass film made for this draft.</p>
    <p>&copy; 2026 Beki Eakins Ltd</p>
  </div>
</footer>"""


PAGES = []


def page(slug, title, desc, body, current=None, home=False):
    PAGES.append((slug, title, body))
    doc = f"""<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
<link rel="preload" href="assets/fonts/newsreader-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="assets/site.css">
</head>
<body{' class="home"' if home else ""}>
<a class="skip" href="#main">Skip to content</a>
{bar(current)}
<main id="main">
{body}
</main>
{FOOT}
<script src="assets/site.js" defer></script>
</body>
</html>
"""
    (OUT / slug).write_text(doc)


# ---------------------------------------------------------------- content
STAGES = [
    ("quiet", "The Quiet Planner", "f-mist2", "Employed, with an idea you haven't said out loud",
     "You've got years of skill and a quiet feeling there's more you could do with it. You haven't started yet, and that's fine. Most OTs I work with began exactly here, with a job, a rota and an idea they hadn't said out loud.",
     "Steady income while you test ideas, deep clinical knowledge, and time to start small without pressure.",
     "The idea stays in your head because you don't know what you'd actually offer, or who'd pay for it.",
     "Turn one thing you already know into a simple offer, alongside your job, without changing your job.",
     (MINI, "Show me how to package my skills"), ("start-free.html", "Or start with the free resources")),
    ("solo", "The Fully Booked Solo", "f-moss", "Self-employed, and your diary is full",
     "You did the brave bit. You work for yourself and your diary is full. The catch is that your income is tied to your hours, so the only way to earn more is to work more, and you're already tired.",
     "Proven demand, clients who trust you, and full control over how you work.",
     "No session, no income. Time off costs you money.",
     "Package what you already know into something that earns without another session in the diary.",
     (ROB, "Book my free Connection Call"), ("membership.html", "Or see the Membership")),
    ("clinic", "The Stretched Clinic Owner", "f-forest", "A practice and a team, still running through you",
     "You've built a practice and a team, which most OTs never do. But it still runs through you. The questions, the decisions and the hardest cases all come back to your desk.",
     "A real business, a team, and a reputation people refer to.",
     "The business depends on your hours and your head. Step back and things wobble.",
     "Get your expertise out of your head and into something packaged, so the business earns and runs without you in every room.",
     (ROB, "Book my free Connection Call"), ("collective.html", "Or see the Collective")),
    ("scale", "The Ready-to-Scale Expert", "f-navy", "Already selling something online",
     "You've already done what most OTs only talk about: you have your practice and you've started something online. Now it needs to sell steadily, not only when you push it.",
     "A product that exists, proof people will buy, and experience of launching.",
     "Sales come in waves, so it never quite replaces the hours.",
     "A simple, repeatable way to sell what you've already built.",
     (ROB, "Book my free Connection Call"), ("collective.html", "Or see the Collective")),
]

RESULTS = [
    "Sarita made $21,550 AUD within her first launch, 4 months into the programme",
    "Shaenelle hit $10k USD months in month 5, and $14k in month 6 of the programme",
    "Nicola made £6000 with her nature-based coaching programme in 6 months",
    "Ivan sold his first offer within 3 weeks, and made $25,000",
    "Sascha makes 2-4 times her NHS employee income, whilst working less",
    "Mel developed a Burnout programme and has since made over $20k",
    "Michelle signed her first client within 3 weeks and then secured enough further clients to leave her day job!",
    "Ellie got to $15,000 AUD per month within 5 months",
    "Kelsey had a $35k launch",
    "Bethany doubled her OT income in 6 months",
    "Alex replaced her OT wage within 9 months",
    "Sharon sold her first offer in just one social media post",
    "Brad made $6000 AUD within the first 4 months",
    "Anna made £4000 in her first 4 months",
]

EPISODES = [
    ("ep147", "147", "Starting Your Online OT Business", "Featuring Beki Eakins (Repost from The OT Lifestyle Movement)", "https://podcasts.apple.com/gb/podcast/147-starting-your-online-ot-business-featuring-beki/id1713728830?i=1000778155257"),
    ("ep133", "133", "From Blood Pressure Meds to Closing His Clinic", "How OT Ivan Hardcastle Built a Freedom Business in 2 Years", "https://podcasts.apple.com/gb/podcast/133-from-blood-pressure-meds-to-closing-his-clinic/id1713728830?i=1000761946383"),
    ("ep139", "139", "Why OTs Are Perfectly Positioned", "To Lead the Somatic Nervous System Revolution, with Sarita", "https://podcasts.apple.com/gb/podcast/139-why-ots-are-perfectly-positioned-to-lead-the/id1713728830?i=1000770127567"),
    ("ep106", "106", "From Baker to OT to Business Owner", "How Brad Williams Created a Driving Programme for Neurodivergent Learners", "https://podcasts.apple.com/gb/podcast/106-from-baker-to-ot-to-business-owner-how-brad-williams/id1713728830?i=1000731094167"),
    ("ep114", "114", "The OT Path to Freedom", "Burnout Recovery, Alignment & Farm OT with Alex Viera", "https://podcasts.apple.com/gb/podcast/114-the-ot-path-to-freedom-burnout-recovery-alignment/id1713728830?i=1000739800280"),
    ("ep130", "130", "What a 12-Hour Work Week Looks Like", "How I Designed My Freedom Life as a Former OT", "https://podcasts.apple.com/gb/podcast/130-what-a-12-hour-work-week-looks-like-how-i/id1713728830?i=1000757652169"),
]

FAQS = json.loads((HERE / "content/faqs.json").read_text())

MAGNETIC_BONUS = ["Confidence that lives in your body", "Stop undercharging and second-guessing",
                  "Speak with certainty instead of hesitation", "Live community for daily connection and support",
                  "8 Embodiment Sessions with Katja & Meg"]


def faq_answer(item):
    parts = []
    for a in item["a"]:
        if a.startswith("https://"):
            parts.append(f"<p>{ext(a, html.escape(a.replace('https://www.', '')))}</p>")
        elif "✔" in a:
            parts.append(ul([x for x in a.split("✔") if x.strip()], "checks"))
        else:
            parts.append(f"<p>{e(a)}</p>")
    return parts


# ---------------------------------------------------------------- pages
def home():
    swatches = [("#stages", "Your stage", "f-mist2"), ("#programmes", "Programmes", "f-moss"),
                ("#stories", "Stories", "f-forest"), ("#podcast", "Podcast", "f-navy2"), ("#call", "Book a call", "f-navy")]
    picker = "".join(f'<li><a class="{f}" href="#stage-{k}" aria-current="false"><strong>{n.replace("The ", "")}</strong><span>{e(who)}</span></a></li>'
                     for k, n, f, who, *_ in STAGES)
    stages = ""
    for k, n, f, who, intro, strong, hold, nxt, (u1, l1), (u2, l2) in STAGES:
        target = ' target="_blank" rel="noopener"' if u1.startswith("http") else ""
        stages += f"""<section class="stage chapter {f}" id="stage-{k}"><div class="wrap grid" data-in>
<h3>{n}</h3>
<div class="body"><p class="statement">{e(intro)}</p>
<dl><div><dt>Your strengths</dt><dd>{e(strong)}</dd></div><div><dt>What holds you back</dt><dd>{e(hold)}</dd></div><div><dt>Your next step</dt><dd>{e(nxt)}</dd></div></dl>
<div class="actions"><a class="btn" href="{u1}"{target}>{l1}</a><a class="link" href="{u2}">{l2}</a></div></div>
</div></section>"""
    # one picture across the programme tiles; text tiles sit where the picture is quietest
    texts = {
        0: ('f-white', '<a class="tile-link" href="book-a-call.html"><strong>Not sure which?</strong><p>Book a free call with Rob.</p></a>'),
        3: ('f-navy', f'<a class="tile-link" href="collective.html"><strong>The OT Freedom Collective</strong><p>1:1 with Beki and her team. £6,000 to £11,000, by call.</p></a>'),
        8: ('f-forest', f'<a class="tile-link" href="membership.html"><strong>The Membership</strong><p>£197 a month + VAT for UK residents. 3-day free trial.</p></a>'),
        13: ('f-gold', f'<a class="tile-link" href="{MAGNETIC}" target="_blank" rel="noopener"><strong>Magnetic Momentum</strong><p>£40 including UK VAT. Confidence first.</p></a>'),
        18: ('f-moss', f'<a class="tile-link" href="{MINI}" target="_blank" rel="noopener"><strong>Package Your OT Skills</strong><p>£20 including VAT. Your first offer.</p></a>'),
        23: ('f-mist2', '<a class="tile-link" href="start-free.html"><strong>Start free</strong><p>The Formula replay, the podcast and a free course.</p></a>'),
    }
    tiles = ""
    for i in range(24):
        c, r = i % 6, i // 6
        if i in texts:
            f, inner = texts[i]
            tiles += f'<div class="tile txt {f}">{inner}</div>'
        else:
            tiles += f'<div class="tile pic" style="background-image:url(assets/img/forest-overalls.jpg);background-position:{c * 20}% {r * 100 / 3:.2f}%" aria-hidden="true"></div>'
    cards = "".join(f'<a class="card" href="{u}" target="_blank" rel="noopener"><div><h3>{e(t)}</h3><p>{e(rest)}</p></div><span class="meta"><span>Episode {n}</span><span>Listen on Apple</span></span></a>'
                    for _, n, t, rest, u in EPISODES)
    faq_pick = [FAQS[i] for i in (0, 2, 7, 10, 12)]
    body = f"""<section class="hero" aria-label="Introduction"><div class="hero-in">
<div class="view on-film" data-push>{film("hill-loop", "hill-poster.jpg")}
<h1><span class="mask"><span>OT yourself</span></span><span class="mask"><span>to freedom</span></span></h1>
<p class="lede rise-late">Former OT Beki Eakins helps occupational therapists design, grow and scale an online business, using the skills they already have.</p>
<a class="btn rise-late" href="#stages">Find your stage</a></div>
<ul class="swatches">{"".join(f'<li class="{f}"><a href="{h}">{l}</a></li>' for h, l, f in swatches)}</ul>
</div><p class="hero-lede-m">Former OT Beki Eakins helps occupational therapists design, grow and scale an online business, using the skills they already have.</p></section>

<section class="intro chapter f-white"><div class="wrap grid" data-in>
<h2 class="statement">Wales, most days. The office moves. The income does not stop.</h2>
<figure>{img("forest-laptop-red", "Beki working on her laptop in the forest")}</figure>
<div class="after"><p>I am Beki, former Occupational Therapist and now Business and Lifestyle Coach. I left the profession in 2019 to travel the world, build my business and to support a freedom-based life.</p><a class="link" href="about.html">More about Beki</a></div>
</div></section>

<section class="stage-pick" id="stages">{film("compass-loop", "compass-poster.jpg")}<div class="wrap chapter" data-in>
<h2>Which stage are you at?</h2>
<p class="statement">Tap the one that sounds most like you. Not sure? {ext(QUIZ, "Take the 2-minute quiz")}.</p>
<ul class="picker">{picker}</ul></div></section>
{stages}

<section class="f-white" aria-labelledby="about-h"><div class="inset"><div class="grid" data-in>
<h2 id="about-h">A former OT who found the way out</h2>
<figure class="arch">{img("forest-denim", "Beki in the forest near her home in North Wales")}</figure>
<div class="cols">
<div><h3>Burnout first</h3><p>Beki experienced burnout from trying to be a Mum, run a home and trying to work as an OT.</p></div>
<div><h3>Then a model that worked</h3><p>I started out coaching healthcare workers with stress and burnout, and had fast success: I doubled my OT income from the 2nd month, and hit 5k months in my 4th month of business.</p></div>
<div><h3>Now about 12 hours a week</h3><p>The business model allowed me to work just 12 hours per week. We spend our days going out in the forest, mountain biking or out on the canoe.</p><a class="link" href="about.html">Beki's story</a></div>
</div></div></div></section>

<section class="programmes f-mist" id="programmes"><div class="wrap tiles-head"><h2>Ways to work with Beki</h2></div><div class="tiles">{img("forest-overalls", "Beki in the forest", "tiles-photo")}{tiles}</div></section>

<section class="results chapter f-gold"><div class="wrap" data-in>
<h2>What Beki's clients have done</h2>
<p class="muted">Of course success depends on how much energy and commitment each client applies.</p>
{ul(RESULTS, "")}
<a class="link" href="stories.html">Read their stories</a></div></section>

<section class="tq" id="stories"><div class="who"><h2>In their words</h2><p><strong>Nicola</strong>OT and nature-based coach</p><a class="link" href="stories.html">All the stories</a></div>
<div class="said"><blockquote>&ldquo;She turns up authentically, honestly and comfortably as herself.&rdquo;</blockquote>
<p>&ldquo;Despite years of therapy, most of what I know about overcoming my mindset has come from Beki.&rdquo;</p></div></section>

<section class="deck-wrap f-mist" id="podcast"><div class="deck-stage wrap">
<h2>The podcast</h2>
<p class="statement">OT Yourself to Freedom: OTs who built the way out, in their own words.</p>
<div class="deck">{cards}</div>
<p class="deck-note"><a class="link" href="podcast.html">All episodes and where to listen</a></p></div></section>

<section class="chapter f-white" id="call"><div class="wrap grow" data-in>
<div class="head"><h2>What happens on a call</h2><p class="statement">A free 45-minute Connection Call with Rob. Routing you to the right room is part of the job, not a way of turning you away.</p><div class="actions"><a class="btn" href="{ROB}" target="_blank" rel="noopener">Book a free call</a></div></div>
<figure class="g1">{img("headset-forest", "Beki on a call outdoors")}</figure>
<figure class="g2">{img("laptop-window", "Beki at her laptop by the window")}</figure>
<figure class="g3">{img("beach-sit", "Beki sitting on the beach")}</figure>
<div class="cap c1"><strong>You book</strong>A 45-minute slot that suits you.</div>
<div class="cap c2"><strong>You talk</strong>Where you are now, and where you want to be.</div>
<div class="cap c3"><strong>You get a straight answer</strong>The right programme for you, or an honest no.</div>
</div></section>

<section aria-labelledby="faq-h"><div class="faq-head wrap f-white"><h2 id="faq-h">Questions</h2></div>
{bands([(f["q"], faq_answer(f)) for f in faq_pick])}
<div class="band"><div class="grid"><h3>More questions?</h3><div class="a"><a class="link" href="faqs.html">All the answers</a></div></div></div></section>

<section class="close f-navy wrap"><h2>One call. Your time back.</h2>
<div class="foot"><p>Free, 45 minutes, with Rob. Or start with Beki's free resources.</p>
<div class="actions"><a class="btn" href="{ROB}" target="_blank" rel="noopener">Book a free call</a><a class="link" href="start-free.html">Start free</a></div></div></section>"""
    page("index.html", "Beki Eakins | OT Yourself to Freedom", "Beki Eakins helps occupational therapists design, grow and scale an online business.", body, home=True)


def collective():
    team = [
        ("c-beki", "Beki", "Strategy, leadership, and decision-making", ["This is where your business is seen clearly. Not through theory, but through experience.", "You are given direct, honest guidance on what is actually slowing you down, where you are overcomplicating things, and what needs to change if you want this to work."]),
        ("t-meg", "Meg", "Human Design and energetic alignment", ["There is a point where pushing harder stops working. Meg's work is not about making things softer. It is about precision.", "Understanding how you are designed to make decisions, manage your energy, and build your work in a way that does not create unnecessary resistance."]),
        ("t-katja", "Katja", "Vocal Alchemy and embodied visibility", ["Most people are not invisible because they lack ideas. They are invisible because they are holding themselves back.", "Katja works at the level most people avoid completely. Your voice, your presence, your ability to be felt when you speak."]),
        (None, "Rob", "Sales, discipline, and high performance", ["At some point, this comes down to standards. Rob brings the level of discipline and execution that separates people who “want it” from people who actually build it.", "He will show you exactly where you are hesitating, where you are avoiding responsibility, and where you are lowering your own expectations. And then he will raise them."]),
    ]
    people = "".join(
        f'<figure>{img(p, "Portrait of " + n) if p else f"<div class=ph aria-hidden=true>{n[0]}</div>"}<h3>{n}</h3><p><strong>{e(r)}</strong></p>{paras(*t)}</figure>'
        for p, n, r, t in team)
    steps = [
        ("fire-laptop", "Design your high ticket offer", ["We will take your skills and passions and teach you how to package them up into a high ticket offer. This is a personalised and bespoke service and what you produce will be unique to you!", "If you are brand new, we can take you from not even having an idea, to launching and scaling."]),
        ("forest-mug", "Master your marketing", ["We will teach you a number of strategies where you can get quick wins in finding clients online.", "Sales is a big process, and we will teach you the language, and skills required to smash this!"]),
        ("suitcase", "Repeat, automate, delegate", ["Once you have mastered each stage, we can look at ways to improve the ease of what you do. With automations, delegations and systems that you can use to save your precious time."]),
    ]
    cases = "".join(img(f"c-case{i}", f"Client result screenshot {i}") for i in range(1, 7))
    long_faq = [
        ("It's not cheap, and this is a big investment for me. Will it work for me?", [
            "Most of our clients and the majority of people feel this way before investing but to put it in context for you. It’s scary the first time you choose to invest in your own growth and development. I know, because I remember feeling exactly the same! I have had literally shivers when pressing the button on some of my biggest investments.",
            "Which do you think holds more risk? Trying something new or keep doing what you are doing and trying to figure it out alone? I have seen people waste years, and even a decade in trying to get it going alone. And yet the fastest time one of my clients has hit a 15k month was 5 months of working with me.",
            "If you are still struggling with the investment, do speak to us. This is the middle level in terms of working with us, so there are other options."]),
        ("Can I think about it?", [
            "Of course, you can think about it. Breathe into it, listen to your intuition and inner guidance.",
            "Yes - tune into the way your body makes decisions. (Meg will be teaching more about this on the programme.) But this doesn’t need to take a long time.",
            "Ultimately the real question is who are you going to be and how are you going to make decisions moving forward?"]),
        ("It might not work for where I live", [
            "Most clients think that people in their area will not buy high ticket offers. But over and over again we see this theory is proven to be wrong.",
            "The beauty of online work, is that we have a really broad pool of people to pull from. Many of you may choose to have an international business - that's the choice I made. What appears as a small niche, is suddenly massive when you opt to focus on the whole world.",
            "When we teach you how to communicate effectively online, you will open up new doors to a world of people you had no idea existed!"]),
    ]
    body = f"""<section class="film-head" data-push>{film("valley-loop", "valley-poster.jpg")}<div class="wrap" data-in>
<h1>The OT Freedom Collective</h1><p class="lede">For the OT who knows she is operating below her own ceiling. More income. Fewer hours. No second-guessing.</p>
<div class="actions"><a class="btn" href="{ROB}" target="_blank" rel="noopener">Book a call with our team</a></div></div></section>

<section class="chapter f-white"><div class="wrap split" data-in>
<div class="l"><h2>The model is the problem.</h2></div>
<div class="r prose"><p class="statement">Here is the part most people will not say out loud.</p>{paras(
    "You left employment to get your freedom back. What you actually built was a job with better branding. The referrals come in, so you say yes to work you would never have chosen. You write reports in the evenings to justify work you have already done. You are busy, you are good at this, and you are still not in control of a single hour.",
    "That is not freedom. That is the same trap, rebuilt by your own hands.",
    "And it is not happening because you do not know what to do. You know plenty. It is happening because you are still inside a model that was never going to give your time back.",
    "The model is the problem. So we change the model.",
    "Inside the Collective you stop being paid for your hours and start being paid for the value you deliver. You stop taking whatever lands in your inbox and start building an offer people actively choose. You stop filling your diary with the wrong work and start building something that finally fits the life you walked away for in the first place.",
    "This is not motivation. You do not need motivating. You need a higher standard held around you, by people who can see your patterns faster than you can, and who will not let you quietly settle for less than you came here for.",
    "The OTs who fly here are the ones already established and credible, with a little room to move and the decisiveness to sell before everything feels perfect. If that is you, keep reading.")}
<p>If you are at rock bottom right now with nothing spare, <a class="link" href="membership.html">the Membership</a> is the honest place to begin, and I will tell you so on the call. Routing you to the right room is part of my job, not a way of turning you away.</p></div>
</div></section>

<section class="chapter f-navy"><div class="wrap" data-in>
<h2>You didn't escape the system. You rebuilt it.</h2>
<div class="split" style="margin-top:48px"><div class="l prose">{paras(
    "You’ve likely built a business that still depends on referrals coming in, which means you are often saying yes to clients you would not have actively chosen, simply because the work is there.",
    "At the same time, you are spending evenings writing reports to justify work you have already done, while your income remains tied to the hours you can physically fit into your week.")}</div>
<div class="r prose"><p>Inside the OT Freedom Collective, we don’t just “build you a business”. We rebuild how you operate entirely.</p>
{ul(["You stop taking whatever referrals come your way, and start creating an offer people actively choose",
     "You stop being paid for your time, and start being paid for the value you deliver",
     "You stop filling your diary with the wrong work, and start building something that actually fits your life",
     "And most importantly, you stop second-guessing everything"])}</div></div></div></section>

<section class="chapter f-mist"><div class="wrap split" data-in>
<div class="l"><h2>What you actually get</h2><p class="price">£6,000 to £11,000</p><p>The OT Freedom Collective prices range from £6000 to £11,000, with payment plans available.</p></div>
<div class="r">{ul(["Direct access to me and my team of experts.", "Access to the level of thinking you cannot reach on your own.",
     "Clear direction on what to focus on each week, so you stop wasting time on things that don’t move your business forward",
     "Support when you hit resistance, so you don’t fall back into old patterns", "And a structure that forces your business to actually grow"])}
<div style="margin-top:40px">{vid("369ko60244", "v-sales", "Beki on the OT Freedom Collective", "wide")}</div></div>
</div></section>

<section class="chapter f-white"><div class="wrap split" data-in>
<div class="l"><h2>Why this works</h2></div>
<div class="r prose">{paras(
    "At some point, this stops being about knowing what to do.",
    "Most Occupational Therapists at your level already understand enough about business to move forward. The issue is not information. It is inconsistency, hesitation, and the quiet ways you allow yourself to stay where it is comfortable.",
    "That is why most programmes fail. They give you more to think about, but they do not change how you actually operate. This does.",
    "You are not here to be motivated. You are here to perform at a level that produces results.")}
{ul(["Decisions are made faster", "Execution becomes consistent", "And the gaps you have been avoiding are no longer left alone"])}</div>
</div></section>

<section class="chapter f-navy2"><div class="wrap" data-in>
<h2>Your team</h2><p class="statement" style="margin:20px 0 48px">Beki is a former OT and Meg, who offers human design is a current OT. This programme is written by OTs for OTs.</p>
<div class="people">{people}</div></div></section>

<section class="chapter f-white"><div class="wrap split" data-in>
<div class="l"><h2>Here's what you will get</h2><p class="muted">This isn't a group programme, a course, or some low level offer. I will not encourage you to make ads, build websites or hire staff, until you are making more than enough to cover this.</p></div>
<div class="r">{ul(["A personalised plan for 10-12 hours work weekly - that can grow into a full time if you want (25 hours per week max business)",
     "Help with designing your high ticket offer", "Launching strategies that feel aligned to you",
     "Personalised 1:1 calls with Beki, and her team of experts",
     "Community support with many other OTs from around the world, all sharing ideas and thoughts. There is power in this!",
     "A business you love that keeps your bank account full and your calendar empty. No more trading your time for money.",
     "No unnecessary stress, overwhelm or risk of burnout."])}
<p style="margin-top:28px">Some of my OTs want to run hard and fast at this, and we can match this pace. Others prefer to take their time. That is also ok. We work at your pace.</p></div>
</div></section>

<section class="chapter f-mist"><div class="wrap" data-in><h2>Three stages</h2>
<div class="columns-3" style="margin-top:48px">{"".join(f'<div><figure>{img(p, "")}</figure><h3>{t}</h3>{paras(*ps)}</div>' for p, t, ps in steps)}</div></div></section>

<section class="chapter f-moss"><div class="wrap split" data-in>
<div class="l"><h2>Free access to Magnetic Momentum</h2><p>Included inside the OT Freedom Collective. Because strategy only works when self-belief is already in place.</p></div>
<div class="r">{ul(MAGNETIC_BONUS)}</div></div></section>

<section class="chapter f-white"><div class="wrap" data-in><h2>Case studies</h2>
<p style="margin:20px 0 40px;max-width:70ch">Clients have built coaching, mentoring, education or supervision style businesses. We have paediatric OTs galore, mental health OTs, but we also help OTs who feel they are jack of all trades and master of none.</p>
<div class="gallery">{cases}</div></div></section>

<section class="chapter f-gold"><div class="wrap split" data-in>
<div class="l"><h2>The investment</h2><p class="price">£6,000 to £11,000</p></div>
<div class="r"><p>Prices range from £6000-£11,000, with payment plans available. If you are on a smaller budget, see <a class="link" href="membership.html">our Membership option</a>.</p>
<p>Speak with our team to find out which is right for you. Still have questions? Email <a class="link" href="mailto:{EMAIL}">{EMAIL}</a>.</p>
<div class="actions"><a class="btn" href="{ROB}" target="_blank" rel="noopener">Book a call</a></div></div></div></section>

<section class="chapter f-white"><div class="wrap split" data-in>
<div class="l"><h2>Why do we do this?</h2></div>
<div class="r prose">{paras(
    "We have a dream to help OTs find their version of freedom. We want to help OTs to create a lifestyle they love, whilst still pursuing their passions and following their heart.",
    "We believe OTs have a unique message to give to the world. But they are held back by fears, poor money mindset and a lack of business strategy and marketing skills.",
    "We see OTs racing for passive income, and making their life miserable in the process. We see OTs becoming a victim of their own successful practice.",
    "We have found a different way of living. We have each created a life where every day we CHOOSE what we do.")}</div></div></section>

<section aria-labelledby="cfaq"><div class="faq-head wrap f-white"><h2 id="cfaq">Common questions</h2></div>{bands(long_faq)}</section>"""
    page("collective.html", "The OT Freedom Collective | Beki Eakins", "1:1 with Beki and her team, for established OTs ready to scale.", body, "collective.html")


def membership():
    body = f"""<section class="page-head f-white"><div class="wrap grid" data-in>
<h1>The Membership</h1>
<div class="side"><p>Are you an OT wanting to create a freedom style business? This is the very place where OTs from across the world come together, to learn how to design, grow and scale an online business.</p>
<p class="price">£197</p><p class="small">a month, + VAT for UK residents added at checkout. 3-day free trial. No contract, cancel any time.</p>
<div class="actions"><a class="btn" href="{MEMBERSHIP_OFFER}" target="_blank" rel="noopener">Start your 3-day free trial</a></div></div>
</div></section>

<section class="chapter f-mist"><div class="wrap split" data-in>
<div class="l wide">{vid("vhtvj6gfxf", "v-m1", "Beki on the Membership", "wide")}</div>
<div class="r prose" style="grid-column:8/-1">{paras(
    "The OT Yourself to Freedom Membership is an educational programme, designed to help you design, launch and grow your online business. You get full access to the recorded programme, and you will have support via a community app.",
    "You can attend multiple group calls per month. Some are with Beki, across different timezones. Other calls are with Katja, our Voice Alchemist who runs sessions on building confidence to support clients on their way to a successful business.",
    "You also get a BONUS course, Magnetic Momentum, which is designed to boost your self-belief.")}</div></div></section>

<section class="chapter f-white"><div class="wrap" data-in><h2>The three parts of the Membership</h2>
<div class="columns-3" style="margin-top:48px">
<div><figure>{img("m-understanding", "")}</figure><h3>Understanding You</h3><p>Discover your purpose and zones of genius, then tie in with your life story to create a high ticket offer that is totally aligned to you.</p></div>
<div><figure>{img("m-strategy", "")}</figure><h3>Business Strategy</h3><p>You will learn how to master online sales and marketing using social media. We teach you how to launch, without needing to pay for ads or a website.</p></div>
<div><figure>{img("m-mindset", "")}</figure><h3>Mindset &amp; Energetics</h3><p>You will learn the basics on how to master your mind. Energetics is around 80% of your business success, so growth in this area is essential.</p></div>
</div></div></section>

<section class="chapter f-moss"><div class="wrap split" data-in>
<div class="l"><h2>This is for you if you want</h2>{ul(["a freedom based, online business", "to learn how to work less and earn more", "to learn how to get clients online", "to learn how to make 5-15k per month", "to understand sales and marketing strategies", "to grow your entrepreneurial mindset", "to meet with a like minded community of OT entrepreneurs"])}</div>
<div class="r"><h2>It is not for you if you are</h2>{ul(["Hoping for a quick fix and not willing to put in the work", "Looking to create a busy practice or bricks and mortar style business", "Not willing to use social media to grow a business", "Looking for a side hustle or small hobby", "Have less than 5 hours per week to put in (10+ is preferable)", "Fixed in mindset and not willing to grow"])}</div>
</div></section>

<section class="chapter f-gold"><div class="wrap split" data-in>
<div class="l"><h2>What the Membership includes</h2><p class="price">£197</p><p class="small">a month, + VAT for UK residents added at checkout</p>
<div class="actions"><a class="btn" href="{MEMBERSHIP_OFFER}" target="_blank" rel="noopener">Start your 3-day free trial</a></div>
<div style="margin-top:40px">{vid("pth5k25isy", "v-walkthrough", "A walkthrough of the Membership content", "wide")}</div></div>
<div class="r">{ul(["Access to Magnetic Momentum, The Confidence Foundation for OTs (normally £40)", "Monthly group calls with Beki for business advice and Katja for growing in self-belief and confidence", "How to define your offer", "Energetic work to overcome blocks and limiting beliefs", "A vibrant community with OTs from across the world", "A personal call with Beki at month 3 to help you hone down your ideas", "Fun challenges designed to help you grow", "Modules on sales training", "Full access to the recorded programme with video, text and downloadable content"])}</div>
</div></section>

<section class="chapter f-white"><div class="wrap split" data-in>
<div class="l"><h2>What is unique about this membership?</h2>{vid("sq8epyc8yn", "v-m2", "Beki on what makes the Membership different", "wide")}</div>
<div class="r prose">{paras(
    "This membership is the only one in the world, specifically designed by a (former) OT to help OTs use skills they already have to create an online business in this way.",
    "The focus is to create a high ticket offer. This means selling a programme that might sell for thousands instead of hundreds.",
    "This membership will teach you how to design a high ticket offer that is inspired from your personal journey and life mission. Then we teach you how to market, launch and scale using social media.",
    "The membership is unique because it also includes the energetics work to get you better results. In my experience business is not a linear experience, you will have challenges to face and much of it will be an internal battle.",
    "This is not a prison. We are not going to force you to stay and we have made it very easy for you to leave at any time if you don't feel it's a good fit for you.")}</div>
</div></section>

<section class="tq"><div class="who"><h2>OT, UK</h2><p><strong>Membership member</strong></p></div>
<div class="said"><blockquote>&ldquo;I started the membership and it gave me the reassurance I needed to know I do know what I need to do.&rdquo;</blockquote>
<p>&ldquo;Not to doubt myself, rid the imposter syndrome and that is worth every penny of the investment I made.&rdquo;</p>
<p>&ldquo;I highly recommend Beki Eakins if you are an OT looking for a freedom lifestyle. She is a wealth of knowledge and an all round wonderful energy.&rdquo;</p></div></section>

<section aria-labelledby="mfaq"><div class="faq-head wrap f-white"><h2 id="mfaq">You asked</h2></div>{bands([
    ("How much support will I get on the membership?", ["This is a self-paced membership. You can work through this in your own time, and ask questions in the community and attend group calls.", "You will get a 1:1 call with Beki after 3 months, this is the optimum time to really create your business, when you have worked through all of the first three modules.", "There are a number of group calls per month, offered over different time zones with Beki and Katja, our Voice Alchemist."]),
    ("What kind of businesses have previous clients made?", ["There are so many options of a business that people can design. You can use some traditional OT skills, or coaching, mentoring, supervision, consulting and of course education.", '<p><a class="link" href="stories.html">Take me to the stories</a></p>']),
    ("How long is the membership?", ["You can stay as long as you require, the payments are ongoing. It is anticipated that you will want to stay for at least 12 months, whilst working through the material."]),
    ("What tools or extra purchases am I expected to make?", ["I will tell you to avoid spending money on anything that you absolutely don't have to.", "A good computer or laptop will be useful, or a device that you can easily use apps like zoom, or spreadsheets on. A smartphone with a good camera is very useful for social media.", "Good internet will always help. But I built my business from a campervan and forest house with terrible internet and still managed."]),
])}</section>

<section class="story f-mist"><div class="wrap split" data-in>
<div class="l">{vid("wjoe0v9gmf", "v-alexm", "Alex's story", "tall")}</div>
<div class="r prose"><h2>Alex left her job within 9 months</h2><!-- taste-skill-ignore: "shadow work" is Beki's copy, not a CSS shadow -->{paras(
    "Alex does Mom coaching for those mums running on autopilot and hitting burnout. Alex has been a super fun client to work with.",
    "Alex dived into shadow work and money mindset at the start, which were essential to learn how to sell her true worth, and not low value options.",
    "After a group call on the energetics of content, Alex put out a piece of content that went viral. She had over 6000 new followers in one week, and made multiple sales from this one content piece!",
    "Alex now has a business where she is magnetising clients to her, making regular sales and not working crazy hours to do it.")}</div></div></section>

<section class="results chapter f-white"><div class="wrap" data-in><h2>Client results</h2>{ul([
    "J.V designed a high ticket offer of 6 hours trauma work for 1800 and sold it with ease!", "Nicola made 6k in 6 months!",
    "Clare filled her diary with 8 sales calls in just one week and was able to launch her group programme!",
    "Suzanne created and sold her first high ticket offer in just 4 weeks of working with us.", "Timothy started the year with a bang and signed up 10 clients!",
    "Julie designed, launched and sold her high ticket offer for 1500 in just 9 weeks!",
    "Michelle signed her first client within 3 weeks and then secured enough further clients to leave her day job!",
    "Bethany designed, launched and sold her high ticket offer in 11 weeks for over 2k! She also made multiple extra sales to her membership.",
    "Kaili had a 5k month her first month of working with us and sold her first high ticket offer within 9 weeks"], "")}</div></section>

<section class="close f-navy wrap"><h2>Start with three free days.</h2>
<div class="foot"><p>£197 a month, + VAT for UK residents. Magnetic Momentum is included automatically when you join.</p>
<div class="actions"><a class="btn" href="{MEMBERSHIP_OFFER}" target="_blank" rel="noopener">Start your free trial</a><a class="link" href="book-a-call.html">Or book a call</a></div></div></section>"""
    page("membership.html", "The Membership | Beki Eakins", "£197 a month, 3-day free trial. Learn to design, launch and grow an online OT business.", body, "membership.html")


def start_free():
    rows = [
        ("r-formula", "formula.html", "The OT Freedom Formula replay", "Watch the OT Freedom Formula for free.", False),
        ("compass-top", QUIZ, "Find your Freedom Stage", "8 honest questions, 2 minutes. Find out where you are and the one next step that fits.", True),
        ("r-lifestyle", "https://podcasts.apple.com/au/podcast/133-starting-your-online-ot-business-feat-beki-eakins/id1530131740?i=1000757842134", "Beki on The OT Lifestyle Movement", "Discover how to build a thriving online OT business in this episode of The OT Lifestyle Movement with Beki Eakins, covering real numbers, smart strategy and powerful mindset shifts.", True),
        ("r-ideal1", LIVE + "/pl/2147653061", "4 Steps to Attracting in your Ideal Client", "A 30 minute training teaching you how to attract in your ideal client in the online space. Free course and downloadable workbook.", True),
        ("r-podcast", "podcast.html", "The podcast", "Our weekly podcast covering all of the hot topics.", False),
        ("r-accelerator", ACCELERATOR, "The OT Business Accelerator", "For OT entrepreneurs who know they are capable of more and are ready to move now. They might have a strong business already, but are trapped by their own success.", True),
    ]
    rowhtml = "".join(
        f'<a class="post-row" href="{u}"{" target=_blank rel=noopener" if out else ""}>{img(i, "")}<div class="t"><h3>{e(t)}</h3><p>{e(d)}</p></div></a>'
        for i, u, t, d, out in rows)
    body = f"""<section class="page-head f-white"><div class="wrap grid" data-in>
<h1>Start free</h1><div class="side"><p>Here you can find all of my free resources to help you on your journey to freedom.</p>
<p><a class="link" href="{LIVE}/pl/2147631049" target="_blank" rel="noopener">The free overnight meditation</a></p></div></div></section>
<section class="chapter f-mist" style="padding-top:20px" aria-label="Free resources"><div class="wrap posts" data-in>{rowhtml}</div></section>
<section class="close f-navy wrap"><h2>Enjoyed these? Let's talk.</h2>
<div class="foot"><p>If you would like to take the next step, contact our team to discuss working together.</p>
<div class="actions"><a class="btn" href="book-a-call.html">Book a free call</a><a class="link" href="stories.html">What clients say</a></div></div></section>"""
    page("start-free.html", "Start free | Beki Eakins", "Beki's free resources for OTs.", body, "start-free.html")


def formula():
    body = f"""<section class="film-head" data-push>{img("formula-lp", "", eager=True)}<div class="wrap" data-in>
<h1>The OT Freedom Formula replay</h1>
<p class="lede">A session created to help OTs build more freedom, income and balance, without burnout.</p></div></section>
<section class="chapter f-white"><div class="wrap split" data-in>
<div class="l"><h2>What you'll discover</h2><p class="statement">How OTs are creating more freedom and income online.</p>
<div class="actions"><a class="btn" href="{FORMULA_LIVE}" target="_blank" rel="noopener">Yes please, take me to the recording</a></div>
<p class="small muted" style="margin-top:14px">You will be subscribed to our newsletter, opt out at any time.</p>
<figure style="margin-top:40px">{img("fire-laptop", "Beki working by the fire")}</figure></div>
<div class="r prose">{paras(
    "If you missed it (or fancy watching it again), you can catch the full replay. You’ll discover how to package your OT skills into a high-ticket offer that can double your income in half the time.",
    "This session is a must-watch if you’re ready to rethink how you work as an OT. You’ll discover how others around the world are using their skills to build online businesses that bring more time, income and energy back into their lives.")}
<h3>What will be covered</h3>{ul([
    "The common mistakes OTs make when starting an online business (and what to do instead)", "Why high-ticket offers are the most powerful way to start and scale",
    "The exact first step to building a business that aligns with your true strengths", "How to activate your purpose, energy and natural magnetism using The OT Freedom Method",
    "How to create a high-value marketing message that draws in your ideal clients"])}</div></div></section>"""
    page("formula.html", "The OT Freedom Formula replay | Beki Eakins", "Watch the OT Freedom Formula replay.", body, "start-free.html")


def faqs():
    body = f"""<section class="page-head f-white"><div class="wrap grid" data-in>
<h1>Questions, answered</h1><div class="side"><p>Anything not here? Email <a class="link" href="mailto:{EMAIL}">{EMAIL}</a> or <a class="link" href="book-a-call.html">book a call</a>.</p><figure>{img("green-blazer", "Beki Eakins")}</figure></div></div></section>
<section aria-label="All questions" data-in>{bands([(f["q"].rstrip(":"), faq_answer(f)) for f in FAQS])}</section>"""
    page("faqs.html", "FAQs | Beki Eakins", "Answers to the questions OTs ask Beki most.", body)


def stories():
    people = [
        ("pzgkvdd11p", "v-sarita", "Sarita", ["Sarita made $21,550 AUD within her first launch, 4 months into the programme. That’s more than 10x the initial investment.", "Sarita has now filled two cohorts of her online programme, working with people across 7 countries and doing work she genuinely enjoys.", "“The feedback has been incredible and really inspiring to continue.”"], ("https://podcasts.apple.com/gb/podcast/110-building-a-freedom-led-online-ot-practice/id1713728830?i=1000735679377", "Hear her full journey")),
        ("n30iawlk75", "v-ivan", "Ivan", ["Ivan sold his first high ticket offer within 3 weeks, and made 5 times the cost of his investment back during his time with us. Ivan automated his business quickly, and has also now started the delegation process too.", "He managed all of this whilst running a successful OT business!"], None),
        ("nte9bcs9w7", "v-bethany", "Bethany", ["Bethany came to us with a business already created. We helped her to make it more profitable, and streamlined and have a higher ticket offer.", "Bethany doubled her OT income within 6 months of starting with us, and has since gone on to earn more than she has ever before as her business continues to grow and expand!"], None),
        ("o59oakb9hb", "v-alex", "Alex", ["Alex very quickly replaced her OT wage and left her job to concentrate on her business full time within 9 months."], None),
        ("1wcjivul8o", "v-ellie", "Ellie", ["Ellie made $15k in a 2 week period, has just had a $5000 week and has now been able to drop her contract work.", "There were a lot of pieces to put together in Ellie's business, which is a hybrid OT and parent coaching model. In less than 6 months she has completely spun her world round and is now ready for the next stages of growth.", "She did all of this with a toddler and moved house as well!"], None),
        ("ne49sr02m9", "v-shaenelle", "Shaenelle", ["Shaenelle signed up 5 clients within 3 weeks, all on big packages meaning she did not have to return to her OT job after the summer break.", "During her fifth month on the Abundance Accelerator she brought in 10k of cash sales! After this she had a 15k month and kept growing from there."], None),
        ("kpq4kexqrh", "v-lisa", "Lisa", ["Lisa just signed her first 1:1 client!! AND created a webinar, AND got people signed up to it...all in one week!!"], None),
        ("22o1n02y68", "v-clare", "Clare", ["Clinical Hypnotherapist and Mindfulness Coach.", "Clare was earning a maximum of £400 per month in her business before we worked together. At this stage Clare has passed £2000 per month and she is headed towards her next goal of £4000 monthly.", "Clare has created a beautiful, blended business where she works 1:1, in schools and hosts groups."], None),
        ("7584ergsj7", "v-orla", "Orla", ["There is not a one size fits all approach in business. Orla is a great example of this.", "One of these was facing the camera for social media. It can take courage to put yourself on social media and this can be an energy drain for some.", "Orla has created a beautiful business, has 3 regular clients and funnels that are set up and ready for her to expand on this start."], None),
    ]
    blocks = ""
    for i, (w, t, n, ps, link) in enumerate(people):
        f = "f-white" if i % 2 == 0 else "f-mist"
        more = f'<p>{ext(link[0], link[1])}</p>' if link else ""
        blocks += f"""<section class="story {f}"><div class="wrap split" data-in>
<div class="l">{vid(w, t, n + "'s story")}</div><div class="r prose"><h2>{e(n)}</h2>{paras(*ps)}{more}</div></div></section>"""
    quotes = [
        ("I have to say that since I met Beki, my life has been changing for the better. I was stuck with my business and there had been no growth or new clients. I can feel the energy of the business changing.", "Tamara"),
        ("I find working with Beki very valuable. I have grown and become more confident and I am becoming comfortable with being visible! I would highly recommend Beki!", "Annette"),
        ("The course is inspiring. It provides a safe container to access support to take action, get inspiration & overcome blocks. I love the group coaching calls!", "Louisa"),
        ("Beki has created the most amazing community of like-minded women who are also on a mission to help others and make a difference in the world.", "Karen"),
        ("After a period of being stuck and not knowing what direction I wanted to go in, she helped me open up with what was really holding me back. This jumpstarted my business idea exponentially!", "Kelly"),
        ("This course has been brilliant, absolutely brilliant. I am so pleased I signed up. Not only strategy but mindset as well. You’ve been incredibly generous with it all.", "Jeanette"),
        ("I am so grateful for everything. My life, the impact that I have managed to have, the knowledge that you have given to me, I am a better person for it.", "Tamara"),
        ("That session was fantastic. I definitely feel a lot more fired up. Come on, now I can do this.", "Lisa"),
        ("Beki is an amazing coach! She is truly inspiring and left me feeling motivated, focused and ready to achieve my goals.", "Sarika"),
        ("I feel excited to be working with you now as you have done it already. This is definitely working!", "Bez"),
    ]
    fields = ["f-gold", "f-mist", "f-moss", "f-mist2"]
    qhtml = "".join(f'<figure class="{fields[i % 4]}"><blockquote>&ldquo;{e(q)}&rdquo;</blockquote><figcaption>{n}</figcaption></figure>' for i, (q, n) in enumerate(quotes))
    body = f"""<section class="film-head" data-push>{img("beach-walk", "Beki walking on the beach", eager=True)}<div class="wrap" data-in>
<h1>Stories from OTs</h1><p class="lede">What do others say about Beki's courses? In their own words, and their own videos.</p></div></section>
{blocks}
<section class="tq"><div class="who"><h2>Nicola</h2><p><strong>OT and nature-based coach</strong>We worked together for 6 months and Nicola was able to make double the cost of working with me.</p></div>
<div class="said"><blockquote>&ldquo;What made me choose Beki was how wonderfully human and actually imperfect she was.&rdquo;</blockquote>
<p>&ldquo;She turned up to the intro call with paint on her face.&rdquo;</p>
<p>&ldquo;I've signed up 3 paid clients now and 3 unpaid trial clients before that, all of which have been since I started working with Beki.&rdquo;</p></div></section>
<section class="story f-white"><div class="wrap split" data-in>
<div class="l"><figure>{img("t-bibba", "Bibba")}</figure></div>
<div class="r prose"><h2>Bibba</h2>{paras(
    "After I completed my coaching accreditation I thought that I would feel confident to go out there and find clients with relative ease. But things didn’t quite work out like that.",
    "Beki supported me and helped me to dig into what was behind these fears. She gave me space and strategies to work through the limitations that I was placing on myself and allowed me to go at my own pace.",
    "Fast forward a few months, I now support a community of ladies within my niche, have 2 further clients, and the best part, I get to do this with a business partner and friend for life.")}</div></div></section>
<section class="chapter f-white"><div class="wrap"><h2 style="margin-bottom:40px">More kind words</h2><div class="quotes">{qhtml}</div></div></section>
<section class="close f-navy wrap"><h2>Your story could be next.</h2>
<div class="foot"><p>Let's talk about how we can help take your business to the next level.</p>
<div class="actions"><a class="btn" href="{ROB}" target="_blank" rel="noopener">Meet with our team</a></div></div></section>"""
    page("stories.html", "Stories | Beki Eakins", "OTs who built online businesses with Beki, in their own words.", body, "stories.html")


def podcast():
    eps = "".join(f'<a class="ep" href="{u}" target="_blank" rel="noopener"><div>{img(i, "Episode " + n + " artwork")}</div><p class="t">{e(t)}</p><p class="small go">{e(rest)}</p><span class="go link">Listen to episode {n}</span></a>'
                  for i, n, t, rest, u in EPISODES)
    body = f"""<section class="page-head f-navy"><div class="wrap grid" data-in>
<h1>OT Yourself to Freedom</h1>
<div class="side"><p>The podcast for OTs who want more time, more income and a life they choose. Beki and her guests share how they built the way out.</p>
<div class="actions"><a class="btn" href="{APPLE}" target="_blank" rel="noopener">Listen on Apple Podcasts</a><a class="link" href="{LIVE}/podcasts/ot-yourself-to-freedom" target="_blank" rel="noopener">All episodes</a></div></div>
</div></section>
<section class="chapter f-mist"><div class="wrap" data-in><h2 style="margin-bottom:40px">Featured episodes</h2><div class="eps">{eps}</div></div></section>
<section class="story f-white"><div class="wrap split" data-in>
<div class="l">{vid("99cfy5roue", "v-reel", "Beki on why she started", "tall")}</div>
<div class="r prose"><h2>100 episodes in</h2><p>What Beki has learned helping OTs build online businesses, in one episode.</p>
<p>{ext("https://podcasts.apple.com/gb/podcast/100-100-episodes-what-ive-learned-helping-ots-build/id1713728830?i=1000723992558", "Listen to episode 100")}</p>
<figure style="margin-top:32px;max-width:340px">{img("pod-100", "Episode 100 artwork")}</figure></div></div></section>
<section class="close f-navy wrap"><h2>Enjoying the podcast? Let's talk.</h2>
<div class="foot"><p>If you want to create an online business and wish to discuss how we can support you, book in with our team.</p>
<div class="actions"><a class="btn" href="{ROB}" target="_blank" rel="noopener">Book a free call</a><a class="link" href="stories.html">See how other OTs have transformed their careers</a></div></div></section>"""
    page("podcast.html", "Podcast | OT Yourself to Freedom", "The OT Yourself to Freedom podcast with Beki Eakins.", body, "podcast.html")


POSTS = [
    ("blog-post.html", "Fear of Judgement on Social Media: A Guide for OTs", "22 Oct 2026", "Have you ever written a social media post, read it back, decided it sounded too bold, changed half of it, and then left it sitting in your drafts?"),
    ("ot-wage-time-and-location-freedom", "Building an Online Business for Occupational Therapists: Why Time and Location Freedom Come First", "15 Oct 2026", "Imagine getting a phone call tomorrow morning telling you that someone you love is seriously ill on the other side of the world."),
    ("how-to-build-a-niche-ot-private-practice-and-escape-system-burnout", "How to Build a Niche OT Private Practice (And Escape System Burnout)", "9 Oct 2026", "Many Occupational Therapists reach a point in their careers where the traditional healthcare model no longer feels sustainable."),
    ("online-occupational-therapy-coaching-business", "Beyond the Four Clinic Walls: How OTs Can Build a Profitable Online Coaching Business", "", ""),
    ("blog%2Fdeep-breath-moment-ot-business-breakthrough", "The Deep Breath Moment: What Happens Before an OT Business Breakthrough", "", ""),
    ("why-ots-build-successful-businesses", "Why the OTs Who Make It Big Refuse to Wait for the Perfect Time", "10 Sep 2026", "There is a point in almost every new business where the excitement of having an idea meets the reality of having to build it."),
    ("ot-business-scalability-freedom-model", "Beyond the Clinic: How Occupational Therapists Can Build a Scalable, Freedom-First Online Business", "2 Sep 2026", ""),
    ("occupational-therapist-business-5-steps-to-freedom-flow", "Occupational Therapist Business: 5 Steps to Freedom & Flow", "", ""),
    ("how-to-scale-ot-business", "How Occupational Therapists Can Work Less and Scale an Online Business", "12 Aug 2026", ""),
    ("business-boundaries-for-ots", "Business Boundaries for OTs: Why You Are Pulled in Every Direction", "", ""),
    ("working-less-as-an-ot", "The Grind Is a Lie: Why OTs Need to Redefine Full Time", "29 Jul 2026", "I work about 12 hours a week."),
    ("how-to-sell-occupational-therapy-services", "Sales for Occupational Therapists: Why OTs Fear Selling and How to Sell with Confidence", "22 Jul 2026", "For many Occupational Therapists, the word sales can feel uncomfortable."),
]


def blog():
    fields = ["f-navy", "f-forest", "f-moss", "f-navy2", "f-gold", "f-mist2"]
    rows = ""
    for i, (slug, t, d, ex) in enumerate(POSTS):
        href = slug if slug.endswith(".html") else f"{LIVE}/blog/{slug}"
        attrs = "" if slug.endswith(".html") else ' target="_blank" rel="noopener"'
        rows += (f'<a class="post-row" href="{href}"{attrs}><div class="thumb {fields[i % 6]}" aria-hidden="true"><b>{e(t.split(":")[0])}</b></div>'
                 f'<div class="t"><h3>{e(t)}</h3>{f"<p class=small>{d}</p>" if d else ""}{f"<p>{e(ex)}</p>" if ex else ""}</div></a>')
    body = f"""<section class="page-head f-white"><div class="wrap grid" data-in>
<h1>Notes from the road</h1><div class="side"><p>Beki's writing on building an online OT business: visibility, selling, boundaries and freedom.</p><figure>{img("laptop-window", "Beki writing at her laptop")}</figure></div></div></section>
<section class="chapter f-mist" style="padding-top:20px" aria-label="Posts"><div class="wrap posts" data-in>{rows}</div></section>"""
    page("blog.html", "Blog | Beki Eakins", "Beki's writing for OTs building an online business.", body)


def blog_post():
    lines = (HERE / "content/post-fear-of-judgement.txt").read_text().splitlines()[1:]  # line 1 repeats the title
    article = prose_from(lines).split("<h2>")
    for at, (pic, alt) in zip((2, 5, 9), (("forest-mug", "Beki with a mug in the forest"), ("headset-forest", "Beki on a call outdoors"), ("beach-sit", "Beki sitting on the beach"))):
        if at < len(article):
            article[at] = f"<figure>{img(pic, alt)}</figure>" + article[at]
    article = "<h2>".join(article)
    body = f"""<section class="page-head post f-white"><div class="wrap grid">
<h1>Fear of Judgement on Social Media: A Guide for OTs</h1></div></section>
<section class="chapter f-white" style="padding-top:0"><div class="wrap split" data-in>
<aside class="l side-col"><figure>{img("forest-laptop-red", "Beki writing in the forest")}</figure><p class="small">22 October 2026 · Beki Eakins</p><p><a class="link" href="blog.html">All posts</a></p></aside>
<article class="r prose">{article}</article></div></section>
<section class="close f-navy wrap"><h2>Ready to be seen?</h2>
<div class="foot"><p>Explore the resources and support available through OT Yourself to Freedom.</p>
<div class="actions"><a class="btn" href="start-free.html">Start free</a><a class="link" href="book-a-call.html">Book a call</a></div></div></section>"""
    page("blog-post.html", "Fear of Judgement on Social Media: A Guide for OTs | Beki Eakins", "How to stop fearing judgement on social media as an Occupational Therapist.", body)


def about():
    q = FAQS[1]["a"]
    body = f"""<section class="film-head" data-push>{img("window-hills", "Beki at home in North Wales", eager=True)}<div class="wrap" data-in>
<h1>About Beki</h1><p class="lede">Former Occupational Therapist, now Business and Lifestyle Coach, in the forests and mountains of North Wales.</p></div></section>
<section class="chapter f-white"><div class="wrap split" data-in>
<div class="l"><figure>{img("portrait-denim", "Portrait of Beki Eakins")}</figure></div>
<div class="r prose"><h2>Who is your coach?</h2>{paras(
    "I am Beki, former Occupational Therapist and now Business and Lifestyle Coach. I left the profession in 2019 to travel the world, build my business and to support a freedom-based life. I have home educated my two kids and live an outdoors lifestyle in the beautiful rural forests and mountains of North Wales, UK.",
    "I spent years trying to create a freedom style business before I hit on a model that worked. I tried network marketing and other businesses, but I was missing the deep fulfilment that I had grown used to having as an OT.",
    "But I figured it out! I started out coaching healthcare workers with stress and burnout, and had fast success: I doubled my OT income from the 2nd month, and hit 5k months in my 4th month of business.",
    "The business model allowed me to work just 12 hours per week. We spend our days going out in the forest, mountain biking or out on the canoe, whilst my income continued to rise to 20k per month and beyond.",
    "I realised that energy is everything and that running a business does not need to take up all your time.")}</div></div></section>
<section class="chapter f-mist"><div class="wrap" data-in><h2 style="margin-bottom:40px">Most days, outdoors</h2>
<div class="gallery">{img("beach-white", "Beki on the beach")}{img("suitcase", "Beki travelling")}{img("aurora", "Northern lights")}{img("forest-mug", "Beki with a mug in the forest")}{img("green-blazer", "Beki in a green blazer")}{img("fire-laptop", "Beki working by the fire")}</div></div></section>
<section class="chapter f-white"><div class="wrap split" data-in>
<div class="l"><h2>Qualifications</h2></div><div class="r prose">{paras(*q)}</div></div></section>
<section class="close f-navy wrap"><h2>Where are you on the climb?</h2>
<div class="foot"><p>Take the 2-minute quiz, or talk to the team.</p>
<div class="actions"><a class="btn" href="{QUIZ}" target="_blank" rel="noopener">Find your stage</a><a class="link" href="book-a-call.html">Book a call</a></div></div></section>"""
    page("about.html", "About Beki Eakins", "Former OT Beki Eakins, Business and Lifestyle Coach in North Wales.", body, "about.html")


def book_a_call():
    body = f"""<section class="film-head" data-push>{img("compass-macro", "", eager=True)}<div class="wrap" data-in>
<h1>Book a free call</h1><p class="lede">A free 45-minute Connection Call with Rob, to find the right next step for you.</p>
<div class="actions"><a class="btn" href="{ROB}" target="_blank" rel="noopener">Choose a time</a></div></div></section>
<section class="chapter f-white"><div class="wrap grow" data-in>
<div class="head"><h2>How the call works</h2><p class="statement">Routing you to the right room is part of the job, not a way of turning you away.</p></div>
<figure class="g1">{img("headset-forest", "Beki on a call outdoors")}</figure>
<figure class="g2">{img("laptop-window", "Beki at her laptop by the window")}</figure>
<figure class="g3">{img("compass-top", "")}</figure>
<div class="cap c1"><strong>You book</strong>A 45-minute slot that suits you, in your own time zone.</div>
<div class="cap c2"><strong>You talk</strong>Where you are now, and where you want to be.</div>
<div class="cap c3"><strong>You get a straight answer</strong>The right programme for you, or an honest no.</div></div></section>
<section class="close f-navy wrap"><h2>One call. A clear next step.</h2>
<div class="foot"><p>Questions first? Email <a class="link" href="mailto:{EMAIL}">{EMAIL}</a>.</p>
<div class="actions"><a class="btn" href="{ROB}" target="_blank" rel="noopener">Book a free call</a></div></div></section>"""
    page("book-a-call.html", "Book a call | Beki Eakins", "A free 45-minute Connection Call with Rob.", body)


def privacy():
    lines = (HERE / "content/privacy.txt").read_text().splitlines()
    body = f"""<section class="page-head f-white"><div class="wrap grid"><h1>Privacy policy</h1><div class="side"><p>Beki Eakins Ltd</p></div></div></section>
<section class="chapter f-white" style="padding-top:0"><div class="wrap split" data-in>
<aside class="l side-col"><figure>{img("beach-white", "Beki on the beach")}</figure><p>Questions about your data? Email <a class="link" href="mailto:bekieakins@gmail.com">bekieakins@gmail.com</a>.</p></aside>
<article class="r prose">{prose_from(lines)}</article></div></section>"""
    page("privacy.html", "Privacy policy | Beki Eakins", "How Beki Eakins Ltd handles your personal data.", body)


COURSES = ["SOPs for Onboarding and Working with VAs", "Kajabi Training", "TIME and how to bend it", "Membership Annual",
           "The Abundance Activator", "The Tripwire Ads Funnel", "How to Package Your OT Skills into a 2k+ Online Offer",
           "Magnetic Momentum: 21 Days to Unstoppable Confidence", "How To Get Clients!", "OT Yourself to Freedom Membership",
           "Membership", "OT Freedom Collective", "Magnetic Momentum: The Confidence Foundation for OTs"]
COMMUNITIES = ["Magnetic Confidence Community", "Magnetic Momentum Community", "Kajabi Community", "Collective Community", "Membership Community"]


def kit():
    fields = ["f-navy", "f-forest", "f-moss", "f-navy2", "f-gold", "f-mist2"]
    photos = {1: "forest-mug", 7: "beach-sit", 9: "forest-red", 11: "c-beki", 12: "beach-white"}
    thumbs = "".join(
        f'<div class="thumb {fields[i % 6]}{" has-img" if i in photos else ""}">{img(photos[i], "") if i in photos else ""}<b>{e(t)}</b><i>OT Yourself to Freedom</i></div>'
        for i, t in enumerate(COURSES))
    banners = "".join(f'<div class="banner {fields[i % 6]}">{img(["forest-overalls", "beach-walk", "laptop-window", "c-beki", "forest-denim"][i], "")}<b>{e(t)}</b></div>' for i, t in enumerate(COMMUNITIES))
    body = f"""<section class="page-head f-white"><div class="wrap grid" data-in>
<h1>The Kajabi kit</h1><div class="side"><p>How the rest of Beki's Kajabi would look in the new brand: the podcast, the 13 courses, the 5 communities, the emails and the login. A preview only; nothing in Kajabi has been changed.</p></div></div></section>

<section class="chapter f-mist"><div class="wrap" data-in><h2>Podcast cover art</h2>
<p class="statement" style="margin:20px 0 40px">The compass, set on Freedom: one cover for the show, one template for every episode.</p>
<div class="split"><div class="l"><div class="cover">{img("compass-top", "")}<span class="cb">Beki Eakins</span><span class="ct">OT Yourself to Freedom</span></div></div>
<div class="r" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
<div class="cover f-forest" style="background:var(--forest)">{img("ep133", "")}<span class="cb">Episode 133</span><span class="ct" style="font-size:clamp(24px,2.6vw,40px)">Closing his clinic</span></div>
<div class="cover story-size">{img("compass-story", "")}<span class="cb">New episode</span><span class="ct" style="font-size:clamp(28px,3vw,44px)">OT Yourself to Freedom</span></div>
</div></div>
<div class="mock" style="margin-top:40px"><div class="mail"><div class="mh">Show notes template</div><div class="mb">
<p><strong>In this episode</strong><br>Two or three lines in Beki's voice on what the listener will take away.</p>
<p><strong>Where to go next</strong></p>{ul(["Find your Freedom Stage: the 2-minute quiz", "Start free: Beki's free resources", "Book a free call with Rob"])}</div>
<div class="mf">The same three links, in the same place, on every episode.</div></div></div>
</div></section>

<section class="chapter f-white"><div class="wrap" data-in><h2>Course thumbnails</h2>
<p class="statement" style="margin:20px 0 40px">All 13 courses, one family. Names tidied from capitals only; Beki to confirm.</p>
<div class="kit-grid">{thumbs}</div></div></section>

<section class="chapter f-mist2"><div class="wrap" data-in><h2>Community banners</h2>
<div style="display:grid;gap:10px;margin-top:40px">{banners}</div></div></section>

<section class="chapter f-white"><div class="wrap split" data-in>
<div class="l"><h2>Email template</h2><p>Navy header, one column, one button. Greeting uses the first name merge field only.</p></div>
<div class="r mock"><div class="mail"><div class="mh">OT Yourself to Freedom</div><div class="mb">
<p>Hi {{{{contact.first_name}}}},</p><p><em>Sample layout only, not a real email.</em> A short opening in Beki's voice, then the one thing to do next.</p>
<p><a class="btn" href="#" aria-disabled="true">Listen to the new episode</a></p><p>Beki</p></div>
<div class="mf">Beki Eakins Ltd, United Kingdom. You are receiving this because you opted in. Unsubscribe.</div></div></div>
</div></section>

<section class="chapter f-navy"><div class="wrap split" data-in>
<div class="l"><h2>Login and library</h2><p>The member login and the library page, in the same navy and gold.</p></div>
<div class="r mock" style="background:var(--navy-2)"><div class="login"><h3>Log in to your library</h3>
<label>Email</label><div class="field"></div><label>Password</label><div class="field"></div>
<div class="actions"><span class="btn">Log in</span></div></div></div>
</div></section>"""
    page("kajabi-kit.html", "Kajabi kit (draft) | Beki Eakins", "How Beki's podcast, courses, communities, emails and login would look.", body)


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    shutil.copytree(HERE / "assets", OUT / "assets", ignore=shutil.ignore_patterns("sizes.json", "credits.json"))
    for build in (home, collective, membership, start_free, formula, faqs, stories, podcast, blog, blog_post, about, book_a_call, privacy, kit):
        build()
    # self-check: every page is noindex, has one h1, no em dash, and every local link and asset exists
    for f in sorted(OUT.glob("*.html")):
        s = f.read_text()
        assert 'content="noindex, nofollow"' in s, f
        assert s.count("<h1") == 1, (f, s.count("<h1"))
        assert "—" not in s and " – " not in s, f
        for ref in re.findall(r'(?:href|src)="([^"#:]+)"', s) + re.findall(r"url\(([^):]+)\)", s):
            assert (OUT / ref.split("?")[0]).exists(), (f.name, ref)
    print("built", len(list(OUT.glob("*.html"))), "pages into", OUT)
    genie()


# ---------------------------------------------------------------- Genie (dbf.bekieakins.com/draftwebsite)
# Genie serves one page, so all 14 live in it and the menu swaps between them (#/collective ...).
# Photos and films come from Genie's media library (scripts/upload-draft-media.py writes the map),
# styles are scoped to .bk so Genie's own styles and ours leave each other alone, and the code is
# cut into boxes no bigger than the ones Genie has already taken (the tripwire page, ~33k).
GENIE = HERE / "genie"
BOX_LIMIT = 45000
# Genie's API key may not upload media (27 Oct: "not authorized for this scope"), so unless
# genie/media-map.json exists the pictures and films load from Jan's preview of the draft.
PREVIEW = "https://genestjanramirez.com/BekiEakinsdraftwebsite/"
FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Karla:wght@400..700&family=Newsreader:opsz,wght@6..72,300..600&display=swap">')


def scope_css(css):
    """Prefix every rule with .bk; state classes the script puts on <html> (.js, .ready) stay in front."""
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    css = re.sub(r"@import[^;]+;", "", css)
    def sel(one):
        one = one.strip()
        if one in (":root", "body", "html"):
            return ".bk"
        m = re.match(r"((?:\.(?:js|ready)\s*)+)(.*)", one)
        if m:
            return m.group(1).strip() + " .bk " + m.group(2)
        return ".bk " + one
    out, i = [], 0
    while i < len(css):
        j = css.find("{", i)
        if j < 0:
            break
        head = css[i:j].strip()
        if head.startswith("@media"):
            depth, k = 1, j + 1
            while depth:
                depth += {"{": 1, "}": -1}.get(css[k], 0); k += 1
            out.append(head + "{" + scope_css(css[j + 1:k - 1]) + "}")
            i = k
            continue
        k = css.find("}", j)
        out.append(",".join(sel(x) for x in head.split(",")) + "{" + re.sub(r"\s+", " ", css[j + 1:k]).strip() + "}")
        i = k + 1
    return "".join(out)


ROUTER = """(function () {
  // one Genie page holds all 14: #/collective shows that page, a plain #anchor scrolls within the page
  var pages = document.querySelectorAll(".bk [data-page]");
  function show() {
    var m = location.hash.match(/^#\\/([\\w-]*)/), cur = document.querySelector(".bk [data-page]:not([hidden])");
    if (!m && location.hash && cur && cur.querySelector(location.hash)) return;
    var name = m && m[1] ? m[1] : "home", hit = null;
    pages.forEach(function (p) { if (p.getAttribute("data-page") === name) hit = p; });
    hit = hit || pages[0];
    pages.forEach(function (p) { p.hidden = p !== hit; });
    document.title = hit.getAttribute("data-title");
    document.querySelectorAll(".bk .bar nav a").forEach(function (a) {
      a.setAttribute("aria-current", a.getAttribute("href") === "#/" + hit.getAttribute("data-page") ? "page" : "false");
    });
    document.querySelectorAll(".bk details.menu").forEach(function (d) { d.open = false; });
    if (cur !== hit) scrollTo(0, 0);
  }
  addEventListener("hashchange", show);
  show();
})();
"""


def genie_html(body):
    body = re.sub(r'href="index\.html"', 'href="#/"', body)
    body = re.sub(r'href="([\w-]+)\.html"', r'href="#/\1"', body)
    return body


def genie():
    GENIE.mkdir(exist_ok=True)
    bar_html, foot_html = genie_html(bar(None)), genie_html(FOOT)
    parts = []
    for slug, title, body in PAGES:
        name = "home" if slug == "index.html" else slug[:-5]
        hidden = "" if name == "home" else " hidden"
        parts.append(f'<div data-page="{name}" data-title="{html.escape(title)}"{hidden}>{genie_html(body)}</div>')
    allhtml = bar_html + "".join(parts) + foot_html
    allhtml = re.sub(r'<source src="assets/media/[\w-]+\.webm" type="video/webm">', "", allhtml)
    need = sorted(set(re.findall(r'assets/((?:img|media)/[\w.-]+\.(?:jpg|mp4))', allhtml)))
    (GENIE / "media-needed.txt").write_text("\n".join(need) + "\n")
    mapping = GENIE / "media-map.json"
    urls = json.loads(mapping.read_text()) if mapping.exists() else {n: PREVIEW + "assets/" + n for n in need}
    print("genie: media from", "Genie's library" if mapping.exists() else PREVIEW)
    missing = [n for n in need if n not in urls]
    assert not missing, "not uploaded yet: %s" % missing
    allhtml = re.sub(r'assets/((?:img|media)/[\w.-]+\.(?:jpg|mp4))', lambda m: urls[m.group(1)], allhtml)
    assert not re.search(r'["(]assets/', allhtml), re.findall(r'.{40}["(]assets/.{40}', allhtml)[:3]
    css = scope_css((HERE / "assets/site.css").read_text())
    js = ROUTER + (HERE / "assets/site.js").read_text()
    # cut between pages so no box breaks one open
    chunks = [bar_html] + parts + [foot_html]
    chunks = [re.sub(r'assets/((?:img|media)/[\w.-]+\.(?:jpg|mp4))', lambda m: urls[m.group(1)], re.sub(r'<source src="assets/media/[\w-]+\.webm" type="video/webm">', "", c)) for c in chunks]
    boxes, cur = [chunks[0]], ""  # box 1: fonts, styles and the menu bar; pages from box 2
    for c in chunks[1:]:
        if cur and len(cur) + len(c) > BOX_LIMIT:
            boxes.append(cur); cur = ""
        cur += c
    boxes.append(cur)
    for old in GENIE.glob("box-*.html"):
        old.unlink()
    for i, b in enumerate(boxes, 1):
        head = f"<!-- Beki draft website, box {i} of {len(boxes)}. Paste into its own Custom JS/HTML element, in order. -->\n"
        if i == 1:
            head += FONTS + "<style>" + css + "</style>\n"
        tail = f"\n<script>{js}</script>" if i == len(boxes) else ""
        (GENIE / f"box-{i}.html").write_text(head + f'<div class="bk">{b}</div>' + tail)
    paste_sheet(len(boxes))
    print("genie: %d boxes: %s" % (len(boxes), ", ".join("%dk" % (len((GENIE / f"box-{i}.html").read_text()) // 1000) for i in range(1, len(boxes) + 1))))


HEAD_CODE = '<meta name="robots" content="noindex, nofollow">'


def paste_sheet(n):
    """One page for Jan: the steps, and each box behind a Copy button."""
    boxes = "".join(
        f'<li><p><b>Box {i} of {n}</b>. Add a <b>Custom JS/HTML</b> element under the last one, open its code editor, then click <button data-copy="b{i}">Copy box {i}</button> and paste with Ctrl V. Save.</p>'
        f'<textarea id="b{i}" readonly>{html.escape((GENIE / f"box-{i}.html").read_text())}</textarea></li>' for i in range(1, n + 1))
    (GENIE / "paste-steps.html").write_text(f"""<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Draft website in Genie: paste steps</title>
<style>body{{margin:0;background:#f3f6f3;color:#12222b;font:17px/1.55 system-ui,sans-serif}}main{{max-width:760px;margin:0 auto;padding:32px 20px 80px}}
h1{{font:400 34px/1.1 Georgia,serif;margin:0 0 8px}}h2{{font:400 24px/1.2 Georgia,serif;margin:36px 0 10px}}li{{margin-bottom:14px}}
textarea{{width:100%;height:70px;font:12px monospace;margin-top:6px}}button{{font:700 15px system-ui;background:#2c5f4a;color:#fff;border:0;padding:8px 14px;cursor:pointer}}
.note{{background:#f4efdb;padding:14px 16px}}code{{background:#e7ede7;padding:1px 5px}}</style></head><body><main>
<h1>Beki's draft website in Genie</h1><p>Goes to <b>dbf.bekieakins.com/draftwebsite</b>. One new funnel; nothing existing is touched. About 15 minutes.</p>
<p class="note">The photos and films load from your preview at genestjanramirez.com/BekiEakinsdraftwebsite, so keep that folder until the real site is built.</p>
<h2>1. Make the funnel</h2><ol>
<li>Genie, left menu: <b>Sites</b>, then <b>Funnels</b> along the top.</li>
<li><b>+ New Funnel</b>, start from blank, name it <code>Draft website</code>.</li>
<li><b>+ Add New Step</b>: name <code>Draft website</code>, path <code>draftwebsite</code>. If Genie adds digits to the path, tell me what it shows.</li>
<li>Funnel <b>Settings</b>: domain <code>dbf.bekieakins.com</code>. In <b>Head tracking code</b> paste this line, then Save: <button data-copy="head">Copy line</button><textarea id="head" readonly>{html.escape(HEAD_CODE)}</textarea></li></ol>
<h2>2. Paste the {n} boxes, in order</h2><p>Open the step, <b>Edit page</b> (blank). Add a <b>full-width Section</b>, a 1-column <b>Row</b>, and set the section, row and column padding to 0. Then:</p><ol>{boxes}</ol>
<h2>3. Save and publish</h2><ol><li>Builder <b>Save</b>, then <b>Publish</b>.</li><li>Tell me, and I check every page at dbf.bekieakins.com/draftwebsite from outside.</li></ol>
</main><script>document.querySelectorAll("[data-copy]").forEach(function(b){{b.onclick=function(){{var t=document.getElementById(b.dataset.copy);t.select();navigator.clipboard.writeText(t.value).then(function(){{b.textContent="Copied";}});}};}});</script>
</body></html>""")


if __name__ == "__main__":
    main()
