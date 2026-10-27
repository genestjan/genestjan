#!/usr/bin/env python3
"""Builds the draft of Beki's new website into site/out/: the Tripwire brand (the live
dbf.bekieakins.com pages' own colours, type, cards and buttons) with a cinematic layer.

Plain static HTML, relative links, noindex on every page, no tracking, no live forms:
every button goes to the real page it would go to on the live site. Beki's own words
come from the first build (build_v1.py) and the live Tripwire pages, as she wrote them.
"""
import html
import os
import re
import shutil
from pathlib import Path

from PIL import Image

from build_v1 import (ACCELERATOR, APPLE, COMMUNITIES, COURSES, EMAIL, FORMULA_LIVE, INSTAGRAM, LIVE,
                      MAGNETIC, MAGNETIC_BONUS, MEMBERSHIP_OFFER, MINI, POSTS, QUIZ, ROB, e, faq_answer, paras, prose_from)
from content import EPISODES, FAQS, HOME, OFFERS, RESULTS, STAGES, STORY_VIDEOS, TW_QUOTES, plain, rich
from content import paras as text_paras

HERE = Path(__file__).resolve().parent
OUT = Path(os.environ.get("BEKI_OUT", HERE / "out"))  # the deploy builds straight into the site
GUIDE = "https://dbf.bekieakins.com/ot-guide"
SEQ_FRAMES = 120


def img(name, alt="", cls="", eager=False, attrs=""):
    p = HERE / name if "/" in name else next(HERE.glob(f"assets/img/{name}.*"))  # the dashboard gives full paths
    w, h = Image.open(p).size
    c = f' class="{cls}"' if cls else ""
    load = 'fetchpriority="high"' if eager else 'loading="lazy"'
    return f'<img src="assets/img/{p.name}" width="{w}" height="{h}" alt="{html.escape(alt)}"{c} {load} decoding="async"{attrs}>'


def film(name, poster, tall=None):
    """A silent looping film. tall=(name, poster) adds a portrait cut that phones show instead."""
    def v(n, p, c=""):
        return (f'<video{c} data-loop autoplay muted loop playsinline preload="metadata" poster="assets/media/{p}" aria-hidden="true">'
                f'<source src="assets/media/{n}.webm" type="video/webm"><source src="assets/media/{n}.mp4" type="video/mp4"></video>')
    return v(name, poster, ' class="wide"') + v(*tall, ' class="tall"') if tall else v(name, poster)


def badge(href, words, key, label):
    """The slowly turning ring of words (it speeds up while the page scrolls)."""
    return (f'<a class="badge" href="{href}"{ext(href)} aria-label="{label}"><svg viewBox="0 0 120 120" aria-hidden="true">'
            f'<defs><path id="ring-{key}" d="M60,60 m-45,0 a45,45 0 1,1 90,0 a45,45 0 1,1 -90,0"/></defs>'
            f'<g class="spin"><text><textPath href="#ring-{key}" textLength="279" lengthAdjust="spacing">{words}</textPath></text></g>'
            f'<path class="arrow" d="M60 47 V73 M50 63 L60 73 L70 63"/></svg></a>')


def out_link(href, label, cls="link"):
    return f'<a class="{cls}" href="{href}" target="_blank" rel="noopener">{label}</a>'


def gets(items):
    return '<ul class="gets">' + "".join(f"<li>{i}</li>" for i in items) + "</ul>"


def vcard(wistia, pic, name, length, shape="tall"):
    return (f'<button class="vcard" type="button" data-wistia="{wistia}" data-shape="{shape}" aria-label="Play {html.escape(name)}\'s video">'
            f'{img(pic)}<span class="vplay"><span class="vplay-tri"></span><span class="vname"><strong>{html.escape(name)}</strong><span>{length}</span></span></span></button>')


NAV = [("collective.html", "The Collective"), ("membership.html", "Membership"), (MAGNETIC, "Magnetic Momentum"),
       ("podcast.html", "Podcast"), ("stories.html", "Stories"), ("about.html", "About")]


def chrome_top(current):
    def a(href, label, extra=""):
        outside = ' target="_blank" rel="noopener"' if href.startswith("http") else ""
        cur = ' aria-current="page"' if href == current else ""
        return f'<a href="{href}"{outside}{cur}{extra}>{label}</a>'
    links = "".join(f"<li>{a(h, l)}</li>" for h, l in NAV)
    big = "".join(a(h, l, ' class="big"') for h, l in [("index.html", "Home")] + NAV + [("start-free.html", "Start free")])
    draft = '<p class="draft">Draft for Beki\'s review. Not the live site.</p>'
    return f"""<a class="skip" href="#main">Skip to content</a>
<div class="curtain" aria-hidden="true"><div class="curtain-in"><svg viewBox="0 0 100 100" width="76" height="76"><circle cx="50" cy="50" r="44" fill="none" stroke="#c9a54a" stroke-width="5"/><circle cx="50" cy="50" r="36" fill="#123344"/><g class="cn"><path d="M50 18 L56 50 L44 50 Z" fill="#d8b445"/><path d="M50 82 L56 50 L44 50 Z" fill="#f4efdb"/></g><circle cx="50" cy="50" r="4" fill="#c9a54a"/></svg><span>Beki Eakins</span></div></div>
<header class="nav">{draft}<div class="shell">
  <a class="word" href="index.html">Beki Eakins</a>
  <nav aria-label="Main"><ul>{links}</ul></nav>
  <a class="cta" href="book-a-call.html">Book a free call</a>
  <button class="menu-btn" type="button" data-menu aria-expanded="false" aria-controls="menu">Menu</button>
</div></header>
<div class="menu" id="menu" role="dialog" aria-label="Menu">
  {draft}<div class="shell menu-top"><a class="word" href="index.html">Beki Eakins</a><button class="menu-close" type="button" data-menu>Close</button></div>
  <nav class="shell menu-links" aria-label="Menu links">{big}</nav><div class="menu-bg" aria-hidden="true"></div>
  <div class="shell small-links"><a href="blog.html">Blog</a><a href="faqs.html">FAQs</a><a href="{QUIZ}" target="_blank" rel="noopener">Find your stage</a></div>
  <div class="shell"><a class="cta" href="book-a-call.html">Book a free call</a></div>
</div>"""


FOOT = f"""<footer class="foot"><div class="shell">
  <p class="big" aria-hidden="true">OT yourself to <em>freedom</em></p>
  <div class="foot-grid">
    <div><h4>Work with Beki</h4><ul><li><a href="collective.html">The OT Freedom Collective</a></li><li><a href="membership.html">The Membership</a></li><li><a href="{MAGNETIC}" target="_blank" rel="noopener">Magnetic Momentum</a></li><li><a href="{MINI}" target="_blank" rel="noopener">Package Your OT Skills</a></li></ul></div>
    <div><h4>Start free</h4><ul><li><a href="{GUIDE}" target="_blank" rel="noopener">The free guide</a></li><li><a href="formula.html">The Formula replay</a></li><li><a href="podcast.html">The podcast</a></li><li><a href="{QUIZ}" target="_blank" rel="noopener">Find your stage</a></li><li><a href="blog.html">Blog</a></li></ul></div>
    <div><h4>Beki</h4><ul><li><a href="about.html">About Beki</a></li><li><a href="stories.html">Stories</a></li><li><a href="faqs.html">FAQs</a></li><li><a href="book-a-call.html">Book a free call</a></li><li><a href="kajabi-kit.html">Kajabi kit (draft)</a></li></ul></div>
    <div><h4>Say hello</h4><ul><li><a href="mailto:{EMAIL}">{EMAIL}</a></li><li><a href="{INSTAGRAM}" target="_blank" rel="noopener">Instagram</a></li><li><a href="{APPLE}" target="_blank" rel="noopener">Apple Podcasts</a></li><li>Ruthin, North Wales</li></ul></div>
  </div>
  <div class="legal">
    <p>The information on this website is for general informational and educational purposes only. Please seek your own legal and financial advice within your own country before making any decisions, and check you remain compliant with the occupational therapy regulations where you live.</p>
    <p>Hill footage: "Moel y Gaer, Llanfair DC Rhagfyr 2022" by Drones Over Wales, CC BY 3.0, via Wikimedia Commons. The compass, the desk, the map and the dawn path were made for this draft (the last three with AI) and are not real photos of Beki's home.</p>
    <p>&copy; 2026 Beki Eakins Ltd. All prices include UK VAT unless stated. <a href="privacy.html">Privacy policy</a></p>
  </div>
</div></footer>
<div class="sticky" aria-hidden="false"><div><b>Free 45-minute call</b><span>with Rob, no pressure</span></div><a class="cta" href="book-a-call.html">Book a call</a></div>
<div class="lightbox" role="dialog" aria-label="Video"><button class="close" type="button">Close</button><div class="box"></div></div>"""

