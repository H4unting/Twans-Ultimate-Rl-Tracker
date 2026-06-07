# Valorant Launcher V1.0 Blocker Report

## Likely Cause

Two independent issues blocked the expected `Valorant Tracker.bat` flow:

### 1. Valorant did not launch (only Riot Client shell opened)

`launchValorant()` in `scripts/start-grind.mjs` tried the `riotclient://` URI **first**. On many Windows installs that URI opens the Riot Client UI without starting the Valorant product. The reliable path is `RiotClientServices.exe --launch-product=valorant --launch-patchline=live`, which was only used as a fallback after URI failure.

### 2. Auto-log did not initialize promptly

The `.bat` runs:

```
node scripts/start-grind.mjs --val-only --launch-val --no-browser
```

Without `--auto-poll`, the bridge started with `manualArm: true`, which:

- Required opening `http://localhost:8080` to arm Henrik polling, **or**
- Waited **45 seconds** before auto-arming

The browser tab was also delayed **15 seconds** after the tracker came up (`valOnly && skipBrowser`), so client-side auto-log (`valorant-live.js` polling `/valorant/last-match`) could not run until well after launch.

Together: Riot Client opened but Valorant often did not start, and match polling stayed disarmed while the tracker tab was late to open.

## Files Involved

| File | Role |
|------|------|
| `Valorant Tracker.bat` | Entry point: `--val-only --launch-val --no-browser` |
| `scripts/start-grind.mjs` | Orchestrates bridge, tracker server, game launch, browser |
| `scripts/rl-bridge.mjs` | HTTP bridge on `:49200`; forwards Valorant bridge options |
| `scripts/valorant-bridge.mjs` | Henrik polling, baseline seeding, `/valorant/*` API |
| `docs/SETUP.md` | User-facing launcher documentation |

## Recommended Fix (implemented)

### Valorant launch order

In `launchValorant()`:

1. Try `RiotClientServices.exe` (Program Files x86, then `%LOCALAPPDATA%`) with `--launch-product=valorant --launch-patchline=live`
2. Fall back to `riotclient://launch-product=valorant&patchline=live` if exe is missing or exec fails
3. Log the method used with `[valorant-launcher]` prefix

`valorant://` was researched; Riot documents `RiotClientServices.exe` args as the standard CLI launch path, so no third URI was added.

### Launcher mode for `--val-only --launch-val`

`start-grind.mjs` detects `valLauncherMode = valOnly && launchVal` (no `.bat` change required):

| Behavior | Before | After |
|----------|--------|-------|
| Henrik polling | `manualArm: true` → 45s wait or browser required | `manualArm: false`, `deferPollMs: 0` → immediate |
| Browser (`--no-browser`) | 15s delay | Opens as soon as `:8080` is listening |
| Rocket League `.bat` / generic `start-grind.mjs` | Unchanged | Unchanged |

Options flow: `start-grind.mjs` → `startBridge()` → `startValorantBridge({ manualArm, deferPollMs, launcherMode })`.

### Startup diagnostics

Structured `[valorant-launcher]` console logs for the `.bat` flow:

- Launcher started
- Bridge started (port)
- Tracker ready (port)
- Opening tracker tab
- Valorant launch command (method + path)
- Polling armed / baseline seeded / waiting for match

## Verification Steps

1. **Henrik setup** — In tracker Auto-Log Setup: Riot ID (`Name#TAG`), region, Henrik API key → **Apply & Go**.
2. **Launch** — Double-click `Valorant Tracker.bat`. Keep the console window open.
3. **Console checks** — Confirm logs appear in order:
   - `[valorant-launcher] Launcher started`
   - `[valorant-launcher] Bridge started (port 49200)`
   - `[valorant-launcher] Tracker ready (port 8080)`
   - `[valorant-launcher] Opening tracker tab...`
   - `[valorant-launcher] Method: RiotClientServices.exe — <path>` (or URI fallback)
   - `[valorant-launcher] Polling armed — Henrik match watch starting now`
4. **Browser** — Tracker tab opens at `http://localhost:8080` without a 15s wait; leave it open.
5. **Game** — Valorant should launch (not just the Riot Client shell). Queue and finish a match.
6. **Auto-log** — After the match, the tracker should auto-log via Henrik polling and/or the open tab polling `/valorant/last-match`.
7. **Regression** — `Rocket League Tracker.bat` and `node scripts/start-grind.mjs --val-only` (without `--launch-val`) should behave as before (manual arm / 15s browser delay for val-only without launch).
