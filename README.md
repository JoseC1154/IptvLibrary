# Public Link
https://josec1154.github.io/IptvLibrary/

# IPTV Library PWA 

A GitHub-friendly Progressive Web App to organize IPTV links into channel groups (for example: Kids Channel, Movie Channel) with an Apple TV–style library view.

## Features

- Create, edit, and delete channel groups
- Create, edit, and delete channels
- Import M3U/M3U8 playlist files and view parsed channels
- Submit a direct network stream URL from the import dialog
- Batch scan all saved channels to flag reachable/blocked/problem streams
- Add individual channels from imported playlist
- Add all channels from imported playlist in one click
- Mini-play channels directly from imported playlist without adding first
- Choose target group per imported channel before adding
- Store channel details:
  - Channel name
  - Group
  - IPTV link URL
  - Custom photo URL (internet URL)
- Browse by group: click a group to see its channel list
- Built-in media player for channels
- Sticky mini "Now Playing" bar with quick Play and Cast actions
- Floating minimized video tile (keeps stream playing while browsing)
- Cast support:
  - Chromecast (when available in browser/network)
  - Browser device picker / AirPlay fallback where supported
  - System player handoff (for native device routing/casting outside browser)
- Export your full library to JSON
- Import library from JSON
- Works offline after first load (service worker)
- Installable as a PWA

## Project Files

- `index.html` — app layout and dialogs
- `styles.css` — Apple TV–style glassmorphism theme
- `app.js` — all UI logic + local storage + import/export
- `manifest.webmanifest` — PWA manifest
- `sw.js` — offline caching service worker
- `assets/icons/icon.svg` — app icon

## Run Locally

Use any static server (recommended for service worker testing):

```bash
python3 -m http.server 5500
```

Then open:

```text
http://localhost:5500
```

## Deploy on GitHub Pages

1. Push this folder to a GitHub repository.
2. In GitHub, go to **Settings → Pages**.
3. Set source to your default branch (root folder).
4. Save and open your Pages URL.

The app is fully static, so it is ideal for GitHub Pages.

## Data Format

Library exports use this JSON shape:

```json
{
  "version": 1,
  "groups": [{ "id": "group-1", "name": "Kids Channel" }],
  "channels": [
    {
      "id": "channel-1",
      "name": "Cartoon Mix",
      "groupId": "group-1",
      "streamUrl": "https://example.com/live.m3u8",
      "imageUrl": "https://example.com/image.jpg"
    }
  ]
}
```

## Notes

- Data is stored in browser local storage.
- Image links can be any public internet image URL (`https://...`).
- Channel cards open in the in-app player. Use **Open External** for a direct link.
- M3U import picks channel title from `tvg-name`, `EXTINF` title, then URL fallback.
- Clicking outside the player dialog minimizes it to a floating tile (stream keeps playing) so you can browse/select another stream.
- Browser playback requires stream servers to allow CORS (`Access-Control-Allow-Origin`). If blocked, use **Open External** or **Cast**.
- **Scan Channels** runs browser-side checks and marks cards with `Scan: Reachable`, `Scan: Blocked (403)`, or issue warnings.
- Double-click a group in the sidebar to edit it.
- Click **Edit** on any channel card to update or remove it.
