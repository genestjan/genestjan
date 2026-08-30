#!/usr/bin/env python3
"""
Screen every email and phone number for whether it can actually be used.

What this CAN establish:
  email  - syntax, the domain resolves, and the domain publishes MX records
           (i.e. it is set up to receive mail at all)
  phone  - valid NANP number, and the area code really belongs to the state
           the practice sits in; how many independent sources agree on it

What this CANNOT establish, and is never claimed:
  email  - that a specific mailbox exists. That needs an SMTP probe on port 25,
           which this environment cannot make (HTTPS-only egress), and which
           damages sender reputation when done at volume.
  phone  - that a line is answered. That needs dialling it.
"""
import json, re, socket, sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import dns.resolver

HERE = Path(__file__).parent

AREA = {
 "CT": {"203","475","860","959"},
 "NY": {"212","315","332","347","363","516","518","585","607","631","646","680",
        "716","718","838","845","914","917","929","934"},
 "RI": {"401"},
 "MA": {"339","351","413","508","617","774","781","857","978"},
 "MD": {"227","240","301","410","443","667"},
 "ME": {"207"},
 "VT": {"802"},
 "VA": {"276","434","540","571","703","757","804","826","948"},
}
TOLLFREE = {"800","833","844","855","866","877","888"}
ROLE = ("info@","contact@","office@","hello@","admin@","frontdesk@","reception@",
        "appointments@","smile@","team@","mail@","help@","support@","staff@","care@")
DISPOSABLE = {"mailinator.com","guerrillamail.com","10minutemail.com","tempmail.com",
              "throwawaymail.com","yopmail.com","trashmail.com"}
FREEMAIL = {"gmail.com","yahoo.com","hotmail.com","outlook.com","aol.com","icloud.com",
            "comcast.net","verizon.net","msn.com","live.com","sbcglobal.net","att.net"}
EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")

_res = dns.resolver.Resolver()
_res.timeout, _res.lifetime = 5, 6
_cache = {}


def domain_check(dom):
    """(resolves, has_mx, provider)"""
    if dom in _cache:
        return _cache[dom]
    has_a = has_mx = False
    provider = ""
    try:
        socket.setdefaulttimeout(5)
        socket.getaddrinfo(dom, None)
        has_a = True
    except Exception:
        pass
    try:
        ans = _res.resolve(dom, "MX")
        hosts = [str(r.exchange).rstrip(".").lower() for r in ans]
        if hosts:
            has_mx = True
            h = " ".join(hosts)
            provider = ("Google Workspace" if "google" in h else
                        "Microsoft 365" if "outlook" in h or "protection.office" in h else
                        "Proofpoint" if "pphosted" in h else
                        "Barracuda" if "barracuda" in h else
                        "GoDaddy" if "secureserver" in h else
                        "Other")
    except Exception:
        pass
    _cache[dom] = (has_a, has_mx, provider)
    return _cache[dom]


def audit_email(email):
    if not email:
        return {"email_status": "", "email_detail": "", "mx_provider": "",
                "email_type": ""}
    e = email.strip().lower()
    if not EMAIL_RE.match(e):
        return {"email_status": "INVALID", "email_detail": "malformed address",
                "mx_provider": "", "email_type": ""}
    dom = e.split("@")[1]
    kind = ("Role account" if e.startswith(ROLE) else
            "Free mailbox" if dom in FREEMAIL else "Named/other")
    if dom in DISPOSABLE:
        return {"email_status": "REJECT", "email_detail": "disposable domain",
                "mx_provider": "", "email_type": kind}
    a, mx, prov = domain_check(dom)
    if mx:
        return {"email_status": "DELIVERABLE", "mx_provider": prov,
                "email_detail": "domain accepts mail (MX present)", "email_type": kind}
    if a:
        return {"email_status": "RISKY", "mx_provider": "",
                "email_detail": "domain resolves but publishes no MX", "email_type": kind}
    return {"email_status": "DEAD", "mx_provider": "",
            "email_detail": "domain does not resolve", "email_type": kind}


def audit_phone(phone, state, corroboration=1):
    d = re.sub(r"\D", "", phone or "")
    if len(d) != 10:
        return {"phone_status": "INVALID", "phone_detail": "not 10 digits"}
    npa, nxx = d[:3], d[3:6]
    if npa[0] in "01" or nxx[0] in "01":
        return {"phone_status": "INVALID", "phone_detail": "not a valid NANP number"}
    if npa in TOLLFREE:
        return {"phone_status": "VALID", "phone_detail": "toll-free (not a local line)"}
    if npa in AREA.get(state, set()):
        note = f"area code matches {state}"
        if corroboration >= 2:
            note += f"; confirmed by {corroboration} independent sources"
        return {"phone_status": "VALID", "phone_detail": note}
    owner = next((s for s, codes in AREA.items() if npa in codes), None)
    if owner:
        return {"phone_status": "CHECK",
                "phone_detail": f"area code {npa} belongs to {owner}, practice is in {state}"}
    return {"phone_status": "VALID", "phone_detail": f"area code {npa} outside target states"}


def run(rows, email_key="email", phone_key="phone", state_key="state",
        corro_key=None):
    doms = {r[email_key].split("@")[1].lower() for r in rows
            if r.get(email_key) and "@" in r[email_key]}
    print(f"  resolving {len(doms)} distinct email domains...", flush=True)
    with ThreadPoolExecutor(max_workers=30) as ex:
        list(ex.map(domain_check, doms))
    out = []
    for r in rows:
        a = audit_email(r.get(email_key, ""))
        a.update(audit_phone(r.get(phone_key, ""), r.get(state_key, ""),
                             r.get(corro_key, 1) if corro_key else 1))
        out.append(a)
    return out


if __name__ == "__main__":
    print(audit_email("info@steinhofdental.com"))
    print(audit_email("drfsanchezdentalarts@gamil.com"))
    print(audit_phone("(203) 367-0400", "CT"))
    print(audit_phone("(802) 555-1234", "CT"))
