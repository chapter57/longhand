"""Downloads the calendar's portraits from Wikimedia Commons.

For each month in the calendar's data file, the lead picture of the writer's
Wikipedia article (or the Commons file named in "commons"), as large as
Commons has it, up to 3000 pixels wide, for printing. Saves
.github/calendar/portraits/<portrait>.jpg and each picture's maker and license
in credits.yml there. Only public-domain and Creative Commons pictures are
kept. Run by .github/workflows/fetch-portraits.yml.

    python .github/calendar/fetch.py .github/calendar/2027.yml
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

import yaml

OUT = ".github/calendar/portraits"
UA = {"User-Agent": "LonghandAlmanac/1.0 (https://longhandlit.com; hello@longhandlit.com)"}
API = "https://commons.wikimedia.org/w/api.php?"


def get(url):
    # Wikimedia turns away fast or repeated requests, so go slowly and wait when asked.
    for wait in (5, 20, 60, 120):
        time.sleep(1.5)
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
                return r.read()
        except urllib.error.HTTPError as err:
            if err.code != 429:
                raise
            time.sleep(wait)
    raise RuntimeError("Wikimedia kept saying to slow down")


def plain(html):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", html or "")).strip()


os.makedirs(OUT, exist_ok=True)
saved = os.path.join(OUT, "credits.yml")
credits = (yaml.safe_load(open(saved, encoding="utf-8")) or {}) if os.path.exists(saved) else {}
for m in yaml.safe_load(open(sys.argv[1], encoding="utf-8"))["months"]:
    key = m["portrait"]
    try:
        name = m.get("commons", "").removeprefix("File:")
        if not name:
            summary = json.loads(get("https://en.wikipedia.org/api/rest_v1/page/summary/"
                                     + urllib.parse.quote(m["wiki"], safe="")))
            original = (summary.get("originalimage") or {}).get("source", "")
            if "/wikipedia/commons/" not in original:
                print(key, "no Commons picture on", m["wiki"])
                continue
            name = urllib.parse.unquote(original.split("?")[0].rsplit("/", 1)[1])
        if (credits.get(key) or {}).get("commons") == "File:" + name and os.path.exists(os.path.join(OUT, credits[key]["file"])):
            continue
        info = json.loads(get(API + urllib.parse.urlencode({
            "action": "query", "format": "json", "formatversion": "2", "prop": "imageinfo",
            "iiprop": "url|size|extmetadata", "iiurlwidth": "3000", "titles": "File:" + name})))
        ii = info["query"]["pages"][0]["imageinfo"][0]
        meta = ii.get("extmetadata", {})
        lic = plain(meta.get("LicenseShortName", {}).get("value"))
        if not re.search(r"public domain|^pd|cc0|^cc[ -]by", lic, re.I):
            print(key, "skipped, not freely licensed:", name, lic)
            continue
        url = ii["thumburl"] if ii.get("width", 0) > 3000 and ii.get("thumburl") else ii["url"]
        data = get(url)
        file = key + (".jpg" if data[:2] == b"\xff\xd8" else ".png" if data[:4] == b"\x89PNG" else ".img")
        for old in os.listdir(OUT):
            if old.startswith(key + ".") and old != file:
                os.remove(os.path.join(OUT, old))
        open(os.path.join(OUT, file), "wb").write(data)
        credits[key] = {"file": file, "commons": "File:" + name, "pictured": m["by"].split(" · ")[0],
                        "artist": plain(meta.get("Artist", {}).get("value")), "license": lic,
                        "date": plain(meta.get("DateTimeOriginal", {}).get("value")),
                        "size": f"{min(ii.get('width', 0), 3000)} wide"}
        print(key, "saved", name, lic)
    except Exception as err:
        print(key, "failed:", err)
yaml.safe_dump(credits, open(saved, "w", encoding="utf-8"), allow_unicode=True, sort_keys=True, width=1000)
