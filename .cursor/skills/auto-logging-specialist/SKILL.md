---
name: auto-logging-specialist
description: >-
  Owns Rocket League and Valorant process detection, bridge auto-log pipelines,
  and match-completion ingest for Twans Ultimate Tracker. Implements fixes in
  rl-bridge, valorant-bridge, process-watcher, and live UI clients. Use when the
  user mentions auto-log, bridge, Rocket League detection, Valorant detection,
  Riot Client, tracking, match completion, rl-bridge, or valorant-bridge.
disable-model-invocation: true
---

# Auto-Logging Specialist

**Role:** Implement bridge and detection fixes for **Twans Ultimate Tracker** auto-log. Unlike review agents in `AGENTS.md`, this skill **applies minimal code changes** in bridge scripts and live clients — not read-only reports.

## Purpose

Own all Rocket League and Valorant detection.

## Rules

Never fake tracking.
Detect real processes only.
Riot Client ≠ Valorant.
Auto-log only after match completion.
Handle crashes gracefully.

## Global constraints

- **Minimal diffs** — fix detection, polling, or ingest; no unrelated refactors.
- **Security and release blockers** from review agents outrank detection polish.
- **Desktop packaging** — coordinate with `desktop-engineer` on spawn/EXE paths; do not break internal `:49200` bridge.
- **Performance** — coordinate with `performance-engineer` on poll intervals; do not add duplicate listeners or intervals.

## Scope map

| Area | Primary paths |
|------|----------------|
| RL TCP bridge + HTTP API | `scripts/rl-bridge.mjs` |
| Valorant Henrik/Overwolf bridge | `scripts/valorant-bridge.mjs` |
| Windows process detection | `scripts/process-watcher.mjs` |
| Bridge heartbeat + auth | `js/bridge-client.js` |
| Status pill + hints | `js/bridge-ui.js` |
| RL live poller | `js/rl-live.js` |
| Valorant live poller | `js/valorant-live.js` |
| Match ingest handlers | `js/auto-log-handlers.js` |

## Architecture (summary)

```
Tracker UI (rl-live / valorant-live)
    ↕ bridgeFetch / heartbeat /status
rl-bridge.mjs (:49200)
├── RL Stats API TCP :49123 → MatchEnded / PodiumStart → /last-match
├── process-watcher → RocketLeague.exe, VALORANT-Win64-Shipping.exe
└── valorant-bridge → Henrik poll / Overwolf push → /valorant/last-match
```

**Tracking UI** = real game process running (or RL Stats API connected). **Auto-log** = finished match payload available and consumed once.

## Workflow

```
Detection / auto-log fix:
- [ ] 1. Reproduce — RL vs Val, process open/closed, match end, crash
- [ ] 2. Trace — tasklist → /status heartbeat → live poller → handler
- [ ] 3. Root cause — wrong process, stale cache, premature log, missing retry
- [ ] 4. Fix — minimal diff in bridge or client; preserve Rules above
- [ ] 5. Verify — process on/off transitions; match completes → one log only
```

### Step 1 — Reproduce

- **Valorant:** Riot Client only → must **not** show Tracking. Launch game → Tracking. Exit game → Tracking clears. Finish match → auto-log (or toast if auto-log off).
- **Rocket League:** RL closed → waiting. RL open → Tracking (process and/or Stats API). Match end → `/last-match` populated; auto-log after `MatchEnded`/`PodiumStart`.
- **Crashes:** kill bridge or game mid-match — no phantom Tracking; bridge reconnects; no duplicate logs.

### Step 2 — Trace

1. **Process truth:** `scripts/process-watcher.mjs` — exact `IMAGENAME` match (`RocketLeague.exe`, `VALORANT-Win64-Shipping.exe` only).
2. **Bridge state:** `GET /status` — `rocketLeagueRunning`, `rlConnected`, `valorantProcessRunning` (never infer Val from Riot Client).
3. **UI cache:** `js/bridge-ui.js` — heartbeat from `bridge-client.js` **wins** over stale `/valorant/status` or RL poller cache.
4. **Match ready:** RL `finalizeMatch` on winner; Val Henrik after process was running + stats activity > 0, or Overwolf push with result.

