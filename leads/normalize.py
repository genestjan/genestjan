#!/usr/bin/env python3
"""Normalise raw NPPES records into clean lead rows."""
import json, re, csv
from pathlib import Path
from collections import Counter

HERE = Path(__file__).parent
raw = json.loads((HERE / "raw_nppes.json").read_text())

SPECIALTY = {
    "1223P0221X": "Pediatric", "1223X0400X": "Orthodontics",
    "1223S0112X": "Oral Surgery", "1223P0700X": "Prosthodontics",
    "1223E0200X": "Endodontics", "1223P0300X": "Periodontics",
    "1223D0001X": "Public Health", "1223X2210X": "Oral Radiology",
    "1223X0008X": "Oral Medicine", "1223X0104X": "Oral Pathology",
}
GENERAL = {"1223G0001X", "122300000X"}

# Practice-name noise that signals a non-practice / non-target record
SKIP_NAME = re.compile(r"\b(SUPPLY|LABORATOR|LAB LLC|BILLING|CONSULT|STAFFING|"
                       r"INSURANCE|UNIVERSITY|COLLEGE|SCHOOL OF)\b", re.I)


KEEP_UPPER = {"DDS", "DMD", "PC", "PLLC", "LLC", "LLP", "PA", "MD", "MS", "DPM",
              "II", "III", "IV", "USA", "NE", "NW", "SE", "SW", "MSD", "PHD",
              "TMJ", "TMD", "NYC", "USC", "NYU", "VA", "DC", "OMS",
              "NY", "VT", "MA", "MD", "RI", "NH", "NJ"}
# street suffixes and similar that must NOT be shouted
LOWER_ABBR = {"ST": "St", "RD": "Rd", "DR": "Dr", "AVE": "Ave", "LN": "Ln",
              "CT": "Ct", "PL": "Pl", "BLVD": "Blvd", "PKWY": "Pkwy", "HWY": "Hwy",
              "TPKE": "Tpke", "STE": "Ste", "APT": "Apt", "FL": "Fl", "RM": "Rm",
              "SQ": "Sq", "TER": "Ter", "CIR": "Cir", "EXT": "Ext", "BLDG": "Bldg",
              "PLZ": "Plz", "TRL": "Trl", "WAY": "Way", "PT": "Pt", "MT": "Mt"}


def title(s):
    if not s:
        return ""
    out = []
    for w in " ".join(s.split()).split(" "):
        u = w.upper().rstrip(".")
        if u in KEEP_UPPER:
            out.append(u)
        elif u in LOWER_ABBR:
            out.append(LOWER_ABBR[u])
        elif re.fullmatch(r"[A-Za-z]\.?", w):        # lone letter: initial or "A Plus"
            out.append(w.upper().rstrip("."))
        elif re.fullmatch(r"(?:[A-Za-z]\.){2,}", w):  # D.D.S. style
            out.append(w.upper())
        elif any(ch.isdigit() for ch in w):
            # mixed alphanumeric: title-case the word-parts, keep the digits
            out.append(re.sub(r"[A-Za-z]{3,}",
                              lambda m: m.group(0).capitalize(), w))
        elif "'" in w:                                # O'Brien, D'Amico
            a, _, b = w.partition("'")
            out.append(a.capitalize() + "'" + b.capitalize())
        elif "-" in w:                                # Smith-Jones
            out.append("-".join(x.capitalize() for x in w.split("-")))
        elif u.startswith("MC") and len(u) > 3:
            out.append("Mc" + w[2:].capitalize())
        else:
            out.append(w.capitalize())
    return " ".join(out)


def fix_title(s):
    """Owner job titles: CEO / DDS stay shouted, the rest sentence-cased."""
    if not s:
        return ""
    t = title(s)
    for a, b in (("Ceo", "CEO"), ("Cfo", "CFO"), ("Coo", "COO"),
                 ("Dds", "DDS"), ("Dmd", "DMD"), ("Md", "MD"), ("Rdh", "RDH")):
        t = re.sub(rf"\b{a}\b", b, t)
    return t


def phone(p):
    if not p:
        return ""
    d = re.sub(r"\D", "", p)
    if len(d) == 11 and d.startswith("1"):
        d = d[1:]
    return f"({d[:3]}) {d[3:6]}-{d[6:]}" if len(d) == 10 else ""



def build():
    TARGET_STATES = {"CT","NY","RI","MA","MD","ME","VT","VA"}

    rows, seen_phone = [], {}
    for r in raw:
        b = r.get("basic", {})
        if b.get("status") != "A":
            continue
        name = (b.get("organization_name") or "").strip().lstrip("'").strip()
        if not name or SKIP_NAME.search(name):
            continue

        loc = next((a for a in r.get("addresses", [])
                    if a.get("address_purpose") == "LOCATION"), None)
        if not loc or loc.get("country_code") != "US":
            continue
        if loc.get("state") not in TARGET_STATES:
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

        tel = phone(loc.get("telephone_number"))
        if not tel:
            continue

        owner = " ".join(x for x in [
            title(b.get("authorized_official_first_name", "")),
            title(b.get("authorized_official_last_name", "")),
        ] if x).strip()
        cred = (b.get("authorized_official_credential") or "").replace("--", "").strip()
        if cred and owner:
            owner = f"{owner}, {cred.upper()}"

        zipc = (loc.get("postal_code") or "")[:5]
        row = {
            "practice_name": title(name),
            "kind": kind,
            "tier": tier,
            "owner_name": owner,
            "owner_title": fix_title((b.get("authorized_official_title_or_position") or "").strip()),
            "phone": tel,
            "address": title(loc.get("address_1", "")) + (
                " " + title(loc.get("address_2", "")) if loc.get("address_2") else ""),
            "city": title(loc.get("city", "")),
            "state": loc.get("state", ""),
            "zip": zipc,
            "npi": r.get("number", ""),
            "license_state": prim.get("state", ""),
            "n_taxonomies": len(taxes),
            "enumerated": b.get("enumeration_date", ""),
            "last_updated": b.get("last_updated", ""),
            "website": "",
            "email": "",
            "source": f"NPPES NPI {r.get('number','')}",
        }

        # Multiple practices sharing one phone = same front desk (group/DSO).
        key = row["phone"]
        if key in seen_phone:
            seen_phone[key]["sites"] += 1
            continue
        row["sites"] = 1
        seen_phone[key] = row
        rows.append(row)

    rows.sort(key=lambda r: (r["state"], r["city"], r["practice_name"]))
    (HERE / "leads_base.json").write_text(json.dumps(rows, indent=1))

    print(f"Clean, phone-deduped practices: {len(rows)}\n")
    print("BY STATE                 total   general   specialty")
    for st, n in sorted(Counter(r["state"] for r in rows).items(),
                        key=lambda x: -x[1]):
        g = sum(1 for r in rows if r["state"] == st and r["tier"] == "PRIMARY")
        print(f"  {st:<20} {n:>6} {g:>9} {n-g:>11}")
    print(f"\nWith owner name captured: "
          f"{sum(1 for r in rows if r['owner_name'])} "
          f"({100*sum(1 for r in rows if r['owner_name'])//len(rows)}%)")
    print(f"Multi-location groups:    {sum(1 for r in rows if r['sites'] > 1)}")


if __name__ == "__main__":
    build()