PAGES = []


def page(slug, title, desc, body, current=None):
    PAGES.append((slug, title, body))
    (OUT / slug).write_text(f"""<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
<meta name="theme-color" content="#0C222E">
<meta name="color-scheme" content="light only">
<script>try{{if(!sessionStorage.getItem("bk-c")){{document.documentElement.classList.add("curtain-on");sessionStorage.setItem("bk-c","1")}}}}catch(e){{}}</script>
<link rel="preload" href="assets/fonts/newsreader-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="assets/beki.css">
</head>
<body>
{chrome_top(current)}
<main id="main">
{body}
</main>
{FOOT}
<script src="assets/vendor/gsap.min.js" defer></script>
<script src="assets/vendor/ScrollTrigger.min.js" defer></script>
<script src="assets/vendor/SplitText.min.js" defer></script>
<script src="assets/vendor/lenis.min.js" defer></script>
<script src="assets/beki.js" defer></script>{'<script type="module" src="assets/compass3d.js"></script>' if "data-compass3d" in body else ""}
</body>
</html>
""")


def topo(seed=1):
    """Contour lines of one hill, drawn by the script as the section scrolls in."""
    import math
    paths = []
    for k in range(9):
        r, pts = 70 + k * 46, []
        for i in range(73):
            a = i / 72 * 2 * math.pi
            w = 1 + .16 * math.sin(3 * a + seed + k * .35) + .09 * math.sin(5 * a + seed * 2) + .05 * math.sin(9 * a + k)
            pts.append(f"{780 + math.cos(a) * r * w * 1.25:.1f},{300 + math.sin(a) * r * w * .8:.1f}")
        paths.append(f'<path d="M{" L".join(pts)}Z"/>')
    return f'<svg class="topo" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">{"".join(paths)}</svg>'


def dark(inner, cls="s-dark", seed=1):
    return f'<section class="{cls}"><div class="glow" aria-hidden="true"></div>{topo(seed)}<canvas class="motes" aria-hidden="true"></canvas><div class="grain" aria-hidden="true"></div>{inner}</section>'


def final(h2="One call. <em>Your time back.</em>",
          lede="A free 45-minute Connection Call with Rob. Routing you to the right room is part of the job, not a way of turning you away.",
          ctas=None):
    ctas = ctas or f'<a class="cta" href="{ROB}" target="_blank" rel="noopener">Book a free call</a><a class="cta cta--ghost" href="{GUIDE}" target="_blank" rel="noopener">Get the free guide</a>'
    return f"""<section class="final">
  <div class="bg">{film("dawn-loop", "dawn-poster.jpg", ("dawn-tall", "dawn-tall-poster.jpg"))}</div><div class="grain" aria-hidden="true"></div>
  <div class="shell">
    <p class="eyebrow" data-rv>One step</p>
    <h2 data-split>{h2}</h2>
    <p class="lede" data-rv>{lede}</p>
    <div class="cta-row" data-rv>{ctas}</div>
  </div>
</section>"""


def page_hero(eyebrow, h1, lede, ctas="", media="", side="", short=False):
    m = f'<div class="media">{media}</div>' if media else ""
    inner = f'<div><p class="eyebrow" data-rv>{eyebrow}</p><h1>{h1}</h1><p class="lede" data-rv>{lede}</p>{f"<div class=cta-row data-rv>{ctas}</div>" if ctas else ""}</div>'
    grid = f'<div class="ph-grid">{inner}<div data-rv>{side}</div></div>' if side else inner
    return f'<section class="page-hero{" short" if short else ""}">{m}<div class="grain" aria-hidden="true"></div><div class="shell">{grid}</div></section>'


def faq_block(items, title="Honest answers", eyebrow="Before you decide", cls="s-tint"):
    qa = "".join(f'<details><summary>{e(q)}</summary><div class="a">{a}</div></details>' for q, a in items)
    return f'<section class="{cls}"><div class="shell"><div class="head"><p class="eyebrow" data-rv>{eyebrow}</p><h2 data-split>{title}</h2></div><div class="faq" data-rv>{qa}</div></div></section>'


def ext(href):
    return ' target="_blank" rel="noopener"' if href.startswith("http") else ""


# ---------------------------------------------------------------- home
# the shared lists (videos, quotes, offers, stages, results, episodes, FAQs) live in content/*.yml


def btn(link, label, cls="cta"):
    return f'<a class="{cls}" href="{html.escape(link)}"{ext(link)}>{plain(label)}</a>'


def sec_hero(x):
    cta = "".join(btn(b["link"], b["label"], "cta cta--ghost" if b.get("style") == "outline" else "cta") for b in x.get("buttons") or [])
    who = f'<span class="strip-item who">{img(x["photo"], x["name"])}<span><b>{plain(x["name"])}</b>{plain(x["name_line"])}</span></span>' if x.get("photo") else ""
    chips = "".join(f'<figure class="chip c{i}"><blockquote>&ldquo;{plain(c["quote"])}&rdquo;</blockquote><figcaption>{img(c["photo"], "")}{plain(c["name"])}</figcaption></figure>'
                    for i, c in enumerate((x.get("quote_cards") or [])[:2], 1))
    small = f'<p class="chip c3"><span class="stars" aria-hidden="true">★★★★★</span> {plain(x["small_card"])}</p>' if x.get("small_card") else ""
    w = plain(x.get("ring_words"))
    ring = badge("#stages", f"{w} &#183; {w} &#183; ", "hero", w.capitalize()) if w else ""
    h1 = rich(x["heading"]).replace("way out", "way&nbsp;out")
    return f"""<section class="hero">
<div class="hero-film">{film("hill-loop", "hill-poster.jpg")}</div>{topo(4)}<canvas class="motes" aria-hidden="true"></canvas><div class="grain" aria-hidden="true"></div>
<div class="shell hero-grid">
  <div class="hero-copy">
    <p class="eyebrow" data-rv>{plain(x["eyebrow"])}</p>
    <h1>{h1}</h1>
    <p class="lede" data-rv>{rich(x["text"])}</p>
    <div class="cta-row" data-rv>{cta}</div>
    <div class="strip" data-rv>{who}<span class="strip-item"><span class="stars" aria-hidden="true">★★★★★</span>{plain(x["proof"])}</span></div>
  </div>
  <div class="hero-object" data-compass3d>
    {img("compass-top", "", "fallback", eager=True)}
    {chips}{small}{ring}
  </div>
</div>
<span class="scroll-cue" aria-hidden="true"></span>
</section>"""


def sec_results(x):
    m = "".join(f"<span>{plain(r)}</span>" for r in RESULTS)
    hidden = m.replace("<span>", '<span aria-hidden="true">')
    return f'<div class="marquee" aria-label="Client results"><div class="marquee-track">{m}{hidden}</div></div>'


def sec_numbers(x):
    items = "".join(f'<div data-rv><b><span data-count="{int(n["number"])}">{int(n["number"]):,}</span>{plain(n.get("after"))}</b><span>{plain(n["text"])}</span></div>'
                    for n in x["numbers"])
    return f'<section class="stats"><div class="stats-map" aria-hidden="true">{img("map-route", "")}</div><div class="shell stats-grid">{items}</div></section>'


def sec_window(x):
    lines = [l for l in (x.get("line_1"), x.get("line_2"), x.get("line_3")) if l]
    spans = "".join(f"<span>{rich(l)}</span>" for l in lines)
    return f"""<section class="window" aria-label="{plain(' '.join(lines))}">
  <div class="window-pin">
    <div class="window-frame">{img(x["picture"], "")}<div class="window-shade"></div></div>
    <div class="shell window-copy">
      <p class="eyebrow n">{plain(x["eyebrow"])}</p>
      <h2 class="stagger">{spans}</h2>
    </div>
  </div>
</section>"""


