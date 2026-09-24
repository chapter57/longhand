# Longhand

A quiet place to write. Longhand runs in Chrome, works without the internet once installed, and saves your writing as Rich Text (`.rtf`) files that open in Word, Pages, TextEdit and Scrivener.

## Install it on your Mac

1. Open the site in Chrome.
2. Click the install icon at the right end of the address bar (a small screen with a down arrow), or open Chrome's ⋮ menu and choose **Cast, save and share → Install page as app…**
3. Click **Install**. Longhand gets its own window and a place in your Dock and Launchpad, and it opens without an internet connection from then on.

## Keys

- ⌘S saves to a Rich Text file. After the first save, Longhand keeps the file up to date as you write.
- ⇧⌘S saves a copy under a new name.
- ⌘O opens an `.rtf` or `.txt` file.
- ⌘I and ⌘B for italics and bold. Type `#` and a space at the start of a line for a heading.
- Esc brings the buttons back while you're writing.

## What's here

- `index.html`: the page and its styling
- `app.js`: the editor, saving, and opening files
- `rtf.js`: reads and writes Rich Text Format
- `sw.js`: keeps Longhand working offline (bump `VERSION` there whenever a file changes)
- `manifest.webmanifest`, `icons/`: what Chrome needs to install it as an app
- `fonts/`: Literata and IBM Plex Mono, both under the SIL Open Font License (see `fonts/OFL.txt`)
