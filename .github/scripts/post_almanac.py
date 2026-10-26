"""Posts the day's almanac to Bluesky and Mastodon, three times a day, and
the evening quote card to Instagram.

Run by .github/workflows/post-almanac.yml. Each run makes one of the day's
posts (today's date in New York time):

  morning  the almanac entry from _almanac/: its short note, with a link card
           to the entry's page and its portrait
  midday   a short quote from _data/social.yml, with the same link card
  evening  a short poem or passage from _data/social.yml, posted as its quote
           card picture (assets/cards/<month>-<day>.png), with a link to the entry

  meme     on days with one in _data/memes.yml, a homemade-looking meme
           (assets/memes/<month>-<day>.jpg), to Bluesky and Instagram

For a writer still in copyright, both are about the writer instead: a line
in our own words at midday, and a card with their portrait in the evening.

A platform whose secrets aren't set is skipped.

Settings, all from the environment:
  BLUESKY_HANDLE, BLUESKY_APP_PASSWORD     e.g. longhandlit.bsky.social
  MASTODON_INSTANCE, MASTODON_TOKEN        e.g. https://mastodon.social
  INSTAGRAM_TOKEN                          an Instagram API access token; it lasts 60 days,
                                           so the script renews it every week and keeps the
                                           new one, locked with this one, in INSTAGRAM_DIR
  INSTAGRAM_DIR                            optional folder for the renewed token
  SLOT                                     morning (the default), midday or evening,
                                           announcement for a one-off post, or instagram for
                                           a carousel post on Instagram only
  ANNOUNCEMENT                             with SLOT=announcement, which one, by its id in
                                           _data/announcements.yml; with SLOT=instagram, which
                                           carousel, by its id in _data/instagram.yml
  ALMANAC_DATE                             optional, "MM-DD", to post another day
  DRY_RUN                                  "true" to print the posts, not send them
  POSTED_DIR                               optional folder that remembers which posts
                                           already went out today, so a second run skips them
"""
import datetime
import glob
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from zoneinfo import ZoneInfo

import yaml

SITE = "https://longhandlit.com"
BLUESKY_LIMIT = 300
MASTODON_LIMIT = 500
HASHTAGS = "#OnThisDay #Books #Literature #Poetry"
INSTAGRAM_API = "https://graph.instagram.com/v23.0/"
INSTAGRAM_HASHTAGS = ("#poetry #books #literature #onthisday #bookstagram #booksofinstagram "
                      "#classicbooks #classicliterature #literaryquotes #poetrycommunity #readingcommunity #writersofinstagram")
# Bluesky carries these without showing them, so posts reach the book feeds
# without using up the character limit.
BLUESKY_TAGS = ["BookSky", "Books", "Literature", "OnThisDay", "Writing", "Poetry"]
BLUESKY_IMAGE_LIMIT = 1_000_000  # bytes
MONTHS = ["January", "February", "March", "April", "May", "June", "July",
          "August", "September", "October", "November", "December"]
USER_AGENT = "LonghandAlmanac/1.0 (" + SITE + ")"


def read_entries():
    entries = []
    for path in glob.glob("_almanac/*.md"):
        text = open(path, encoding="utf-8").read()
        _, front, body = text.split("---", 2)
        e = yaml.safe_load(front)
        e["url"] = SITE + "/almanac/" + os.path.basename(path)[:-3] + "/"
        entries.append(e)
    return entries


def read_social():
    return yaml.safe_load(open("_data/social.yml", encoding="utf-8"))


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


def curly(text):
    """Typewriter quotes to printer's quotes."""
    text = re.sub(r'(^|[\s(\[—-])"', "\\1“", str(text)).replace('"', "”")
    return re.sub(r"(^|[\s(\[—-])'", "\\1‘", text).replace("'", "’")


# ---------- what each post says ----------

def morning(e, social):
    top = headline(e)
    # The link goes in a card under the post, so the words get the whole limit.
    return {"bluesky": top + "\n\n" + fit(e["note"], BLUESKY_LIMIT - len(top) - 2),
            "mastodon": f"{top}\n\n{fit(e['note'], MASTODON_LIMIT - len(top) - 23 - len(HASHTAGS) - 6)}",
            "card": True}