def member(t):
    face = img(t["photo"], t["name"]) if t.get("photo") else f'<span class="ph" aria-hidden="true">{plain(t["name"])[:1]}</span>'
    return f'<div class="member">{face}<div><b>{plain(t["name"])}</b><span>{plain(t["role"])}</span></div></div>'


def sec_story(x):
    team = f'<div class="team" data-rv>{"".join(member(t) for t in x["team"])}</div>' if x.get("team") else ""
    link = f'<a class="link" href="{html.escape(x["link"])}"{ext(x["link"])} data-rv>{plain(x["link_label"])}</a>' if x.get("link") else ""
    flip = " flip" if x.get("picture_side") == "left" else ""
    return f"""<section class="s-paper"><div class="shell split2{flip}">
  <div class="read">
    <p class="eyebrow n" data-rv>{plain(x["eyebrow"])}</p>
    <h2 data-split>{rich(x["heading"])}</h2>
    <div class="prose" style="margin-top:24px" data-rv>{text_paras(x["text"])}</div>
    {team}{link}
  </div>
  <div class="photo tall" data-reveal>{img(x["picture"], x.get("picture_text", ""), attrs=' data-parallax style="object-position:' + plain(x.get("picture_focus") or "50% 50%") + '"')}</div>
</div></section>"""


def sec_statement(x):
    return f'<section class="s-tint statement"><div class="shell"><p class="statement-text" data-words>{rich(x["text"])}</p></div></section>'


def sec_moving_words(x):
    r1 = "".join(f"<span>{rich(w)}</span><i></i>" for w in x["row_1"])
    r2 = f"<span>{rich(x['row_2'])}</span><i></i>" * 4
    return f'<section class="bigtype" aria-hidden="true"><div class="bt-tilt"><div class="bt-row">{r1}</div><div class="bt-row outline">{r2}</div></div></section>'


def sec_stages(x):
    cards = ""
    for k, n, f, who, intro, strong, hold, nxt, (u1, l1), (u2, l2) in STAGES:
        cards += f"""<article class="stage-card" id="stage-{k}"><p class="who">{plain(who)}</p><h3>{plain(n.replace("The ", ""))}</h3>
<p class="intro">{rich(intro)}</p><p class="next"><b>Your next step:</b> {rich(nxt)}</p>
<div class="cta-row">{btn(u1, l1, "cta cta--sm")}{btn(u2, l2.replace("Or ", "or "), "link")}</div></article>"""
    cards += f"""<article class="stage-card" id="stage-freedom"><p class="who">{plain(x["last_card_label"])}</p><h3>{plain(x["last_card_heading"])}</h3>
<p>{rich(x["last_card_text"])}</p>
<div class="cta-row">{btn(x["last_card_button_link"], x["last_card_button"], "cta cta--sm")}{btn(x["last_card_link_to"], x["last_card_link"], "link")}</div></article>"""
    rail = "".join("<li><i></i></li>" for _ in range(5))
    return f"""<section class="compass" id="stages" data-frames="{SEQ_FRAMES}" data-d="assets/seq/d/" data-m="assets/seq/m/" aria-label="{plain(x["eyebrow"])}">
  <div class="compass-pin">
    <canvas aria-hidden="true"></canvas>
    <div class="compass-ui"><div class="shell"><div class="compass-copy">
      <p class="eyebrow n">{plain(x["eyebrow"])}</p>
      <h2>{rich(x["heading"])}</h2>
      <div class="rail-names" aria-hidden="true"><span>Planner</span><span>Solo</span><span>Clinic</span><span>Scale</span><span>Freedom</span></div>
      <ul class="rail" aria-hidden="true">{rail}</ul>
      <div class="stage-cards">{cards}</div>
    </div></div></div>
  </div>
</section>"""


def sec_offers(x):
    offers = ""
    for pic, contain, name, price, note, items, (u, l), more in OFFERS:
        m = btn(more[0], more[1], "link more") if more else ""
        ring = badge(u, "FREE GUIDE &#183; FREE GUIDE &#183; ", "guide", "Get the free guide") if str(price).strip().lower() == "free" else ""
        offers += f"""<article class="offer"><div class="pic{' contain' if contain else ''}" data-reveal>{img(pic)}</div><div class="body">{ring}
<h3>{plain(name)}</h3><div class="price-row"><span class="price-now">{plain(price)}</span><span class="price-note">{plain(note)}</span></div>{gets(items)}
<div class="act">{btn(u, l)}{m}</div></div></article>"""
    return f"""<section class="s-tint work" id="programmes"><div class="shell"><div class="work-track">
  <div class="reel-intro">
    <p class="eyebrow n">{plain(x["eyebrow"])}</p>
    <h2>{rich(x["heading"])}</h2>
    <p class="lede">{rich(x["text"])}</p>
    <p class="reel-hint">Swipe for more</p>
  </div>
  <div class="reel">{offers}</div>
</div></div></section>"""


def sec_testimonials(x):
    vids = "".join(vcard(*v) for v in STORY_VIDEOS)
    quotes = "".join(f'<figure class="quote" data-rv><blockquote>&ldquo;{plain(q)}&rdquo;</blockquote><figcaption>{img(p)}<div>{plain(n)}<span>OT, in her own words</span></div></figcaption></figure>'
                     for p, n, q in TW_QUOTES)
    link = f'<p style="margin-top:34px" data-rv>{btn(x["link"], x["link_label"], "link")}</p>' if x.get("link") else ""
    inner = (f'<div class="shell"><div class="head"><p class="eyebrow n" data-rv>{plain(x["eyebrow"])}</p><h2 data-split>{rich(x["heading"])}</h2>'
             f'<p class="lede" data-rv>{rich(x["text"])}</p></div><div class="vreel" data-rv>{vids}</div><div class="quotes">{quotes}</div>{link}</div>')
    return dark(inner)


def sec_podcast(x):
    eps = "".join(f'<li><a href="{html.escape(u)}" target="_blank" rel="noopener"><span class="n">{plain(n)}</span><span class="t">{plain(t)}<span>{plain(rest)}</span></span><span class="go">Listen</span></a></li>'
                  for _, n, t, rest, u in EPISODES)
    inner = (f'<div class="shell pod"><a class="cover" href="podcast.html" data-rv>{img(x["cover"], "")}<span class="cover-t"><small>The podcast</small>OT Yourself to Freedom</span></a>'
             f'<div><div class="head"><p class="eyebrow n" data-rv>{plain(x["eyebrow"])}</p><h2 data-split>{rich(x["heading"])}</h2></div><ul class="eps" data-rv>{eps}</ul>'
             f'<div class="cta-row" style="margin-top:28px" data-rv>{btn(x["button_link"], x["button_label"], "cta cta--ghost cta--sm")}<a class="link" href="podcast.html">All episodes</a></div></div></div>')
    return dark(inner, "s-dark s-deep")


def sec_questions(x):
    faqs = "".join(f"<details><summary>{e(f['q']).rstrip(':')}</summary><div class=\"a\">{''.join(faq_answer(f))}</div></details>" for f in FAQS if f.get("on_home"))
    return f"""<section class="s-tint"><div class="shell">
  <div class="head"><p class="eyebrow n" data-rv>{plain(x["eyebrow"])}</p><h2 data-split>{rich(x["heading"])}</h2></div>
  <div class="faq" data-rv>{faqs}</div>
  <p style="margin-top:28px" data-rv><a class="link" href="faqs.html">All the questions</a></p>
</div></section>"""


def sec_final(x):
    return final(rich(x["heading"]), rich(x["text"]))


SECTIONS = {k[4:]: v for k, v in dict(globals()).items() if k.startswith("sec_")}


def home():
    """The home page is the dashboard's list of sections, in the order it gives."""
    body = "\n\n".join(SECTIONS[x["type"]](x) for x in HOME["sections"])
    page("index.html", plain(HOME["title"]), plain(HOME["description"]), body)


