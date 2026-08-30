#!/usr/bin/env python3
"""Wider candidate net for practices pass 1 could not place. DNS is cheap and
verification stays strict, so extra guesses cost time, never accuracy."""
import re
from domainize import tokens, CORE, GENERIC

TLDS = (".com", ".net", ".org", ".us", ".dental", ".care", ".co")


def candidates2(name, city="", state="", limit=34):
    t = tokens(name)
    if not t:
        return []
    out = []

    def add(s, tlds=("(default)",)):
        s = re.sub(r"[^a-z0-9]", "", s)
        if not (5 <= len(s) <= 42) or s in GENERIC:
            return
        for tld in (TLDS if tlds == ("(default)",) else tlds):
            d = s + tld
            if d not in out:
                out.append(d)

    lead = [w for w in t if w not in CORE]
    kw = next((w for w in t if w in CORE), None)
    surname = lead[-1] if lead else t[-1]
    c = re.sub(r"[^a-z]", "", city.lower())

    add("".join(t), (".com", ".net", ".org", ".us"))
    if len(t) > 1:
        add("".join(t[:-1]), (".com", ".net", ".org"))
    for base in (surname + "dental", surname + "dentistry", surname + "dds",
                 surname + "smiles", "dr" + surname, "dr" + surname + "dental",
                 surname + "familydental", surname + "dentalcare"):
        add(base, (".com", ".net", ".org"))
    if lead:
        add("".join(lead) + (kw or "dental"), (".com", ".net"))
        add("".join(lead), (".com", ".net"))
    if c:
        add(c + surname, (".com",))
        add(surname + c, (".com",))
        if kw:
            add(c + kw, (".com", ".net"))
        add(c + "familydental", (".com",))
    # hyphenated variants of the full name
    if len(t) > 1:
        h = "-".join(t)
        if 5 <= len(h) <= 42:
            for tld in (".com", ".net"):
                if h + tld not in out:
                    out.append(h + tld)
    return out[:limit]


if __name__ == "__main__":
    for n, c in [("David L Steinhof DMD PC", "Fall River"),
                 ("Perry M Opin DDS PC", "Fairfield")]:
        print(n, "->", len(candidates2(n, c)))
        print("  ", candidates2(n, c)[:14])
