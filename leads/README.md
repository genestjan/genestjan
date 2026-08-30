# Dental Practice Lead List — Hudson Hector

Eight-state dental practice call list for MedSafe outreach.
Built 30 August 2026.

---

## What's in `output/`

| File | Use |
|---|---|
| `Hudson_Dental_Leads.xlsx` | Main deliverable. Summary tab + one tab per state. Filters on, header frozen. |
| `Hudson_Dental_Leads_MASTER.csv` | Everything in one file. Import straight into Google Sheets. |
| `Hudson_Dental_Leads_WITH_EMAIL.csv` | Only the rows carrying a verified email. |
| `by-state/*.csv` | One file per state, if you want to hand out territories. |

The last three columns — **Called / Outcome / Follow Up** — are deliberately
blank for Hudson to fill in as he works the list.

---

## Where the data comes from

**CMS NPPES** (National Plan & Provider Enumeration System) — the federal
provider registry. Every practice that bills insurance in the US has a record
here, and it is public data published by CMS.

That matters for two reasons:

1. It is the same registry the insurers use, so it is the closest thing to a
   census of real, billing dental practices. It isn't a scraped directory.
2. It carries the **authorised official** — in a dental practice that is
   almost always the owner or managing partner. That's the decision maker,
   which is who MedSafe needs, not the front desk.

Queried organisational records (NPI-2) with dental taxonomies across 168
target cities, then deduplicated by phone number.

---

## Coverage

| State | Practices |
|---|---|
| New York | 2,179 |
| Virginia | 1,321 |
| Massachusetts | 953 |
| Maryland | 930 |
| Connecticut | 499 |
| Maine | 189 |
| Rhode Island | 158 |
| Vermont | 102 |
| **Total** | **6,331** |

Every row has a practice name, street address, phone number, owner name and
practice type. **100% have a phone and a named owner.**

---

## How to work the list

Sorted so the best calls are at the top.

- **Priority A** — general dentistry in CT and NY. Hudson's existing beachhead
  plus the expansion he asked for.
- **Priority B** — general dentistry in the other six states.
- **Priority C** — specialty practices (ortho, oral surgery, pedo, endo, perio).
  Secondary targets, per the original brief.

Within each band, rows are sorted **freshest record first**.

### Record freshness

A practice that closes doesn't always get removed from NPPES, so the date the
registry record was last updated is a proxy for whether the number is still
live:

- **Recent** — updated 2022 or later. Call these first.
- **Ageing** — 2015–2021.
- **Stale** — untouched since 2014. Expect a higher dead-number rate.

This is a prioritisation signal, not a guarantee.

---

## On the emails — read this bit

**Phone coverage is complete. Email coverage is not, and that is a real
finding rather than a gap in the work.**

Emails here come from two places, both verified:

1. **NPPES registry filings** — addresses practices registered themselves with
   the federal government. Highest confidence.
2. **The practice's own website** — where the site could be located *and*
   confirmed as belonging to that specific practice.

Nothing was accepted on a name match alone. A website is only attached to a
practice if the page carried **that practice's exact phone number or street
address**. That rule was doing real work: `carterdentistry.com` is a practice
in Alabama, not the Carter Dentistry in Scarsdale NY; `apexdentalcare.com` is
in Arizona, not Arlington VA. Relaxing the rule would have produced a list
that looked twice as full and quietly sent Hudson to the wrong practices.

Two reasons the email column is sparse:

- **Most dental practices don't publish an email.** They run a contact form
  instead, specifically to avoid the kind of outreach MedSafe is doing. This
  is a property of the market, not of the method.
- **Search engines block automated lookup.** Bing, DuckDuckGo, Mojeek, Ecosia,
  Startpage and Brave were all tested and all either blocked the request or
  returned degraded results, so websites could only be found by deriving
  candidate domains and verifying them.

**If email is needed at volume, it needs a paid B2B data provider** — Apollo,
Hunter, Clearbit or similar. That is a data cost, not a labour cost. See the
note below.

---

## Rebuilding or extending

```bash
python3 harvest_nppes.py   # pull raw records from the CMS registry
python3 normalize.py       # clean, classify, dedupe by phone
python3 endpoints.py       # emails filed directly in the registry
python3 enrich.py          # find + verify websites, extract emails
python3 export.py          # build the CSV / XLSX deliverables
```

To add states or cities, edit `TARGETS` in `harvest_nppes.py`. Everything
downstream is keyed on NPI, so it all still lines up.

---

## Compliance note

This is public federal data on **businesses**, gathered for B2B outreach —
practice names, business addresses, business phone numbers and the owner's
professional name. No patient data and no personal contact details are
involved.

Two things worth keeping in mind:

- **Calls.** Business-to-business calls sit outside most Do Not Call rules,
  but several of these states regulate commercial calling. Worth a check
  before a high-volume dialling campaign.
- **Email.** CAN-SPAM applies to the commercial emails: accurate headers, a
  real physical address, and a working opt-out on every send.

Given Hudson has just been on the receiving end of exactly this kind of
outreach via Apollo, keeping the volume sane and the targeting tight is
probably also the commercially smarter play.
