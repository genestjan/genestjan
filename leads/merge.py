#!/usr/bin/env python3
"""Merge Google Maps results into the NPPES base list without creating duplicates.

NPPES is the spine (authoritative name/phone/owner). Maps contributes websites,
ratings and a citable place URL, plus any practice NPPES missed.
"""
import json, re
from pathlib import Path

HERE = Path(__file__).parent
NOISE = {"dental", "dentistry", "dentist", "dds", "dmd", "pc", "pa", "llc", "pllc",
         "llp", "inc", "ltd", "the", "of", "and", "dr", "drs", "office", "offices",
         "group", "associates", "assoc", "center", "centre", "care", "family",
         "practice", "co", "in", "at", "smiles", "smile"}


def digits(s):
    return re.sub(r"\D", "", s or "")


def name_key(s):
    t = re.sub(r"[^a-z0-9 ]", " ", (s or "").lower()).split()
    return {w for w in t if w not in NOISE and len(w) > 2}


def norm_addr(addr):
    """Queens writes house numbers as 33-16; the registry writes 3316.
    Strip the hyphen so both key identically."""
    a = (addr or "").lower()
    return re.sub(r"^\s*(\d+)-(\d+)", r"\1\2", a)


def addr_key(addr, city):
    a = norm_addr(addr)
    m = re.match(r"\s*(\d+)\s+([a-z0-9]+)", a)
    return (m.group(1), m.group(2), (city or "").lower()) if m else None


def street_key(addr):
    """Street number + first word only. Maps infers city from the search
    query, so a neighbouring-town label must not block a real match."""
    m = re.match(r"\s*(\d+)\s+([a-z0-9]+)", norm_addr(addr))
    return (m.group(1), m.group(2)) if m else None


def main():
    base = json.loads((HERE / "leads_base.json").read_text())
    maps = json.loads((HERE / "maps_parsed.json").read_text())

    by_phone, by_addr, by_street = {}, {}, {}
    for b in base:
        d = digits(b["phone"])
        if d:
            by_phone.setdefault(d, b)
        k = addr_key(b["address"], b["city"])
        if k:
            by_addr.setdefault(k, []).append(b)
        s2 = street_key(b["address"])
        if s2:
            by_street.setdefault(s2, []).append(b)

    stats = {"phone": 0, "addr": 0, "street": 0, "dupe": 0, "new": 0}
    seen_new = {}
    extra = {}          # npi -> maps info to fold in
    new_rows = []

    for m in maps:
        hit = None
        d = digits(m["phone"])
        if d and d in by_phone:
            hit, how = by_phone[d], "phone"
        else:
            nk = name_key(m["name"])
            k = addr_key(m["address"], m["city"])
            if k and k in by_addr:
                for cand in by_addr[k]:
                    if nk & name_key(cand["practice_name"]) or not nk:
                        hit, how = cand, "addr"
                        break
            if not hit:
                # same street address + overlapping name, whatever city label
                s2 = street_key(m["address"])
                if s2 and s2 in by_street and nk:
                    for cand in by_street[s2]:
                        if nk & name_key(cand["practice_name"]):
                            hit, how = cand, "street"
                            break
        if hit:
            stats[how] += 1
            e = extra.setdefault(hit["npi"], {})
            if m["website"] and not e.get("website"):
                e["website"] = m["website"]
            if m["maps_url"]:
                e["maps_url"] = m["maps_url"]
            if m["rating"]:
                e["rating"] = m["rating"]
            if m["category"]:
                e["category"] = m["category"]
            # the name on the door, which is often not the registered entity
            if m["name"] and not e.get("trading_name"):
                e["trading_name"] = m["name"]
        else:
            # collapse duplicate Maps listings for the same business
            nk2 = frozenset(name_key(m["name"])) or frozenset([m["name"].lower()])
            dk = (nk2, street_key(m["address"]))
            if dk in seen_new:
                prev = seen_new[dk]
                if m.get("website") and not prev.get("website"):
                    prev["website"] = m["website"]
                if m.get("phone") and not prev.get("phone"):
                    prev["phone"] = m["phone"]
                stats["dupe"] += 1
                continue
            seen_new[dk] = m
            stats["new"] += 1
            new_rows.append(m)

    (HERE / "maps_extra.json").write_text(json.dumps(extra, indent=1))
    (HERE / "maps_new.json").write_text(json.dumps(new_rows, indent=1))
    print(f"maps rows            {len(maps)}")
    print(f"  matched by phone   {stats['phone']}")
    print(f"  matched by address {stats['addr']}")
    print(f"  matched by street  {stats['street']}")
    print(f"  duplicate listings {stats['dupe']}")
    print(f"  NEW (not in NPPES) {stats['new']}")
    print(f"  websites gained    {sum(1 for v in extra.values() if v.get('website'))}")


if __name__ == "__main__":
    main()
