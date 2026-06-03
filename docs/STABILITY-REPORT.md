# Stability Report — v1.0.0-rc1

**Date:** 2026-06-02  
**Mode:** Stabilization (code review + manual test guidance)  
**Legend:** **Pass** = acceptable for v1.0 if smoke test confirms · **Warning** = edge cases / silent degradation · **Fail** = blocker if reproduced

---

## Executive summary

| System | Status |
|--------|--------|
| Auth | **Pass** (Warning: CDN dependency) |
| Supabase sync | **Pass** (Warning: legacy fallback path) |
| RL manual logging | **Pass** |
| Val manual logging | **Pass** |
| Edit match | **Pass** |
| Delete match | **Pass** |
| Undo | **Pass** |
| Session tracking | **Pass** (Warning: localStorage) |
| Goals | **Pass** |
| Reports | **Pass** |
| Focus | **Pass** |
| Squads | **Warning** (Val weekly snapshot uses RL report module) |
| Auto-log handlers | **Pass** (Warning: Overwolf RR always estimated) |
| Desktop bridge | **Warning** (expected off on GitHub Pages) |

**Overall:** No **Fail** ratings from code review alone. Product Owner smoke test is required to confirm.

---

## Auth

**Status: Pass** (Warning)

**Reasoning:**
- `js/auth.js` loads Supabase client from CDN fallbacks + local vendor path.
- Session persisted; `getAccessToken()` feeds REST calls.
- OAuth hash handling and boot failure UI in `index.html`.
- Sign-in required before match CRUD (`matches.js` → `requireSignedIn()`).

**Warnings:**
- CDN blocked (Brave Shields, offline) → boot failure message — covered in checklist.
- GitHub Desktop logs showed intermittent `Failed to fetch` to `api.github.com` (Desktop issue, not app).

**Reproduction (smoke):**
1. Sign out → email login → dashboard loads.
2. Sign out → Google login → dashboard loads.
3. Wrong password → error toast, no crash.
4. Refresh while signed in → session restored, data loads.

---

## Supabase sync

**Status: Pass** (Warning)

**Reasoning:**
- `loadUserData()` loads profile, matches, settings, groups.
- `saveGames()` normalizes, upserts per game slice, deletes orphaned rows by match_num.
- `persistChain` in `matches.js` serializes concurrent saves.
- Sync indicator via `setSyncStatus()` (`connecting` / `saving` / `live` / `error`).
- Boot repairs RL MMR chain and Val rank chain if drift detected.

**Warnings:**
- Legacy `syncGameSliceLegacy` delete-then-insert fallback (see AUDIT H1).
- `loadSettings()` empty catch returns defaults if `user_settings` missing — silent.
- Multi-game column missing → explicit error message pointing to SQL migration.

**Reproduction:**
1. Log RL game → sync dot green → refresh → game persists.
2. Log Val game → same.
3. Edit match → refresh → edit persists.
4. Open DevTools offline → attempt save → error toast, sync error state.
5. Re-online → save again → recovers.

---

## RL manual logging

**Status: Pass**

**Reasoning:**
- Dock quick log + full form in `quicklog.js` / `app.js`.
- `addGame()` → `buildGameFromForm` → `saveGames`.
- Rank chain via `repairPlaylistMMRChain` on edit/delete.
- Post-match card for MMR confirm (`post-match.js`).

**Reproduction:**
1. Start `start-grind.bat`, open localhost:8080, sign in.
2. Set RL rank baselines if prompted.
3. Quick dock: WIN, enter end MMR, log.
4. Row appears in Match Logs with correct +/- MMR.
5. Repeat for 2's and 3's modes.

---

## Val manual logging

**Status: Pass**

**Reasoning:**
- Val dock fields: K/D/A, agent, map, RR, rank tiers.
- `js/games/valorant/matches.js` builds normalized rows.
- Promotion ladder in `rank-ladder.js`; display in `ranks.js`.
- Long notes wrap without breaking scroll (CSS fix in `styles.css`).

**Reproduction:**
1. Start `start-val-grind.bat`, sign in, switch to Val.
2. Log Competitive win with K/D/A, start/end RR.
3. Verify Start/End columns (`Iron 2 · 40` style) and +/- column.
4. Log match with very long note (QA edge case) — page scrolls normally.
5. Promote tier (100 RR overflow) — green ↑ on End column only when tier changes.

---

## Edit match

**Status: Pass**

**Reasoning:**
- `openEditModal()` uses `mod.META.startRankField` / `rankField` (Val RR fix applied).
- `updateGame()` runs `repairActiveGameChain` after edit.
- Save errors surfaced via toast in `handleSaveEdit`.

**Reproduction:**
1. Edit RL game — change end MMR → save → log and downstream chain update.
2. Edit Val game — change end RR and tier → save → End column correct.
3. Edit tags and notes → persist after refresh.

---

## Delete match

**Status: Pass**

**Reasoning:**
- `deleteGame()` confirms, renumbers matches, runs rank chain repair, persists.

**Reproduction:**
1. Delete middle match in RL history → match numbers resequenced.
2. Verify next match start rank recalculated from chain.
3. Delete Val match → same for RR chain.

---

## Undo

**Status: Pass**

**Reasoning:**
- `undoLastGame()` removes last active-game match with confirm (unless `skipConfirm` from post-match).
- Renumbers and repairs chain.

**Reproduction:**
1. Log game → Undo from dock → last row removed.
2. Undo from post-match card (auto-log) → last row removed without double confirm when configured.

---

