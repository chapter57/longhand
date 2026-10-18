# Longhand

A quiet place to write, and a little company while you do: a free writing app and a literary almanac with a writer, a book or a moment from literary history for every day.

The site is built by GitHub Pages from this project. Changes go live a minute or two after they reach the `gh-pages` branch. Readers write to longhandlit@gmail.com (set as `email` in `_config.yml`).

## The Almanac

The almanac is a calendar, written once: one file per day in `_almanac/`. Each file holds the day's short note, links, and a longer original entry, which gets its own page (for example `/almanac/11-30-mark-twain/`). Nobody has to post anything. The site picks the entries by itself, using each visitor's own date:

- **Today in the Almanac** on the front page shows today's entry, and a short "Coming up" list for the next six days. On a day with no entry, it shows the next one coming up.
- **This week** at the top of the Almanac page (`/almanac/`) shows today and the six days after. Below it is the whole calendar, month by month, with today highlighted.
- Each entry's own page has the full piece, with links to the day before and the day after.

The calendar currently runs from October 17 to December 31. Entries repeat every year.

**Portraits.** Each entry's `portrait` names a Wikipedia article (for example `John_Keats`). The reader's browser loads the picture at the top of that article, but only if it's a freely licensed picture from Wikimedia Commons, and credits its maker and license, linked to the picture's page. For a book or event, `pictured` says who is shown. If there is no portrait, or Wikipedia can't be reached, a lettered card appears instead. To store a portrait on the site instead, add the image and fill in `image` and `image_credit`.

## Editing the calendar (the easy way)

The site is set up for **Pages CMS**, a free editor. Its settings are in `.pages.yml`.

1. Go to [app.pagescms.org](https://app.pagescms.org) and sign in with GitHub.
2. Open the `chapter57/longhand` project and choose the `gh-pages` branch.
3. Choose **Almanac calendar** in the sidebar. Open an entry to change it, or add a new one: month and day, the year it happened, the kind (Born, Died, Published or Event), the name, a note of two or three sentences, the portrait, the links, and the full entry.
4. Click **Save**. The site updates a minute or two later.

Please check every date and fact against two sources before adding it, and write entries in your own words.

## Posting to Bluesky and Mastodon

Every morning at about 9 a.m. New York time (8 a.m. in winter), GitHub posts the day's entry to Bluesky and Mastodon: its short note and a link to its full page. Days with no entry are skipped. On Bluesky the link card carries the entry's portrait, and each post is quietly tagged #BookSky, #Books, #Literature, #OnThisDay, #Writing and #Poetry so it reaches the book feeds. The site links to the Bluesky account (`bluesky` in `_config.yml`). The posting is done by `.github/workflows/post-almanac.yml` and `.github/scripts/post_almanac.py`.

The accounts' details are kept privately in the project's **Settings → Secrets and variables → Actions**:

- `BLUESKY_HANDLE`: the account name, e.g. `longhandlit.bsky.social`
- `BLUESKY_APP_PASSWORD`: an app password made in Bluesky under Settings → Privacy and security → App passwords
- `MASTODON_INSTANCE`: the server's address, e.g. `https://mastodon.social`
- `MASTODON_TOKEN`: an access token made in Mastodon under Preferences → Development → New application, with the `write:statuses` permission

If an account's details are missing, that account is skipped. To post by hand, or to preview without posting, open the **Actions** tab, choose **Post the almanac**, and click **Run workflow**.

## What's where

- `index.html`: the front page, with Today in the Almanac, the app and "Write to us"
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
