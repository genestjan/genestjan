#!/usr/bin/env python3
"""
Find + VERIFY each practice's website, then pull contact emails.

Nothing is accepted on a name match alone. A domain is only attached to a
practice if the fetched page carries that practice's NPPES phone number or its
street address. Anything else is discarded -- a wrong number in a call list is
worse than a blank cell.
"""
import json, re, socket, sys, time, warnings
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
from domainize import candidates

warnings.filterwarnings("ignore")
requests.packages.urllib3.disable_warnings()

HERE = Path(__file__).parent
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
BAD_EMAIL = re.compile(
    r"(sentry|wix|godaddy|squarespace|\.png|\.jpg|\.jpeg|\.gif|\.webp|\.svg|"
    r"example\.|domain\.com|email\.com|yourname|test@|noreply|no-reply|"
    r"sample@|placeholder|@2x|core-js|jquery|bootstrap|schema\.org|"
    r"\.js$|\.css$|user@|name@|abc@|xyz@)", re.I)
PARKED = re.compile(
    r"(domain (is )?(for sale|may be for sale)|buy this domain|godaddy\.com/"
    r"domainsearch|parked (free )?(by|at)|sedoparking|hugedomains|afternic|"
    r"this domain is available|namecheap.*parking|under construction)", re.I)


def digits(s):
    return re.sub(r"\D", "", s or "")


def resolve(domain):
    try:
        socket.setdefaulttimeout(4)
        socket.getaddrinfo(domain, 443, proto=socket.IPPROTO_TCP)
        return True
    except Exception:
        return False


def get(url, timeout=12):
    try:
        r = requests.get(url, headers={"User-Agent": UA,
                                       "Accept-Language": "en-US,en;q=0.9"},
                         timeout=timeout, verify=False, allow_redirects=True)
        ct = r.headers.get("Content-Type", "")
        if r.status_code == 200 and "html" in ct.lower() and len(r.text) > 400:
            return r.text, r.url
    except Exception:
        pass
    return None, None


def text_of(html):
    t = re.sub(r"<script.*?</script>", " ", html, flags=re.S | re.I)
    t = re.sub(r"<style.*?</style>", " ", t, flags=re.S | re.I)
    return re.sub(r"<[^>]+>", " ", t)


def searchable(html):
    """Visible text PLUS tel:/JSON-LD payloads, where dental sites hide phones."""
    body = text_of(html)
    tel = " ".join(re.findall(r'tel:([+0-9().\- ]{7,20})', html, re.I))
    ld = " ".join(re.findall(r'"telephone"\s*:\s*"([^"]+)"', html, re.I))
    ld += " " + " ".join(re.findall(r'"(?:streetAddress|addressLocality)"\s*:\s*"([^"]+)"', html, re.I))
    return body + " " + tel + " " + ld


def verify(html, lead):
    """Return match strength: 'phone', 'address', or None."""
    if PARKED.search(html[:6000]):
        return None
    body = searchable(html)
    flat = digits(body)
    if digits(lead["phone"]) and digits(lead["phone"]) in flat:
        return "phone"
    # street address: number + first real street word
    parts = lead["address"].split()
    if len(parts) >= 2 and parts[0].isdigit():
        street = re.sub(r"[^a-z]", "", parts[1].lower())
        low = body.lower()
        if len(street) >= 3 and parts[0] in low and street in low:
            if lead["city"].lower() in low:
                return "address"
    return None


def emails_from(html, domain):
    found, base = [], domain.replace("www.", "").lower()
    for m in re.findall(r'mailto:([^"\'>?\s&]+)', html) + EMAIL_RE.findall(text_of(html)):
        e = m.strip().strip(".,;:").lower()
        if not EMAIL_RE.fullmatch(e) or BAD_EMAIL.search(e) or len(e) > 60:
            continue
        if e not in found:
            found.append(e)
    # prefer an address on the practice's own domain
    own = [e for e in found if base.split(".")[0] in e.split("@")[1]]
    ranked = own or found
    pri = ("info@", "contact@", "office@", "hello@", "frontdesk@", "reception@",
           "smile@", "appointments@", "admin@")
    ranked.sort(key=lambda e: (0, pri.index(next((p for p in pri if e.startswith(p)), "")))
                if any(e.startswith(p) for p in pri) else (1, 0))
    return ranked[:3]


CONTACT_PATHS = ["", "/contact", "/contact-us", "/contact.html", "/about/contact",
                 "/contact-us.html", "/about-us"]


def work(lead):
    for dom in candidates(lead["practice_name"], lead["city"]):
        if not resolve(dom):
            continue
        html, final = get(f"https://{dom}") 
        if not html:
            html, final = get(f"http://{dom}")
        if not html:
            continue
        strength = verify(html, lead)
        pages = [html]
        if not strength:
            # phone is frequently only on the contact page -- look before rejecting
            for cp in CONTACT_PATHS[1:4]:
                h2, _ = get(final.rstrip("/") + cp, timeout=10)
                if h2:
                    pages.append(h2)
                    strength = verify(h2, lead)
                    if strength:
                        break
        if not strength:
            continue
        # confirmed this practice -- now hunt for an email
        mails = []
        for pg in pages:
            mails = emails_from(pg, dom)
            if mails:
                break
        if not mails:
            for cp in CONTACT_PATHS[1:]:
                h2, _ = get(final.rstrip("/") + cp, timeout=10)
                if h2:
                    mails = emails_from(h2, dom)
                    if mails:
                        break
        return {"npi": lead["npi"], "website": final.rstrip("/"),
                "email": mails[0] if mails else "",
                "alt_emails": ", ".join(mails[1:]),
                "verified_by": strength}
    return {"npi": lead["npi"], "website": "", "email": "",
            "alt_emails": "", "verified_by": ""}


def main():
    leads = json.loads((HERE / "leads_base.json").read_text())
    sample = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    outfile = HERE / (sys.argv[2] if len(sys.argv) > 2 else "enriched.json")
    if sample:
        step = max(1, len(leads) // sample)
        leads = leads[::step][:sample]

    done, t0 = [], time.time()
    with ThreadPoolExecutor(max_workers=40) as ex:
        futs = {ex.submit(work, l): l for l in leads}
        for i, f in enumerate(as_completed(futs), 1):
            try:
                done.append(f.result())
            except Exception:
                pass
            if i % 25 == 0 or i == len(leads):
                sites = sum(1 for d in done if d["website"])
                mails = sum(1 for d in done if d["email"])
                print(f"  {i}/{len(leads)}  sites={sites} emails={mails} "
                      f"({time.time()-t0:.0f}s)", flush=True)
    outfile.write_text(json.dumps(done, indent=1))
    s = sum(1 for d in done if d["website"]); m = sum(1 for d in done if d["email"])
    print(f"\nRESULT  {len(done)} checked | website {s} ({100*s//max(len(done),1)}%) "
          f"| email {m} ({100*m//max(len(done),1)}%) -> {outfile}")


if __name__ == "__main__":
    main()
