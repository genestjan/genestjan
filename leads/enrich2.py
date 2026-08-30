#!/usr/bin/env python3
"""Second pass: retry the practices pass 1 could not place, with a wider net.
Same strict verification -- only the candidate list grows."""
import json, time, warnings
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import enrich as E
from domainize2 import candidates2

warnings.filterwarnings("ignore")
HERE = Path(__file__).parent


def work(lead):
    for dom in candidates2(lead["practice_name"], lead["city"], lead["state"]):
        if not E.resolve(dom):
            continue
        html, final = E.get(f"https://{dom}")
        if not html:
            html, final = E.get(f"http://{dom}")
        if not html:
            continue
        strength = E.verify(html, lead)
        pages = [html]
        if not strength:
            for cp in E.CONTACT_PATHS[1:4]:
                h2, _ = E.get(final.rstrip("/") + cp, timeout=10)
                if h2:
                    pages.append(h2)
                    strength = E.verify(h2, lead)
                    if strength:
                        break
        if not strength:
            continue
        mails = []
        for pg in pages:
            mails = E.emails_from(pg, dom)
            if mails:
                break
        if not mails:
            for cp in E.CONTACT_PATHS[1:]:
                h2, _ = E.get(final.rstrip("/") + cp, timeout=10)
                if h2:
                    mails = E.emails_from(h2, dom)
                    if mails:
                        break
        return {"npi": lead["npi"], "website": final.rstrip("/"),
                "email": mails[0] if mails else "",
                "alt_emails": ", ".join(mails[1:]), "verified_by": strength}
    return None


def main():
    leads = {l["npi"]: l for l in json.loads((HERE / "leads_base.json").read_text())}
    p1 = json.loads((HERE / "enriched.json").read_text())
    hits = {e["npi"]: e for e in p1 if e.get("website")}
    todo = [leads[n] for e in p1 if not e.get("website")
            for n in [e["npi"]] if n in leads]
    print(f"pass 1 placed {len(hits)}; retrying {len(todo)} with wider net", flush=True)

    t0 = time.time()
    with ThreadPoolExecutor(max_workers=40) as ex:
        futs = {ex.submit(work, l): l for l in todo}
        for i, f in enumerate(as_completed(futs), 1):
            try:
                r = f.result()
                if r:
                    hits[r["npi"]] = r
            except Exception:
                pass
            if i % 200 == 0 or i == len(todo):
                m = sum(1 for v in hits.values() if v.get("email"))
                print(f"  {i}/{len(todo)}  total sites={len(hits)} emails={m} "
                      f"({time.time()-t0:.0f}s)", flush=True)

    merged = [hits.get(n, {"npi": n, "website": "", "email": "",
                           "alt_emails": "", "verified_by": ""}) for n in leads]
    (HERE / "enriched.json").write_text(json.dumps(merged, indent=1))
    s = sum(1 for d in merged if d["website"]); m = sum(1 for d in merged if d["email"])
    print(f"\nCOMBINED: websites {s} ({100*s//len(merged)}%), emails {m} ({100*m//len(merged)}%)")


if __name__ == "__main__":
    main()