# ---------------------------------------------------------------- inner pages
def collective():
    team = [
        ("c-beki", "Beki", "Strategy, leadership, and decision-making", ["This is where your business is seen clearly. Not through theory, but through experience.", "You are given direct, honest guidance on what is actually slowing you down, where you are overcomplicating things, and what needs to change if you want this to work."]),
        ("t-meg", "Meg", "Human Design and energetic alignment", ["There is a point where pushing harder stops working. Meg's work is not about making things softer. It is about precision.", "Understanding how you are designed to make decisions, manage your energy, and build your work in a way that does not create unnecessary resistance."]),
        ("t-katja", "Katja", "Vocal Alchemy and embodied visibility", ["Most people are not invisible because they lack ideas. They are invisible because they are holding themselves back.", "Katja works at the level most people avoid completely. Your voice, your presence, your ability to be felt when you speak."]),
        (None, "Rob", "Sales, discipline, and high performance", ["At some point, this comes down to standards. Rob brings the level of discipline and execution that separates people who “want it” from people who actually build it.", "He will show you exactly where you are hesitating, where you are avoiding responsibility, and where you are lowering your own expectations. And then he will raise them."]),
    ]
    people = "".join(
        f'<article class="person" data-rv><div class="pic">{img(p, "Portrait of " + n) if p else f"<div class=ph aria-hidden=true>{n[0]}</div>"}</div>'
        f'<div class="body"><h3>{n}</h3><p class="role">{e(r)}</p>{paras(*t)}</div></article>' for p, n, r, t in team)
    steps = [
        ("Design your high ticket offer", "We will take your skills and passions and teach you how to package them up into a high ticket offer. This is a personalised and bespoke service and what you produce will be unique to you! If you are brand new, we can take you from not even having an idea, to launching and scaling."),
        ("Master your marketing", "We will teach you a number of strategies where you can get quick wins in finding clients online. Sales is a big process, and we will teach you the language, and skills required to smash this!"),
        ("Repeat, automate, delegate", "Once you have mastered each stage, we can look at ways to improve the ease of what you do. With automations, delegations and systems that you can use to save your precious time."),
    ]
    modules = "".join(f'<div class="module"><span class="num">0{i}</span><div><h3>{t}</h3><p>{e(d)}</p></div></div>' for i, (t, d) in enumerate(steps, 1))
    cases = "".join(img(f"c-case{i}", f"Client result {i}") for i in range(1, 7))
    faq = [
        ("It's not cheap, and this is a big investment for me. Will it work for me?", paras(
            "Most of our clients and the majority of people feel this way before investing. It’s scary the first time you choose to invest in your own growth and development. I know, because I remember feeling exactly the same! I have had literally shivers when pressing the button on some of my biggest investments.",
            "Which do you think holds more risk? Trying something new or keep doing what you are doing and trying to figure it out alone? I have seen people waste years, and even a decade in trying to get it going alone. And yet the fastest time one of my clients has hit a 15k month was 5 months of working with me.",
            "If you are still struggling with the investment, do speak to us. This is the middle level in terms of working with us, so there are other options.")),
        ("Can I think about it?", paras(
            "Of course, you can think about it. Breathe into it, listen to your intuition and inner guidance.",
            "Yes, tune into the way your body makes decisions. (Meg will be teaching more about this on the programme.) But this doesn’t need to take a long time.",
            "Ultimately the real question is who are you going to be and how are you going to make decisions moving forward?")),
        ("It might not work for where I live", paras(
            "Most clients think that people in their area will not buy high ticket offers. But over and over again we see this theory is proven to be wrong.",
            "The beauty of online work, is that we have a really broad pool of people to pull from. Many of you may choose to have an international business, that's the choice I made. What appears as a small niche, is suddenly massive when you opt to focus on the whole world.")),
    ]
    side = f'''<div class="pricebox"><div class="price-row"><span class="price-now">£6,000 to £11,000</span></div><p class="price-note" style="margin:10px 0 0">Payment plans available. By application, after a call.</p>
{gets(["<b>Direct access</b> to me and my team of experts", "<b>Clear direction</b> on what to focus on each week", "<b>Support when you hit resistance</b>, so you don't fall back into old patterns", "<b>A structure</b> that makes your business actually grow"])}
<a class="cta" style="width:100%" href="{ROB}" target="_blank" rel="noopener">Book a call with our team</a></div>'''
    body = f"""{page_hero("The OT Freedom Collective", "For the OT operating <em>below her own ceiling</em>",
        "More income. Fewer hours. No second-guessing. Run properly, like the expert you already are.", media=film("valley-loop", "valley-poster.jpg"), side=side)}

<section class="s-paper"><div class="shell split2">
  <div><p class="eyebrow" data-rv>Read this carefully</p><h2 data-split>The model is the problem. So we change the model.</h2></div>
  <div class="prose read" data-rv>{paras(
    "Here is the part most people will not say out loud.",
    "You left employment to get your freedom back. What you actually built was a job with better branding. The referrals come in, so you say yes to work you would never have chosen. You write reports in the evenings to justify work you have already done. You are busy, you are good at this, and you are still not in control of a single hour.",
    "And it is not happening because you do not know what to do. You know plenty. It is happening because you are still inside a model that was never going to give your time back.",
    "Inside the Collective you stop being paid for your hours and start being paid for the value you deliver. You stop taking whatever lands in your inbox and start building an offer people actively choose.")}
    <p class="pull">That is not freedom. That is the same trap, rebuilt by your own hands.</p>
    <p>If you are at rock bottom right now with nothing spare, <a class="link" href="membership.html">the Membership</a> is the honest place to begin, and I will tell you so on the call.</p>
  </div>
</div></section>

{dark(f'''<div class="shell cols2">
  <div><p class="eyebrow" data-rv>So what actually changes?</p><h2 data-split>You didn't escape the system. <em>You rebuilt it.</em></h2>
  <div class="prose" style="margin-top:24px" data-rv><p>Inside the OT Freedom Collective, we don't just “build you a business”. We rebuild how you operate entirely.</p></div></div>
  <div data-rv>{gets(["You stop taking whatever referrals come your way, and start creating an offer people actively choose",
     "You stop being paid for your time, and start being paid for the value you deliver",
     "You stop filling your diary with the wrong work, and start building something that actually fits your life",
     "And most importantly, <b>you stop second-guessing everything</b>"])}
  <div style="margin-top:30px">{vcard("369ko60244", "v-sales", "Beki on the Collective", "Watch", "wide").replace('class="vcard"', 'class="vcard wide"')}</div></div>
</div>''')}

{dark(f'''<div class="shell"><div class="head"><p class="eyebrow" data-rv>Not navigating this alone</p><h2 data-split>Your team</h2>
<p class="lede" data-rv>Beki is a former OT and Meg, who offers human design is a current OT. This programme is written by OTs for OTs.</p></div>
<div class="people">{people}</div></div>''', "s-dark s-deep")}

<section class="s-tint"><div class="shell cols2">
  <div><p class="eyebrow" data-rv>Three stages</p><h2 data-split>How we build it, <em>together</em></h2>
  <p class="lede" data-rv>Some of my OTs want to run hard and fast at this, and we can match this pace. Others prefer to take their time. That is also ok. We work at your pace.</p></div>
  <div class="modules" data-rv>{modules}</div>
</div></section>

<section class="s-paper"><div class="shell cols2">
  <div><p class="eyebrow" data-rv>Here's what you will get</p><h2 data-split>Personal, not a course</h2>
  <p class="lede" data-rv>This isn't a group programme, a course, or some low level offer. I will not encourage you to make ads, build websites or hire staff, until you are making more than enough to cover this.</p></div>
  <div data-rv>{gets(["A personalised plan for 10-12 hours work weekly, that can grow into a full time if you want (25 hours per week max business)",
     "Help with designing your high ticket offer", "Launching strategies that feel aligned to you",
     "Personalised 1:1 calls with Beki, and her team of experts",
     "Community support with many other OTs from around the world, all sharing ideas and thoughts",
     "A business you love that keeps your bank account full and your calendar empty",
     "<b>Free access to Magnetic Momentum</b>, included inside the Collective"])}</div>
</div></section>

<section class="s-tint"><div class="shell"><div class="head"><p class="eyebrow" data-rv>Case studies</p><h2 data-split>What clients have built</h2>
<p class="lede" data-rv>Coaching, mentoring, education or supervision style businesses. We have paediatric OTs galore, mental health OTs, but we also help OTs who feel they are jack of all trades and master of none.</p></div>
<div class="gallery" data-rv>{cases}</div></div></section>

{faq_block(faq, "Common questions")}
{final("Speak with <em>our team</em>", "Prices range from £6,000 to £11,000, with payment plans available. If you are on a smaller budget, the Membership is the place to start.",
   f'<a class="cta" href="{ROB}" target="_blank" rel="noopener">Book a call with our team</a><a class="cta cta--ghost" href="membership.html">See the Membership</a>')}"""
    page("collective.html", "The OT Freedom Collective | Beki Eakins", "1:1 with Beki and her team, for established OTs ready to scale.", body, "collective.html")