def midday(e, social):
    q = social["midday"]
    # A writer still in copyright gets a few words about them instead of a quote.
    if not q.get("author"):
        words = curly(str(q["text"]).strip())
        return {"bluesky": words, "mastodon": words, "card": True}
    # A quote that is already dialogue keeps its own quotation marks.
    quote = curly(q["text"]) if '"' in q["text"] else "“" + curly(q["text"]) + "”"
    words = (q.get("intro", "") + "\n\n" if q.get("intro") else "") + quote
    by = "— " + curly(q["author"]) + ", " + curly(q["source"])
    return {"bluesky": words + "\n" + by, "mastodon": words + "\n" + by, "card": True}


def evening(e, social):
    p = social["evening"]
    date = MONTHS[e["month"] - 1] + " " + str(e["day"])
    if p.get("about"):
        return about_card(e, p, date)
    top = f"An evening reading for {date}: “{curly(p['title'])},” {curly(p['author'])}."
    alt = curly(str(p["text"]).strip()) + "\n\n— " + curly(p["author"]) + ", " + curly(p["source"])
    return {"bluesky": top + "\n\nToday in the almanac: " + e["url"],
            "mastodon": top + "\n\nToday in the almanac:",
            "image": (f"assets/cards/{e['month']}-{e['day']}.png", alt[:1900]),
            # Instagram links don't work in captions, so the link is in the profile.
            "instagram": f"{top}\n\n{alt}\n\nToday in the almanac: {e['name']}. The link is in our bio, longhandlit.com."
                         f"\n\n{INSTAGRAM_HASHTAGS}",
            "fallback": curly(str(p["text"]).strip()) + "\n— " + curly(p["author"])}


def about_card(e, p, date):
    """The evening card for a writer still in copyright: their portrait and a
    few words about them, in place of a quote."""
    about = curly(" ".join(str(p["about"]).split()))
    top = f"For {date}: {e['name']}."
    alt = f"A portrait of {e['name']}, with the words: {about}"
    return {"bluesky": top + "\n\nToday in the almanac: " + e["url"],
            "mastodon": top + "\n\nToday in the almanac:",
            "image": (f"assets/cards/{e['month']}-{e['day']}.png", alt[:1900]),
            "instagram": f"{top}\n\n{about}\n\nToday in the almanac: {e['name']}. The link is in our bio, longhandlit.com."
                         f"\n\n{INSTAGRAM_HASHTAGS}",
            "fallback": about}


def meme(e, social, name=""):
    """The day's meme from _data/memes.yml, or the one called name, or None."""
    memes = yaml.safe_load(open("_data/memes.yml", encoding="utf-8")) or []
    found = [m for m in memes if (m.get("id") == name if name else (m.get("month"), m.get("day")) == (e["month"], e["day"]))]
    if not found and not name:
        # No meme for the day: the next one from the pool, taking turns by date.
        pool = [m for m in memes if m.get("pool")]
        if pool:
            n = datetime.date(2026, e["month"], e["day"]).toordinal()
            found = [pool[n % len(pool)]]
            name = found[0]["id"]
    if not found:
        return None
    m = found[0]
    path = f"assets/memes/{m.get('id') or str(e['month']) + '-' + str(e['day'])}.jpg"
    words = curly(" ".join(str(m["caption"]).split()))
    # "From the almanac", so a meme posted on another day still reads right.
    lead, where = ("", "Every day at longhandlit.com.") if name else ("From the almanac: ", f"From the almanac: {e['name']}.")
    return {"bluesky": words + "\n\n" + lead + e["url"],
            "mastodon": words + "\n\n" + (lead or "Longhand Literature:"),
            "image": (path, curly(m["alt"])[:1900]), "size": (1080, m.get("height", 1080)),
            "instagram": f"{words}\n\n{where} The link is in our bio, longhandlit.com."
                         f"\n\n{INSTAGRAM_HASHTAGS} #LiteraryMemes #BookMemes",
            "instagram_image": path,
            "fallback": words}


SLOTS = {"morning": morning, "midday": midday, "evening": evening, "meme": meme}


def announcement(name):
    """A one-off post from _data/announcements.yml, as (entry-like link, post)."""
    found = [a for a in yaml.safe_load(open("_data/announcements.yml", encoding="utf-8")) if a["id"] == name]
    if not found:
        raise SystemExit(f"No announcement called {name!r} in _data/announcements.yml.")
    a = found[0]
    link = {"url": a["link"], "name": a["title"], "note": a["description"], "image_file": a.get("image")}
    return link, {"bluesky": a["bluesky"].strip(), "mastodon": a.get("mastodon", a["bluesky"]).strip(),
                  "card": True, "card_title": a["title"],
                  "hashtags": a.get("hashtags", "#Books #Reading #Literature"),
                  "tags": a.get("tags", ["BookSky", "Books", "Reading", "Literature", "Writing"])}


