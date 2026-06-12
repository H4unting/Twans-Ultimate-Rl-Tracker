# Data Engineer — reference

## `js/matches.js`

- **`persistChain`** — serializes Supabase writes; always chain through `persistActiveGames`.
- **`repairActiveGameChain`** — delegates to `mod.repairPlaylistMMRChain ?? mod.repairRankChain`.
- **Mutations** — `addGame`, `updateGame`, `patchLastGame`, `undoLastGame`, `deleteGame` all repair before persist.
- **`clearGameHistory`** — wipes one game partition only; other games untouched.
- **Val cleanup** — `isGhostValorantMatch` (0/0/0), `collapseDuplicateValorantMatches` (signature dedupe), `purgeGhostValorantMatches`.

## `js/games/rocketleague/rank-chain.js`

- **`resolveGameStartRank`** — prior end for mode → stored baseline → infer from `endMMR - estimateRankDelta`.
- **`repairRankChain`** — sort by `match`; recompute `startMMR`, `mmrDiff`; returns `{ games, changed }`.
- **`estimateRankDelta`** — last 15 same result+mode averages, else W:+10 / L:-10.

## `js/games/valorant/rank-chain.js`

- **`resolveGameStartRankState`** — prior end state → baseline → reverse from end via `applyRRDelta(..., -est)`.
- **`repairRankChain`** — if `rrDiff` set, derive end via `applyRRDelta(start, rrDiff)`; else reconcile end fields.
- **Promotion** — all rank movement through `applyRRDelta` in `rank-ladder.js` (≥100 RR promotes with carry).

## `js/utils.js` — `calcStats`

- Empty games → zeroed object (not null throws).
- Uses `mod.META.rankField` / `diffField` for game-agnostic aggregates.
- `totalMMRGain` = sum of diff field; `currentMMR` = last row rank field; streak via `coreCalcStreak`.

## `js/tracker-level.js`

- **`computeTrackerLevel(totalGames)`** — `floor(totalGames / 10) + 1`, clamped 1–999.
- **`getDisplayTrackerLevel`** — `max(computed, stored, 1)`; stored level never drops on clear.
- **`maybeBumpTrackerLevel`** — called after match save; persists via settings saver.

## `docs/supabase/sync-matches.sql`

```sql
CREATE UNIQUE INDEX IF NOT EXISTS matches_user_game_match_num_key
  ON matches (user_id, game, match_num)
  WHERE user_id IS NOT NULL;
```

App upsert: `POST .../matches?on_conflict=user_id,game,match_num` with `resolution=merge-duplicates`.

## Manual verify scenarios

1. Log W/L sequence in one RL playlist — each `startMMR` equals prior same-mode `endMMR`.
2. Val promotion at 100 RR — carry RR correct on next tier; demotion at 0 RR symmetric.
3. Delete match 3 of 5 — renumber 1–4, repair, stats and chain intact.
4. Duplicate Val auto-log batch — collapse keeps best row; repair idempotent.
5. Clear one game — tracker level for that game unchanged in display.