def membership():
    side = f'''<div class="pricebox"><div class="price-row"><span class="price-now">£197</span><span class="price-note">a month + VAT for UK residents</span></div>
{gets(["<b>Try free for 3 days.</b> Cancel any time before your trial ends", "<b>Group calls every month</b> with Beki and with Katja", "<b>A personal call with Beki</b> at month 3", "<b>Magnetic Momentum included</b> (normally £40)", "<b>No contract.</b> Leave any time"])}
<a class="cta" style="width:100%" href="{MEMBERSHIP_OFFER}" target="_blank" rel="noopener">Start your 3-day free trial</a><p class="cta-sub">+ VAT for UK residents, added at checkout</p></div>'''
    comps = [("m-understanding", "Understanding You", "Discover your purpose and zones of genius, then tie in with your life story to create a high ticket offer that is totally aligned to you."),
             ("m-strategy", "Business Strategy", "You will learn how to master online sales and marketing using social media. We teach you how to launch, without needing to pay for ads or a website."),
             ("m-mindset", "Mindset & Energetics", "You will learn the basics on how to master your mind. Energetics is around 80% of your business success, so growth in this area is essential.")]
    cards = "".join(f'<article class="card" data-rv><div class="pic">{img(p)}</div><div class="body"><h3>{e(t)}</h3><p>{e(d)}</p></div></article>' for p, t, d in comps)
    faq = [("How much support will I get on the membership?", paras("This is a self-paced membership. You can work through this in your own time, and ask questions in the community and attend group calls.", "You will get a 1:1 call with Beki after 3 months, this is the optimum time to really create your business, when you have worked through all of the first three modules.")),
           ("How long is the membership?", paras("You can stay as long as you require, the payments are ongoing. It is anticipated that you will want to stay for at least 12 months, whilst working through the material.")),
           ("What tools or extra purchases am I expected to make?", paras("I will tell you to avoid spending money on anything that you absolutely don't have to.", "A good computer or laptop will be useful, and a smartphone with a good camera is very useful for social media.", "Good internet will always help. But I built my business from a campervan and forest house with terrible internet and still managed.")),
           ("What kind of businesses have previous clients made?", paras("There are so many options of a business that people can design. You can use some traditional OT skills, or coaching, mentoring, supervision, consulting and of course education.") + '<p><a class="link" href="stories.html">Read their stories</a></p>')]
    results = ["J.V designed a high ticket offer of 6 hours trauma work for 1800 and sold it with ease!", "Nicola made 6k in 6 months!",
               "Clare filled her diary with 8 sales calls in just one week and was able to launch her group programme!",
               "Suzanne created and sold her first high ticket offer in just 4 weeks of working with us.", "Timothy started the year with a bang and signed up 10 clients!",
               "Julie designed, launched and sold her high ticket offer for 1500 in just 9 weeks!",
               "Michelle signed her first client within 3 weeks and then secured enough further clients to leave her day job!",
               "Bethany designed, launched and sold her high ticket offer in 11 weeks for over 2k!",
               "Kaili had a 5k month her first month of working with us and sold her first high ticket offer within 9 weeks"]
    body = f"""{page_hero("The OT Yourself to Freedom Membership", "Design, launch and grow <em>your online business</em>",
        "If you have an idea for an online business, or you don't have an idea, you are very welcome here. This is the very place where OTs from across the world come together.", media=img("laptop-window", "", eager=True), side=side)}

<section class="s-paper"><div class="shell split2">
  <div class="read"><p class="eyebrow" data-rv>What it is</p><h2 data-split>An educational programme, <em>built by an OT</em></h2>
  <div class="prose" style="margin-top:22px" data-rv>{paras("The OT Yourself to Freedom Membership is an educational programme, designed to help you design, launch and grow your online business. You get full access to the recorded programme, and you will have support via a community app.",
    "You can attend multiple group calls per month. Some are with Beki, across different timezones. Other calls are with Katja, our Voice Alchemist who runs sessions on building confidence.")}</div></div>
  <div data-rv>{vcard("vhtvj6gfxf", "v-m1", "Beki on the Membership", "Watch", "wide").replace('class="vcard"', 'class="vcard wide"')}</div>
</div></section>

<section class="s-tint"><div class="shell"><div class="head"><p class="eyebrow" data-rv>Inside</p><h2 data-split>The three parts of the Membership</h2></div><div class="cols3">{cards}</div></div></section>

<section class="s-paper"><div class="shell cols2">
  <div data-rv><h2 style="margin-bottom:22px">This is for you if you want</h2>{gets(["a freedom based, online business", "to learn how to work less and earn more", "to learn how to get clients online", "to learn how to make 5-15k per month", "to understand sales and marketing strategies", "to meet with a like minded community of OT entrepreneurs"])}</div>
  <div data-rv><h2 style="margin-bottom:22px">It is not for you if you are</h2><ul class="xlist">{"".join(f"<li>{e(x)}</li>" for x in ["Hoping for a quick fix and not willing to put in the work", "Looking to create a busy practice or bricks and mortar style business", "Not willing to use social media to grow a business", "Looking for a side hustle or small hobby", "Have less than 5 hours per week to put in (10+ is preferable)"])}</ul></div>
</div></section>

{dark(f'''<div class="shell cols2">
  <div><p class="eyebrow" data-rv>The Membership includes</p><h2 data-split>Everything to get you <em>to your first sales</em></h2>
  <div style="margin-top:30px" data-rv>{vcard("pth5k25isy", "v-walkthrough", "A walkthrough of the Membership", "Watch the walkthrough", "wide").replace('class="vcard"', 'class="vcard wide"')}</div></div>
  <div data-rv>{gets(["Access to Magnetic Momentum, The Confidence Foundation for OTs (normally £40)", "Monthly group calls with Beki for business advice and Katja for growing in self-belief and confidence", "How to define your offer", "Energetic work to overcome blocks and limiting beliefs", "A vibrant community with OTs from across the world", "A personal call with Beki at month 3 to help you hone down your ideas", "Fun challenges designed to help you grow", "Modules on sales training", "Full access to the recorded programme with video, text and downloadable content"])}
  <div class="cta-row" style="margin-top:28px"><a class="cta" href="{MEMBERSHIP_OFFER}" target="_blank" rel="noopener">Start your 3-day free trial</a></div><p class="cta-sub">£197 a month + VAT for UK residents, added at checkout</p></div>
</div>''')}

<section class="s-paper"><div class="shell split2 flip">
  <div class="read"><p class="eyebrow" data-rv>Why it's different</p><h2 data-split>The only one built by an OT, <em>for OTs</em></h2>
  <div class="prose" style="margin-top:22px" data-rv>{paras("This membership is the only one in the world, specifically designed by a (former) OT to help OTs use skills they already have to create an online business in this way.",
    "The focus is to create a high ticket offer. This means selling a programme that might sell for thousands instead of hundreds.",
    "The membership is unique because it also includes the energetics work to get you better results.")}</div>
  <p class="pull" data-rv>This is not a prison. We have made it very easy for you to leave at any time if you don't feel it's a good fit for you.</p></div>
  <div data-rv>{vcard("sq8epyc8yn", "v-m2", "Beki on what makes it different", "Watch", "wide").replace('class="vcard"', 'class="vcard wide"')}
  <figure class="quote" style="margin-top:18px;background:var(--paper-2);border-color:var(--rule)"><blockquote style="color:var(--ink)">&ldquo;I started the membership and it gave me the reassurance I needed to know I do know what I need to do, not to doubt myself, rid the imposter syndrome and that is worth every penny of the investment I made.&rdquo;</blockquote><figcaption style="color:var(--ink)">OT, UK<span>Membership member</span></figcaption></figure></div>
</div></section>

{dark(f'''<div class="shell split2">
  <div>{vcard("wjoe0v9gmf", "v-alexm", "Alex", "Her story")}</div>
  <div class="read"><p class="eyebrow" data-rv>Alex's story</p><h2 data-split>Alex left her job within 9 months</h2>
  <div class="prose" style="margin-top:22px" data-rv>{paras("Alex does Mom coaching for those mums running on autopilot and hitting burnout.",
    "After a group call on the energetics of content, Alex put out a piece of content that went viral. She had over 6000 new followers in one week, and made multiple sales from this one content piece!",
    "Alex now has a business where she is magnetising clients to her, making regular sales and not working crazy hours to do it.")}</div></div>
</div>''', "s-dark s-deep")}

<section class="s-tint"><div class="shell"><div class="head"><p class="eyebrow" data-rv>Client results</p><h2 data-split>What members have done</h2><p class="lede" data-rv>Of course success depends on how much energy and commitment each client applies.</p></div>
<div class="results-list" data-rv>{gets([e(r) for r in results])}</div></div></section>

{faq_block(faq, "You asked", "Questions", "s-paper")}
{final("Start with <em>three free days</em>", "£197 a month + VAT for UK residents. Magnetic Momentum is included automatically when you join. No contract.",
   f'<a class="cta" href="{MEMBERSHIP_OFFER}" target="_blank" rel="noopener">Start your 3-day free trial</a><a class="cta cta--ghost" href="book-a-call.html">Or book a free call</a>')}"""
    page("membership.html", "The Membership | Beki Eakins", "£197 a month, 3-day free trial. Design, launch and grow an online OT business.", body, "membership.html")


