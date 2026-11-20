# Longhand

A literary almanac: a writer, a book or a moment from literary history, every day, with reviews of classic books by readers and Great Reads 2027, a year of reading courses. The look is a broadsheet: Newsreader and IBM Plex Mono, black ink on newsprint, one red (`assets/site.css`).

The site is built by GitHub Pages from this project. Changes go live a minute or two after they reach the `gh-pages` branch. Readers write to hello@longhandlit.com (set as `email` in `_config.yml`). Namecheap forwards it to the Longhand Gmail inbox, longhandlit@gmail.com, and Gmail can reply as hello@longhandlit.com.

## The Almanac

The almanac is a calendar, written once: one file per day in `_almanac/`. Each file holds the day's short note, links, and a longer original entry, which gets its own page (for example `/almanac/11-30-mark-twain/`). Nobody has to post anything. The site picks the entries by itself, using each visitor's own date.

Entries open one day at a time, starting from `almanac_start` in `_config.yml` (October 17, 2026). Readers see today's entry and every earlier one, never the days still to come, so there's a reason to come back tomorrow:

- **Today in the Almanac** on the front page shows today's entry, and "Earlier this week" lists the six days before.
- The Almanac page (`/almanac/`) lists every entry so far, newest first, with today's highlighted.
- An entry's own page links to the day before and the day after, but only to days that have opened. Visiting a day still to come shows "Not yet," with the date it opens.

