# Longhand

A quiet place to write, read, and talk about both: a free writing app, a small literary journal, and a book club.

The site is built by GitHub Pages from this project. Changes go live a minute or two after they reach the `gh-pages` branch.

## What's where

- `index.html`: the front page
- `journal/`: the journal page and the submission guidelines (`journal/submit.md`)
- `book-club/`: the book club page
- `_journal/`: one file per published journal piece
- `_data/issues.yml`: the journal's issues, with deadlines and notes
- `_data/books.yml`: the book club's books, reading schedules and questions
- `_config.yml`: site settings, including the email, newsletter and discussion links
- `_layouts/`, `_includes/`, `assets/site.css`: the page design
- `fonts/`: Literata and IBM Plex Mono, both under the SIL Open Font License (see `fonts/OFL.txt`)
- `write/`: the Longhand writing app
- `sw.js`: retires the offline copy that older installs of the app kept at the site's main address

## Switching on email, the newsletter and the discussion space

In `_config.yml`, fill in:

- `email`: where submissions and questions go
- `newsletter_username`: your username at [Buttondown](https://buttondown.com), a free newsletter service
- `discussion_url`: the invite link to your discussion space, such as a Discord server

Until one is filled in, the site says that part is coming soon.

## Adding a journal piece

1. Copy `_journal/how-to-add-a-piece.md` to a new file with a short name, like `_journal/the-orchard.md`.
2. Fill in the title, author, issue number, form (poem, fiction or essay) and bio.
3. Paste the piece below the second `---` line. For a poem, keep each line on its own line and leave an empty line between stanzas.
4. Delete the `published: false` line.

When an issue is ready, change its `status` in `_data/issues.yml` from `reading` to `published` and add its `published_on` date. To open the next issue, add a new entry at the end of that file.

## Changing the book club's book

In `_data/books.yml`, change the finished book's `status` to `past`, and add the new book with `status: current`, a short blurb, and a weekly schedule. Each week's row is highlighted on the site automatically while that week is on.

## Moving to your own domain

1. In `_config.yml`, set `url` to your domain (like `"https://longhand.example"`) and set `baseurl` to `""`.
2. In this project's **Settings → Pages**, enter the domain under **Custom domain**, and follow GitHub's instructions for your domain seller's settings.
3. Writers reinstall the app from the new address. Longhand keeps its backup copies per address, so save pieces as files (⌘S / Ctrl+S) before switching.

## The writing app

Longhand runs in Chrome or Microsoft Edge on a Mac or Windows PC, works without the internet once installed, and saves writing as Rich Text (`.rtf`) files that open in Word, Pages, TextEdit, LibreOffice and Scrivener.

To install it, open `…/write/` in Chrome and click the install icon at the right end of the address bar. In Edge, open the **⋯** menu and choose **Apps → Install this site as an app**.

Keys (on Windows, use Ctrl where these say ⌘, and Shift for ⇧):

- ⌘S saves to a Rich Text file. After the first save, Longhand keeps the file up to date as you write.
- ⇧⌘S saves a copy under a new name.
- ⌘O opens an `.rtf` or `.txt` file.
- ⌘I and ⌘B for italics and bold. Type `#` and a space at the start of a line for a heading.
- Esc brings the buttons back while you're writing.

The app's files are in `write/`: `index.html` (page and styling), `app.js` (editor, saving, opening files), `rtf.js` (reads and writes Rich Text Format), `sw.js` (offline support; bump `VERSION` there whenever an app file changes), and `manifest.webmanifest` with `icons/` (what Chrome needs to install it).
