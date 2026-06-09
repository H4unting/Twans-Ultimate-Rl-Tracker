# Twans Ultimate Tracker (desktop launcher)

Windows tray app that starts the local tracker (`localhost:8080`), bridge (`:49200`), and opens your browser — no black console window.

## Build (once)

1. Install [Node.js LTS](https://nodejs.org).
2. Double-click **`build-bridge.bat`** in this folder (or **`build-tray-app.bat`** from repo root).
3. The portable exe is copied to the tracker root: **`Twans Ultimate Tracker.exe`**

## Daily use

1. Double-click **`Twans Ultimate Tracker.exe`** (same folder as the tracker).
2. Tray icon:
   - **Green** — Tracking (game connected)
   - **Yellow** — Waiting (ready, launch your game)
   - **Blue** — Starting services
   - **Red** — Error (see `bridge.log`; auto-restarts up to 8 times)
3. Keep it running while you play. Quit from the tray menu when done.

Legacy names `Twans Auto-Log.exe` and `Twans-Tracker-Bridge.exe` are copied too if not locked.

## Config

Edit **`config/bridge-launcher.json`** in the tracker folder:

| Key | Purpose |
|-----|---------|
| `trackerUrl` | Bookmark opened from tray menu |
| `openBrowserOnStart` | Open tracker when app starts |

Logs (if something fails): **`bridge.log`** in the tracker root.

## Notes

- Still uses **Node.js** under the hood (same as the game launcher `.bat` files).
- **v1.1+:** stats scripts are bundled inside the exe — you only need the exe in any folder (plus Node.js). Config files live in **`config/`** next to the tracker (`grind-config.json`, `bridge.log`).
- Older builds were named `Twans-Tracker-Bridge.exe` — same app, new name.
