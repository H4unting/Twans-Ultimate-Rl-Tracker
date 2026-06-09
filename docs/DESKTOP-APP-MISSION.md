# Desktop App Mission — Twans Ultimate Tracker

Make the tracker feel like a single polished desktop app: one exe, auto bridge, friendly status, play buttons, onboarding, and process-based sessions.

## Startup path audit (current repo)

| Path | Role | Status |
|------|------|--------|
| **`Twans Ultimate Tracker.exe`** | Primary launcher — Electron tray, spawns `start-grind.mjs`, opens `localhost:8080` | **Phase 1** — enhanced with crash restart + unified branding |
| `tools/launcher/src/main.cjs` | Electron entry — bridge spawn, tray, browser open | Enhanced v1.2 |
| `scripts/start-grind.mjs` | HTTP proxy `:8080` + bridge `:49200` + static tracker | Unchanged core; uses shared `game-launch.mjs` |
| `Rocket League Tracker.bat` | Dev fallback — Node + `--launch-rl` | **Kept** — not removed |
| `Valorant Tracker.bat` | Dev fallback — Val-only mode | **Kept** |
| `start-grind.bat` | Generic Node launcher | **Kept** |
| `build-tray-app.bat` | Builds exe via `tools/launcher` | Updated naming |
| `launcher/` (repo root) | Legacy duplicate of `tools/launcher` | Unchanged — use `tools/launcher` |
| GitHub Pages (`index.html` + static JS) | Remote bookmark / phone — **no auto-log** | **Not broken** — bridge only on localhost |

### Port map

- **8080** — Tracker UI + `/api/bridge/*` proxy (required for auto-log in browser)
- **49200** — Bridge API (RL stats, Val Henrik, launch, process detect)
- **49123** — Rocket League Stats API (game → bridge TCP)

### Friction points addressed in Phase 1

- Users had to know which `.bat` to run → exe is now primary in all UI copy
- Black console window → exe runs hidden (tray only)
- Bridge crash = manual restart → exe auto-restarts up to 8 times
- Jargon status pills → **Tracking / Waiting / Error / Connecting**
- Manual session start only → process watcher auto-starts session when game detected
- First match needed rank edit → onboarding wizard (game pick + rank baseline modal)

---

## Phases

### Phase 1 — Foundation (this session) ✅

- [x] Rebrand exe to **Twans Ultimate Tracker.exe** (legacy: `Twans Auto-Log.exe`)
- [x] Launcher crash restart + tray status (Tracking / Waiting / Error)
- [x] Bridge connectivity retry UI (`bridge-client.js` attempt counter)
- [x] Unified status pill in dock (`bridge-ui.js`)
- [x] **Play** button in dock + dashboard quick actions
- [x] Bridge API: `POST /launch/rocket-league`, `POST /launch/valorant`, `GET /processes`
- [x] Windows process detection (`process-watcher.mjs`)
- [x] Auto session start on game process (`process-session.js`)
- [x] First-run onboarding: game selection → rank baseline (`onboarding-wizard.js`)

### Phase 2 — In-app config (deferred)

- [ ] Settings panel: Henrik key, Riot ID, RL name, game paths — all in localStorage/Supabase
- [ ] Hide `grind-config.json` editing for normal users
- [ ] Apply & Go without touching `.bat` files

### Phase 3 — Session intelligence (deferred)

- [ ] Auto **end** session when game closes (with confirmation)
- [ ] Cross-game session handling (RL + Val same evening)
- [ ] Smarter Valorant detection (Riot Client vs shipping exe)

### Phase 4 — Polish (deferred)

- [ ] Embedded BrowserWindow instead of external browser tab
- [ ] Single-instance browser focus
- [ ] Bundled Node runtime (no separate Node install)
- [ ] Installer (NSIS) vs portable exe
- [ ] macOS support

---

## Build & run

### Build the exe (once per machine)

```bat
REM From tracker repo root:
build-tray-app.bat
```

Requires Node.js LTS + npm. Output:

- `tools/launcher/dist/Twans Ultimate Tracker.exe`
- Copied to repo root: `Twans Ultimate Tracker.exe`

### Daily use (players)

1. Double-click **`Twans Ultimate Tracker.exe`**
2. Browser opens **`http://localhost:8080`** — sign in if needed
3. Tray icon: blue = starting, yellow = waiting, green = tracking, red = error
4. Click **▶ Play** in the dock or dashboard to launch your game
5. Session auto-starts when the game process is detected (if not already live)

### Dev fallback (no exe build)

```bat
Rocket League Tracker.bat
REM or
Valorant Tracker.bat
```

### Manual test checklist (Phase 1)

1. `node --check` on all edited `.js` / `.mjs` files (see below)
2. Run `node scripts/start-grind.mjs` — verify `http://localhost:8080` loads
3. Verify `http://localhost:8080/api/bridge/status` returns JSON with `rocketLeagueRunning`
4. Sign in → new account should see onboarding modal (game pick → rank baseline)
5. With bridge up, click **▶ Play** — game should launch, session should start
6. Status pill cycles: Connecting → Waiting → Tracking (when game running)
7. Kill bridge process — exe should restart (tray shows "Restarting…")
8. GitHub Pages URL still loads tracker (manual log only, no bridge)

### Syntax check

```bat
node --check js/bridge-client.js
node --check js/bridge-ui.js
node --check js/game-launcher.js
node --check js/process-session.js
node --check js/onboarding-wizard.js
node --check js/boot.js
node --check js/app.js
node --check js/home.js
node --check js/core/app-config.js
node --check scripts/game-launch.mjs
node --check scripts/process-watcher.mjs
node --check scripts/start-grind.mjs
```

---

## Files changed (Phase 1)

| File | Change |
|------|--------|
| `tools/launcher/src/main.cjs` | Rebrand, crash restart, dual port health |
| `tools/launcher/package.json` | Product name + artifact |
| `tools/launcher/scripts/copy-exe.cjs` | Copy to tracker root with legacy aliases |
| `scripts/game-launch.mjs` | **New** — shared RL/Val launch |
| `scripts/process-watcher.mjs` | **New** — Windows tasklist |
| `scripts/rl-bridge.mjs` | Launch + process endpoints |
| `scripts/bridge-security.mjs` | Allowlist new paths |
| `scripts/start-grind.mjs` | Use shared launch module |
| `js/core/app-config.js` | DESKTOP_APP constants |
| `js/bridge-client.js` | Retry / phase helpers |
| `js/bridge-ui.js` | Tracking / Waiting / Error labels |
| `js/game-launcher.js` | **New** — Play buttons |
| `js/process-session.js` | **New** — Auto session |
| `js/onboarding-wizard.js` | **New** — First-run flow |
| `js/boot.js`, `js/app.js`, `js/home.js` | Wire new modules |
| `js/setup-wizard.js` | Exe-first copy |
| `index.html` | Play button, onboarding modal |
| `css/styles.css` | Play + status + onboarding styles |
| `build-tray-app.bat`, `tools/launcher/build-bridge.bat` | Naming |

---

## Remaining work for full mission

1. **Embedded window** — replace `shell.openExternal` with Electron `BrowserWindow`
2. **In-app settings** — no config file editing for players
3. **Auto session end** when game closes
4. **Bundled Node** — eliminate Node.js install requirement
5. **Valorant-only / RL-only exe profiles** — optional smaller launches
6. **Startup audit** — remove remaining `pause` prompts in player-facing paths where exe is used
7. **Operator docs** — update `docs/USER-SETUP.md` to lead with exe
