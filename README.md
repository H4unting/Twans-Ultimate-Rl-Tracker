# Twans Ultimate Tracker

Rocket League + Valorant grind tracker with local auto-log and Supabase sync.

## Quick start

| What | File |
|------|------|
| **Play Rocket League** | Double-click **`Rocket League Tracker.bat`** |
| **Play Valorant** | Double-click **`Valorant Tracker.bat`** |
| **Open tracker** | http://localhost:8080 (while a launcher is running) |

Legacy names `start-grind.bat` and `start-val-grind.bat` still work (they forward to the files above).

Full setup: **[docs/SETUP.md](docs/SETUP.md)**  
Folder map: **[docs/STRUCTURE.md](docs/STRUCTURE.md)**

## Root folder (keep it simple)

Only launchers and the web app shell live at the top level. Keys and logs go in **`config/`**. Docs and extras live under **`docs/`**, **`integrations/`**, and **`tools/`**.