## Session tracking

**Status: Pass** (Warning)

**Reasoning:**
- Live session bar, timer, grind block history in `sessions.js`.
- Persisted per user per game in localStorage (`rl-grind-session:{gameId}:{userId}`).
- Stale session cleared after 6h (`STALE_SESSION_MS`).
- Integrates tilt detection from insights.

**Warnings:**
- localStorage quota / private mode — save caught silently (`sessions.js` line ~76).
- Session number derived from match data + stored prefs — verify across devices (session # is local UX, not synced as first-class entity).

**Reproduction:**
1. Start session → play counter increments on log.
2. End session → summary shown.
3. Refresh mid-session → session restored.
4. Switch RL ↔ Val → separate session state per game.

---

## Goals

**Status: Pass**

**Reasoning:**
- Per-game goals in Supabase `user_settings.data.goals`.
- `normalizeGoalsStorage()` handles legacy flat shape.
- Progress on home/goals UI via `getGoalProgress()`.

**Reproduction:**
1. Set weekly games target on Goals page → refresh → still set.
2. Log games → progress bar updates.
3. Switch Val → separate goal defaults (20 games/week default).

---

## Reports

**Status: Pass**

**Reasoning:**
- Weekly report in `reports.js` / `reports-ui.js`.
- CSV export via `export.js`.
- Game-specific report builders in `games/*/reports.js`.

**Reproduction:**
1. Log 3+ games in current week → Reports page shows weekly card.
2. Export CSV → opens/downloads valid file.
3. Switch Val → report copy uses match terminology.

---

## Focus

**Status: Pass**

**Reasoning:**
- Tag correlations and focus tips delegate to game insights modules.
- Renders from `focus.js` via `app.js`.

**Reproduction:**
1. Log 10+ games with tags on losses.
2. Open Focus page → tag insights appear (or empty state if insufficient data).

---

## Squads

**Status: Warning**

**Reasoning:**
- Create/join/leave via Supabase RPCs (`create_grind_squad`, etc.).
- `loadUserGroups()` catch returns `[]` on any error — UI shows empty squads, no error toast.
- Member stats fetched on demand; module-level cache may stale on game switch (see AUDIT M10).

**Warnings:**
- `renderWeeklySnapshot` calls `buildWeeklyReport(..., 0)` without `state.activeGame` — Val squads show RL-shaped stats (0 gain).
- `loadUserGroups()` catch returns `[]` on any error — silent empty squads.
- Member games cache not cleared on game switch (AUDIT M10).

**Reproduction:**
1. **Friend:** Create squad → invite code shown.
2. **You:** Join with code → both see squad.
3. View member stats (coach vs grinder rules).
4. Leave squad → removed from list.
5. **Fail signal:** RPC error in console, empty squads with no explanation — verify `docs/supabase/groups-schema.sql` applied.
6. **Val squad snapshot:** Switch to Val, open squad weekly card — **fail** if RR gain shows 0 for active grinders.

---

## Auto-log handlers

**Status: Pass** (Warning)

**Reasoning:**
- RL: Stats API via bridge (`auto-log-handlers.js`, `rl-live.js`).
- Val: Henrik/Overwolf via bridge; duplicate match id guard; 0/0/0 rejected with toast.
- RR estimation when API lag; promotion math via `applyRRDelta`.
- **Blocker fixed:** `priorEnd` ReferenceError in `handleValorantAutoLog` (line 158) — changed to `!priorState.hasPrior`.

**Warnings:**
- Overwolf path does not attach RR from bridge — rank chain always estimated until user confirms (document/workaround).
- Premature Val auto-log (0/0/0) possible before Henrik ready — mitigated by ghost detection + user toast.
- Bridge required — not available on GitHub Pages alone.

**Reproduction:**
1. RL: Run bridge + RL with Stats API → finish match → auto-log + post-match card.
2. Val: Configure Riot ID + Henrik key → finish match → auto-log after stats ready.
3. Duplicate match id → second log skipped.
4. Disconnect bridge mid-session → manual log still works.

---

## Desktop bridge integration

**Status: Warning** (expected)

**Reasoning:**
- `bridge-client.js` heartbeat with grace periods for hidden tabs.
- Proxy at `/api/bridge` when served on `:8080`; direct `:49200` otherwise.
- `env.js` / `bridge-ui.js` show hints when not on localhost.

**Warnings:**
- GitHub Pages users see bridge offline — manual logging only (by design).
- Tray app locks build files in git clone — process issue only.

**Reproduction:**
1. Run `start-val-grind.bat` → bridge status online in setup wizard.
2. Stop bridge → status offline, manual log still works.
3. Open GitHub Pages URL → no bridge, no crash.

---

## Cross-system dependency map

```
Auth → loadUserData → boot repair → UI render
         ↓
    saveGames ← matches CRUD ← dock / auto-log / edit modal
         ↓
    Supabase matches + user_settings
         
Bridge (localhost only) → auto-log-handlers → addGame → saveGames

Sessions / prefs → localStorage (device-local overlay)
```

---

## Sign-off checklist for Product Owner

Before tagging `v1.0.0`:

- [ ] All **Pass** systems exercised in `docs/RELEASE-CHECKLIST.md`
- [ ] All **Warning** systems have at least one manual repro documented above
- [ ] No **Fail** reproduced
- [ ] Friend path completed on fresh account
- [ ] `push-updates.bat` run; GitHub Pages matches localhost behavior

---

*Generated during v1.0 stabilization audit. No code was modified to produce this report.*
