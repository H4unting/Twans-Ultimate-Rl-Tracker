# Twans Ultimate Tracker — Setup

One app everywhere. Sign in with **Google or email** — log games, view stats, and manage squads from **any device**. Auto-log from Rocket League when **Twans Auto-Log** or `start-grind.bat` is running on your gaming PC.

## 1. Download the full repo

Download the **entire** project as a ZIP from GitHub — not just `start-grind.bat`. You need `index.html`, `js/`, `css/`, and `scripts/`.

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

Open `start-grind.bat` and set `RLNAME` to match your Rocket League display name **exactly** (case-sensitive).

The in-app setup wizard also saves your name — **restart `start-grind.bat`** after changing it so auto-log picks it up.

## 5. Sign-in & Supabase (first time)

1. Sign in with **Google** or **email + password** on the tracker.
2. In [Supabase](https://supabase.com) → **Authentication** → **Providers**:
   - Enable **Google** (OAuth client ID/secret)
   - Enable **Email** (confirm email on or off — if on, users must click the link before first sign-in)
3. Under **Authentication** → **URL Configuration**, add your site to **Redirect URLs**, e.g.  
   `https://h4unting.github.io/Twans-Ultimate-Rl-Tracker/`
4. Run the SQL files from the repo:
   - `schema.sql` — games & profile
   - `auth-schema.sql` — auth policies
   - `multi-game.sql` — Rocket League + Valorant on one account
   - `groups-schema.sql` — squads (optional)
   - `profile-customization.sql` — profile colors + url# signup numbers
   - `groups-schema-fix.sql` — only if you see an "infinite recursion" policy error

## 6. Daily use

**Recommended — tray app (no black window):**

1. One-time: open `launcher\build-bridge.bat` to build **`Twans Auto-Log.exe`** in the tracker folder.
2. Before you queue: double-click **`Twans Auto-Log.exe`**.
3. A tray icon appears (orange = waiting for RL, green = connected). Right-click for **Open tracker** or **Quit**.
4. Optional: edit `bridge-launcher.json` for your tracker URL and whether to open the browser on start.

**Classic — batch file:**

Double-click `start-grind.bat` before you queue. Edit `TRACKER_URL` in that file (or use `bridge-launcher.json` with the tray app).

| What Twans Auto-Log does |
|--------------------------|
| Reads RL / Valorant stats on your PC and auto-logs matches |
| Opens your tracker URL in the browser (bat only; tray uses menu or `openTrackerOnStart`) |
| Keep it running while you play |

Use `http://localhost:8080` as the tracker URL only if you want the local copy from this folder offline.

**On phone / another device:** open the same GitHub Pages bookmark, sign in — same stats, manual logging via the dock.

| Service | When |
|---------|------|
| Your tracker URL | GitHub Pages bookmark (or localhost if you changed it) |
| Auto-log app | **`Twans Auto-Log.exe`** or `start-grind.bat` on gaming PC |
| Rocket League API | TCP :49123 (BakkesMod) |

## 7. After each game

When a match ends (with auto-log running):

1. **Auto-log** saves W/L, mode, G/A/S, and estimated MMR.
2. The **post-match card** appears — **type your real MMR** from the ranked screen when estimated.
3. Tap **quick tags** if something went wrong.
4. **Undo log** if the game was logged by mistake.

**Without auto-log:** use the dock manually — W/L, G/A/S, End MMR, LOG.

**Dock toggles:**
- **Auto-log** — save games automatically on match end (needs **Twans Auto-Log** running)
- **🔔** — sound on auto-log

## 8. What's the same everywhere

Once signed in, you get the **same app** on GitHub Pages and localhost:

- Log games & edit match logs
- Sessions, post-match card, squads, goals, reports
- Data syncs via Supabase

**Only difference:** automatic stats need **Twans Auto-Log** (or `start-grind.bat`) running on the PC where you're playing.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `MODULE_NOT_FOUND` for scripts | Download the full repo ZIP, not just the bat file |
| Auto-log off in dock | Run **`Twans Auto-Log.exe`** or `start-grind.bat`, keep RL open, check BakkesMod Stats API |
| Wrong player stats | Use **Apply & Go** in Auto-Log Setup, or set `RLNAME` in `start-grind.bat`, then restart auto-log |
| Build the tray app | Run `launcher\build-bridge.bat` once (needs Node.js) |
| Port already in use | Close old terminal windows / restart the bat file |
| Can't save games | Sign in with Google first |
| Session resets | Update to latest code — sessions persist in localStorage |
| Policy / recursion error | Run `groups-schema-fix.sql` in Supabase |
| Valorant auto-log error | Riot dev keys (`RGAPI-…`) **cannot** read Val match history. Get a **free Henrik key** at [api.henrikdev.xyz/dashboard](https://api.henrikdev.xyz/dashboard), paste in Auto-Log Setup, **Apply & Go**, restart **Twans Auto-Log** |

## Quick test

- [ ] Sign in on your bookmarked URL
- [ ] `TRACKER_URL` in `start-grind.bat` matches your GitHub Pages URL
- [ ] **`Twans Auto-Log.exe`** or `start-grind.bat` → dock shows connected (green pill)
- [ ] Start session → play a game → post-match card
- [ ] Refresh — same session # and stats
- [ ] Open on phone — same games visible
