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

## 5. Start grind mode

Double-click `start-grind.bat`. It opens:

- **Site:** http://localhost:8080
- **Bridge:** connects RL → tracker on ports 49123 / 49200

Sign in with Google, complete the setup wizard, then **▶ Start Session** before queueing.

## 6. After each game

When a match ends:

1. **Auto-log** saves W/L, mode, G/A/S, and estimated MMR.
2. The **post-match card** appears — type your **real MMR** from the ranked screen.
3. Tap **quick tags** if something went wrong.
4. **Undo log** if the game was logged by mistake.

First session: type your MMR in the dock bar once — auto-log uses it from then on.

## Glance vs grind

| | GitHub Pages | localhost (start-grind.bat) |
|---|---|---|
| View stats | ✅ | ✅ |
| Log games | ❌ | ✅ |
| Auto-log from RL | ❌ | ✅ |
| Post-match card | ❌ | ✅ |

## Troubleshooting

| Problem | Fix |
|---|---|
| `MODULE_NOT_FOUND` for scripts | Download the full repo ZIP, not just the bat file |
| Auto stats off | Run `start-grind.bat`, keep RL open, check BakkesMod Stats API |
| Wrong player stats | Fix `RLNAME` in `start-grind.bat` |
| Port already in use | Close old terminal windows / restart the bat file |
| Edits blocked on GitHub | Normal — logging only works on localhost |
