#!/usr/bin/env python3
"""Generate candidate web domains from a practice name."""
import re

STOP = {"the","of","and","at","a","in","for","pc","pa","llc","pllc","llp","inc",
        "ltd","co","corp","dds","dmd","md","ms","phd","prof","assoc","associates",
        "association","dr","drs","professional","limited","liability","company",
        "chartered","pllc.","incorporated","corporation","practice","office",
        "offices","and","jr","sr","ii","iii","iv"}
CORE = {"dental","dentistry","dentist","smiles","smile","orthodontics","ortho",
        "periodontics","endodontics","prosthodontics","oral","surgery",
        "pediatric","family","care","group","center","centre","associates"}
# words that are too generic to stand alone as a domain
GENERIC = {"dental","dentistry","dentist","smile","smiles","family","care",
           "group","center","centre","oral","ortho","orthodontics","first",
           "new","best","pure","apex","revive","next","park","back","main",
           "advanced","modern","gentle","bright","total","complete","premier"}


def tokens(name):
    n = name.lower()
    n = re.sub(r"\b(p\.?c|p\.?a|l\.?l\.?c|p\.?l\.?l\.?c|d\.?d\.?s|d\.?m\.?d)\b\.?", " ", n)
    n = re.sub(r"[^a-z0-9\s&]", " ", n)
    n = n.replace("&", " and ")
    return [w for w in n.split() if w and w not in STOP and len(w) > 1]


def candidates(name, city="", limit=10):
    t = tokens(name)
    if not t:
        return []
    out = []

    def add(s):
        s = re.sub(r"[^a-z0-9]", "", s)
        if not (5 <= len(s) <= 42):
            return
        if s in GENERIC:                       # never guess a bare generic word
            return
        for tld in (".com", ".net"):
            d = s + tld
            if d not in out:
                out.append(d)

    lead = [w for w in t if w not in CORE]     # distinctive words (often a surname)
    kw = next((w for w in t if w in CORE), None)

    add("".join(t))                            # whole name run together
    if len(t) > 1:
        add("".join(t[:-1]))
    if lead:
        # surname-led forms: "opindental", "mendoladental"
        surname = lead[-1]
        add(surname + (kw or "dental"))
        add(surname + "dental")
        add(surname + "dentistry")
        add("".join(lead) + (kw or "dental"))
        add("".join(lead))
        if len(lead) > 1:
            add(lead[0] + surname)
    if kw and city:
        c = re.sub(r"[^a-z]", "", city.lower())
        if c:
            add(c + kw)
    return out[:limit]


if __name__ == "__main__":
    for n, c in [("Thames River Dental Group", "New London"),
                 ("Perry M Opin DDS PC", "Fairfield"),
                 ("Robert J Mendola DDS PC", "Stamford"),
                 ("Carter Dentistry PC", "Scarsdale"),
                 ("Apex Dental Care", "Arlington"),
                 ("Park Slope Dental", "Brooklyn")]:
        print(f"{n:<30} -> {candidates(n, c)}")
