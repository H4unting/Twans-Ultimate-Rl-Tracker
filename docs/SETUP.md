# Twans Ultimate Tracker — Setup

One app everywhere. Sign in with **Google or email** — log games, view stats, and manage squads from **any device**. Auto-log from Rocket League or Valorant when a game launcher is running on your gaming PC.

## 1. Download the full repo

Download the **entire** project as a ZIP from GitHub — not just a single `.bat` file. You need `index.html`, `js/`, `css/`, and `scripts/`.

## 2. Install Node.js

Install [Node.js LTS](https://nodejs.org/) (v18+). Open a terminal in the project folder and run:

```bat
node --version
```

## 3. Rocket League Stats API

1. Install [BakkesMod](https://bakkesmod.com/) and the **Stats API** plugin.
2. Edit `DefaultStatsAPI.ini` (BakkesMod config folder):
   ```ini
   PacketSendRate=10
   ```
3. Restart Rocket League after changing the config.

## 4. Set your in-game name

Open **`Rocket League Tracker.bat`** and set `RLNAME` to match your Rocket League display name **exactly** (case-sensitive).

The in-app setup wizard also saves your name — **restart the launcher** after changing it so auto-log picks it up.

## 5. Sign-in & Supabase (first time)

1. Sign in with **Google** or **email + password** on the tracker.
2. In [Supabase](https://supabase.com) → **Authentication** → **Providers**:
   - Enable **Google** (OAuth client ID/secret)
   - Enable **Email** (confirm email on or off — if on, users must click the link before first sign-in)
3. Under **Authentication** → **URL Configuration**, add your site to **Redirect URLs**, e.g.  
   `https://h4unting.github.io/Twans-Ultimate-Rl-Tracker/`
4. In Supabase → **SQL Editor**, run **`docs/supabase/v1-full-setup.sql`** once.  
   It is idempotent (safe to re-run). It replaces the older individual files in `docs/supabase/`.

### Two ways to use the tracker

| Type | What you need | Updates |
|------|----------------|---------|
| **Website only** | Bookmark the GitHub Pages URL, sign in | Hard refresh (`Ctrl+Shift+R`) after each deploy — no download |
| **Auto-log (gaming PC)** | Full repo folder + a game launcher (see below) | Re-download the ZIP or `git pull` when bridge/scripts change; website users only need refresh |

First sign-in may prompt for your current rank (MMR for Rocket League queues, RR for Valorant Competitive). That baseline is stored in your account so stats display correctly from day one.

## 6. Daily use

### Game launchers (recommended)

| Game | Double-click | What happens |
|------|--------------|--------------|
| **Rocket League** | **`Rocket League Tracker.bat`** | Starts tracker + bridge → opens http://localhost:8080 → launches Rocket League via Steam (`steam://rungameid/252950`) |
| **Valorant** | **`Valorant Tracker.bat`** | Starts Val bridge → opens tracker tab immediately → launches Valorant via Riot Client |

Keep the launcher window open while you play.

**Legacy names:** `start-grind.bat` and `start-val-grind.bat` still work — they forward to the files above.

**Rocket League on Epic:** if the Steam link does not open your game, launch Rocket League from the Epic Games launcher manually.

**Valorant fallback:** if Valorant does not launch, install/update the [Riot Client](https://playvalorant.com/) or run Valorant manually. The launcher tries `RiotClientServices.exe --launch-product=valorant --launch-patchline=live` first, then `riotclient://launch-product=valorant&patchline=live`.

### Tray app (no black window)

1. One-time: double-click **`build-tray-app.bat`** (or run `tools\launcher\build-bridge.bat`) to build **`Twans Auto-Log.exe`** in the tracker folder.
2. Before you queue: double-click **`Twans Auto-Log.exe`**.
3. A tray icon appears (orange = waiting for RL, green = connected). Right-click for **Open tracker** or **Quit**.
4. Optional: edit **`config/bridge-launcher.json`** for your tracker URL and whether to open the browser on start.

| What the auto-log app does |
|--------------------------|
| Reads RL / Valorant stats on your PC and auto-logs matches |
| Opens your tracker URL in the browser (bat launchers open it automatically) |
| Keep it running while you play |

Use `http://localhost:8080` as the tracker URL only if you want the local copy from this folder offline.

**On phone / another device:** open the same GitHub Pages bookmark, sign in — same stats, manual logging via the dock.

| Service | When |
|---------|------|
| Your tracker URL | GitHub Pages bookmark (or localhost if you changed it) |
| Auto-log | Game launcher or **`Twans Auto-Log.exe`** on gaming PC |
| Rocket League API | TCP :49123 (BakkesMod) |

## 7. After each game

When a match ends (with auto-log running):

1. **Auto-log** saves W/L, mode, G/A/S, and estimated MMR.
2. The **post-match card** appears — **type your real MMR** from the ranked screen when estimated.
3. Tap **quick tags** if something went wrong.
4. **Undo log** if the game was logged by mistake.

**Without auto-log:** use the dock manually — W/L, G/A/S, End MMR, LOG.

**Dock toggles:**
- **Auto-log** — save games automatically on match end (needs auto-log running)
- **🔔** — sound on auto-log

## 8. What's the same everywhere

Once signed in, you get the **same app** on GitHub Pages and localhost:

- Log games & edit match logs
- Sessions, post-match card, squads, goals, reports
- Data syncs via Supabase

**Only difference:** automatic stats need a launcher or **Twans Auto-Log** running on the PC where you're playing.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `MODULE_NOT_FOUND` for scripts | Download the full repo ZIP, not just the bat file |
| Auto-log off in dock | Run **`Rocket League Tracker.bat`** or **`Valorant Tracker.bat`**, keep the game open, check BakkesMod Stats API (RL) |
| Wrong player stats | Use **Apply & Go** in Auto-Log Setup, or set `RLNAME` in **`Rocket League Tracker.bat`**, then restart the launcher |
| Rocket League did not launch | Open RL manually from Steam (app ID 252950) or Epic Games |
| Valorant did not launch | Open Valorant manually from Riot Client |
| Build the tray app | Double-click **`build-tray-app.bat`** once (needs Node.js) |
| Port already in use | Close old terminal windows / restart the launcher |
| Can't save games | Sign in with Google first |
| Session resets | Update to latest code — sessions persist in localStorage |
| Policy / recursion error | Re-run `docs/supabase/v1-full-setup.sql` in Supabase |
| Valorant auto-log error | Riot dev keys (`RGAPI-…`) **cannot** read Val match history. Get a **free Henrik key** at [api.henrikdev.xyz/dashboard](https://api.henrikdev.xyz/dashboard), paste in Auto-Log Setup, **Apply & Go**, restart the launcher |

## Quick test

- [ ] Sign in on your bookmarked URL
- [ ] `TRACKER_URL` in **`Rocket League Tracker.bat`** matches your GitHub Pages URL (if you changed it)
- [ ] **`Rocket League Tracker.bat`** or **`Valorant Tracker.bat`** → dock shows connected (green pill)
- [ ] Start session → play a game → post-match card
- [ ] Refresh — same session # and stats
- [ ] Open on phone — same games visible
