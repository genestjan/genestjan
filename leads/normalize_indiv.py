#!/usr/bin/env python3
"""Fold individual (NPI-1) dentists into the practice list.

Organisational records are the better lead (real practice name, named owner),
so they win every phone collision. Individuals only create a new row when their
practice phone isn't already in the list -- which is exactly the solo and
associate-run practice the org-only pass missed.
"""
import json, re
from pathlib import Path
from collections import Counter
from normalize import title, fix_title, phone as fmt_phone, SPECIALTY, GENERAL

HERE = Path(__file__).parent
TARGET_STATES = {"CT", "NY", "RI", "MA", "MD", "ME", "VT", "VA"}

base = json.loads((HERE / "leads_base.json").read_text())
raw = json.loads((HERE / "raw_nppes_indiv.json").read_text())

seen_phone = {r["phone"] for r in base}
rows, added = list(base), {}

for r in raw:
    b = r.get("basic", {})
    if b.get("status") != "A":
        continue
    loc = next((a for a in r.get("addresses", [])
                if a.get("address_purpose") == "LOCATION"), None)
    if not loc or loc.get("state") not in TARGET_STATES:
        continue
    tel = fmt_phone(loc.get("telephone_number"))
    if not tel or tel in seen_phone:
        continue

    taxes = r.get("taxonomies", [])
    prim = next((t for t in taxes if t.get("primary")), taxes[0] if taxes else {})
    code = prim.get("code", "")
    if code in GENERAL:
        kind, tier = "General Dentistry", "PRIMARY"
    elif code in SPECIALTY:
        kind, tier = SPECIALTY[code], "SECONDARY"
    else:
        kind, tier = prim.get("desc", "Dental"), "SECONDARY"

    person = " ".join(x for x in [title(b.get("first_name", "")),
                                  title(b.get("last_name", ""))] if x).strip()
    cred = (b.get("credential") or "").replace("--", "").strip().upper()
    owner = f"{person}, {cred}" if cred and person else person
    if not person:
        continue
    # a registered "other name" is usually the trading practice name
    practice = ""
    for o in r.get("other_names", []):
        if o.get("organization_name"):
            practice = title(o["organization_name"])
            break
    seen_phone.add(tel)
    added[tel] = {
        "practice_name": practice or owner,
        "kind": kind, "tier": tier, "owner_name": owner,
        "owner_title": fix_title(b.get("credential", "") or "Dentist"),
        "phone": tel,
        "address": title(loc.get("address_1", "")) + (
            " " + title(loc.get("address_2", "")) if loc.get("address_2") else ""),
        "city": title(loc.get("city", "")), "state": loc.get("state", ""),
        "zip": (loc.get("postal_code") or "")[:5],
        "npi": r.get("number", ""), "license_state": prim.get("state", ""),
        "n_taxonomies": len(taxes), "enumerated": b.get("enumeration_date", ""),
        "last_updated": b.get("last_updated", ""),
        "website": "", "email": "", "sites": 1,
        "record_type": "Individual dentist",
        "source": f"NPPES NPI {r.get('number','')}",
    }

for r in rows:
    r.setdefault("record_type", "Practice (organisation)")
rows += list(added.values())
rows.sort(key=lambda r: (r["state"], r["city"], r["practice_name"]))
(HERE / "leads_base.json").write_text(json.dumps(rows, indent=1))

print(f"org practices     {len(base)}")
print(f"+ solo/associate  {len(added)}")
print(f"= total leads     {len(rows)}\n")
print("BY STATE")
for st, n in Counter(r["state"] for r in rows).most_common():
    print(f"  {st}: {n}")