def start_free():
    items = [
        ("guide-cover", GUIDE, "The free guide", "How to turn the skills you already have into a 1k to 4k online offer, without quitting your job. Downloaded by over 1,000 OTs.", "Send me the free guide"),
        ("compass-top", QUIZ, "Find your Freedom Stage", "8 honest questions, 2 minutes. Find out where you are and the one next step that fits.", "Take the quiz"),
        ("r-formula", "formula.html", "The OT Freedom Formula replay", "A session created to help OTs build more freedom, income and balance, without burnout.", "Watch the replay"),
        ("r-lifestyle", "https://podcasts.apple.com/au/podcast/133-starting-your-online-ot-business-feat-beki-eakins/id1530131740?i=1000757842134", "Beki on The OT Lifestyle Movement", "Real numbers, smart strategy and powerful mindset shifts, in Beki's guest episode.", "Listen"),
        ("r-ideal2", LIVE + "/pl/2147653061", "4 Steps to Attracting in your Ideal Client", "A 30 minute training on how to attract in your ideal client online. Free course and downloadable workbook.", "Start the free course"),
        ("r-podcast", "podcast.html", "The podcast", "Weekly episodes on the hot topics, and a free overnight meditation.", "Listen"),
        ("r-accelerator", ACCELERATOR, "The OT Business Accelerator", "For OT entrepreneurs who know they are capable of more and are ready to move now.", "Watch the training"),
    ]
    cards = "".join(f'<a class="card" href="{u}"{ext(u)} data-rv><div class="pic">{img(p)}</div><div class="body"><h3>{t}</h3><p>{e(d)}</p><span class="link">{l}</span></div></a>' for p, u, t, d, l in items)
    body = f"""{page_hero("Start free", "Your first step <em>costs nothing</em>", "Here you can find all of my free resources to help you on your journey to freedom.",
        f'<a class="cta" href="{GUIDE}" target="_blank" rel="noopener">Get the free guide</a><a class="cta cta--ghost" href="{QUIZ}" target="_blank" rel="noopener">Find your stage</a>', media=img("forest-mug", "", eager=True))}
<section class="s-tint"><div class="shell"><div class="cols3">{cards}</div></div></section>
{final("Enjoyed these? <em>Let's talk.</em>", "If you would like to take the next step, contact our team to discuss working together.")}"""
    page("start-free.html", "Start free | Beki Eakins", "Beki's free resources for OTs.", body, "start-free.html")


def formula():
    body = f"""{page_hero("The OT Freedom Formula", "Package your OT skills into <em>a high-ticket offer</em>", "A session created to help OTs build more freedom, income and balance, without burnout. If you missed it, or fancy watching it again, you can catch the full replay.",
        f'<a class="cta" href="{FORMULA_LIVE}" target="_blank" rel="noopener">Take me to the recording</a>', media=img("fire-laptop", "", eager=True))}
<section class="s-paper"><div class="shell cols2">
  <div><p class="eyebrow" data-rv>What will be covered</p><h2 data-split>Discover how OTs are creating <em>more freedom and income</em> online</h2>
  <p class="lede" style="margin-top:20px" data-rv>This session is a must-watch if you're ready to rethink how you work as an OT.</p></div>
  <div data-rv>{gets(["The common mistakes OTs make when starting an online business (and what to do instead)", "Why high-ticket offers are the most powerful way to start and scale", "The exact first step to building a business that aligns with your true strengths", "How to activate your purpose, energy and natural magnetism using The OT Freedom Method", "How to create a high-value marketing message that draws in your ideal clients"])}
  <div class="cta-row" style="margin-top:28px"><a class="cta" href="{FORMULA_LIVE}" target="_blank" rel="noopener">Yes please, take me to the recording</a></div><p class="cta-sub">You will be subscribed to our newsletter. Opt out at any time.</p></div>
</div></section>
{final()}"""
    page("formula.html", "The OT Freedom Formula replay | Beki Eakins", "Watch the OT Freedom Formula replay.", body, "start-free.html")


def faqs():
    qa = [(f["q"].rstrip(":"), "".join(faq_answer(f))) for f in FAQS]
    body = f"""{page_hero("FAQs", "Questions, <em>answered</em>", f'Anything not here? Email <a class="link" href="mailto:{EMAIL}">{EMAIL}</a> or book a free call.', short=True)}
{faq_block(qa, "Everything OTs ask Beki", "All questions", "s-paper")}
{final()}"""
    page("faqs.html", "FAQs | Beki Eakins", "Answers to the questions OTs ask Beki most.", body)


