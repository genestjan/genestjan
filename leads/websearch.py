#!/usr/bin/env python3
"""Find a practice's real website via search engine, then verify by phone."""
import re, time, random, warnings
from urllib.parse import quote_plus, urlparse, unquote
import requests
warnings.filterwarnings("ignore")
requests.packages.urllib3.disable_warnings()

UAS = [
 "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36",
 "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
 "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
]
# Aggregators: useful for confirming a practice exists, useless as "their website"
AGG = re.compile(r"(yelp|zocdoc|healthgrades|vitals|facebook|instagram|linkedin|"
                 r"yellowpages|mapquest|bbb\.org|indeed|glassdoor|opencare|"
                 r"wellness\.com|dentist\.com|smilegeneration|birdeye|nextdoor|"
                 r"npino|npidb|hipaaspace|doctor\.com|ratemds|sharecare|webmd|"
                 r"tiktok|youtube|twitter|x\.com|pinterest|apple\.com|google\.|"
                 r"bing\.com|amazon|wikipedia|tripadvisor|angi\.com|thumbtack|"
                 r"care\.com|dexknows|superpages|manta|chamberofcommerce|"
                 r"buzzfile|zoominfo|apollo\.io|crunchbase|dnb\.com|bizapedia|"
                 r"npiprofile|medicare\.gov|cms\.gov|zippia|trustpilot)", re.I)


def bing(query, tries=3):
    url = "https://www.bing.com/search?q=" + quote_plus(query) + "&count=20&setlang=en-US&cc=US"
    for a in range(tries):
        try:
            r = requests.get(url, headers={
                "User-Agent": random.choice(UAS),
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Language": "en-US,en;q=0.9",
            }, timeout=20, verify=False)
            if r.status_code == 200 and len(r.text) > 5000:
                return r.text
        except requests.RequestException:
            pass
        time.sleep(1.5 * (a + 1))
    return ""


def result_domains(html, limit=10):
    """Pull candidate practice domains out of a Bing SERP, in rank order."""
    doms, seen = [], set()
    raw = re.findall(r'<h2[^>]*>\s*<a[^>]+href="(https?://[^"]+)"', html)
    raw += re.findall(r'<cite[^>]*>(.*?)</cite>', html)
    for item in raw:
        u = re.sub(r"<[^>]+>", "", item).strip()
        u = unquote(u).split(" ")[0]
        u = u.replace(" › ", "/").replace("›", "/")
        if not u.startswith("http"):
            u = "https://" + u
        try:
            host = urlparse(u).netloc.lower().replace("www.", "")
        except Exception:
            continue
        if not host or "." not in host or AGG.search(host) or host in seen:
            continue
        seen.add(host)
        doms.append(host)
        if len(doms) >= limit:
            break
    return doms


def find_site(lead):
    q = f'"{lead["practice_name"]}" {lead["city"]} {lead["state"]} dentist'
    return result_domains(bing(q))


if __name__ == "__main__":
    import json
    leads = json.loads(open("leads_base.json").read())
    for l in leads[::900][:6]:
        print(f"\n{l['practice_name']} | {l['city']}, {l['state']} | {l['phone']}")
        for d in find_site(l)[:6]:
            print("   ", d)
        time.sleep(1)
