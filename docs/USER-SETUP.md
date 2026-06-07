# Twans Ultimate Tracker — Player setup

This guide is for **players** who download the tracker from GitHub. You do **not** need admin rights, Supabase access, or developer tools to use the app.

**Bookmark (works on any device):**  
https://h4unting.github.io/Twans-Ultimate-Rl-Tracker/

---

## What works without anything installed

You can use the tracker **right in your browser** — no download, no Node.js, no local files.

| Feature | Works on GitHub Pages? |
|---------|------------------------|
| Sign in (Google or email) | Yes |
| Manual match logging (dock W/L, stats, tags) | Yes |
| View stats, sessions, goals, squads | Yes |
| Sync across phone / PC (same account) | Yes |
| **Automatic** match logging from Valorant or Rocket League | No — needs a local launcher on your gaming PC (see below) |

After each site update, hard refresh once: **Ctrl+Shift+R** (or Cmd+Shift+R on Mac).

---

## What needs your PC (but not admin)

Local auto-log runs a small helper on **your** gaming PC. It does **not** need Windows administrator rights if port 8080 is free.

| What | Why |
|------|-----|
| **Full repo folder** (ZIP from GitHub, not just one `.bat` file) | Launchers need `index.html`, `js/`, `scripts/`, etc. |
| **Node.js LTS** | [nodejs.org](https://nodejs.org/) — free install, no admin for default user install |
| **Port 8080 free** | The tracker serves on `http://localhost:8080` while the launcher window is open |
| **Valorant:** free **Henrik API key** + your **Riot ID** (`Name#TAG`) | Recommended path for most players — see [Local auto-log (Valorant)](#local-auto-log-valorant-no-admin) |
| **Rocket League:** **BakkesMod** + Stats API plugin | See [Local auto-log (Rocket League)](#local-auto-log-rocket-league) |

Use **`Valorant Tracker (Player).bat`** (Valorant) or **`Rocket League Tracker.bat`** (Rocket League). Keep the black console window open while you play.

---

## What needs admin — or will not work for most players

| Item | Why players should skip it |
|------|----------------------------|
| **`Kill-Port-8080.bat`** | Uses `taskkill`, which often needs admin or fails on system processes. Close Live Server yourself instead (see [Port 8080 blocked](#if-port-8080-is-blocked-no-admin)). |
| **Killing random PIDs on port 8080** | Same as above — close the app that owns the port (VS Code Live Server, etc.). |
| **Supabase dashboard / SQL files** | For the project owner only. You just sign in on the website. |
| **Overwolf unpacked extension** | Overwolf blocks most accounts with **Unauthorized App** unless the developer is whitelisted. **Use Henrik API instead** — it works for everyone. |
| **`push-updates.bat`, `.cursor/`, internal scripts** | Developer-only — ignore them. See [WHAT-PLAYERS-DONT-NEED.md](WHAT-PLAYERS-DONT-NEED.md). |

---

## Player quick start (website only)

Best if you only want to log games yourself and view stats.

1. Open the bookmark: https://h4unting.github.io/Twans-Ultimate-Rl-Tracker/
2. **Sign in** (Google or email).
3. Set your rank when prompted (first time).
4. After each game, use the **dock** at the bottom: W/L, goals/assists/saves (RL) or K/D/A (Val), end rank/MMR, **LOG**.
5. Optional: start a **session** before you queue so stats group by grind block.

Same account on your phone — open the same bookmark and sign in.

---

## Local auto-log (Valorant, no admin)

Recommended for Valorant players who want matches saved automatically.

### One-time setup

1. **Download the full project** from GitHub (green **Code → Download ZIP**). Unzip anywhere you can find it (Desktop is fine).
2. Install **Node.js LTS** from [nodejs.org](https://nodejs.org/) if you do not have it.
3. Make sure nothing else is using **port 8080** (close VS Code **Live Server** / **Live Preview** if you use them).
4. Double-click **`Valorant Tracker (Player).bat`** in the unzipped folder.
5. Your browser opens **`http://localhost:8080`**. Sign in with the **same account** as GitHub Pages.
6. Open **Auto-Log Setup** (from the hint banner or setup page):
   - Enter your **Riot ID** (`Name#TAG`, e.g. `Player#NA1`).
   - Get a **free Henrik API key** at [api.henrikdev.xyz/dashboard](https://api.henrikdev.xyz/dashboard/) (sign in there, copy key starting with `HDEV-`).
   - Paste the key, click **Apply & Go**.
7. Turn **Auto-log ON** in the dock (green pill when connected).

### Every time you play

1. Double-click **`Valorant Tracker (Player).bat`** — leave the window open.
2. Use the tab at **`http://localhost:8080`** (not the GitHub Pages bookmark for auto-log).
3. Confirm **Auto-log ON** in the dock.
4. Play Valorant. After a match ends, wait up to a few minutes (Henrik API can lag), then confirm rank on the post-match card if asked.

**Do not use Riot developer keys (`RGAPI-…`)** — they cannot read your match history. Henrik is the supported path.

---

## Local auto-log (Rocket League)

1. Install [BakkesMod](https://bakkesmod.com/) and the **Stats API** plugin.
2. In BakkesMod config, set `PacketSendRate=10` in `DefaultStatsAPI.ini`, then restart Rocket League.
3. Download the full repo ZIP and install Node.js (same as Valorant above).
4. Edit **`Rocket League Tracker.bat`** — set `RLNAME=` to your in-game display name **exactly** (or use Auto-Log Setup → Apply & Go).
5. Double-click **`Rocket League Tracker.bat`**, sign in on `http://localhost:8080`, turn **Auto-log ON**.

If Rocket League does not launch from the bat, open the game manually from Steam or Epic — auto-log still works while the launcher window is open.

---

## If port 8080 is blocked (no admin)

The tracker must use port **8080** on your PC for auto-log. Common blockers: **VS Code Live Server**, **Live Preview**, old tracker windows, or `npx serve`.

You **do not** need admin to fix this:

1. **Close** VS Code Live Server (click **Port: 8080** in the status bar → stop server), or close the editor tab running Live Preview.
2. **Close** any old **Valorant Tracker** / **Rocket League Tracker** console windows.
3. In a normal Command Prompt (no admin), check what is using the port:
   ```bat
   netstat -ano | findstr :8080
   ```
   The number on the far right is the process ID (PID). Open **Task Manager** (Ctrl+Shift+Esc) → **Details** → find that PID → **End task** on the app you recognize (often `Code.exe` or `node.exe` from Live Server).
4. Run **`Valorant Tracker (Player).bat`** again.

If you cannot free port 8080 (work PC, locked-down machine):

- Use **GitHub Pages only** — manual logging still works.
- You cannot run local auto-log until the port is free.

**Avoid `Kill-Port-8080.bat`** unless you know you have permission to kill that process — it uses `taskkill` and may fail without admin.

---

## Overwolf “Unauthorized App”

The Overwolf extension in this repo is **developer / unpacked** only. Most players see **Unauthorized App** even with the correct folder.

**What to do:** ignore Overwolf for now and use **Henrik API** in Auto-Log Setup (steps above). That is the path that works for regular users.

When Twans Val Auto-Log is published on the Overwolf Appstore, this section will be updated.

---

## Legal & privacy

- [Privacy policy](https://h4unting.github.io/Twans-Ultimate-Rl-Tracker/legal/privacy.html)
- [Terms of use](https://h4unting.github.io/Twans-Ultimate-Rl-Tracker/legal/terms.html)
- [Disclaimer](https://h4unting.github.io/Twans-Ultimate-Rl-Tracker/legal/disclaimer.html)

(Local copy in the ZIP: `legal/privacy.html`, `legal/terms.html`, `legal/disclaimer.html`.)

This project is not affiliated with Riot Games, Psyonix, or Epic Games.

---

## Quick troubleshooting

| Problem | What to try |
|---------|-------------|
| “Port 8080 already in use” | [If port 8080 is blocked](#if-port-8080-is-blocked-no-admin) — close Live Server manually |
| Auto-log off in dock | Run the player `.bat`, use `http://localhost:8080`, not GitHub Pages |
| Valorant matches not appearing | Henrik key applied? Riot ID correct? Wait 1–3 min after match; play Competitive |
| `MODULE_NOT_FOUND` / missing scripts | Download the **full** ZIP, not a single bat file |
| Can't save games | Sign in first on the same URL you are using |
| Overwolf Unauthorized App | Use Henrik API instead — see [Local auto-log (Valorant)](#local-auto-log-valorant-no-admin) |

---

## Developer setup

If you maintain the project or need Supabase, Overwolf dev load, or bridge internals, see **[SETUP.md](SETUP.md)** instead.
