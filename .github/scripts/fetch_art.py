"""Finds public-domain prints on Wikimedia Commons for the searches in
.github/art/wanted.yml and saves the best few of each, at 1600 pixels wide,
in .github/art/found/<name>/, with credits.yml (title, maker, date, license,
page). Files that aren't clearly public domain are skipped."""
import json, os, re, urllib.parse, urllib.request
import yaml

API = "https://commons.wikimedia.org/w/api.php"
UA = "LonghandArtFetcher/1.0 (https://longhandlit.com)"
PER = 6


def get(params):
    url = API + "?" + urllib.parse.urlencode({**params, "format": "json"})
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def plain(html):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", html or "")).strip()


wanted = yaml.safe_load(open(".github/art/wanted.yml")) or {}
for name, query in wanted.items():
    out = f".github/art/found/{name}"
    if os.path.exists(f"{out}/credits.yml"):
        continue
    os.makedirs(out, exist_ok=True)
    found = get({"action": "query", "generator": "search", "gsrsearch": f"filetype:bitmap {query}",
                 "gsrnamespace": 6, "gsrlimit": 30, "prop": "imageinfo",
                 "iiprop": "url|extmetadata|size", "iiurlwidth": 1600})
    pages = sorted(found.get("query", {}).get("pages", {}).values(), key=lambda p: p.get("index", 99))
    credits = []
    for p in pages:
        if len(credits) >= PER:
            break
        info = (p.get("imageinfo") or [{}])[0]
        meta = info.get("extmetadata", {})
        lic = plain(meta.get("LicenseShortName", {}).get("value"))
        if not re.search(r"public domain|^pd|cc0", lic, re.I):
            continue
        if info.get("width", 0) < 600:
            continue
        src = info.get("thumburl") or info.get("url")
        ext = os.path.splitext(urllib.parse.urlparse(src).path)[1].lower() or ".jpg"
        fn = f"{len(credits) + 1}{ext}"
        req = urllib.request.Request(src, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=120) as r, open(f"{out}/{fn}", "wb") as f:
            f.write(r.read())
        credits.append({"file": fn, "title": p["title"], "artist": plain(meta.get("Artist", {}).get("value"))[:200],
                        "date": plain(meta.get("DateTimeOriginal", {}).get("value"))[:80], "license": lic,
                        "page": info.get("descriptionurl")})
        print(name, fn, p["title"], lic)
    yaml.safe_dump(credits, open(f"{out}/credits.yml", "w"), allow_unicode=True, sort_keys=False)