### Step 3 — Common failures

| Symptom | Likely cause | Fix direction |
|---------|--------------|---------------|
| Tracking with only Riot Client open | `valorantRunning` not process-gated | Gate on `VALORANT-Win64-Shipping.exe` only (see ac7f932) |
| Tracking stuck after Val exit | Stale `/valorant/status` cache | Heartbeat `/status` + `patchCachedValorantProcessRunning` (534c577) |
| RL not detected when game open | Missing RL heartbeat flags | Mirror Val gating: `rocketLeagueRunning` + `rlConnected` in sig (f1b4317) |
| Log before match ends | Poll fired too early | RL: wait `MatchEnded`/`PodiumStart`; Val: activity check + baseline |
| Duplicate logs | Same `matchId` / `matchGuid` | Dedupe in handlers; `consumed` flag on consume |
| Bridge down after crash | No retry / stale UI | RL TCP reconnect 15s; client reconnect phase; clear cached state on startup |

### Step 4 — Apply (minimal diff)

**Process detection (`process-watcher.mjs`):**

- Only `tasklist` exact image names — never substring-match Riot Client for Val.
- Export `getGameProcessState` / `startProcessWatcher`; cache 3s; force refresh on heartbeat.

**Valorant bridge (`valorant-bridge.mjs`):**

- `isValorantProcessRunning()` → `VALORANT-Win64-Shipping.exe` only.
- Henrik poll runs while process running; UI Tracking follows process, not poll armed alone.
- `pushOverwolfMatch` / `parseHenrikMatch` require real stats (kills+deaths+assists > 0).
- Persist baseline (`seeded`, `lastSeenMatchId`) — auto-log **next** finished match only.

**RL bridge (`rl-bridge.mjs`):**

- TCP to `:49123`; retry on close/error (15s).
- `finalizeMatch` once per `matchGuid`; expose `/last-match`, `/last-match/consume`.
- Include process flags in `/status` for UI heartbeat.

**Live clients (`rl-live.js`, `valorant-live.js`, `bridge-ui.js`, `bridge-client.js`):**

- Subscribe `subscribeBridgeProcessState` — refresh pill on process change without full poll storm.
- Slower polls when game absent; faster when Tracking.
- `bridgeStatusSig` / `valStatusSig` must include process flags so idle tabs still update UI.
- Auto-log: call handlers only when `!consumed` and auto-log enabled; always consume after ingest attempt.

**Handlers (`auto-log-handlers.js`):**

- `handleAutoLog` / `handleValorantAutoLog` — dedupe by `matchId`/`matchGuid` in notes.
- Never synthesize match results; reject `activity === 0` on Val.

**Do not:**

- Set Tracking true when only launcher/Riot Client is running.
- Auto-submit logs on `MatchCreated` or mid-match live stats.
- Fake W/L, MMR, or RR without bridge payload or explicit user-estimate toast path.

### Step 5 — Verify

- [ ] Riot Client alone → not Tracking (Val).
- [ ] Game process open → Tracking; exit → waiting within one heartbeat cycle.
- [ ] Full match → exactly one auto-log (or one toast when auto-log off).
- [ ] Bridge restart mid-session → reconnects; no duplicate logs for same match id.
- [ ] `node --check` on changed `scripts/*.mjs` and `js/**/*.js`.

## Anti-patterns

- Treating `RiotClientServices.exe` or `VALORANT.exe` as Valorant running.
- Using `/valorant/status` alone for Tracking when heartbeat `/status` disagrees.
- Logging on Henrik match before stats populate (zero activity).
- Clearing `consumed` or re-arming baseline in a way that re-logs old matches.
- Adding a second `setInterval` poll without clearing the first.

## Output (fix tasks)

Summarize in chat or PR:

1. **Symptom** — game, process state, expected vs actual Tracking/log
2. **Root cause** — process gate, cache, timing, or ingest chain
3. **Changes** — files touched and which Rule they enforce
4. **Verify** — manual steps: process on/off, match end, crash/reconnect

## Additional resources

- Bridge architecture, endpoints, and prior fix notes: [reference.md](reference.md)
- Desktop spawn and EXE paths: `desktop-engineer`
- Poll/render guardrails: `performance-engineer`
