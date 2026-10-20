"""Downloads each almanac entry's portrait, for drawing Instagram slides.

The same picture the site shows: the lead image of the entry's Wikipedia
article, when it is a freely licensed file on Wikimedia Commons. Saves
.github/instagram/portraits/<month>-<day>.jpg and the maker and license of
each in .github/instagram/portraits/credits.yml. Run by
.github/workflows/fetch-portraits.yml.
"""
import glob
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request

import yaml

OUT = ".github/instagram/portraits"
UA = {"User-Agent": "LonghandAlmanac/1.0 (https://longhandlit.com; hello@longhandlit.com)"}


def get(url):
    # Wikimedia turns away fast or repeated requests, so go slowly and wait when asked.
    for wait in (5, 20, 60, 120):
        time.sleep(1.5)
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
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
for path in sorted(glob.glob("_almanac/*.md")):
    e = yaml.safe_load(open(path, encoding="utf-8").read().split("---", 2)[1])
    key = f"{e['month']}-{e['day']}"
    if not e.get("portrait") or (credits.get(key) or {}).get("license"):
        continue
    try:
        summary = json.loads(get("https://en.wikipedia.org/api/rest_v1/page/summary/"
                                 + urllib.parse.quote(e["portrait"], safe="")))
        original = (summary.get("originalimage") or {}).get("source", "")
        thumb = (summary.get("thumbnail") or {}).get("source", "")
        if "/wikipedia/commons/" not in original:
            print(key, "no Commons picture")
            continue
        name = urllib.parse.unquote(original.split("?")[0].rsplit("/", 1)[1])
        done = credits.get(key, {}).get("file")
        data = open(os.path.join(OUT, done), "rb").read() if done and os.path.exists(os.path.join(OUT, done)) else None
        if not data and thumb and (summary["originalimage"].get("width") or 0) > 960:
            try:
                data = get(re.sub(r"/\d+px-([^/]+)$", r"/960px-\1", thumb))
            except Exception:
                data = None
        data = data or get(original)
        file = key + (".jpg" if data[:2] == b"\xff\xd8" else ".png" if data[:4] == b"\x89PNG" else ".img")
        open(os.path.join(OUT, file), "wb").write(data)
        meta, info = {}, None
        try:
            info = json.loads(get("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({
                "action": "query", "format": "json", "formatversion": "2", "prop": "imageinfo",
                "iiprop": "extmetadata", "titles": "File:" + name})))
            meta = info["query"]["pages"][0]["imageinfo"][0]["extmetadata"]
        except Exception as err:
            print(key, "no credit details:", err, str(info)[:300])
        credits[key] = {"file": file, "commons": "File:" + name, "pictured": e.get("pictured") or e["name"],
                        "artist": plain(meta.get("Artist", {}).get("value")),
                        "license": plain(meta.get("LicenseShortName", {}).get("value")),
                        "date": plain(meta.get("DateTimeOriginal", {}).get("value"))}
        print(key, "saved", file)
    except Exception as err:
        print(key, "failed:", err)
yaml.safe_dump(credits, open(os.path.join(OUT, "credits.yml"), "w", encoding="utf-8"),
               allow_unicode=True, sort_keys=True, width=1000)
