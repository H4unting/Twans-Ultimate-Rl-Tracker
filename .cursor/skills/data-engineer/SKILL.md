---
name: data-engineer
description: >-
  Keeps match stats, rank chains, RR/MMR math, tracker level, and Supabase
  match sync accurate for Twans Ultimate Tracker. Implements data integrity
  fixes — repair chains, validate calculations, dedupe/purge bad rows. Use when
  the user mentions stats, MMR, RR, rank chain, match data, calculations,
  Supabase matches, repair chain, tracker level, data integrity, or Twans
  Ultimate Tracker data bugs.
disable-model-invocation: true
---

# Data Engineer

**Role:** Implement data integrity fixes in **Twans Ultimate Tracker**. Unlike review agents in `AGENTS.md`, this skill **applies minimal code/SQL diffs** — not read-only reports.

**Pairing:** Coordinate with `auto-logging-specialist` on ingest bugs; `security-engineer` on RLS/sync policy; `performance-engineer` when repair runs on large histories.

## Purpose

Keep stats accurate.

## Rules

Never lose data.
Never overwrite unnecessarily.
Validate calculations.
Rank progression must be deterministic.
RR/MMR math must always be reversible.

## Global constraints

- **Minimal diffs** — fix the chain, stat, or sync path; no unrelated refactors.
- **Repair, don't wipe** — prefer `repairRankChain` / renumber over bulk delete unless user confirms.
- **Persist chain** — match CRUD goes through `persistActiveGames` + `repairActiveGameChain` in `js/matches.js`.
- **Supabase upsert** — respect `(user_id, game, match_num)` unique key; merge, don't clobber unrelated games.

## Scope map

| Area | Primary paths |
|------|----------------|
| Match CRUD + repair hook | `js/matches.js` |
| RL MMR chain | `js/games/rocketleague/rank-chain.js` |
| Val RR / promotion chain | `js/games/valorant/rank-chain.js`, `rank-ladder.js` |
| Aggregated stats | `js/utils.js` (`calcStats`, `getSessionStats`, streaks) |
| Tracker level (monotonic) | `js/tracker-level.js` |
| Rank baselines | `js/rank-baseline-store.js` |
| Supabase match sync | `js/supabase.js`, `docs/supabase/sync-matches.sql` |
| Val dedupe / ghost purge | `js/matches.js` (`collapseDuplicateValorantMatches`, `purgeGhostValorantMatches`) |

## Workflow

```
Data integrity fix:
- [ ] 1. Symptom — wrong stat, broken chain, missing/extra match
- [ ] 2. Reproduce — game, mode, match range, before/after values
- [ ] 3. Trace — ingest → normalize → repair → calcStats → persist
- [ ] 4. Root cause — which invariant broke (Rules above)
- [ ] 5. Fix — minimal diff; re-run repair on affected slice
- [ ] 6. Verify — forward + reverse RR/MMR; stats match manual count
```

### Step 1 — Classify the bug

| Type | Examples |
|------|----------|
| **Rank chain** | Wrong `startMMR`/`startRR`, playlist bleed, promotion carry wrong |
| **Stats** | Win rate, streak, `totalMMRGain`, session aggregates off |
| **Tracker level** | Level dropped after clear; not bumping on save |
| **Sync** | Duplicate `match_num`, partial overwrite, wrong game partition |
| **Ingest quality** | Val ghost rows (0/0/0), duplicate auto-log signatures |

### Step 2 — Invariants to check

**RL (`repairRankChain`):** sorted by `match`; `startMMR = resolveGameStartRank`; `mmrDiff = endMMR - startMMR`; prior end per mode.

**Valorant (`repairRankChain`):** `applyRRDelta` for promotions/demotions; `rrDiff` authoritative when present; `startRank`/`endRank`/`startRR`/`endRR` consistent.

**Reversibility:** given start state + delta, `applyRRDelta` / end−start must recover the same end; editing match *N* must not rewrite unrelated modes.

**Tracker level:** `getDisplayTrackerLevel` = `max(computed, stored, 1)` — level never decreases when matches cleared.

**Stats:** `calcStats` uses game module `META.rankField` / `diffField`; empty array → zeroed defaults, not throw.

### Step 3 — Fix patterns (prefer in order)

1. **Repair chain** — call existing `repairRankChain` / `repairPlaylistMMRChain`; do not hand-edit MMR/RR fields in UI code.
2. **Renumber** — after delete/dedupe, reassign `match = i + 1` then repair (see `deleteGame`, `collapseDuplicateValorantMatches`).
3. **Targeted purge** — Val ghosts/duplicates only via `purgeGhostValorantMatches` / `collapseDuplicateValorantMatchesInState`.
4. **Baseline** — missing start uses `getStoredRankBaseline` / `getStoredValorantBaseline`; don't invent defaults that break chain.
5. **Persist** — `JSON.parse(JSON.stringify(...))` before mutate; await `persistActiveGames`; never skip `repairActiveGameChain`.
6. **Sync SQL** — upsert on `(user_id, game, match_num)`; see `docs/supabase/sync-matches.sql`.

### Step 4 — Validate calculations

Before closing a fix, manually verify on the affected slice:

- [ ] Last match `endMMR`/`endRR` matches UI "current rank"
- [ ] Sum of `mmrDiff`/`rrDiff` equals `calcStats(...).totalMMRGain`
- [ ] Win/loss counts match filtered `result === 'W'|'L'`
- [ ] Re-run repair → `{ changed: false }` (idempotent)
- [ ] Delete middle match → renumber + repair restores chain

```bash
node --check js/matches.js js/utils.js js/tracker-level.js js/games/*/rank-chain.js
```

## Anti-patterns

- Bulk `saveGames([], gameId)` when repair/dedupe would preserve valid rows
- Writing `startMMR`/`startRR` from previous match without mode filter
- Non-deterministic promotion (random RR swing without `applyRRDelta`)
- Recalculating stats in UI instead of `calcStats` / game module helpers
- Supabase full-table replace that drops other users' columns or other games
- Lowering `trackerLevels` on clear history

## Output (fix tasks)

Summarize in chat or PR:

1. **Symptom** — user-visible wrong stat or chain break
2. **Root cause** — invariant violated and file/function
3. **Changes** — minimal diff; repair vs purge vs sync
4. **Verify** — idempotent repair, reversible math, stats spot-check

## Additional resources

- File-level chains, sync notes, test scenarios: [reference.md](reference.md)
- Team ownership: `docs/TEAM-WORKFLOW.md` (Backend Lead for schema/RLS)
- Supabase unique key: `docs/supabase/sync-matches.sql`