Once a full year has passed, every entry is open. (Pages for days to come are hidden by the reader's browser, not removed, so they're still in the site's files.)

The calendar currently runs from October 17 to December 31. Entries repeat every year.

**Portraits.** Each entry's `portrait` names a Wikipedia article (for example `John_Keats`). The reader's browser loads the picture at the top of that article, but only if it's a freely licensed picture from Wikimedia Commons, and credits its maker and license, linked to the picture's page. For a book or event, `pictured` says who is shown. If there is no portrait, or Wikipedia can't be reached, a lettered card appears instead. To store a portrait on the site instead, add the image and fill in `image` and `image_credit`.

**Bookstore links.** An entry with a `buy` (the book's title) and an `isbn` (the 13-digit ISBN of an edition) links to that book on Bookshop.org, using Longhand's affiliate ID (`bookshop_id` in `_config.yml`). Bookshop.org shares its profits with independent bookstores, and Longhand earns a small commission on sales; the page says so under the link. Entries without an ISBN have no bookstore link. Reviews work the same way, with `isbn`. Once `bookshop_shop` in `_config.yml` holds the address of the Longhand storefront on Bookshop.org, the front page and the Almanac page link to it as the Almanac Shelf.

**A writer with two days** (a birthday and a death day, say) gets two different entries. The later one links back to the earlier one ("We met Arthur Rimbaud on his birthday, October 20...") and tells a different part of the life, and the two days use different quotes and poems. Rimbaud (October 20 and November 10) is the example.

## Editing the calendar (the easy way)

The site is set up for **Pages CMS**, a free editor. Its settings are in `.pages.yml`.

1. Go to [app.pagescms.org](https://app.pagescms.org) and sign in with GitHub.
2. Open the `chapter57/longhand` project and choose the `gh-pages` branch.
3. Choose **Almanac calendar** in the sidebar. Open an entry to change it, or add a new one: month and day, the year it happened, the kind (Born, Died, Published or Event), the name, a note of two or three sentences, the portrait, the links, and the full entry.
4. Click **Save**. The site updates a minute or two later.

Please check every date and fact against two sources before adding it, and write entries in your own words.

## Reviews

Readers send reviews of classic books (published at least fifty years ago, 700 to 1,000 words, written by them and not by AI) with the form on the Reviews page (`/reviews/`). The review arrives by email in the Longhand Gmail inbox (longhandlit@gmail.com), sent through Web3Forms; its access key, in `_config.yml` (`web3forms_key`), only allows sending to that inbox.

Nothing is published automatically. To publish a review you've approved, open Pages CMS, choose **Reviews**, click **Add an entry**, and fill in the book, its author, the reviewer's name, the date, a one-line summary, the book's ISBN (for the bookstore link), and the review itself. It appears on the Reviews page a minute or two after you save, at its own address. Reviews are stored one file each in `_reviews/`; `_layouts/review.html` is the design of each review's page.

## Posting to Bluesky and Mastodon

GitHub posts the almanac to Bluesky and Mastodon three times a day, New York time (an hour earlier in winter):

- **About 9:45 a.m.:** the day's entry, its short note with a link card to its full page. On Bluesky the card carries the entry's portrait.
- **About 1 p.m.:** a short quote, with the same link card.
- **About 3:45 p.m., on days that have one:** a homemade-looking meme, to Bluesky and Instagram.
- **About 7:30 p.m.:** a short poem or passage, posted as a quote card picture, with a link to the day's entry. The full text goes in the picture's description, for people using screen readers.

When the day's writer is still in copyright, the midday post is a line about them in our own words, and the evening card shows their portrait and a few sentences about them.

Days without a meme of their own take one from a rotating pool: the memes and portrait cards marked `pool: true` in `_data/memes.yml`. The portraits are drawn in code by `.github/portraits/draw.mjs` into `assets/portraits/`.

Reels (short videos, for Instagram and Bluesky) are in `_data/reels.yml`, made into `assets/reels/<id>.mp4` by `.github/reels/reel.mjs` (it needs ffmpeg), and posted by hand: Actions → Post the almanac → Run workflow, choose "reel" and type its id.

The memes' captions are in `_data/memes.yml`, and the pictures in `assets/memes/` are drawn by `.github/memes/memes.mjs` (`npm install playwright`, plus Python's Pillow, then `node .github/memes/memes.mjs`). Each meme is written into that script by hand. The photos in them are public-domain portraits only.

The midday quotes and evening readings are in `_data/social.yml`, one pair per day. Everything in them is in the public domain; "translated for Longhand" marks our own translations. The quote cards are pictures in `assets/cards/`, drawn from that file by `.github/cards/render.mjs` (`npm install playwright js-yaml`, then `node .github/cards/render.mjs`); after changing an evening reading, draw its card again.

Days with nothing in the almanac are skipped. Bluesky posts are quietly tagged #BookSky, #Books, #Literature, #OnThisDay, #Writing and #Poetry so they reach the book feeds. The site links to the Bluesky account (`bluesky` in `_config.yml`). The posting is done by `.github/workflows/post-almanac.yml` and `.github/scripts/post_almanac.py`.

The accounts' details are kept privately in the project's **Settings → Secrets and variables → Actions**:

- `BLUESKY_HANDLE`: the account name, e.g. `longhandlit.bsky.social`
- `BLUESKY_APP_PASSWORD`: an app password made in Bluesky under Settings → Privacy and security → App passwords
- `MASTODON_INSTANCE`: the server's address, e.g. `https://mastodon.social`
- `MASTODON_TOKEN`: an access token made in Mastodon under Preferences → Development → New application, with the `write:statuses` and `write:media` permissions (the second lets it post the quote cards)

- `INSTAGRAM_TOKEN`: an Instagram API access token for the Longhand Instagram account (a Professional account), made in the Meta app dashboard under **Instagram → API setup with Instagram login → Generate access tokens**

Instagram gets the evening quote card only, from the `.jpg` copy of the card (Instagram takes only JPEG pictures). Links don't work in Instagram captions, so the caption points to the link in the profile, which should be longhandlit.com/almanac/. Instagram tokens last 60 days; the posting renews the token every week and keeps the new one, locked, in GitHub's cache. If more than 60 days pass with no evening post, make a new token and replace the secret.

**Instagram carousels.** A post of several slides is written in `_data/instagram.yml` (its slides and caption), drawn into `assets/instagram/<id>-<n>.jpg` by `.github/instagram/carousel.mjs`, and posted, once the pictures are on the site, by running **Post the almanac** with **instagram** and the post's id. The cover slide uses the writer's portrait from `.github/instagram/portraits/`, which the **Fetch portraits** workflow downloads from Wikimedia Commons with each picture's maker and license (`credits.yml`); the credit is printed on the slide.

If an account's details are missing, that account is skipped. For a one-off post, like an announcement, add it to `_data/announcements.yml` (the file explains each field), then run **Post the almanac** by hand, choose **announcement**, and type the post's id.

To post by hand, or to preview without posting, open the **Actions** tab, choose **Post the almanac**, click **Run workflow**, and pick which post.

## The wall calendar

*The Longhand Almanac 2027* is a wall calendar for printing on Lulu (11 × 8.5 in, wire-bound). It has one writer a month, with a portrait, a quotation and a few lines, and a writer in every day of the grid. All of it is in `.github/calendar/2027.yml`. The portraits are public-domain and Creative Commons pictures from Wikimedia Commons; the **Fetch portraits** workflow downloads them into `.github/calendar/portraits/` with each one's maker and license, which the calendar prints. To make the print PDF (26 pages, each 11.25 × 8.75 in with bleed):

    PREVIEW=1 node .github/calendar/calendar.mjs .github/calendar/2027.yml /tmp/calendar

`.github/calendar/mockups.mjs` then turns those page pictures into pictures of the printed calendar (hanging over a desk, lying on a table, the cover, a close look at the grid, and a link card), which are in `assets/calendar/` and used on the calendar's page at `/calendar/`, the Instagram carousel `calendar-2027` and the announcement `calendar-2027`. The shop link is `calendar_shop` in `_config.yml`.

## What's where

- `index.html`: the front page, laid out like a newspaper's: today's almanac entry as the lead story, Great Reads 2027 and "The line" (the day's quotation from `_data/social.yml`) beside it, then earlier this week, the newsletter, the calendar and the call for reviews
- `reviews/index.html`, `_reviews/`: the Reviews page, its submission form, and the published reviews
- `_data/social.yml` and `assets/cards/`: the midday quotes and evening quote cards
- `_almanac/`: the almanac, one file per day; `_layouts/almanac-entry.html` is the design of each entry's page
- `almanac/index.html`: the Almanac page, with this week and the whole calendar
- `assets/almanac.js`: picks today's entry and the coming week, and loads the portraits; `_includes/almanac-data.html` hands it the calendar
- `assets/images/almanac/`: portraits, if any are added
- `_layouts/`, `_includes/`, `assets/site.css`: the page design (the front page has the full masthead; other pages a small one)
- `.pages.yml`: the Pages CMS editing screens
- `_config.yml`: site settings
- `assets/icons/`, `favicon.ico`: the site icon (a blue ink drop); `assets/brand/`: the banner and round logo for social profiles
- `fonts/`: Newsreader (the site) and Literata (the calendar and cards) and IBM Plex Mono, all under the SIL Open Font License (see `fonts/OFL.txt`)
- `write/`: the writing app's retirement page, which lets anyone who used the app download what they wrote (still saved in their browser); `write/sw.js` clears installed copies. The app itself is archived in `_archive/write/`.
- `courses/index.html`: Great Reads 2027, the 2027 courses: the reading list and the waitlist form (sign-ups are emailed to the address in `_config.yml`, through Web3Forms, like reviews)
- `play/`: sends old links to the Mrs. Dalloway game to Great Reads 2027; the game is archived in `_archive/play/`
- `_archive/day/`: A Quiet Day, the writing game, archived (see below)
- `.github/`: the daily posting to Bluesky and Mastodon
- `sw.js`: retires the offline copy that older installs of the app kept at the site's main address

## Visitor numbers

The website counts its visits with GoatCounter, which uses no cookies and doesn't track people across sites. The numbers are at [cdamonsmith.goatcounter.com](https://cdamonsmith.goatcounter.com) (sign in with the GoatCounter account). The counter is added to every page that uses the site's design (`goatcounter` in `_config.yml`).

## The domain

The site lives at [longhandlit.com](https://longhandlit.com), registered at Namecheap. The `CNAME` file tells GitHub Pages to serve it there, and `url` in `_config.yml` matches.

DNS records for the website:

| Type | Host | Value |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | chapter57.github.io |


## Archived: the writing app and the games

The Longhand writing app, A Quiet Day and the Mrs. Dalloway game were retired in November 2026, when the site narrowed to reading. They're kept in `_archive/` (`write/`, `day/`, `play/`), which Jekyll doesn't publish. The notes below describe A Quiet Day as it was.

## A Quiet Day (archived)

Archived in November 2026 to be developed later: the files are in `_archive/day/`, which Jekyll doesn't publish (folders starting with an underscore are skipped). To bring it back, move the folder back to `day/` at the top of the site and add its link to the footer in `_layouts/default.html`.

A small game at `/day/` about a writer's day at home: walk around the house, make coffee, feed and walk Juniper the dog, light the fire, play a record, look out the window, then sit down at the desk and write. The desk opens the Longhand writing app (`/write/`) in a frame, so it's real writing: the same pieces, saved the same way in the browser, with the same Export. The game counts the words added at each sitting and shows the day's total when you go to bed.

The clock runs a game minute every second while you walk around, and slowly (two game minutes a real minute) while you write. The light, the sky in the windows and the weather (clear or rain) change through the day, and the day ends at midnight or when you go to bed. Progress is kept in the browser (`localStorage`, key `longhand.quietday`); the writing itself is only ever in Longhand.

Everything is drawn in code, with no image files, and the sound (rain, birds, the kettle, the fire, a record) is made with Web Audio. The files are `_archive/day/index.html` (the page, the cards and the desk) and `_archive/day/game.js` (the house, the art, the dog, the light and the sound). The writing app tells the game its word count through `window.longhand` in `write/app.js`. Adding `?debug` to the address exposes the game's state as `window.__qd`, for testing.

