# Teams Tile Swapper

Chrome extension that overlays a custom image on Microsoft Teams participant tiles in the web client (`teams.cloud.microsoft`, `teams.microsoft.com`, `teams.live.com`).

## Install (unpacked)

1. Open `chrome://extensions`
2. Toggle **Developer mode** on (top-right)
3. Click **Load unpacked** and pick this folder (`msteamsfun`)
4. Click the extension icon → upload your custom image

## Options

- **Enabled** — master toggle.
- **Replace even when video is on** — if off, only tiles with the camera off get the overlay.
- **Custom image** — uploaded image is downscaled to 1024px max and stored in `chrome.storage.local`.

## How it works

A content script runs on Teams pages, scans the DOM for participant tiles, and appends a `<div>` overlay with your image as `background-image`. A `MutationObserver` plus a 1.5s interval keep it applied as the layout reshuffles during a meeting.

## Known limitations

- Teams class names are hashed and change between releases. The selectors in `content.js` (`TILE_SELECTORS`) target `data-tid` attributes and class-name substrings, but you may need to tweak them if Microsoft ships a layout change.
- Only works in the browser. The Teams desktop app is a separate Electron-ish client and does not load Chrome extensions.
- If a tile is a `<canvas>` element (some Teams variants render remote video to canvas), the "video active" check may miss it — turn on **Replace even when video is on** as a workaround.

## Tweaking selectors

Open DevTools in a Teams meeting, right-click a participant tile → Inspect, find the outer wrapper (look for `data-tid="..."` or a class containing `participantTile`/`videoTile`), and add that selector to `TILE_SELECTORS` in `content.js`.
