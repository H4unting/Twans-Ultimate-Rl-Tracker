# Logic Validator Reference

Twans Ultimate Tracker domain invariants for tracking, ranks, sessions, and auth.

## Tracking state machine

### Valorant

```
NOT RUNNING (waiting)
  → VALORANT-Win64-Shipping.exe starts → TRACKING
  → process exits → waiting (within one heartbeat)
```

- **Source:** `scripts/process-watcher.mjs` → `valorantProcessRunning`
- **Bridge:** `scripts/valorant-bridge.mjs` — Henrik poll armed only while process running
- **Client:** `js/bridge-ui.js` → `isValorantGameProcessRunning()` prefers `getHeartbeatValorantProcessRunning()` over `cachedValStatus`
- **Stale cache fix:** `patchCachedValorantProcessRunning(running)` when heartbeat disagrees with `/valorant/status`

**Not Tracking:** Riot Client, RiotClientServices, VALORANT.exe launcher, poll armed with no process.

### Rocket League

```
NOT RUNNING (waiting)
  → RocketLeague.exe and/or RL Stats API TCP :49123 → TRACKING
  → process exit + socket close → waiting
```

- **Source:** `rocketLeagueRunning`, `rlConnected` on `GET /status`
- **Client:** `js/bridge-ui.js` → `isRocketLeagueGameActive()` prefers heartbeat over poller cache
- **In-match:** `cachedRlInMatch` from `/live` — Tracking can be true while not in active round

### UI pill phases (`js/bridge-client.js`)

| Phase | When |
|-------|------|
| `connecting` | Bridge probe incomplete |
| `tracking` | Process gate true (or RL in-match with process up) |
| `waiting` | Bridge up, game not running |
| `error` | Bridge down or repeated failure |

Heartbeat `/status` signature must include process flags (`bridgeStatusSig`, `valStatusSig`) so idle tabs refresh the pill.

## RR rank ladder (`js/games/valorant/rank-ladder.js`)

### `applyRRDelta(startRank, startRR, delta)`

**Non-Radiant divisions (Iron 1 … Immortal 3):**

- RR within tier: **0–100**
- `rrWorking > 100` → subtract 100, `idx += 1`, `promoted = true` (repeat while overflow and not at Radiant)
- `rrWorking < 0` → add 100, `idx -= 1`, `demoted = true` (repeat while underflow and idx > 0)
- Final clamp: `Math.min(100, rrWorking)` when not Radiant

**Radiant:**

- RR unbounded upward
- `rr < 0` after delta → demote to `Immortal 3` at `100 + rr`

### Chain repair (`js/games/valorant/rank-chain.js`)

- `repairRankChain` re-applies `applyRRDelta` when `rrDiff` present
- `startRank`/`endRank`/`startRR`/`endRR` must be mutually consistent after repair
- Auto-log path: `js/auto-log-handlers.js` → `handleValorantAutoLog` uses `applyRRDelta` for estimated and Henrik-sourced RR

### Human rules (from skill Example)

| Condition | Expected behavior |
|-----------|-------------------|
| RR > 100 (non-Radiant) | Promote |
| RR < 0 | Demote |
| Display shows 105 RR at Gold 2 | Bug — should be Gold 3 · 5 RR |

## RL MMR chain (`js/games/rocketleague/rank-chain.js`)

- Matches sorted by `match` number per active game partition
- `startMMR` = prior match `endMMR` for same mode (via `resolveGameStartRank`)
- `mmrDiff = endMMR - startMMR`
- Ranked playlist flag from bridge `isRanked` / playlist id map in `rl-bridge.mjs`
- Repair: `repairRankChain` in RL module; invoked from `js/matches.js` `repairActiveGameChain`

## Sessions (`js/sessions.js`)

### Storage

- Key: `rl-grind-session:{gameId}:{authUserId}` (no user id → game-only key)
- Fields: `active`, `sessionNum`, `startTime`, `startMMR`, `nextSessionNum`, `lastEndedSession`, `history`

### Lifecycle

| Event | Expected |
|-------|----------|
| `startSession` / `activateSession` | `active: true`, timer running, `sessionNum` synced to form |
| `endSession` | `active: false`, `nextSessionNum = sessionNum + 1`, history entry |
| Stale > 6h (`STALE_SESSION_MS`) | Auto-end on `restoreSessionFromStorage` |
| Game process exit | `js/process-session.js` may `endSession({ auto: true })` |

### Sign-out invariant (`js/app.js` `handleSignOut`)

```js
clearSessionTimer();
await signOut();
resetTrackerLevels();
resetAppState();  // state.session.active = false, sessionNum = 1
stopBridgeHeartbeat();
stopBridgeServices();
```

**Bug if:** login screen shows active session, timer still ticking, or dock shows "End Session" after sign-out.

**Fix direction:** ensure `clearSessionTimer` before auth clears; `resetAppState` zeroes session; optionally persist `active: false` to user-scoped storage before `signOut()` if restore resurrects wrongly.

## Auth boundary

- `storageKey()` uses `getAuthUser()?.id` — different users must not share session state
- `restoreSessionFromStorage` runs after games load for authenticated user — must not run on login screen
- `handleDeleteAccount` mirrors sign-out cleanup (`clearSessionTimer`, `resetAppState`, bridge stop)

## Cross-module logic bugs (historical patterns)

| Symptom | Root cause | Primary fix location |
|---------|------------|---------------------|
| Val Tracking with only Riot Client | Process not gated | `valorant-bridge.mjs`, `bridge-ui.js` |
| Tracking stuck after Val exit | Stale `/valorant/status` | `patchCachedValorantProcessRunning` |
| RL not Tracking when game open | Missing heartbeat flags | `bridge-client.js`, `rl-live.js` |
| RR display wrong after auto-log | Skipped `applyRRDelta` | `auto-log-handlers.js` |
| Session survives logout | Missing reset on sign-out | `handleSignOut`, `resetAppState` |

## Verification commands

```bash
node --check js/bridge-ui.js js/bridge-client.js js/sessions.js js/app.js
node --check js/games/valorant/rank-ladder.js js/auto-log-handlers.js
node --check scripts/process-watcher.mjs scripts/valorant-bridge.mjs
```

## Related skills

| Skill | When to defer |
|-------|---------------|
| `auto-logging-specialist` | Ingest timing, bridge TCP, match completion |
| `data-engineer` | Bulk chain repair, Supabase sync, ghost purge |
| `security-engineer` | RLS, XSS, bridge token — not business logic |
| `performance-engineer` | Poll interval tuning without logic change |
