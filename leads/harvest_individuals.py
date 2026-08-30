#!/usr/bin/env python3
"""Harvest INDIVIDUAL (NPI-1) dentist records.

Solo and associate dentists often have no organisational NPI, so the org-only
pass misses their practice entirely. Deduping these by practice phone collapses
associates back down to one row per front desk.
"""
import json, time, sys
from pathlib import Path
import requests
from harvest_nppes import TARGETS, fetch, API

OUT = Path(__file__).parent / "raw_nppes_indiv.json"


def harvest_city(state, city):
    out, skip = [], 0
    while skip <= 1000:
        d = fetch({"version": "2.1", "enumeration_type": "NPI-1",
                   "taxonomy_description": "Dentist", "state": state,
                   "city": city, "limit": 200, "skip": skip})
        if not d or not d.get("results"):
            break
        out.extend(d["results"])
        if len(d["results"]) < 200:
            break
        skip += 200
        time.sleep(0.2)
    return out


def main():
    all_recs, seen = {}, set()
    for state, cities in TARGETS.items():
        n = 0
        for city in dict.fromkeys(cities):
            for r in harvest_city(state, city):
                npi = r.get("number")
                if npi and npi not in seen:
                    seen.add(npi)
                    all_recs[npi] = r
                    n += 1
            time.sleep(0.1)
        print(f"== {state}: {n} individual dentists ==", flush=True)
        OUT.write_text(json.dumps(list(all_recs.values())))
    OUT.write_text(json.dumps(list(all_recs.values())))
    print(f"TOTAL INDIVIDUAL NPIs: {len(all_recs)} -> {OUT}")


if __name__ == "__main__":
    main()
