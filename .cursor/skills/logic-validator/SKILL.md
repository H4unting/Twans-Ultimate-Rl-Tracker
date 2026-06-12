---
name: logic-validator
description: >-
  Validates and fixes business-logic invariants in Twans Ultimate Tracker —
  tracking state vs game process, RR promotion/demotion, session reset on auth,
  rank chain consistency, and cross-cutting sanity checks. Implements minimal
  code diffs when invariants are violated; not read-only reports. Use when the
  user mentions logic bug, invariant, tracking state, RR rank, session reset,
  sanity check, doesn't make sense, or Twans Ultimate Tracker logic.
disable-model-invocation: true
---

# Logic Validator

**Role:** **Implement** logic fixes in **Twans Ultimate Tracker**. Unlike review agents in `AGENTS.md`, this skill **applies minimal code diffs** when invariants break — not read-only reports.

**Pairing:** Coordinate with `auto-logging-specialist` on Tracking/process gates; `data-engineer` on RR/MMR chains; `security-engineer` only when logic fix touches auth/RLS.

## Purpose

Think like a human.

## Rules

Never fake state.
UI must match reality.
Rank math must follow ladder rules.
Sessions must not survive sign-out.
If logic doesn't make sense, fix it.

## Example

If Tracking = true but game isn't running → bug.

If RR > 100 → promote.

If RR < 0 → demote.

If session exists but user logged out → reset.

If logic doesn't make sense, fix it.

## Global constraints

- **Minimal diffs** — fix the invariant violation; no unrelated refactors.
- **Reality wins** — process detection and heartbeat `/status` are source of truth for Tracking.
- **Reuse ladder math** — call `applyRRDelta` in `rank-ladder.js`; never hand-roll promotion.
- **Security/release blockers** from review agents outrank logic polish.

## Scope map

| Area | Primary paths |
|------|----------------|
| Tracking pill + process gates | `js/bridge-ui.js`, `js/bridge-client.js` |
| RL live / process sync | `js/rl-live.js`, `scripts/process-watcher.mjs` |
| Val live / process sync | `js/valorant-live.js`, `scripts/valorant-bridge.mjs` |
| RR ladder + promotion | `js/games/valorant/rank-ladder.js`, `js/auto-log-handlers.js` |
| RL MMR chain | `js/games/rocketleague/rank-chain.js` |
| Sessions + timer | `js/sessions.js`, `js/process-session.js` |
| Sign-out reset | `js/app.js` (`handleSignOut`), `js/core/state.js` (`resetAppState`) |

## Invariant checklist

Copy and track when investigating:

```
Logic validation:
- [ ] Tracking ↔ process (bridge-ui, bridge-client, process-watcher)
- [ ] RR ladder (rank-ladder, auto-log-handlers, rank-chain)
- [ ] RL MMR chain (rank-chain, matches repair)
- [ ] Session ↔ auth (sessions, handleSignOut, resetAppState)
- [ ] Cross-game UI state (activeGame, cached bridge flags)
```

### Tracking ↔ game process

- [ ] **Tracking true, game not running** → bug. Pill must be `waiting` or `connecting`, never `tracking`.
- [ ] Val: only `VALORANT-Win64-Shipping.exe` counts — Riot Client alone → not Tracking.
- [ ] RL: `rocketLeagueRunning` or `rlConnected` required — no Tracking when both false.
- [ ] Heartbeat `/status` wins over stale `/valorant/status` or RL poller cache (`patchCachedValorantProcessRunning`, `isRocketLeagueGameActive`).
- [ ] Game exit → Tracking clears within one heartbeat cycle; no stuck pill after crash.

### RR rank ladder (Valorant)

- [ ] **RR > 100** (non-Radiant) → promote to next division; carry overflow RR.
- [ ] **RR < 0** → demote to prior division; carry underflow as `100 + rr`.
- [ ] Non-Radiant RR stays **0–100** within a division after `applyRRDelta`.
- [ ] Radiant: RR may exceed 100; **RR < 0** demotes to Immortal 3 at `100 + rr`.
- [ ] Auto-log and manual log use same `applyRRDelta` — no divergent promotion paths.
- [ ] `startRank`/`endRank`/`startRR`/`endRR`/`rrDiff` agree after repair (`repairRankChain`).

### RL MMR chain

