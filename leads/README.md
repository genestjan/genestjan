# Dental Practice Lead List — Hudson Hector

Call-ready dental lead list for MedSafe outreach across eight states:
Connecticut, New York, Rhode Island, Massachusetts, Maryland, Maine,
Vermont and Virginia.

Built 30 August 2026.

## Final counts

| | |
|---|---|
| **Total leads** | **21,628** |
| With a phone number | 17,895 |
| With a named owner / decision maker | 16,042 |
| With a website | 4,635 |
| With an email | 1,376 (1,332 passed the deliverability audit) |
| Corroborated by a Google Maps listing | 9,246 |
| Duplicate phone numbers | **0** |

By state: New York 6,786 · Virginia 4,442 · Massachusetts 3,443 ·
Maryland 3,364 · Connecticut 1,933 · Maine 795 · Rhode Island 533 ·
Vermont 361.

Phone audit: 17,408 valid · 423 to check (area code doesn't match the state) ·
64 invalid · 3,733 with no number on record.

---

## What's in `output/`

| File | Use |
|---|---|
| `Hudson_Dental_Leads.xlsx` | Main deliverable. Summary tab, all leads, a deliverable-email tab, and one tab per state. Filters on, header frozen, audit columns colour-coded. |
| `Hudson_Dental_Leads_MASTER.csv` | Everything in one file. Imports straight into Google Sheets. |
| `Hudson_Dental_Leads_WITH_EMAIL.csv` | Only rows whose email passed the deliverability audit. |
| `by-state/*.csv` | One file per state, for splitting territories. |

The last three columns — **Called / Outcome / Follow Up** — are left blank for
Hudson to work in.

---

## Where the data comes from

Three sources, combined and deduplicated.

**1. CMS NPPES** — the federal provider registry. Every practice that bills
insurance in the US has a record here. This is the spine of the list because:

- It is a census of real, billing practices rather than a scraped directory.
- It carries the **authorised official** — in a dental practice, the owner or
  managing partner. That is the person MedSafe needs, not the front desk.

Both organisational records (NPI-2) and individual dentists (NPI-1) were
harvested across 163 target cities. The individual pass matters: solo and
associate-run practices often have no organisational NPI at all, so an
org-only list silently misses them.

**2. Google Maps** — scraped with a real browser (Playwright driving the
preinstalled Chromium). Contributes the thing the registry does not have:
**website URLs**, plus ratings and a citable place URL. Maps also surfaces
businesses with no registry match at all.

**3. Practice websites** — fetched to extract published contact emails.

### Note on Google Maps

Scraping Maps is against Google's Terms of Service. It is standard practice in
B2B lead generation and Google Maps was already listed as a source in the
original brief, so it is included here — but it is your commercial call, and
worth knowing rather than discovering later. The sanctioned alternative is the
Google Places API, which is paid and returns the same fields.

Google Maps carries **no email field**. Any tool promising emails "from Google
Maps" is really visiting each business's website and scraping it there — which
is exactly what this pipeline does.

---

## Deduplication

The user-visible rule: **one row per practice**. Matching runs in tiers:

1. **Phone** — the strongest key. Practices sharing a front desk collapse to
   one row, with `Locations On Phone` recording how many listings shared it.
2. **Street address + city + name overlap.**
3. **Street address + name overlap, ignoring city.** Maps infers city from the
   search query, so a neighbouring-town label must not block a real match.
4. Duplicate Maps listings for the same business are collapsed against each
   other before anything is added.

Verified after every build: zero duplicate phone numbers in the output.

---

## Sources on every row

Four provenance columns, so any lead can be traced back:

| Column | What it points to |
|---|---|
| `Source - Registry` | The practice's public NPPES provider record |
| `Source - Website` | The practice's own site |
| `Source - Google Maps` | The Google Maps place listing |
| `Source - Email Found On` | The exact page the email was taken from |

---

## The contact audit

Every email and phone number is screened. Results are colour-coded in the
workbook: green = usable, amber = check first, red = do not use.

### Emails

| Status | Meaning |
|---|---|
| `DELIVERABLE` | Domain resolves **and** publishes MX records — it is set up to receive mail |
| `RISKY` | Domain resolves but has no MX — mail will bounce |
| `DEAD` | Domain does not resolve |
| `INVALID` / `REJECT` | Malformed, or a disposable-mail domain |

Also recorded: `Mail Host` (Google Workspace, Microsoft 365, …) and
`Email Type` (role account like `info@`, free mailbox, or a named person).
Role accounts are the right target for cold outreach.

**What this does not prove:** that a specific mailbox exists. Confirming that
needs an SMTP probe on port 25, which this environment cannot make (egress is
HTTPS-only) and which damages sender reputation when done at volume. A
`DELIVERABLE` result means the domain accepts mail, not that the address is
guaranteed live.

One trap worth knowing: a typo domain like `gamil.com` is a real registered
typosquat that **does** accept mail, so it passes an MX check. Those are caught
separately and marked in `Data Flag`.

### Phones

| Status | Meaning |
|---|---|
| `VALID` | A valid NANP number, area code consistent with the practice's state |
| `CHECK` | Valid, but the area code belongs to a different state — verify before dialling |
| `INVALID` | Not a dialable number |

`Phone Note` records how many independent sources agreed on the number.

**What this does not prove:** that the line is answered. That requires dialling
it. The strongest signal available here is corroboration — a number that
appears in the federal registry, on the practice's own website, and on its
Google Maps listing is about as good as it gets without picking up a phone.

### Record freshness

A practice that closes does not always get removed from NPPES, so the date the
registry record was last updated is a useful proxy:

- **Recent** — updated 2022 or later. Call these first.
- **Ageing** — 2015–2021.
- **Stale** — untouched since 2014. Expect more dead numbers.

---

## Trading name vs registered name

The registry holds the **legal entity** — "Forella And Donahue Dentistry LLC" —
while the practice actually trades as "Fairfield Dental Arts". Asking for the
legal name on a cold call sounds like a cold call.

Where Google Maps gave a different public name, it is in the **`Trading Name`**
column. That applies to **3,444 rows**. Use it for the opening line.

---

## How to work the list

Sorted so the best calls are at the top, freshest record first within each band.

- **Priority A** — general dentistry in CT and NY. The existing beachhead plus
  the requested expansion.
- **Priority B** — general dentistry in the other six states.
- **Priority C** — specialty practices (ortho, oral surgery, pedo, endo, perio).
- **Priority D** — Google Maps listings with no registry match. Real businesses,
  but thinner data: no owner name, and the city is inferred from the search.

---

## Rebuilding

```bash
python3 harvest_nppes.py        # organisational dental records
python3 harvest_individuals.py  # solo and associate dentists
python3 normalize.py            # clean, classify, dedupe by phone
python3 normalize_indiv.py      # fold individuals in
python3 endpoints.py            # emails filed in the registry itself

cd /tmp/gmscrape                # Google Maps (needs the Chromium flags below)
node scrape.js queries_all.txt maps_0.json

./finalize.sh                   # parse, merge, extract emails, audit, export
```

To add states or cities, edit `TARGETS` in `harvest_nppes.py`. Everything
downstream keys on NPI, so it stays aligned.

**One environment note:** Chromium must be launched with post-quantum key
agreement and ECH disabled (`--disable-features=PostQuantumKyber,
EncryptedClientHello,TLS13KyberSupport`). Chrome's larger ClientHello was
being reset by the egress proxy. TLS verification itself is untouched.

---

## Compliance

Public data on **businesses**, gathered for B2B outreach: practice names,
business addresses, business phone numbers, published business emails and the
owner's professional name. No patient data.

- **Calls.** B2B calls sit outside most Do Not Call rules, but several of these
  states regulate commercial calling. Worth checking before a high-volume dial
  campaign.
- **Email.** CAN-SPAM applies: accurate headers, a real physical address, and a
  working opt-out on every send. Prefer the `Role account` rows — those
  addresses are published for business contact.

Hudson has just been on the receiving end of exactly this kind of outreach via
Apollo. Keeping volume sane and targeting tight is the commercially smarter
play as well as the safer one.
