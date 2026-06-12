# Auto-Logging Bridge Reference

Twans Ultimate Tracker local bridge architecture for RL and Valorant auto-log.

## Ports and entrypoints

| Service | Port | Entry |
|---------|------|-------|
| HTTP bridge | 49200 | `scripts/rl-bridge.mjs` → `startBridge()` |
| RL Stats API | 49123 | TCP from Rocket League (Bakkes/Stats plugin) |
| Static tracker + proxy | 8080 | `scripts/start-grind.mjs` (desktop bundles via launcher) |

`rl-bridge.mjs` loads `valorant-bridge.mjs` dynamically; Val failure does not block RL.

## Process detection

`scripts/process-watcher.mjs`:

- `RocketLeague.exe` → `rocketLeagueRunning`
- `VALORANT-Win64-Shipping.exe` → `valorantProcessRunning`
- Windows `tasklist /FI "IMAGENAME eq …"` with **exact** image name match (534c577)
- 3s cache; `startProcessWatcher(4000)` from bridge startup

**Not** Valorant: Riot Client, RiotClientServices, VALORANT.exe launcher.

## Rocket League pipeline

1. `connectRL()` → TCP `127.0.0.1:49123`
2. Parse JSON events: `MatchCreated`, `MatchEnded`, `PodiumStart`, player updates
3. `finalizeMatch(winnerTeamNum)` → `lastMatch` with `matchGuid`, stats, mode, ranked flag
4. HTTP: `GET /live`, `GET /last-match`, `POST /last-match/consume`, `POST /rocket-league/reset-baseline`
5. On socket close/error: retry every 15s; `rlConnected` false

Client: `js/rl-live.js` polls `/status` + `/live` + `/last-match`; `handleAutoLog` in `js/auto-log-handlers.js`.

### RL UI gating (f1b4317)

- `bridge-client.js` heartbeat includes `rocketLeagueRunning`, `rlConnected`
- `bridge-ui.js` → `isRocketLeagueGameActive()` prefers heartbeat over stale poller
- `bridgeStatusSig` includes RL flags so idle-tab pollers do not skip UI refresh

## Valorant pipeline

1. Config: `riotId` (Name#TAG), `henrikApiKey`, `riotRegion` in `config/grind-config.json`
2. **Tracking:** `valorantProcessRunning` only (ac7f932) — Riot Client alone never counts
3. **Polling:** Henrik API after `armValorantPolling()` / auto-arm; only while game process running
4. **Baseline:** `seedValorantBaseline()` ingests recent matches; next **new** match auto-logs
5. **Overwolf:** `POST /valorant/overwolf-match`, ping TTL 45s — alternative source
6. HTTP: `/valorant/status`, `/valorant/last-match`, `/valorant/arm`, `/valorant/reset-baseline`

Client: `js/valorant-live.js` arms poll, fetches status + last-match; `handleValorantAutoLog` applies RR/rank.

### Val UI gating (ac7f932, 534c577)

- `valorant-bridge.mjs` documents state machine: NOT RUNNING → Play → WAITING → TRACKING → exit
- `bridge-ui.js` → `isValorantGameProcessRunning()` — heartbeat wins over `cachedValStatus`
- `patchCachedValorantProcessRunning` syncs pill when process exits but `/valorant/status` is stale
- Slower client polls when game absent (`POLL_WAITING_MS` vs `POLL_TRACKING_MS`)

## Match completion rules

| Game | "Match complete" signal | Auto-log gate |
|------|-------------------------|---------------|
| RL | `MatchEnded` or `PodiumStart` + winner team | `lastMatch` with result W/L, not consumed |
| Val (Henrik) | New match id, activity > 0, after baseline | Process was running; stats populated |
| Val (Overwolf) | POST with outcome victory/defeat | Validated payload via `bridge-security.mjs` |

Handlers reject Val matches with zero kills+deaths+assists; show toast to wait or log manually.

## Key endpoints (bridge auth required except OPTIONS)

```
GET  /status              — rlConnected, inMatch, process flags, authToken (local origins)
GET  /processes           — raw process-watcher state
GET  /live                — RL in-match stats
GET  /last-match          — RL finished match
POST /last-match/consume  — mark consumed, return payload

GET  /valorant/status     — configured, seeded, valorantProcessRunning, pollingArmed, lastError
GET  /valorant/last-match
POST /valorant/last-match/consume
POST /valorant/arm
POST /valorant/reset-baseline
POST /setup/apply         — RL name, Riot ID, Henrik key; validates + arms Val poll
```

## Crash and reconnect behavior

- RL TCP: auto-reconnect 15s; `inMatch` cleared on disconnect
- HTTP bridge: `EADDRINUSE` on port conflict — user must close duplicate bridge
- Client `bridge-client.js`: phases `connecting` / `reconnecting` / online; heartbeat keeps process truth
- Val bridge state persisted to disk (`saveValorantBridgeState`) — survives bridge restart; baseline prevents re-logging old matches

## Prior fixes (commit map)

| Commit | Fix |
|--------|-----|
| ac7f932 | False Val Tracking when only Riot Client open — process-gate `valorantRunning` on shipping exe |
| 534c577 | Stale Val Tracking after exit — heartbeat `/status` over stale cache; exact tasklist parse |
| f1b4317 | RL sync not detecting game open — RL heartbeat flags in bridge client + `bridgeStatusSig` |

## Files to read first

1. `scripts/process-watcher.mjs` — source of truth for process list
2. `scripts/rl-bridge.mjs` — RL event machine + HTTP surface
3. `scripts/valorant-bridge.mjs` — Henrik/Overwolf + process-gated polling
4. `js/bridge-client.js` — heartbeat, `subscribeBridgeProcessState`
5. `js/bridge-ui.js` — unified status pill logic
6. `js/rl-live.js` / `js/valorant-live.js` — poll loops and auto-log triggers
7. `js/auto-log-handlers.js` — ingest into tracker state

## Coordination

- **desktop-engineer** — bridge auto-start from EXE, `TWANS_TRACKER_ROOT`, bundled `bridge-scripts/`
- **performance-engineer** — poll interval tuning, no duplicate intervals on visibility resume
