"""The words, pictures and links the dashboard (Sveltia CMS, /admin) edits, read from content/*.yml.

Editors write plain text: *star* makes the mint highlight (or italic in body text) and **two stars** make bold.
Everything else is escaped, so nothing typed in the dashboard can break the page.
"""
import html
import re
from pathlib import Path

import yaml

C = Path(__file__).resolve().parent / "content"


def load(name):
    return yaml.safe_load((C / name).read_text()) or {}


def clean(s):
    """House style the build enforces: no em dashes, and no stray spaces."""
    s = str(s or "").strip()
    return re.sub(r"\s*[—–]\s*", ", ", s) if ("—" in s or " – " in s) else s


def rich(s):
    """Escaped text with **bold** and *highlight*."""
    s = html.escape(clean(s), quote=False)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    return re.sub(r"\*(.+?)\*", r"<em>\1</em>", s)


def plain(s):
    return html.escape(clean(s).replace("*", ""), quote=False).replace('"', "&quot;")


def paras(text):
    """A text box with blank lines between paragraphs becomes <p>s."""
    return "".join(f"<p>{rich(p)}</p>" for p in re.split(r"\n\s*\n", clean(text)) if p.strip())


HOME = load("home.yml")
STAGES = [(s["key"], s["name"], s["colour"], s["who"], s["intro"], s["strong"], s["hold"], s["next_step"],
           (s["button_link"], s["button_label"]), (s["link"], s["link_label"])) for s in load("stages.yml")["stages"]]
RESULTS = load("results.yml")["results"]
EPISODES = [(Path(x["image"]).stem, str(x["number"]), x["title"], x["subtitle"], x["link"]) for x in load("episodes.yml")["episodes"]]
_t = load("testimonials.yml")
TW_QUOTES = [(Path(x["photo"]).stem, x["name"], x["quote"]) for x in _t["quotes"]]
STORY_VIDEOS = [(x["wistia"], Path(x["thumbnail"]).stem, x["name"], x["label"]) for x in _t["videos"]]
OFFERS = [(Path(x["picture"]).stem, bool(x.get("show_whole_picture")), x["name"], x["price"], x["price_note"],
           [rich(p) for p in x["points"]], (x["button_link"], x["button_label"]),
           (x["second_link"], x["second_label"]) if x.get("second_link") else None) for x in load("offers.yml")["offers"]]
FAQS = load("faqs.yml")["faqs"]