# ---------- sending ----------

def request(url, data=None, headers=None, method=None):
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, method=method, headers={
        "Content-Type": "application/json", "User-Agent": USER_AGENT, **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as err:
        raise SystemExit(f"{url} answered {err.code}: {err.read().decode(errors='replace')[:500]}")


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read(), r.headers.get_content_type()


def portrait(e):
    """The entry's portrait as (bytes, type), or None.

    The same picture the site shows: one stored on the site, or else the lead
    picture of the entry's Wikipedia article when it is a freely licensed
    image on Wikimedia Commons."""
    try:
        if e.get("image"):
            return fetch(SITE + "/" + e["image"].lstrip("/"))
        if not e.get("portrait"):
            return None
        summary = json.loads(fetch("https://en.wikipedia.org/api/rest_v1/page/summary/"
                                   + urllib.parse.quote(e["portrait"], safe=""))[0])
        thumb = (summary.get("thumbnail") or {}).get("source", "")
        if "/wikipedia/commons/" not in thumb:
            return None
        sized = re.sub(r"/\d+px-([^/]+)$", r"/500px-\1", thumb)
        try:
            return fetch(sized)
        except urllib.error.HTTPError:
            return fetch(thumb)
    except Exception as err:  # a missing picture never stops the post
        print("Bluesky: no portrait,", err)
        return None


def link_facets(text):
    """Bluesky only makes links clickable when told where they are, in bytes."""
    facets = []
    for m in re.finditer(r"https?://\S+", text):
        start = len(text[:m.start()].encode())
        facets.append({"index": {"byteStart": start, "byteEnd": start + len(m.group().encode())},
                       "features": [{"$type": "app.bsky.richtext.facet#link", "uri": m.group()}]})
    return facets


def post_bluesky(e, post, dry):
    text = post["bluesky"]
    if dry:
        extra = "[card] " + e["url"] if post.get("card") else "[video] " + post["video"] if post.get("video") else "[image] " + post["image"][0]
        print(f"--- Bluesky ({len(text)} characters) ---\n{text}\n{extra}")
        return
    handle, password = os.environ.get("BLUESKY_HANDLE"), os.environ.get("BLUESKY_APP_PASSWORD")
    if not handle or not password:
        print("Bluesky: no handle or app password set, skipping.")
        return False
    api = "https://bsky.social/xrpc/"
    session = request(api + "com.atproto.server.createSession", {"identifier": handle, "password": password})
    auth = {"Authorization": "Bearer " + session["accessJwt"]}
    # Don't post the same words twice: look for them among the account's recent posts.
    feed = request(api + "app.bsky.feed.getAuthorFeed?limit=30&actor=" + session["did"], headers=auth)
    recent = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=2)
    for item in feed.get("feed", []):
        rec = item.get("post", {}).get("record", {})
        when = datetime.datetime.fromisoformat(rec.get("createdAt", "1970-01-01T00:00:00Z").replace("Z", "+00:00"))
        if rec.get("text") == text and when > recent:
            print("Bluesky: already posted, skipping.")
            return True

    def upload(data, kind):
        req = urllib.request.Request(api + "com.atproto.repo.uploadBlob", data=data, method="POST",
                                     headers={**auth, "Content-Type": kind, "User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read())["blob"]
        except urllib.error.HTTPError as err:
            print("Bluesky: picture upload failed,", err.code)
            return None

    record = {"$type": "app.bsky.feed.post", "text": text, "langs": ["en"], "tags": post.get("tags", BLUESKY_TAGS),
              "createdAt": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")}
    if post.get("card"):
        card = {"uri": e["url"], "title": post.get("card_title") or e["name"] + " · The Longhand Almanac",
                "description": fit(e["note"], 280)}
        picture = (open(e["image_file"], "rb").read(), "image/png") if e.get("image_file") else portrait(e)
        if picture and len(picture[0]) <= BLUESKY_IMAGE_LIMIT:
            blob = upload(*picture)
            if blob:
                card["thumb"] = blob
        record["embed"] = {"$type": "app.bsky.embed.external", "external": card}
    if post.get("image"):
        path, alt = post["image"]
        blob = upload(open(path, "rb").read(), "image/jpeg" if path.endswith(".jpg") else "image/png")
        if not blob:
            raise SystemExit("Bluesky: the picture didn't upload")
        width, height = post.get("size", (1080, 1350))
        record["embed"] = {"$type": "app.bsky.embed.images", "images": [
            {"image": blob, "alt": alt, "aspectRatio": {"width": width, "height": height}}]}
    if post.get("video"):
        record["embed"] = {"$type": "app.bsky.embed.video", "video": bluesky_video(api, session, auth, post["video"]),
                           "alt": post.get("alt", "")[:1000], "aspectRatio": {"width": 1080, "height": 1920}}
    facets = link_facets(text)
    if facets:
        record["facets"] = facets
    out = request(api + "com.atproto.repo.createRecord",
                  {"repo": session["did"], "collection": "app.bsky.feed.post", "record": record}, auth)
    print("Bluesky: posted", out.get("uri"))
    return True


def bluesky_video(api, session, auth, path):
    """Uploads a video through Bluesky's video service, which prepares it for
    playback, and returns its blob once it's ready."""
    pds = next(s["serviceEndpoint"] for s in session["didDoc"]["service"] if s["id"].endswith("atproto_pds"))
    aud = "did:web:" + urllib.parse.urlparse(pds).hostname
    svc = request(api + "com.atproto.server.getServiceAuth?" + urllib.parse.urlencode(
        {"aud": aud, "lxm": "com.atproto.repo.uploadBlob", "exp": int(time.time()) + 1800}), headers=auth)["token"]
    data = open(path, "rb").read()
    req = urllib.request.Request("https://video.bsky.app/xrpc/app.bsky.video.uploadVideo?" + urllib.parse.urlencode(
        {"did": session["did"], "name": os.path.basename(path)}), data=data, method="POST",
        headers={"Authorization": "Bearer " + svc, "Content-Type": "video/mp4", "User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            job = json.loads(r.read())
    except urllib.error.HTTPError as err:
        body = err.read().decode(errors="replace")
        if err.code == 409 and "jobId" in body:  # already uploaded
            job = json.loads(body)
        else:
            raise SystemExit(f"Bluesky: the video didn't upload ({err.code}): {body[:300]}")
    job_id = job.get("jobId") or job.get("jobStatus", {}).get("jobId")
    for _ in range(60):
        st = request("https://video.bsky.app/xrpc/app.bsky.video.getJobStatus?jobId=" + job_id)["jobStatus"]
        if st.get("blob"):
            return st["blob"]
        if st.get("state") == "JOB_STATE_FAILED":
            raise SystemExit("Bluesky: the video service couldn't use the video: " + str(st.get("error")))
        time.sleep(5)
    raise SystemExit("Bluesky: the video took too long to process")


def mastodon_media(instance, token, path, alt):
    """Uploads a picture; returns its id, or None if it can't."""
    boundary = uuid.uuid4().hex
    parts = [f'--{boundary}\r\nContent-Disposition: form-data; name="description"\r\n\r\n{alt}\r\n'.encode(),
             f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{os.path.basename(path)}"\r\n'
             f'Content-Type: image/png\r\n\r\n'.encode() + open(path, "rb").read() + b"\r\n",
             f"--{boundary}--\r\n".encode()]
    req = urllib.request.Request(instance + "/api/v2/media", data=b"".join(parts), method="POST", headers={
        "Authorization": "Bearer " + token, "User-Agent": USER_AGENT,
        "Content-Type": "multipart/form-data; boundary=" + boundary})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read())["id"]
    except urllib.error.HTTPError as err:
        # A token made without the write:media permission ends up here.
        print("Mastodon: picture upload failed,", err.code)
        return None


def post_mastodon(e, post, dry):
    # Mastodon counts every link as 23 characters.
    tags = post.get("hashtags", HASHTAGS)
    text = f"{post['mastodon']}\n\n{e['url']}\n\n{tags}"
    if dry:
        print(f"--- Mastodon ---\n{text}" + ("\n[image] " + post["image"][0] if post.get("image") else ""))
        return
    instance, token = os.environ.get("MASTODON_INSTANCE"), os.environ.get("MASTODON_TOKEN")
    if not instance or not token:
        print("Mastodon: no instance or token set, skipping.")
        return False
    if not instance.startswith("http"):
        instance = "https://" + instance
    instance = instance.rstrip("/")
    status = {"status": text, "visibility": "public", "language": "en"}
    if post.get("image"):
        media = mastodon_media(instance, token, *post["image"])
        if media:
            status["media_ids"] = [media]
        else:
            # No picture: put the words themselves in the post, if they fit.
            words = post["fallback"]
            if len(words) + 23 + len(tags) + 6 > MASTODON_LIMIT:
                print("Mastodon: the reading doesn't fit without its picture, skipping.")
                return False
            status["status"] = f"{words}\n\n{e['url']}\n\n{tags}"
    out = request(instance + "/api/v1/statuses", status,
                  {"Authorization": "Bearer " + token, "Idempotency-Key": "longhand-" + uuid.uuid5(uuid.NAMESPACE_URL, text).hex})
    print("Mastodon: posted", out.get("url"))
    return True


def instagram_call(path, params, token, post=False):
    params = {**params, "access_token": token}
    data = urllib.parse.urlencode(params).encode()
    url = INSTAGRAM_API + path
    req = (urllib.request.Request(url, data=data, method="POST", headers={"User-Agent": USER_AGENT}) if post
           else urllib.request.Request(url + "?" + data.decode(), headers={"User-Agent": USER_AGENT}))
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as err:
        raise SystemExit(f"Instagram: {path} answered {err.code}: {err.read().decode(errors='replace')[:500]}")


def openssl(args, data, key):
    """Locks or unlocks the saved token, with the token in the project's secrets as the key."""
    out = subprocess.run(["openssl", "enc", "-aes-256-cbc", "-pbkdf2", "-pass", "env:LONGHAND_KEY", *args],
                         input=data, capture_output=True, env={**os.environ, "LONGHAND_KEY": key})
    return out.stdout if out.returncode == 0 else None


def instagram_token():
    """The newest Instagram token, renewed if it's more than a week old.

    Instagram tokens last 60 days. Each renewal gives a new one, which can't be
    written back to the project's secrets, so it's kept in INSTAGRAM_DIR (saved
    between runs by the workflow), locked with the original token as the key."""
    first = os.environ.get("INSTAGRAM_TOKEN", "").strip()
    folder = os.environ.get("INSTAGRAM_DIR", "").strip()
    saved = os.path.join(folder, "token") if folder else ""
    token, renewed = first, 0
    if saved and os.path.exists(saved):
        opened = openssl(["-d"], open(saved, "rb").read(), first)
        try:
            kept = json.loads(opened)
            token, renewed = kept["token"], kept["renewed"]
        except (TypeError, ValueError, KeyError):
            print("Instagram: the saved token couldn't be read; using the one in the secrets.")
    if time.time() - renewed > 7 * 86400:
        try:
            fresh = instagram_call("refresh_access_token", {"grant_type": "ig_refresh_token"}, token)
            token = fresh["access_token"]
            if saved:
                os.makedirs(folder, exist_ok=True)
                locked = openssl(["-e"], json.dumps({"token": token, "renewed": time.time()}).encode(), first)
                if locked:
                    open(saved, "wb").write(locked)
            print("Instagram: renewed the token; it now lasts until", time.strftime(
                "%B %-d", time.gmtime(time.time() + fresh.get("expires_in", 0))))
        except SystemExit as err:
            # A token less than a day old can't be renewed yet; it still works.
            print("Instagram: couldn't renew the token this time.", err)
    return token


def post_instagram(e, post, dry):
    if not post.get("instagram"):
        return False
    if post.get("video"):
        return post_instagram_reel(post, dry)
    month, day = e["month"], e["day"]
    base = os.environ.get("INSTAGRAM_IMAGE_BASE", "").strip() or SITE
    image = f"{base}/{post.get('instagram_image') or f'assets/cards/{month}-{day}.jpg'}"
    caption = post["instagram"][:2200]
    if dry:
        print(f"--- Instagram ({len(caption)} characters) ---\n{caption}\n[image] {image}")
        return
    if not os.environ.get("INSTAGRAM_TOKEN"):
        print("Instagram: no token set, skipping.")
        return False
    token = instagram_token()
    me = instagram_call("me", {"fields": "user_id,username"}, token)
    user = me["user_id"]
    # Don't post the same card twice: look at the account's last few posts.
    recent = instagram_call(f"{user}/media", {"fields": "caption", "limit": 5}, token)
    if any((m.get("caption") or "").strip() == caption.strip() for m in recent.get("data", [])):
        print("Instagram: already posted, skipping.")
        return True
    container = instagram_call(f"{user}/media", {"image_url": image, "caption": caption}, token, post=True)["id"]
    # Instagram fetches the picture from the site before it can be published.
    for _ in range(30):
        status = instagram_call(container, {"fields": "status_code"}, token).get("status_code")
        if status == "FINISHED":
            break
        if status == "ERROR":
            raise SystemExit("Instagram: couldn't use the picture at " + image)
        time.sleep(4)
    out = instagram_call(f"{user}/media_publish", {"creation_id": container}, token, post=True)
    print(f"Instagram: posted {out.get('id')} as @{me.get('username')}")
    return True


def post_instagram_reel(post, dry):
    """Posts a video as a reel, shared to the feed too."""
    base = os.environ.get("INSTAGRAM_IMAGE_BASE", "").strip() or SITE
    video = f"{base}/{post['video']}"
    caption = post["instagram"][:2200]
    if dry:
        print(f"--- Instagram reel ({len(caption)} characters) ---\n{caption}\n[video] {video}")
        return
    if not os.environ.get("INSTAGRAM_TOKEN"):
        print("Instagram: no token set, skipping.")
        return False
    token = instagram_token()
    me = instagram_call("me", {"fields": "user_id,username"}, token)
    user = me["user_id"]
    recent = instagram_call(f"{user}/media", {"fields": "caption", "limit": 5}, token)
    if any((m.get("caption") or "").strip() == caption.strip() for m in recent.get("data", [])):
        print("Instagram: already posted, skipping.")
        return True
    container = instagram_call(f"{user}/media", {"media_type": "REELS", "video_url": video, "caption": caption,
                                                 "share_to_feed": "true"}, token, post=True)["id"]
    # Instagram fetches and processes the video first; that can take a few minutes.
    for _ in range(60):
        status = instagram_call(container, {"fields": "status_code"}, token).get("status_code")
        if status == "FINISHED":
            break
        if status == "ERROR":
            raise SystemExit("Instagram: couldn't use the video at " + video)
        time.sleep(10)
    out = instagram_call(f"{user}/media_publish", {"creation_id": container}, token, post=True)
    print(f"Instagram: posted reel {out.get('id')} as @{me.get('username')}")
    return True


def reel(name):
    """A reel from _data/reels.yml, as (entry-like link, post)."""
    reels = yaml.safe_load(open("_data/reels.yml", encoding="utf-8"))
    found = [r for r in reels if r["id"] == name]
    if not name and reels:
        # A scheduled reel: the next one in turn, by date.
        found = [reels[datetime.date.today().toordinal() // 3 % len(reels)]]
        name = found[0]["id"]
    if not found:
        raise SystemExit(f"No reel called {name!r} in _data/reels.yml.")
    r = found[0]
    words = curly(r["caption"].strip())
    link = {"url": SITE + "/", "name": "Longhand Literature", "note": "", "month": 0, "day": 0}
    bsky = curly(fit(r.get("bluesky", r["caption"].split("\n")[0]), 240)) + "\n\n" + SITE + "/"
    return link, {"bluesky": bsky, "mastodon": bsky, "video": f"assets/reels/{name}.mp4",
                  "alt": f"An animation: a drawing of the writer, then the words \"{r['text']}\" and \"{r['by']}\".",
                  "instagram": words + f"\n\n{INSTAGRAM_HASHTAGS}", "fallback": words}


def post_instagram_carousel(name, dry):
    """Posts a carousel from _data/instagram.yml: its slides, drawn into
    assets/instagram/<id>-<n>.jpg, and its caption."""
    found = [p for p in yaml.safe_load(open("_data/instagram.yml", encoding="utf-8")) if p["id"] == name]
    if not found:
        raise SystemExit(f"No Instagram post called {name!r} in _data/instagram.yml.")
    post = found[0]
    # Run from a working branch, the slides come from GitHub's copy of that
    # branch, so a carousel can go out before it reaches the site.
    base = os.environ.get("INSTAGRAM_IMAGE_BASE", "").strip() or SITE
    images = [f"{base}/assets/instagram/{name}-{n}.jpg" for n in range(1, len(post["slides"]) + 1)]
    caption = curly(post["caption"].strip())[:2200]
    if dry:
        print(f"--- Instagram carousel ({len(caption)} characters) ---\n{caption}\n" + "\n".join(images))
        return
    if not os.environ.get("INSTAGRAM_TOKEN"):
        raise SystemExit("Instagram: no token set.")
    token = instagram_token()
    me = instagram_call("me", {"fields": "user_id,username"}, token)
    user = me["user_id"]
    recent = instagram_call(f"{user}/media", {"fields": "caption", "limit": 5}, token)
    if any((m.get("caption") or "").strip() == caption for m in recent.get("data", [])):
        print("Instagram: already posted, skipping.")
        return

    def ready(container):
        # Instagram fetches each picture from the site before it can be used.
        for _ in range(30):
            status = instagram_call(container, {"fields": "status_code"}, token).get("status_code")
            if status == "FINISHED":
                return container
            if status == "ERROR":
                raise SystemExit("Instagram: couldn't use a picture for " + container)
            time.sleep(4)
        raise SystemExit("Instagram: a picture took too long")

    children = [ready(instagram_call(f"{user}/media", {"image_url": url, "is_carousel_item": "true"}, token, post=True)["id"])
                for url in images]
    album = ready(instagram_call(f"{user}/media", {"media_type": "CAROUSEL", "children": ",".join(children),
                                                   "caption": caption}, token, post=True)["id"])
    out = instagram_call(f"{user}/media_publish", {"creation_id": album}, token, post=True)
    print(f"Instagram: posted carousel {out.get('id')} as @{me.get('username')}")


def main():
    today = datetime.datetime.now(ZoneInfo("America/New_York"))
    want = os.environ.get("ALMANAC_DATE", "").strip() or today.strftime("%m-%d")
    slot = os.environ.get("SLOT", "").strip() or "morning"
    dry = os.environ.get("DRY_RUN", "").lower() == "true"
    if slot == "announcement":
        e, post = announcement(os.environ.get("ANNOUNCEMENT", "").strip())
        for send in (post_bluesky, post_mastodon):
            send(e, post, dry)
        return
    if slot == "reel":
        e, post = reel(os.environ.get("ANNOUNCEMENT", "").strip())
        for send in (post_bluesky, post_instagram):
            send(e, post, dry)
        return
    if slot == "meme" and os.environ.get("ANNOUNCEMENT", "").strip():
        # A meme that isn't tied to a day links to the front page.
        e = {"url": SITE + "/", "name": "Longhand Literature", "note": "", "month": 0, "day": 0}
        post = meme(e, None, os.environ["ANNOUNCEMENT"].strip())
        if not post:
            raise SystemExit("No meme called " + os.environ["ANNOUNCEMENT"] + " in _data/memes.yml.")
        for send in (post_bluesky, post_mastodon, post_instagram):
            send(e, post, dry)
        return
    if slot == "instagram":
        post_instagram_carousel(os.environ.get("ANNOUNCEMENT", "").strip(), dry)
        return
    if slot not in SLOTS:
        raise SystemExit(f"Unknown SLOT {slot!r}; use morning, midday, evening, announcement or instagram.")
    month, day = (int(x) for x in want.split("-"))
    found = [e for e in read_entries() if e["month"] == month and e["day"] == day]
    social = [s for s in read_social() if s["month"] == month and s["day"] == day]
    if not found or (slot not in ("morning", "meme") and not social):
        print(f"Nothing in the almanac for {want} at {slot}; nothing to post.")
        return
    e, post = found[0], SLOTS[slot](found[0], social[0] if social else None)
    if not post:
        print(f"No {slot} post for {want}; nothing to post.")
        return
    posted = os.environ.get("POSTED_DIR", "").strip()
    if posted:
        os.makedirs(posted, exist_ok=True)
    for name, send in (("bluesky", post_bluesky), ("mastodon", post_mastodon), ("instagram", post_instagram)):
        mark = os.path.join(posted, f"{slot}-{name}") if posted else ""
        if mark and os.path.exists(mark) and not dry:
            print(f"{name.capitalize()}: already posted this {slot}, skipping.")
            continue
        # Only a post that went up is remembered, so a skipped account gets another try.
        if send(e, post, dry) and mark and not dry:
            open(mark, "w").close()


if __name__ == "__main__":
    sys.exit(main())
