# Twans Auto-Log (tray app)

Small Windows tray app that reads game stats and sends them to the tracker — no black console window.

## Build (once)

1. Install [Node.js LTS](https://nodejs.org).
2. Double-click **`build-bridge.bat`** in this folder.
3. The portable exe is copied to the tracker root: **`Twans Auto-Log.exe`**

## Daily use

1. Double-click **`Twans Auto-Log.exe`** (same folder as `start-grind.bat`).
2. Tray icon:
   - **Green** — Rocket League connected, stats flowing
   - **Orange** — app running, waiting for Rocket League
   - **Red** — error (see `bridge.log` in tracker folder)
3. Keep it running while you play. Quit from the tray menu when done.

## Config

Edit **`config/bridge-launcher.json`** in the tracker folder:

| Key | Purpose |
|-----|---------|
| `trackerUrl` | Bookmark opened from tray menu |
| `openBrowserOnStart` | Open tracker when app starts |

Logs (if something fails): **`bridge.log`** in the tracker root.

## Notes

- Still uses **Node.js** under the hood (same as `start-grind.bat`).
- **v1.1+:** stats scripts are bundled inside the exe — you only need the exe in any folder (plus Node.js). Config files live in **`config/`** next to the tracker (`grind-config.json`, `bridge.log`).
- Older builds were named `Twans-Tracker-Bridge.exe` — same app, new name.
