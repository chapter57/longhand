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
import urllib.parse
import urllib.request

import yaml

OUT = ".github/instagram/portraits"
UA = {"User-Agent": "LonghandAlmanac/1.0 (https://longhandlit.com; longhandlit@gmail.com)"}


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read()


def plain(html):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", html or "")).strip()


os.makedirs(OUT, exist_ok=True)
credits = {}
for path in sorted(glob.glob("_almanac/*.md")):
    e = yaml.safe_load(open(path, encoding="utf-8").read().split("---", 2)[1])
    key = f"{e['month']}-{e['day']}"
    if not e.get("portrait"):
        continue
    try:
        summary = json.loads(get("https://en.wikipedia.org/api/rest_v1/page/summary/"
                                 + urllib.parse.quote(e["portrait"], safe="")))
        original = (summary.get("originalimage") or {}).get("source", "")
        thumb = (summary.get("thumbnail") or {}).get("source", "")
        if "/wikipedia/commons/" not in original:
            print(key, "no Commons picture")
            continue
        data = None
        if thumb and (summary["originalimage"].get("width") or 0) > 1080:
            try:
                data = get(re.sub(r"/\d+px-([^/]+)$", r"/1080px-\1", thumb))
            except Exception:
                data = None
        data = data or get(original)
        name = urllib.parse.unquote(original.rsplit("/", 1)[1])
        info = json.loads(get("https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo"
                              "&iiprop=extmetadata&titles=" + urllib.parse.quote("File:" + name)))
        meta = next(iter(info["query"]["pages"].values()))["imageinfo"][0]["extmetadata"]
        ext = os.path.splitext(name)[1].lower()
        file = f"{key}{'.jpg' if ext in ('.jpg', '.jpeg') else ext}"
        open(os.path.join(OUT, file), "wb").write(data)
        credits[key] = {"file": file, "commons": "File:" + name, "pictured": e.get("pictured") or e["name"],
                        "artist": plain(meta.get("Artist", {}).get("value")),
                        "license": plain(meta.get("LicenseShortName", {}).get("value")),
                        "date": plain(meta.get("DateTimeOriginal", {}).get("value"))}
        print(key, "saved", file)
    except Exception as err:
        print(key, "failed:", err)
yaml.safe_dump(credits, open(os.path.join(OUT, "credits.yml"), "w", encoding="utf-8"),
               allow_unicode=True, sort_keys=True, width=1000)
