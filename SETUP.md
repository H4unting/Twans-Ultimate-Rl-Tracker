[SETUP.md](https://github.com/user-attachments/files/28415973/SETUP.md)
# RL Grind Tracker — Setup

Quick guide for getting grind mode running on Windows.

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

The in-app setup wizard also saves your name to preferences — **restart `start-grind.bat`** after changing it so the bridge picks it up.

## 5. Google sign-in & Supabase (first time)

1. Sign in with Google on the tracker.
2. In [Supabase](https://supabase.com), run the SQL files from the repo:
   - `schema.sql` — games & profile
   - `auth-schema.sql` — auth policies
   - `groups-schema.sql` — squads (optional)
   - `groups-schema-fix.sql` — only if you see an "infinite recursion" policy error

## 6. Start grind mode

Double-click `start-grind.bat`. It opens:

| Service | URL / port |
|---------|------------|
| Tracker site | http://localhost:8080 |
| Stats bridge | http://127.0.0.1:49200 |
| Rocket League API | TCP :49123 |

Sign in, complete the setup wizard, then **▶ Start Session** before queueing.

## 7. After each game

When a match ends:

1. **Auto-log** saves W/L, mode, G/A/S, and estimated MMR.
2. The **post-match card** appears — **type your real MMR** from the ranked screen (required when estimated).
3. Tap **quick tags** if something went wrong.
4. **Undo log** if the game was logged by mistake.
5. **Next game →** when done.

**Dock toggles:**
- **Auto-log** — save games automatically on match end
- **🔔** — sound on auto-log (respects reduced-motion)

**First session:** type your MMR in the dock bar once — auto-log uses it from then on.

**Sessions persist across refresh** — your session #, timer, and live stats are saved locally per Google account.

## 8. Features overview

| Feature | Grind (localhost) | Glance (GitHub Pages) |
|---------|-------------------|------------------------|
| View stats & charts | ✅ | ✅ |
| Log games / dock | ✅ | ❌ |
| Auto-log from RL | ✅ | ❌ |
| Post-match MMR confirm | ✅ | ❌ |
| Session history tab | ✅ | ✅ view |
| Match logs + CSV export | ✅ | ✅ view |
| Reports / Focus / Squads | ✅ | ✅ view |
| Create/join squads | ✅ localhost | view only |

## 9. Ranked playlist detection

The bridge reads playlist info from the Stats API when available (Ranked Duel/Doubles/Standard, etc.) and sets mode automatically. If playlist data isn't sent, it falls back to player count (1's / 2's / 3's).

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `MODULE_NOT_FOUND` for scripts | Download the full repo ZIP, not just the bat file |
| Auto stats off | Run `start-grind.bat`, keep RL open, check BakkesMod Stats API |
| Wrong player stats | Fix `RLNAME` in `start-grind.bat` and restart |
| Port already in use | Close old terminal windows / restart the bat file |
| Edits blocked on GitHub | Normal — logging only works on localhost |
| Session resets to 1 | Update to latest `js/sessions.js` — sessions now persist in localStorage |
| Policy / recursion error | Run `groups-schema-fix.sql` in Supabase |
| MMR? badge stuck | Confirm MMR on the post-match card or in Match Logs |

## Quick test checklist

- [ ] `start-grind.bat` opens http://localhost:8080
- [ ] Bridge shows connected (green dot in dock)
- [ ] Start session → play a game → post-match card appears
- [ ] Save real MMR → badge clears
- [ ] Refresh page → same session # and stats
- [ ] End session → recap modal → next session number increments
