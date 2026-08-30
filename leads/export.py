#!/usr/bin/env python3
"""Merge base + enrichment + NPPES endpoints into call-ready deliverables."""
import json, csv, re, socket
from pathlib import Path
from collections import Counter

HERE = Path(__file__).parent
OUT = HERE / "output"; (OUT / "by-state").mkdir(parents=True, exist_ok=True)

base = json.loads((HERE / "leads_base.json").read_text())
enr = {}
if (HERE / "enriched.json").exists():
    enr = {e["npi"]: e for e in json.loads((HERE / "enriched.json").read_text())}
eps = json.loads((HERE / "endpoint_emails.json").read_text()) if (HERE / "endpoint_emails.json").exists() else {}

STATE_NAME = {"CT": "Connecticut", "NY": "New York", "RI": "Rhode Island",
              "MA": "Massachusetts", "MD": "Maryland", "ME": "Maine",
              "VT": "Vermont", "VA": "Virginia"}
BEACHHEAD = {"CT", "NY"}
TYPO = re.compile(r"@(gamil|gmial|gmai|hotmial|yaho|outlok|yahooo)\.", re.I)

_dns = {}
def domain_live(email):
    d = email.split("@")[-1]
    if d not in _dns:
        try:
            socket.setdefaulttimeout(4); socket.getaddrinfo(d, None); _dns[d] = True
        except Exception:
            _dns[d] = False
    return _dns[d]

rows = []
for b in base:
    e = enr.get(b["npi"], {})
    email, src = "", ""
    if eps.get(b["npi"]):
        email, src = eps[b["npi"]], "NPPES federal registry filing"
    elif e.get("email"):
        email = e["email"]
        src = ("Practice website (phone-verified)" if e.get("verified_by") == "phone"
               else "Practice website (address-verified)")
    flag = ""
    if email and TYPO.search(email):
        flag = "CHECK - likely typo in practice's own filing"
    elif email and not domain_live(email):
        flag = "CHECK - email domain does not resolve"

    yr = (b.get("last_updated") or "")[:4]
    try:
        yi = int(yr)
    except ValueError:
        yi = 0
    fresh = ("Recent" if yi >= 2022 else "Ageing" if yi >= 2015 else "Stale")
    gen = b["tier"] == "PRIMARY"
    prio = "A" if (gen and b["state"] in BEACHHEAD) else ("B" if gen else "C")

    rows.append({
        "Priority": prio,
        "Practice Name": b["practice_name"],
        "City": b["city"],
        "State": b["state"],
        "Phone": b["phone"],
        "Owner / Decision Maker": b["owner_name"],
        "Owner Title": b["owner_title"],
        "Email": email,
        "Email Source": src,
        "Data Flag": flag,
        "Website": e.get("website", ""),
        "Address": b["address"],
        "ZIP": b["zip"],
        "Practice Type": b["kind"],
        "Target Tier": "Primary (general)" if gen else "Secondary (specialty)",
        "Locations On Phone": b["sites"],
        "NPI": b["npi"],
        "Record Updated": yr,
        "Record Freshness": fresh,
        "Verification": b["source"],
        "Called": "", "Outcome": "", "Follow Up": "",   # blank cols for Hudson
    })

rows.sort(key=lambda r: (r["Priority"], {"Recent":0,"Ageing":1,"Stale":2}[r["Record Freshness"]],
                         r["State"], r["City"], r["Practice Name"]))
COLS = list(rows[0].keys())

def write_csv(path, data):
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=COLS); w.writeheader(); w.writerows(data)

write_csv(OUT / "Hudson_Dental_Leads_MASTER.csv", rows)
for st in STATE_NAME:
    sub = [r for r in rows if r["State"] == st]
    if sub:
        write_csv(OUT / "by-state" / f"{st}_{STATE_NAME[st].replace(' ','_')}.csv", sub)
write_csv(OUT / "Hudson_Dental_Leads_WITH_EMAIL.csv", [r for r in rows if r["Email"]])

# ---------- workbook ----------
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

wb = Workbook(); ws = wb.active; ws.title = "Summary"
HEAD = PatternFill("solid", fgColor="1F3864")
HF = Font(color="FFFFFF", bold=True, size=11)

def sheet(ws, data):
    ws.append(COLS)
    for c in ws[1]:
        c.fill = HEAD; c.font = HF; c.alignment = Alignment(vertical="center")
    for r in data:
        ws.append([r[c] for c in COLS])
    ws.freeze_panes = "C2"
    ws.auto_filter.ref = f"A1:{get_column_letter(len(COLS))}{len(data)+1}"
    for i, c in enumerate(COLS, 1):
        w = max(len(c) + 2, *(len(str(r[c])) + 2 for r in data[:400])) if data else len(c) + 2
        ws.column_dimensions[get_column_letter(i)].width = min(w, 42)
    for row in ws.iter_rows(min_row=2, max_row=len(data) + 1):
        if row[0].value == "A":
            row[0].fill = PatternFill("solid", fgColor="C6E0B4")
        row[0].alignment = Alignment(horizontal="center")

emails = [r for r in rows if r["Email"]]
sites = [r for r in rows if r["Website"]]
summary = [
    ["HUDSON HECTOR - DENTAL PRACTICE CALL LIST", ""],
    ["Built", "30 August 2026"],
    ["Primary source", "CMS NPPES National Provider Registry (public federal data)"],
    ["", ""],
    ["Total practices", len(rows)],
    ["  With direct phone", sum(1 for r in rows if r["Phone"])],
    ["  With owner / decision-maker name", sum(1 for r in rows if r["Owner / Decision Maker"])],
    ["  With verified email", len(emails)],
    ["  With verified website", len(sites)],
    ["", ""],
    ["RECORD FRESHNESS (how likely the number is still live)", ""],
    ["  Recent - registry updated 2022 or later", sum(1 for r in rows if r["Record Freshness"] == "Recent")],
    ["  Ageing - updated 2015-2021", sum(1 for r in rows if r["Record Freshness"] == "Ageing")],
    ["  Stale - not updated since 2014", sum(1 for r in rows if r["Record Freshness"] == "Stale")],
    ["", ""],
    ["Priority A - general dentistry, CT + NY", sum(1 for r in rows if r["Priority"] == "A")],
    ["Priority B - general dentistry, other states", sum(1 for r in rows if r["Priority"] == "B")],
    ["Priority C - specialty practices", sum(1 for r in rows if r["Priority"] == "C")],
    ["", ""],
    ["BY STATE", ""],
]
for st, n in Counter(r["State"] for r in rows).most_common():
    summary.append([f"  {STATE_NAME[st]} ({st})", n])
for r in summary:
    ws.append(r)
ws["A1"].font = Font(bold=True, size=14, color="1F3864")
ws.column_dimensions["A"].width = 46; ws.column_dimensions["B"].width = 60
for row in ws.iter_rows(min_row=1, max_row=ws.max_row, max_col=1):
    if row[0].value and str(row[0].value).isupper() and row[0].row > 1:
        row[0].font = Font(bold=True)

sheet(wb.create_sheet("All Leads"), rows)
if emails:
    sheet(wb.create_sheet("Has Email"), emails)
for st in STATE_NAME:
    sub = [r for r in rows if r["State"] == st]
    if sub:
        sheet(wb.create_sheet(STATE_NAME[st][:28]), sub)
wb.save(OUT / "Hudson_Dental_Leads.xlsx")

print(f"practices   {len(rows)}")
print(f"emails      {len(emails)}")
print(f"websites    {len(sites)}")
print(f"flagged     {sum(1 for r in rows if r['Data Flag'])}")
print(f"\n-> {OUT}")