- [ ] `startMMR` of match *N+1* equals `endMMR` of match *N* (per mode/playlist).
- [ ] `mmrDiff = endMMR - startMMR`; ranked vs casual flags respected.
- [ ] No log before match ends (RL: `MatchEnded`/`PodiumStart`; Val: activity > 0).

### Session ↔ auth

- [ ] **Session active but user logged out** → reset. `handleSignOut` must stop timer, clear `state.session.active`, and not show live session on login screen.
- [ ] `resetAppState` zeroes in-memory session; persisted `rl-grind-session:*` must not resurrect active session for a signed-out user.
- [ ] Stale session (>6h) auto-ends via `restoreSessionFromStorage` — timer must not run when `active: false`.
- [ ] Game exit with active session → `process-session.js` may auto-end; session # increments consistently.

### Cross-cutting sanity

- [ ] `state.activeGame` drives bridge pill, session copy, and rank field — no RL pill while Val active.
- [ ] Auto-log off + game running → Tracking allowed; auto-log on + no game → waiting, not Tracking.
- [ ] Consumed match payloads are not re-logged; baseline reset does not replay old matches.

## Workflow

```
Logic fix:
- [ ] 1. Symptom — what a human would call wrong (pill, rank, session, chart)
- [ ] 2. Invariant — which checklist row failed
- [ ] 3. Trace — read scope-map files; follow data from source to UI
- [ ] 4. Root cause — stale cache, missing reset, wrong gate, skipped applyRRDelta
- [ ] 5. Fix — minimal diff; one invariant per change when possible
- [ ] 6. Verify — manual repro + node --check on touched js/
```

### Step 1 — Ask the human question

| Human observation | Invariant |
|-------------------|-----------|
| "Says Tracking but Val isn't open" | Tracking ↔ process |
| "Still Gold 2 at 105 RR" | RR > 100 → promote |
| "Demoted but RR shows -15" | RR < 0 → demote |
| "Session timer after logout" | Session ↔ auth |
| "MMR jumped between playlists" | RL MMR chain |

### Step 2 — Trace order

1. **Source of truth** — `process-watcher.mjs` → bridge `/status` → `bridge-client.js` heartbeat.
2. **UI layer** — `bridge-ui.js` `refreshBridgeStatusUI`; never infer Tracking from launcher alone.
3. **Rank** — ingest → `applyRRDelta` / `repairRankChain` → charts and session aggregates.
4. **Session** — `sessions.js` storage key includes `authUser.id`; sign-out path in `handleSignOut`.

### Step 3 — Fix patterns

| Violation | Fix direction |
|-----------|---------------|
| Tracking without process | Gate on heartbeat flags; patch stale Val cache |
| RR stuck above 100 | Route through `applyRRDelta`; repair chain |
| Negative RR in non-Radiant tier | Demote via `applyRRDelta`; repair `endRank` |
| Session after sign-out | `clearSessionTimer` + `resetAppState`; persist `active: false` before auth clears if needed |
| Phantom auto-log | Match completion gates; `consumed` flag |

**Do not:**

- Set Tracking true without process or RL Stats API connection.
- Store non-Radiant RR outside 0–100 without promotion/demotion.
- Leave `state.session.active` true across `handleSignOut`.
- Invent W/L, MMR, or RR without bridge payload or explicit user input.

### Step 4 — Verify

- [ ] Repro steps: before fix wrong, after fix matches human expectation.
- [ ] Checklist rows for the touched area all pass.
- [ ] `node --check` on changed `js/**/*.js` and `scripts/*.mjs`.
- [ ] No regression in paired skills' scope (auto-log ingest, data chain repair).

## Anti-patterns

- Tracking from Riot Client, launcher, or armed poll alone.
- Capping RR at 100 without promoting.
- Showing negative RR in UI without demoting division.
- Restoring `active: true` session from localStorage on login screen before auth + games load.
- Fixing UI label only while bridge still reports contradictory state.

## Output (fix tasks)

Summarize in chat or PR:

1. **Symptom** — human-readable wrong behavior
2. **Invariant** — which rule from Example or checklist failed
3. **Root cause** — file and logic path
4. **Changes** — minimal diff
5. **Verify** — repro steps confirming fix

## Additional resources

- Twans domain invariants, file anchors, prior fix notes: [reference.md](reference.md)
