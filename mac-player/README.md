# CapsulePlayer

A small, fast Winamp-style MP3 player for the Mac that plays your music
straight off an AirPort Time Capsule (or any network share).

It's a native Cocoa app with no dependencies. It builds on everything from a
PowerPC Mac running **Mac OS X 10.5 Leopard** up to current macOS.

## Why it doesn't stutter

Network shares are slow and bursty, and a Time Capsule's disk spins down when
idle. CapsulePlayer never streams audio directly off the network:

- **Each song is copied into memory before it plays.** A Wi-Fi hiccup halfway
  through a song can't cause a dropout.
- **The next song is fetched while the current one plays,** and the two are
  joined in one continuous audio stream. Songs follow each other with **no
  gap**, and pressing Next is instant.
- **Reads that fail are retried** with growing pauses (up to about 15 seconds),
  which is enough for a sleeping Time Capsule disk to spin up.
- **If the share drops off** (after sleep, say), it is **mounted again
  automatically**. CapsulePlayer remembers the server address from the first
  time you connect.
- **Bad files are skipped** rather than stopping playback.
- **The library index is cached on your Mac**, so thousands of songs show up
  instantly at launch. Rescans only read tags from new or changed files. Scans
  never wander into the Time Machine backups that share the disk.

## Build it

You need Apple's compiler:

- **Leopard / Snow Leopard:** install Xcode from your Mac OS X install DVD
  (or Xcode 3.x from developer.apple.com).
- **Lion and later:** run `xcode-select --install` in Terminal.

Then, in Terminal:

```bash
cd mac-player
```

```bash
make
```

```bash
make install
```

The last step copies **CapsulePlayer.app** into /Applications. `make run`
builds it and opens it without installing.

## First run

1. Connect to the Time Capsule in the Finder. Click it under **Shared** in
   the sidebar, or choose **Go > Connect to Server** and enter
   `afp://Your-Time-Capsule.local`. Tick "Remember this password in my
   keychain".
2. Open CapsulePlayer and choose your **music folder** on the Time Capsule.
   Pick the music folder itself, not the whole disk.
3. The first scan reads the tags of every song over the network. With
   thousands of songs it can take a few minutes, and you can play music
   while it runs. Later scans take seconds.

## Controls

| Key | Action |
| --- | --- |
| **Z X C V B** | Previous, Play, Pause, Stop, Next (just like Winamp) |
| **Space** | Pause / resume |
| **Return** or double-click | Play the selected song |
| **Left / Right arrow** | Skip back / forward 5 seconds |
| **Cmd-Left / Cmd-Right** | Previous / next song |
| **Cmd-Up / Cmd-Down** | Volume |
| **Cmd-S / Cmd-R** | Shuffle / Repeat |
| **Cmd-F** | Search |
| **Cmd-J** | Jump to the playing song |
| **Cmd-K** | Reconnect to the Time Capsule |

- Click the big time readout to switch between elapsed and remaining time.
- Click a column header to sort by it.
- Previous restarts the song if you're more than 3 seconds in.
- In shuffle mode, Previous goes back through what you actually heard.
- Shuffle never repeats a song until everything (in the current search) has
  played.
- The playlist is whatever the search box is showing. Search for an artist
  and press Play to hear just them.

## The icon

The icon lives in `icon/`:

- `icon.svg` is the artwork.
- `icon-1024.png` is the artwork rendered at 1024 x 1024.
- `CapsulePlayer.icns` is the Mac icon file built from that PNG.

`make` copies the `.icns` into the app.

**To use your own picture:** make a square PNG, ideally 1024 x 1024 with a
transparent background. Save it as `icon/icon-1024.png`, then run:

```bash
pip3 install pillow
```

```bash
make icon install
```

**Quicker, for just your Mac:** open any image in Preview and press
Cmd-A, Cmd-C. In the Finder, select CapsulePlayer and choose
**File > Get Info**. Click the small icon at the top left of the Info window
and press Cmd-V. This change is lost the next time you run `make install`.

If the Dock or Finder still shows the old icon, it's the Finder's icon cache.
Log out and back in, or restart the Mac.

## Formats

MP3, AAC/M4A (not DRM-protected iTunes Store `.m4p` files), WAV and AIFF.
These are the formats Mac OS X can decode on its own. FLAC and Ogg aren't
supported.

## Files

- `src/AudioEngine.m`: gapless playback (AudioQueue + ExtAudioFile)
- `src/TrackLoader.m`: fetches songs off the network with retries and remounting
- `src/Library.m`: background folder scan and on-disk cache
- `src/TagReader.m`: ID3v1 / ID3v2.2-2.4 tag reader
- `src/VolumeHelper.m`: finds and remounts the Time Capsule share
- `src/AppController.m`: the window, playlist and controls

Settings live in the app's preferences. The library cache is
`~/Library/Application Support/CapsulePlayer/Library.plist`; delete it to
force a full rescan.
