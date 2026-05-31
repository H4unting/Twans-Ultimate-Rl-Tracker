# Twans Tracker Bridge (tray launcher)

Windows system-tray app that runs the RL stats bridge without a console window.

## Build once

1. Install [Node.js LTS](https://nodejs.org/) if you have not already.
2. Double-click **`build-bridge.bat`** in this folder.
3. The portable exe is copied to the tracker root: **`Twans-Tracker-Bridge.exe`**

## Daily use

1. Double-click **`Twans-Tracker-Bridge.exe`** (same folder as `start-grind.bat`).
2. Tray icon:
   - **Orange** — bridge running, waiting for Rocket League
   - **Green** — connected to RL, auto-stats active
3. **Double-click** tray icon or use **Open tracker** in the menu.
4. **Quit** when done playing.

## Config

Edit **`bridge-launcher.json`** in the tracker root:

```json
{
  "trackerUrl": "https://h4unting.github.io/Twans-Ultimate-Rl-Tracker/",
  "openTrackerOnStart": true
}
```

Bridge logs (if something fails): **`bridge.log`** in the tracker root.

## Dev

```bat
cd launcher
npm install
npm start
```

Requires the tracker repo layout (`scripts/start-grind.mjs` two folders up).

## Notes

- Still uses **Node.js** under the hood to run the bridge scripts (same as `start-grind.bat`).
- Node must be on your PATH, or place a portable `node.exe` at `launcher/node-runtime/node.exe`.
- The exe must live in the **full tracker folder** (with `scripts/`, `index.html`, etc.).
- **v1.1+:** bridge scripts are bundled inside the exe — you only need the exe in any folder (plus Node.js). Config files (`grind-config.json`, `bridge.log`) are written next to the exe.
