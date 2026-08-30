#!/usr/bin/env python3
"""Turn raw Google Maps cards into clean lead records."""
import json, re, glob
from pathlib import Path

HERE = Path(__file__).parent
PUA = re.compile(r"[-]")           # Maps' icon glyphs
PHONE = re.compile(r"(?:\(\d{3}\)\s?|\b\d{3}[-.\s])\d{3}[-.\s]?\d{4}\b")
STREETY = re.compile(r"\b(St|Street|Ave|Avenue|Rd|Road|Blvd|Dr|Drive|Ln|Lane|Way|"
                     r"Pl|Place|Ct|Court|Hwy|Highway|Pike|Pkwy|Tpke|Turnpike|Sq|"
                     r"Ter|Terrace|Cir|Circle|Broadway|Fl|Ste|Suite|Unit|#)\b", re.I)


def clean(s):
    return " ".join(PUA.sub(" ", s or "").split())


def fmt_phone(p):
    d = re.sub(r"\D", "", p or "")
    if len(d) == 11 and d.startswith("1"):
        d = d[1:]
    return f"({d[:3]}) {d[3:6]}-{d[6:]}" if len(d) == 10 else ""


def parse_card(r):
    lines = [clean(x) for x in (r.get("text") or "").split("\n")]
    lines = [x for x in lines if x]
    name = clean(r.get("name"))
    rating, category, address = "", "", ""

    for ln in lines:
        if not rating and re.fullmatch(r"[0-5]\.\d", ln):
            rating = ln
        if "·" in ln:
            segs = [clean(s) for s in ln.split("·")]
            segs = [s for s in segs if s]
            for s in segs:
                if PHONE.fullmatch(s) or s.lower().startswith(("open", "clos", "temporar")):
                    continue
                if (s[:1].isdigit() and STREETY.search(s)) or \
                   (s[:1].isdigit() and len(s.split()) >= 2):
                    if not address:
                        address = s
                elif not category and s and not any(ch.isdigit() for ch in s):
                    category = s
    ph = PHONE.search(clean(r.get("text", "")))
    phone = fmt_phone(r.get("phone") or (ph.group(0) if ph else ""))

    q = r.get("query", "")
    m = re.search(r"in\s+(.+),\s*([A-Z]{2})\s*$", q)
    city, state = (m.group(1), m.group(2)) if m else ("", "")

    web = (r.get("website") or "").split("?")[0]
    return {
        "name": name, "phone": phone, "address": address, "city": city,
        "state": state, "category": category, "rating": rating,
        "website": web, "maps_url": r.get("maps_url", ""), "query": q,
    }


def main():
    raw = []
    for f in sorted(glob.glob("/tmp/gmscrape/maps_[0-9]*.json")):
        try:
            raw += json.loads(Path(f).read_text())
        except Exception:
            pass

    rows, seen = [], set()
    for r in raw:
        p = parse_card(r)
        if not p["name"]:
            continue
        key = p["phone"] or (p["name"].lower(), p["address"].lower())
        if key in seen:
            continue
        seen.add(key)
        rows.append(p)
    (HERE / "maps_parsed.json").write_text(json.dumps(rows, indent=1))
    print(f"raw cards {len(raw)} -> unique {len(rows)}")
    print(f"  with phone   {sum(1 for r in rows if r['phone'])}")
    print(f"  with website {sum(1 for r in rows if r['website'])}")
    print(f"  with address {sum(1 for r in rows if r['address'])}")


if __name__ == "__main__":
    main()
