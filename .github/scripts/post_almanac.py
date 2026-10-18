"""Posts today's almanac entry to Bluesky and Mastodon.

Run every morning by .github/workflows/post-almanac.yml. Reads the entry for
today's date (New York time) from _almanac/, and posts its short note with a
link to its full page on the site. A platform whose secrets aren't set is
skipped.

Settings, all from the environment:
  BLUESKY_HANDLE, BLUESKY_APP_PASSWORD     e.g. longhandlit.bsky.social
  MASTODON_INSTANCE, MASTODON_TOKEN        e.g. https://mastodon.social
  ALMANAC_DATE                             optional, "MM-DD", to post another day
  DRY_RUN                                  "true" to print the posts, not send them
  POSTED_DIR                               optional folder that remembers which accounts
                                           already posted today, so a second run skips them
"""
import datetime
import glob
import json
import os
import re
import sys
import urllib.error
import urllib.request
from zoneinfo import ZoneInfo

import yaml

SITE = "https://longhandlit.com"
BLUESKY_LIMIT = 300
MASTODON_LIMIT = 500
HASHTAGS = "#OnThisDay #Books #Literature #Poetry"


def read_entries():
    entries = []
    for path in glob.glob("_almanac/*.md"):
        text = open(path, encoding="utf-8").read()
        _, front, body = text.split("---", 2)
        e = yaml.safe_load(front)
        e["url"] = SITE + "/almanac/" + os.path.basename(path)[:-3] + "/"
        entries.append(e)
    return entries


def headline(e):
    lead = {
        "Born": "Born on this day in {year}: {name}.",
        "Died": "Died on this day in {year}: {name}.",
        "Published": "Published on this day in {year}: {name}.",
    }.get(e["kind"], "On this day in {year}: {name}.")
    year = f"{-e['year']} BC" if e["year"] < 0 else e["year"]
    return lead.format(year=year, name=e["name"])


def fit(text, limit):
    """Shortens text to at most limit characters, keeping whole sentences if it can."""
    text = " ".join(str(text).split())
    if len(text) <= limit:
        return text
    # A sentence ends at a period after a word, not after an initial like "E. M."
    sentences = re.split(r'(?<=[a-z0-9)]\.)\s+|(?<=\.["”])\s+', text)
    kept = ""
    for sentence in sentences:
        joined = (kept + " " + sentence).strip()
        if len(joined) > limit:
            break
        kept = joined
    if kept:
        return kept
    cut = text[:limit - 1]
    return cut[:cut.rfind(" ")] + "…"


def request(url, data=None, headers=None, method=None):
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, method=method, headers={
        "Content-Type": "application/json", "User-Agent": "LonghandAlmanac/1.0 (" + SITE + ")", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as err:
        raise SystemExit(f"{url} answered {err.code}: {err.read().decode(errors='replace')[:500]}")


def post_bluesky(e, dry):
    # The link goes in a card under the post, so the words get the whole limit.
    top = headline(e)
    text = top + "\n\n" + fit(e["note"], BLUESKY_LIMIT - len(top) - 2)
    card = {"$type": "app.bsky.embed.external", "external": {
        "uri": e["url"], "title": e["name"] + " · The Longhand Almanac", "description": fit(e["note"], 280)}}
    if dry:
        print("--- Bluesky ---\n" + text + "\n[card] " + e["url"])
        return
    handle, password = os.environ.get("BLUESKY_HANDLE"), os.environ.get("BLUESKY_APP_PASSWORD")
    if not handle or not password:
        print("Bluesky: no handle or app password set, skipping.")
        return
    api = "https://bsky.social/xrpc/"
    session = request(api + "com.atproto.server.createSession", {"identifier": handle, "password": password})
    auth = {"Authorization": "Bearer " + session["accessJwt"]}
    # Don't post the same entry twice: look for it among the account's recent posts.
    feed = request(api + "app.bsky.feed.getAuthorFeed?limit=30&actor=" + session["did"], headers=auth)
    recent = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=2)
    for item in feed.get("feed", []):
        rec = item.get("post", {}).get("record", {})
        uri = rec.get("embed", {}).get("external", {}).get("uri")
        when = datetime.datetime.fromisoformat(rec.get("createdAt", "1970-01-01T00:00:00Z").replace("Z", "+00:00"))
        if uri == e["url"] and when > recent:
            print("Bluesky: already posted, skipping.")
            return
    record = {"$type": "app.bsky.feed.post", "text": text, "langs": ["en"], "embed": card,
              "createdAt": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")}
    out = request(api + "com.atproto.repo.createRecord",
                  {"repo": session["did"], "collection": "app.bsky.feed.post", "record": record}, auth)
    print("Bluesky: posted", out.get("uri"))


def post_mastodon(e, dry):
    top, link = headline(e), e["url"]
    # Mastodon counts every link as 23 characters.
    room = MASTODON_LIMIT - len(top) - 23 - len(HASHTAGS) - 6
    text = f"{top}\n\n{fit(e['note'], room)}\n\n{link}\n\n{HASHTAGS}"
    if dry:
        print("--- Mastodon ---\n" + text)
        return
    instance, token = os.environ.get("MASTODON_INSTANCE"), os.environ.get("MASTODON_TOKEN")
    if not instance or not token:
        print("Mastodon: no instance or token set, skipping.")
        return
    if not instance.startswith("http"):
        instance = "https://" + instance
    out = request(instance.rstrip("/") + "/api/v1/statuses", {"status": text, "visibility": "public", "language": "en"},
                  {"Authorization": "Bearer " + token, "Idempotency-Key": "longhand-" + link})
    print("Mastodon: posted", out.get("url"))


def main():
    today = datetime.datetime.now(ZoneInfo("America/New_York"))
    want = os.environ.get("ALMANAC_DATE", "").strip() or today.strftime("%m-%d")
    month, day = (int(x) for x in want.split("-"))
    found = [e for e in read_entries() if e["month"] == month and e["day"] == day]
    if not found:
        print(f"No almanac entry for {want}; nothing to post.")
        return
    dry = os.environ.get("DRY_RUN", "").lower() == "true"
    posted = os.environ.get("POSTED_DIR", "").strip()
    if posted:
        os.makedirs(posted, exist_ok=True)
    for name, post in (("bluesky", post_bluesky), ("mastodon", post_mastodon)):
        mark = os.path.join(posted, name) if posted else ""
        if mark and os.path.exists(mark) and not dry:
            print(f"{name.capitalize()}: already posted today, skipping.")
            continue
        for e in found:
            post(e, dry)
        if mark and not dry:
            open(mark, "w").close()


if __name__ == "__main__":
    sys.exit(main())
