#!/usr/bin/env python3
"""Collect every known website that still has no email, for the extractor."""
import json
from pathlib import Path
HERE = Path(__file__).parent

def load(n, d):
    p = HERE / n
    try: return json.loads(p.read_text()) if p.exists() else d
    except Exception: return d

base   = load("leads_base.json", [])
mextra = load("maps_extra.json", {})
mnew   = load("maps_new.json", [])
enr    = {e["npi"]: e for e in load("enriched.json", []) if e.get("npi")}
done   = load("site_emails.json", {})
eps    = load("endpoint_emails.json", {})

todo, seen = [], set()
for b in base:
    npi = b.get("npi", "")
    key = f"npi:{npi}"
    if key in done or eps.get(npi):
        continue
    site = (mextra.get(npi, {}).get("website")
            or enr.get(npi, {}).get("website") or "")
    if site and site not in seen:
        seen.add(site); todo.append({"key": key, "website": site})
for m in mnew:
    key = f"maps:{m.get('maps_url','')}"
    if key in done:
        continue
    site = m.get("website", "")
    if site and site not in seen:
        seen.add(site); todo.append({"key": key, "website": site})

(HERE / "sites_todo.json").write_text(json.dumps(todo, indent=1))
print(f"websites needing an email lookup: {len(todo)} (already done: {len(done)})")
