# Twans Val Auto-Log (Overwolf)

Simple Valorant auto-log — **no Henrik API key, no Riot ID setup**. Overwolf reads match data from the game client and sends it to your local tracker bridge.

## What you still need running

1. **`Valorant Tracker.bat`** or **`Twans Auto-Log.exe`** — the local bridge the tracker talks to
2. **Tracker** at `http://localhost:8080` (or your GitHub Pages bookmark for manual log only)
3. **Overwolf** with this app loaded

Rocket League auto-log still uses BakkesMod + the same bridge app.

## Install (one time)

1. Install [Overwolf](https://www.overwolf.com/) from their website (browser download — you do **not** need the Store page inside Overwolf to work)
2. In Overwolf: **Settings → Support → Development options → Load unpacked extension**
3. Select this folder: **`integrations/overwolf`** inside your tracker download
4. Enable **Twans Val Auto-Log** in the Overwolf app list (Library tab, or the apps tray)

**Ignore Store / “Can’t load this page”** — that only means Overwolf cannot reach its online Store. Unpacked extensions load locally and do not need the Store.

## Troubleshooting Overwolf

| Problem | Fix |
|---------|-----|
| **Not connected / Can’t load this page** (Store or Library) | Close Overwolf fully (tray → Quit), check internet/VPN/firewall, reopen. You can still load the unpacked extension via **Development options** without the Store. |
| Extension won’t load | Make sure `icon.png` exists and you selected **`integrations/overwolf`** (not the whole repo root). |
| Tracker says auto-log off | Run **`Valorant Tracker.bat`** or **`Twans Auto-Log.exe`** first — Overwolf only sends data to that local bridge. |
| No match logged | Turn **Auto-log** on in the tracker dock, play a full match (not custom/training — Overwolf does not fire on those). |

## Daily use

1. Start **`Twans Auto-Log.exe`** (or **`Valorant Tracker.bat`**)
2. Open tracker → turn **Auto-log** on in the dock
3. Launch Valorant — play a match — it logs when the match ends

Status pill should show **Overwolf linked** or **Auto-log ON**.

## Fallback

If Overwolf is not installed, use **Auto-Log Setup** in the tracker with Riot ID + free Henrik key instead.

## Publish to Overwolf store (optional)

To ship publicly, create a developer account at [Overwolf Developers](https://dev.overwolf.com/), add store assets, and submit this folder for review.