def stories():
    rows = [
        ("pzgkvdd11p", "v-sarita", "Sarita", ["Sarita made $21,550 AUD within her first launch, 4 months into the programme. That’s more than 10x the initial investment.", "Sarita has now filled two cohorts of her online programme, working with people across 7 countries and doing work she genuinely enjoys."]),
        ("n30iawlk75", "v-ivan", "Ivan", ["Ivan sold his first high ticket offer within 3 weeks, and made 5 times the cost of his investment back during his time with us.", "He managed all of this whilst running a successful OT business!"]),
        ("nte9bcs9w7", "v-bethany", "Bethany", ["Bethany came to us with a business already created. We helped her to make it more profitable, and streamlined and have a higher ticket offer.", "Bethany doubled her OT income within 6 months of starting with us."]),
        ("o59oakb9hb", "v-alex", "Alex", ["Alex very quickly replaced her OT wage and left her job to concentrate on her business full time within 9 months."]),
        ("1wcjivul8o", "v-ellie", "Ellie", ["Ellie made $15k in a 2 week period, has just had a $5000 week and has now been able to drop her contract work.", "She did all of this with a toddler and moved house as well!"]),
        ("ne49sr02m9", "v-shaenelle", "Shaenelle", ["Shaenelle signed up 5 clients within 3 weeks, all on big packages meaning she did not have to return to her OT job after the summer break."]),
        ("kpq4kexqrh", "v-lisa", "Lisa", ["Lisa just signed her first 1:1 client!! AND created a webinar, AND got people signed up to it...all in one week!!"]),
        ("22o1n02y68", "v-clare", "Clare", ["Clinical Hypnotherapist and Mindfulness Coach.", "Clare was earning a maximum of £400 per month in her business before we worked together. At this stage Clare has passed £2000 per month and she is headed towards her next goal of £4000 monthly."]),
        ("7584ergsj7", "v-orla", "Orla", ["There is not a one size fits all approach in business. Orla has created a beautiful business, has 3 regular clients and funnels that are set up and ready for her to expand on this start."]),
    ]
    rowhtml = "".join(f'<div class="story-row" data-rv>{vcard(w, t, n, "Her story")}<div class="read"><h3>{n}</h3><div class="prose">{paras(*ps)}</div></div></div>' for w, t, n, ps in rows)
    more = [("Tamara", "I have to say that since I met Beki, my life has been changing for the better. I can feel the energy of the business changing."),
            ("Annette", "I find working with Beki very valuable. I have grown and become more confident and I am becoming comfortable with being visible! I would highly recommend Beki!"),
            ("Louisa", "The course is inspiring. It provides a safe container to access support to take action, get inspiration & overcome blocks. I love the group coaching calls!"),
            ("Karen", "Beki has created the most amazing community of like-minded women who are also on a mission to help others and make a difference in the world."),
            ("Kelly", "After a period of being stuck and not knowing what direction I wanted to go in, she helped me open up with what was really holding me back. This jumpstarted my business idea exponentially!"),
            ("Jeanette", "This course has been brilliant, absolutely brilliant. I am so pleased I signed up. Not only strategy but mindset as well."),
            ("Sarika", "Beki is an amazing coach! She is truly inspiring and left me feeling motivated, focused and ready to achieve my goals."),
            ("Nicola", "What made me choose Beki was how wonderfully human and actually imperfect she was."),
            ("Bez", "I feel excited to be working with you now as you have done it already. This is definitely working!")]
    q2 = "".join(f'<figure class="quote" data-rv><blockquote>&ldquo;{e(q)}&rdquo;</blockquote><figcaption><div>{n}</div></figcaption></figure>' for n, q in more)
    tw = "".join(f'<figure class="quote" data-rv><blockquote>&ldquo;{e(q)}&rdquo;</blockquote><figcaption>{img(p)}<div>{n}<span>OT, in her own words</span></div></figcaption></figure>' for p, n, q in TW_QUOTES)
    body = f"""{page_hero("Stories", "OTs who <em>built the way out</em>", "What do others say about Beki's courses? In their own words, and their own videos. Unedited.",
        '<a class="cta" href="#videos">Watch their stories</a>', media=img("beach-walk", "", eager=True))}
{dark(f'<div class="shell" id="videos"><div class="head"><p class="eyebrow" data-rv>In their own words</p><h2 data-split>Tap any one to play</h2></div><div class="vgrid" data-rv>{"".join(vcard(*v) for v in STORY_VIDEOS)}</div><div class="quotes">{tw}</div></div>')}
<section class="s-paper"><div class="shell">{rowhtml}</div></section>
<section class="s-tint"><div class="shell"><div class="head"><p class="eyebrow" data-rv>More kind words</p><h2 data-split>From clients, <em>unprompted</em></h2></div><div class="qgrid">{q2}</div></div></section>
{final("Your story <em>could be next</em>", "Let's talk about how we can help take your business to the next level.")}"""
    page("stories.html", "Stories | Beki Eakins", "OTs who built online businesses with Beki, in their own words.", body, "stories.html")


def podcast():
    eps = "".join(f'<a class="ep" href="{u}" target="_blank" rel="noopener" data-rv><div class="art">{img(i, "Episode " + n + " artwork")}</div><span class="n">Episode {n}</span><h3>{e(t)}</h3></a>' for i, n, t, _, u in EPISODES)
    cover = f'<div class="kcover">{img("compass-top", "")}<span class="t"><small>The podcast</small>OT Yourself to Freedom</span></div>'
    body = f"""{page_hero("The podcast", "OT Yourself <em>to Freedom</em>", "OTs who built the way out, in their own words. Weekly episodes on the hot topics, from niche and pricing to burnout and confidence.",
        f'<a class="cta" href="{APPLE}" target="_blank" rel="noopener">Listen on Apple Podcasts</a><a class="cta cta--ghost" href="{LIVE}/podcasts/ot-yourself-to-freedom" target="_blank" rel="noopener">All episodes</a>', side=cover)}
{dark(f'<div class="shell"><div class="head"><p class="eyebrow" data-rv>Featured</p><h2 data-split>Start with these</h2></div><div class="epgrid">{eps}</div></div>', "s-dark s-deep")}
<section class="s-paper"><div class="shell split2">
  <div>{vcard("99cfy5roue", "v-reel", "Beki", "Watch")}</div>
  <div class="read"><p class="eyebrow" data-rv>100 episodes in</p><h2 data-split>What Beki has learned <em>helping OTs</em></h2>
  <div class="cta-row" style="margin-top:26px" data-rv><a class="cta" href="https://podcasts.apple.com/gb/podcast/100-100-episodes-what-ive-learned-helping-ots-build/id1713728830?i=1000723992558" target="_blank" rel="noopener">Listen to episode 100</a></div></div>
</div></section>
{final("Enjoying the podcast? <em>Let's talk.</em>", "If you want to create an online business and wish to discuss how we can support you, book in with our team.")}"""
    page("podcast.html", "Podcast | OT Yourself to Freedom", "The OT Yourself to Freedom podcast with Beki Eakins.", body, "podcast.html")


def blog():
    cards = ""
    for slug, t, d, ex in POSTS:
        href = slug if slug.endswith(".html") else f"{LIVE}/blog/{slug}"
        head, _, tail = t.partition(":")
        tile = f"{e(head)}" + (f": <em>{e(tail.strip())}</em>" if tail else "")
        cards += f'<a class="post" href="{href}"{ext(href)} data-rv><div class="tile"><b>{tile}</b></div><div class="body">{f"<p class=date>{d}</p>" if d else ""}<h3>{e(t)}</h3>{f"<p>{e(ex)}</p>" if ex else ""}</div></a>'
    body = f"""{page_hero("Notes from the road", "Beki's <em>writing</em>", "On building an online OT business: visibility, selling, boundaries and freedom.", short=True)}
<section class="s-tint"><div class="shell"><div class="posts">{cards}</div></div></section>
{final()}"""
    page("blog.html", "Blog | Beki Eakins", "Beki's writing for OTs building an online business.", body)


def blog_post():
    lines = (HERE / "content/post-fear-of-judgement.txt").read_text().splitlines()[1:]
    article = prose_from(lines).split("<h2>")
    for at, (pic, alt) in zip((2, 5, 9), (("forest-mug", "Beki with a mug in the forest"), ("headset-forest", "Beki on a call outdoors"), ("beach-sit", "Beki sitting on the beach"))):
        if at < len(article):
            article[at] = f"<figure>{img(pic, alt)}</figure>" + article[at]
    body = f"""{page_hero("Blog", "Fear of judgement on social media: <em>a guide for OTs</em>", f'<span class="byline">{img("portrait-denim", "")}Beki Eakins · 22 October 2026</span>', short=True)}
<section class="s-paper"><div class="shell"><article class="article" data-rv>{"<h2>".join(article)}</article>
<p class="article" style="margin-top:40px"><a class="link" href="blog.html">All posts</a></p></div></section>
{final("Ready to <em>be seen?</em>", "Explore the resources and support available through OT Yourself to Freedom.", f'<a class="cta" href="start-free.html">Start free</a><a class="cta cta--ghost" href="book-a-call.html">Book a free call</a>')}"""
    page("blog-post.html", "Fear of Judgement on Social Media: A Guide for OTs | Beki Eakins", "How to stop fearing judgement on social media as an Occupational Therapist.", body)


