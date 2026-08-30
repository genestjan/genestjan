#!/usr/bin/env python3
"""
Pull contact emails from websites we already know belong to a business.

Unlike the domain-guessing pass, the input URLs here come from the business's
own Google Maps listing, so provenance is already established -- the job is
just to find a published address and record the exact page it came from.
"""
import json, re, sys, time, warnings
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import enrich as E

warnings.filterwarnings("ignore")
HERE = Path(__file__).parent
PATHS = ["", "/contact", "/contact-us", "/contact.html", "/contact-us.html",
         "/about/contact", "/about-us", "/appointments", "/new-patients"]


def scrape_site(url):
    """Return (email, alt_emails, page_url_it_came_from)."""
    if not url.startswith("http"):
        url = "https://" + url
    base = url.rstrip("/")
    dom = re.sub(r"^https?://", "", base).split("/")[0]
    # If the homepage doesn't answer the host is down -- don't burn eight more
    # timeouts walking contact paths that cannot exist.
    home, final = E.get(base, timeout=10)
    if not home:
        return "", "", ""
    if E.PARKED.search(home[:6000]):
        return "", "", ""
    mails = E.emails_from(home, dom)
    if mails:
        return mails[0], ", ".join(mails[1:3]), final
    root = final.rstrip("/")
    for pth in PATHS[1:5]:
        html, fin = E.get(root + pth, timeout=10)
        if not html:
            continue
        mails = E.emails_from(html, dom)
        if mails:
            return mails[0], ", ".join(mails[1:3]), fin
    return "", "", final


def main():
    infile = sys.argv[1] if len(sys.argv) > 1 else "sites_todo.json"
    outfile = sys.argv[2] if len(sys.argv) > 2 else "site_emails.json"
    todo = json.loads((HERE / infile).read_text())
    print(f"scraping {len(todo)} known websites for emails", flush=True)

    out, t0 = {}, time.time()
    with ThreadPoolExecutor(max_workers=60) as ex:
        futs = {ex.submit(scrape_site, t["website"]): t for t in todo}
        for i, f in enumerate(as_completed(futs), 1):
            t = futs[f]
            try:
                em, alt, page = f.result()
            except Exception:
                em, alt, page = "", "", ""
            if em:
                out[t["key"]] = {"email": em, "alt_emails": alt, "email_page": page}
            if i % 200 == 0 or i == len(todo):
                print(f"  {i}/{len(todo)} emails={len(out)} ({time.time()-t0:.0f}s)",
                      flush=True)
                (HERE / outfile).write_text(json.dumps(out, indent=1))
    (HERE / outfile).write_text(json.dumps(out, indent=1))
    print(f"\nfound {len(out)} emails from {len(todo)} sites "
          f"({100*len(out)//max(len(todo),1)}%) -> {outfile}")


if __name__ == "__main__":
    main()
