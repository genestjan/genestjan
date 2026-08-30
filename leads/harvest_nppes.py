#!/usr/bin/env python3
"""
Harvest dental practice leads from the CMS NPPES registry (public federal data).

NPPES = National Plan & Provider Enumeration System. Every practice that bills
insurance in the US has an NPI record here. Organisational records (NPI-2) give
practice name, location, phone, and the authorised official (usually the owner).
No email or website -- those get enriched in a later pass.
"""
import json, time, sys, csv, re
from pathlib import Path
import requests

API = "https://npiregistry.cms.hhs.gov/api/"
OUT = Path(__file__).parent / "raw_nppes.json"

# Target cities: chosen for practice density + callable market, Fairfield County
# CT first since that is the existing MedSafe/platform beachhead.
TARGETS = {
    "CT": ["Bridgeport", "Fairfield", "Stamford", "Norwalk", "Danbury", "Stratford",
           "Trumbull", "Shelton", "Milford", "Westport", "Greenwich", "New Haven",
           "Hartford", "Waterbury", "Stamford", "Darien", "Ridgefield", "Monroe",
           "Orange", "West Hartford", "Middletown", "New London", "Norwich"],
    "NY": ["New York", "Brooklyn", "Bronx", "Queens", "Staten Island", "Flushing",
           "Astoria", "Jamaica", "Yonkers", "White Plains", "New Rochelle", "Scarsdale",
           "Mount Vernon", "Buffalo", "Rochester", "Syracuse", "Albany", "Hempstead",
           "Garden City", "Great Neck", "Huntington", "Commack", "Massapequa",
           "Bay Shore", "Riverhead", "Poughkeepsie", "Nyack", "Middletown"],
    "RI": ["Providence", "Warwick", "Cranston", "Pawtucket", "East Providence",
           "Woonsocket", "North Kingstown", "East Greenwich", "Newport", "Westerly",
           "Johnston", "Smithfield", "Lincoln", "Barrington"],
    "MA": ["Boston", "Worcester", "Springfield", "Cambridge", "Newton", "Quincy",
           "Framingham", "Lowell", "Brockton", "Somerville", "Brookline", "Waltham",
           "Medford", "Peabody", "Attleboro", "Fall River", "New Bedford", "Lynn",
           "Needham", "Andover", "Plymouth", "Northampton"],
    "MD": ["Baltimore", "Bethesda", "Rockville", "Silver Spring", "Columbia",
           "Annapolis", "Frederick", "Gaithersburg", "Towson", "Ellicott City",
           "Germantown", "Hagerstown", "Salisbury", "Bowie", "Laurel", "Potomac",
           "Chevy Chase", "Owings Mills", "Waldorf"],
    "ME": ["Portland", "South Portland", "Bangor", "Lewiston", "Auburn", "Augusta",
           "Biddeford", "Brunswick", "Scarborough", "Westbrook", "Saco", "Waterville",
           "Falmouth", "Windham", "Presque Isle", "Rockland", "Ellsworth"],
    "VT": ["Burlington", "South Burlington", "Essex Junction", "Rutland", "Montpelier",
           "Barre", "Colchester", "Williston", "Bennington", "Brattleboro",
           "St Albans", "Middlebury", "Springfield", "Newport", "Shelburne"],
    "VA": ["Virginia Beach", "Richmond", "Arlington", "Alexandria", "Norfolk",
           "Chesapeake", "Fairfax", "Newport News", "Roanoke", "Charlottesville",
           "Reston", "Herndon", "McLean", "Vienna", "Springfield", "Woodbridge",
           "Ashburn", "Leesburg", "Manassas", "Centreville", "Chantilly",
           "Midlothian", "Glen Allen", "Hampton", "Suffolk", "Lynchburg"],
}

session = requests.Session()
session.headers["User-Agent"] = "lead-research/1.0"


def fetch(params, tries=4):
    for attempt in range(tries):
        try:
            r = session.get(API, params=params, timeout=60)
            if r.status_code == 200:
                return r.json()
            if r.status_code in (429, 500, 502, 503, 504):
                time.sleep(2 ** attempt)
                continue
            return None
        except requests.RequestException:
            time.sleep(2 ** attempt)
    return None


def harvest_city(state, city):
    """Page through every dental org NPI in one city."""
    out, skip = [], 0
    while skip <= 1000:
        p = {
            "version": "2.1",
            "enumeration_type": "NPI-2",
            "taxonomy_description": "Dentist",
            "state": state,
            "city": city,
            "limit": 200,
            "skip": skip,
        }
        d = fetch(p)
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
        state_n = 0
        for city in cities:
            recs = harvest_city(state, city)
            new = 0
            for r in recs:
                npi = r.get("number")
                if npi and npi not in seen:
                    seen.add(npi)
                    all_recs[npi] = r
                    new += 1
            state_n += new
            print(f"  {state}/{city:<18} +{new:<4} (raw {len(recs)})", flush=True)
            time.sleep(0.15)
        print(f"== {state}: {state_n} unique practices ==", flush=True)
    OUT.write_text(json.dumps(list(all_recs.values())))
    print(f"\nTOTAL UNIQUE ORG NPIs: {len(all_recs)}  -> {OUT}")


if __name__ == "__main__":
    main()