def about():
    q = FAQS[1]["a"]
    gallery = "".join(img(n, a) for n, a in [("beach-white", "Beki on the beach"), ("suitcase", "Beki travelling"), ("aurora", "Northern lights"), ("forest-red", "Beki in the forest"), ("fire-laptop", "Beki working by the fire"), ("beach-sit", "Beki on the beach")])
    body = f"""{page_hero("About Beki", "Former OT. <em>Now free.</em>", "Business and Lifestyle Coach, in the rural forests and mountains of North Wales.",
        '<a class="cta" href="book-a-call.html">Book a free call</a>', media=img("window-hills", "", eager=True), side=f'<div class="hero-art" style="justify-self:end"><div class="frame">{img("portrait-denim", "Beki Eakins")}</div></div>')}
<section class="s-paper"><div class="shell split2">
  <div class="read"><p class="eyebrow" data-rv>Who is your coach?</p><h2 data-split>I spent years trying, <em>then I figured it out</em></h2>
  <div class="prose" style="margin-top:22px" data-rv>{paras(
    "I am Beki, former Occupational Therapist and now Business and Lifestyle Coach. I left the profession in 2019 to travel the world, build my business and to support a freedom-based life. I have home educated my two kids and live an outdoors lifestyle in the beautiful rural forests and mountains of North Wales, UK.",
    "I spent years trying to create a freedom style business before I hit on a model that worked. I tried network marketing and other businesses, but I was missing the deep fulfilment that I had grown used to having as an OT.",
    "But I figured it out! I started out coaching healthcare workers with stress and burnout, and had fast success: I doubled my OT income from the 2nd month, and hit 5k months in my 4th month of business.")}</div>
  <p class="pull" data-rv>I realised that energy is everything and that running a business does not need to take up all your time.</p></div>
  <div class="photo tall" data-reveal>{img("forest-overalls", "Beki in the forest", attrs=" data-parallax")}</div>
</div></section>
{dark(f'<div class="shell"><div class="head"><p class="eyebrow" data-rv>Most days, outdoors</p><h2 data-split>The business model allowed me to work <em>just 12 hours per week</em></h2></div><div class="gallery photos" data-rv>{gallery}</div></div>')}
<section class="s-tint"><div class="shell cols2"><div><p class="eyebrow" data-rv>Qualifications</p><h2 data-split>Trained, and <em>still training</em></h2></div><div class="prose" data-rv>{paras(*q)}</div></div></section>
{final("Where are you <em>on the climb?</em>", "Take the 2-minute quiz, or talk to the team.", f'<a class="cta" href="{QUIZ}" target="_blank" rel="noopener">Find your stage</a><a class="cta cta--ghost" href="book-a-call.html">Book a free call</a>')}"""
    page("about.html", "About Beki Eakins", "Former OT Beki Eakins, Business and Lifestyle Coach in North Wales.", body, "about.html")


def book_a_call():
    steps = [("You book", "A 45-minute slot that suits you, in your own time zone."), ("You talk", "Where you are now, and where you want to be."), ("You get a straight answer", "The right programme for you, or an honest no.")]
    modules = "".join(f'<div class="module"><span class="num">0{i}</span><div><h3>{t}</h3><p>{d}</p></div></div>' for i, (t, d) in enumerate(steps, 1))
    body = f"""{page_hero("Free Connection Call", "One call. <em>A clear next step.</em>", "A free 45-minute call with Rob. Routing you to the right room is part of the job, not a way of turning you away.",
        f'<a class="cta" href="{ROB}" target="_blank" rel="noopener">Choose a time</a>', media=img("compass-macro", "", eager=True))}
<section class="s-paper"><div class="shell cols2">
  <div><p class="eyebrow" data-rv>How the call works</p><h2 data-split>Three steps, <em>no pressure</em></h2><p class="lede" style="margin-top:18px" data-rv>Questions first? Email <a class="link" href="mailto:{EMAIL}">{EMAIL}</a>.</p></div>
  <div class="modules" data-rv>{modules}</div>
</div></section>
{final("Ready when <em>you are</em>", "Pick a time in Rob's calendar. It takes a minute.", f'<a class="cta" href="{ROB}" target="_blank" rel="noopener">Book a free call</a>')}"""
    page("book-a-call.html", "Book a call | Beki Eakins", "A free 45-minute Connection Call with Rob.", body)


def privacy():
    lines = (HERE / "content/privacy.txt").read_text().splitlines()
    body = f"""{page_hero("Beki Eakins Ltd", "Privacy <em>policy</em>", 'Questions about your data? Email <a class="link" href="mailto:bekieakins@gmail.com">bekieakins@gmail.com</a>.', short=True)}
<section class="s-paper"><div class="shell"><article class="article">{prose_from(lines)}</article></div></section>"""
    page("privacy.html", "Privacy policy | Beki Eakins", "How Beki Eakins Ltd handles your personal data.", body)


def kit():
    covers = f'''<div class="kit-covers">
<div class="kcover">{img("compass-top", "")}<span class="t"><small>The podcast</small>OT Yourself to Freedom</span></div>
<div class="kcover">{img("ep133", "")}<span class="t" style="font-size:clamp(1.1rem,2vw,1.7rem)"><small>Episode 133</small>From blood pressure meds to closing his clinic</span></div>
<div class="kcover story">{img("compass-story", "")}<span class="t" style="font-size:clamp(1rem,1.6vw,1.4rem)"><small>New episode</small>OT Yourself to Freedom</span></div></div>'''
    thumbs = "".join(f'<div class="thumb{" alt" if i % 3 == 1 else ""}" data-rv><i>OT Yourself to Freedom</i><b>{e(t)}</b></div>' for i, t in enumerate(COURSES))
    banners = "".join(f'<div class="banner" data-rv>{img(p)}<b><small>Community</small>{e(t)}</b></div>' for t, p in zip(COMMUNITIES, ["beach-white", "beki-alt", "laptop-window", "c-beki", "forest-denim"]))
    body = f"""{page_hero("Draft for Beki", "The <em>Kajabi kit</em>", "How the rest of Beki's Kajabi would look in the Tripwire brand: the podcast, the 13 courses, the 5 communities, the emails and the login. A preview only. Nothing in Kajabi has been changed.", short=True)}
{dark(f'<div class="shell"><div class="head"><p class="eyebrow" data-rv>Podcast cover art</p><h2 data-split>The compass, set on Freedom</h2><p class="lede" data-rv>One cover for the show, one template for every episode, and a story size for Instagram.</p></div>{covers}</div>', "s-dark s-deep")}
<section class="s-tint"><div class="shell"><div class="head"><p class="eyebrow" data-rv>Course thumbnails</p><h2 data-split>All 13 courses, <em>one family</em></h2><p class="lede" data-rv>Names tidied from capitals only; Beki to confirm.</p></div><div class="thumbs">{thumbs}</div></div></section>
<section class="s-paper"><div class="shell"><div class="head"><p class="eyebrow" data-rv>Community banners</p><h2 data-split>The five communities</h2></div>{banners}</div></section>
<section class="s-tint"><div class="shell cols2">
  <div><p class="eyebrow" data-rv>Email template</p><h2 data-split>Navy header, <em>one column, one button</em></h2><p class="lede" style="margin-top:16px" data-rv>Greeting uses the first name merge field only.</p></div>
  <div class="mock" data-rv><div class="mail"><div class="mh"><small>OT Yourself to Freedom</small>A new episode is out</div><div class="mb">
  <p>Hi {{{{contact.first_name}}}},</p><p><em>Sample layout only, not a real email.</em> A short opening in Beki's voice, then the one thing to do next.</p>
  <p><span class="cta cta--sm">Listen to the new episode</span></p><p>Beki</p></div><div class="mf">Beki Eakins Ltd, United Kingdom. You are receiving this because you opted in. Unsubscribe.</div></div></div>
</div></section>
{dark(f'''<div class="shell cols2"><div><p class="eyebrow" data-rv>Login and library</p><h2 data-split>The member login, <em>in navy and mint</em></h2></div>
<div class="login" data-rv><h3>Log in to your library</h3><label>Email</label><div class="field"></div><label>Password</label><div class="field"></div><span class="cta">Log in</span></div></div>''')}"""
    page("kajabi-kit.html", "Kajabi kit (draft) | Beki Eakins", "How Beki's podcast, courses, communities, emails and login would look.", body)


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    shutil.copytree(HERE / "assets", OUT / "assets", ignore=shutil.ignore_patterns("sizes.json", "credits.json", "site.css", "site.js"))
    if (HERE / "admin").exists():
        shutil.copytree(HERE / "admin", OUT / "admin")  # the editing dashboard
    for build in (home, collective, membership, start_free, formula, faqs, stories, podcast, blog, blog_post, about, book_a_call, privacy, kit):
        build()
    for f in sorted(OUT.glob("*.html")):
        s = f.read_text()
        assert 'content="noindex, nofollow"' in s, f
        assert s.count("<h1") == 1, (f, s.count("<h1"))
        assert "—" not in s and " – " not in s, f
        for ref in re.findall(r'(?:href|src|poster)="([^"#:]+)"', s):
            assert (OUT / ref.split("?")[0]).exists(), (f.name, ref)
    print("built", len(PAGES), "page(s) into", OUT)


if __name__ == "__main__":
    main()
