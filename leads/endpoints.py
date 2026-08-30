#!/usr/bin/env python3
"""Pull the real email addresses practices registered in NPPES endpoints."""
import json, re
from pathlib import Path

raw = json.loads(Path("raw_nppes.json").read_text())
base = {l["npi"]: l for l in json.loads(Path("leads_base.json").read_text())}
EMAIL = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")

out = {}
for r in raw:
    npi = r.get("number")
    if npi not in base:
        continue
    for e in r.get("endpoints", []):
        val = str(e.get("endpoint", "")).strip().lower()
        val = val.replace("mailto:", "")
        if EMAIL.match(val) and len(val) < 60:
            out.setdefault(npi, val)

Path("endpoint_emails.json").write_text(json.dumps(out, indent=1))
print(f"NPPES-registered emails matched to target-state practices: {len(out)}")
for npi, em in list(out.items())[:12]:
    b = base[npi]
    print(f"  {b['practice_name'][:38]:<40} {b['city']}, {b['state']:<3} {em}")
