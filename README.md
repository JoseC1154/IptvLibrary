# IPTV Library PWA

A GitHub-friendly Progressive Web App to organize IPTV links into channel groups (for example: Kids Channel, Movie Channel) with an Apple TV–style library view.

## Features

- Create, edit, and delete channel groups
- Create, edit, and delete channels
- Store channel details:
  - Channel name
  - Group
  - IPTV link URL
  - Custom photo URL (internet URL)
- Browse by group: click a group to see its channel list
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
- Double-click a group in the sidebar to edit it.
- Click **Edit** on any channel card to update or remove it.
