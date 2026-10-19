# Longhand

A literary almanac: a writer, a book or a moment from literary history, every day, with reviews of classic books by readers. A free writing app for writers is tucked in at the bottom of the front page and in the Reviews section.

The site is built by GitHub Pages from this project. Changes go live a minute or two after they reach the `gh-pages` branch. Readers write to longhandlit@gmail.com (set as `email` in `_config.yml`).

## The Almanac

The almanac is a calendar, written once: one file per day in `_almanac/`. Each file holds the day's short note, links, and a longer original entry, which gets its own page (for example `/almanac/11-30-mark-twain/`). Nobody has to post anything. The site picks the entries by itself, using each visitor's own date.

Entries open one day at a time, starting from `almanac_start` in `_config.yml` (October 17, 2026). Readers see today's entry and every earlier one, never the days still to come, so there's a reason to come back tomorrow:

- **Today in the Almanac** on the front page shows today's entry, and "Earlier this week" lists the six days before.
- The Almanac page (`/almanac/`) lists every entry so far, newest first, with today's highlighted.
- An entry's own page links to the day before and the day after, but only to days that have opened. Visiting a day still to come shows "Not yet," with the date it opens.

Once a full year has passed, every entry is open. (Pages for days to come are hidden by the reader's browser, not removed, so they're still in the site's files.)

The calendar currently runs from October 17 to December 31. Entries repeat every year.

**Portraits.** Each entry's `portrait` names a Wikipedia article (for example `John_Keats`). The reader's browser loads the picture at the top of that article, but only if it's a freely licensed picture from Wikimedia Commons, and credits its maker and license, linked to the picture's page. For a book or event, `pictured` says who is shown. If there is no portrait, or Wikipedia can't be reached, a lettered card appears instead. To store a portrait on the site instead, add the image and fill in `image` and `image_credit`.

**Bookstore links.** An entry with a `buy` (the book's title) and an `isbn` (the 13-digit ISBN of an edition) links to that book on Bookshop.org, using Longhand's affiliate ID (`bookshop_id` in `_config.yml`). Bookshop.org shares its profits with independent bookstores, and Longhand earns a small commission on sales; the page says so under the link. Entries without an ISBN have no bookstore link. Reviews work the same way, with `isbn`.

## Editing the calendar (the easy way)

The site is set up for **Pages CMS**, a free editor. Its settings are in `.pages.yml`.

1. Go to [app.pagescms.org](https://app.pagescms.org) and sign in with GitHub.
2. Open the `chapter57/longhand` project and choose the `gh-pages` branch.
3. Choose **Almanac calendar** in the sidebar. Open an entry to change it, or add a new one: month and day, the year it happened, the kind (Born, Died, Published or Event), the name, a note of two or three sentences, the portrait, the links, and the full entry.
4. Click **Save**. The site updates a minute or two later.

Please check every date and fact against two sources before adding it, and write entries in your own words.

## Reviews

Readers send reviews of classic books (published at least fifty years ago, 700 to 1,000 words, written by them and not by AI) in two ways: from the writing app (Export, then *Submit as a review*), or with the form on the Reviews page (`/reviews/`). Either way the review arrives by email at longhandlit@gmail.com, sent through Web3Forms; its access key, in `_config.yml` (`web3forms_key`) and `write/app.js` (`REVIEW_KEY`), only allows sending to that inbox. The writing app sends nothing unless the writer chooses *Submit as a review* for a piece, and then sends only that piece.

Nothing is published automatically. To publish a review you've approved, open Pages CMS, choose **Reviews**, click **Add an entry**, and fill in the book, its author, the reviewer's name, the date, a one-line summary, the book's ISBN (for the bookstore link), and the review itself. It appears on the Reviews page a minute or two after you save, at its own address. Reviews are stored one file each in `_reviews/`; `_layouts/review.html` is the design of each review's page.

## Posting to Bluesky and Mastodon

GitHub posts the almanac to Bluesky and Mastodon three times a day, New York time (an hour earlier in winter):

- **About 9:45 a.m.:** the day's entry, its short note with a link card to its full page. On Bluesky the card carries the entry's portrait.
- **About 1 p.m.:** a short quote, with the same link card.
- **About 7:30 p.m.:** a short poem or passage, posted as a quote card picture, with a link to the day's entry. The full text goes in the picture's description, for people using screen readers.

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

## What's where

- `index.html`: the front page: Today in the Almanac, the call for reviews, "Write to us", and the writing app at the bottom
- `reviews/index.html`, `_reviews/`: the Reviews page, its submission form, and the published reviews
- `_data/social.yml` and `assets/cards/`: the midday quotes and evening quote cards
- `_almanac/`: the almanac, one file per day; `_layouts/almanac-entry.html` is the design of each entry's page
- `almanac/index.html`: the Almanac page, with this week and the whole calendar
- `assets/almanac.js`: picks today's entry and the coming week, and loads the portraits; `_includes/almanac-data.html` hands it the calendar
- `assets/images/almanac/`: portraits, if any are added
- `_layouts/`, `_includes/`, `assets/site.css`: the page design; the drawings (pen, moon phases, postmark, envelope, ink rule) are in `_includes/ill-*.html`
- `.pages.yml`: the Pages CMS editing screens
- `_config.yml`: site settings
- `fonts/`: Literata and IBM Plex Mono, both under the SIL Open Font License (see `fonts/OFL.txt`)
- `write/`: the Longhand writing app
- `.github/`: the daily posting to Bluesky and Mastodon
- `sw.js`: retires the offline copy that older installs of the app kept at the site's main address

## Visitor numbers

The website counts its visits with GoatCounter, which uses no cookies and doesn't track people across sites. The numbers are at [cdamonsmith.goatcounter.com](https://cdamonsmith.goatcounter.com) (sign in with the GoatCounter account). The counter is added to every page that uses the site's design (`goatcounter` in `_config.yml`); the writing app counts nothing.

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

The writing app keeps pieces per address, so anyone who used it at an earlier address should Export their pieces there, then reinstall from longhandlit.com/write/ and paste them in.

## The writing app

Longhand runs in Chrome or Microsoft Edge on a Mac or Windows PC and works without the internet once installed. Every piece is saved as you type in the browser's own storage (IndexedDB) on that computer, and nothing is ever sent to a server. **Export** is the only way writing leaves the app: Word (.docx), PDF (through the print window's "Save as PDF"), Markdown (.md) or plain text (.txt).

To install it, open `…/write/` in Chrome and click the install icon at the right end of the address bar. In Edge, open the **⋯** menu and choose **Apps → Install this site as an app**.

Keys (on Windows, use Ctrl where these say ⌘, and Shift for ⇧):

- ⌘S confirms the piece is saved. Longhand saves on its own as you type.
- ⇧⌘S opens the Export menu.
- ⌘I and ⌘B for italics and bold. Type `#` and a space at the start of a line for a heading.
- Esc brings the buttons back while you're writing.

The app's files are in `write/`: `index.html` (page and styling), `app.js` (editor and saving), `export.js` (Word, Markdown and plain-text exports), `sw.js` (offline support; bump `VERSION` there whenever an app file changes), and `manifest.webmanifest` with `icons/` (what Chrome needs to install it).
