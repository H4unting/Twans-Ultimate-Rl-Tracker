# Twans Ultimate Tracker

Rocket League + Valorant grind tracker — **premium Windows desktop app** with local auto-log and Supabase sync.

## Players start here

**Install → Open → Sign in → Play.** No batch files, ports, or dev tools for normal use.

| You want… | Start here |
|-----------|------------|
| **Play on your PC (auto-log)** | Install **`TwansUltimateTrackerSetup.exe`** or run **`Twans Ultimate Tracker.exe`** |
| **Bookmark + manual logging only** | https://h4unting.github.io/Twans-Ultimate-Rl-Tracker/ |
| **Full desktop vision & roadmap** | **[docs/DESKTOP-VISION.md](docs/DESKTOP-VISION.md)** |
| **Player setup help** | **[docs/USER-SETUP.md](docs/USER-SETUP.md)** |

Developer / owner setup: **[docs/SETUP.md](docs/SETUP.md)**

## Quick start (players)

1. Double-click **`Twans Ultimate Tracker.exe`** (or install via **`TwansUltimateTrackerSetup.exe`**)
2. Sign in when prompted
3. Complete the short onboarding (games + starting ranks)
4. Click **▶ Play** for Rocket League or Valorant — sessions and auto-log run in the background

Close the window to minimize to the **system tray**; tracking keeps running until you choose **Quit** from the tray menu.

## Developers only

Root `*.bat` files (`Rocket League Tracker.bat`, `Valorant Tracker.bat`, etc.) are **DEVELOPER ONLY** fallbacks when working on the repo without rebuilding the Electron app.

| Task | Command |
|------|---------|
| Build portable exe | `build-tray-app.bat` |
| Build installer | `cd tools/launcher && npm run build:installer` |
| Dev launcher (Node) | `Rocket League Tracker.bat` or `Valorant Tracker.bat` |

Full setup: **[docs/SETUP.md](docs/SETUP.md)**  
Folder map: **[docs/STRUCTURE.md](docs/STRUCTURE.md)**

## Root folder (keep it simple)

Launchers and the web app shell live at the top level. Keys and logs go in **`config/`**. Docs and extras live under **`docs/`**, **`integrations/`**, and **`tools/`**.
