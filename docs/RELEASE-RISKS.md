# Release Risks — v1.0.0-rc1

**Date:** 2026-06-02  
**Mode:** Stabilization (read-only security/reliability review)  
**Purpose:** Actionable risks for Product Owner verification before `v1.0.0` tag

---

## Summary

| Severity | Count | Action before tag |
|----------|------:|-------------------|
| Critical | 1 | **Fixed** — C-1 `priorEnd` (re-test Val auto-log) |
| High | 6 | Manual repro required |
| Medium | 11 | Monitor during smoke test |
| Low | 8 | Accept or defer to v1.0.1 |

---

## Critical

### R-C1 — Val auto-log ReferenceError — **FIXED**

**File:** `js/auto-log-handlers.js:158`  
**Pattern:** Undeclared `priorEnd` in `handleValorantAutoLog`; error swallowed by `valorant-live.js:131`.  
**Fix:** `!priorState.hasPrior ? 'RR estimated' : ''`  
**Re-test:** Finish Val match with bridge armed — auto-log must succeed.

---

## High

### R-H1 — Supabase legacy save: delete-all then insert

**File:** `js/supabase.js` — `syncGameSliceLegacy()`

**Pattern:** `DELETE matches WHERE user+game` then `POST` all rows.

**Risk:** Partial failure = empty remote history for that game.

**When triggered:** Upsert unavailable (`isUpsertUnavailable` — missing unique index, old schema).

**Reproduction:**
1. Confirm production Supabase has run `docs/supabase/multi-game.sql` and unique key on `(user_id, game, match_num)`.
2. Log matches, edit one, watch Network tab for upsert POST (not delete-all fallback).
3. **Fail:** Console shows `[supabase] upsert unavailable — falling back to replace save` during normal save.

---

### R-H2 — Silent settings load failure

**File:** `js/supabase.js` — `loadSettings()` (lines ~325–339)

**Pattern:**
```javascript
} catch {
  /* table may not exist yet */
}
return { goals: DEFAULT_GOALS, ... };
```

**Risk:** User settings appear reset (goals, riot ID, rank baselines flags) without error if `user_settings` query fails transiently.

**Reproduction:**
1. Set goals + riot ID in profile/settings.
2. DevTools → block `user_settings` request once on refresh.
3. **Fail:** Defaults shown, no error toast; subsequent save might overwrite good remote data with defaults if user clicks save.

---

### R-H3 — Boot mutates Val data without explicit consent

**Files:** `js/boot.js`, `js/matches.js`

**Pattern:** `purgeGhostValorantMatches({ silent: true })` and `collapseDuplicateValorantMatchesInState({ silent: true })` on every boot.

**Risk:** Legitimate edge-case rows (e.g. unfinished manual log) removed as "ghost" if K+D+A = 0.

**Reproduction:**
1. Manually log Val match with 0/0/0 (if UI allows) or use QA ghost generator.
2. Refresh app.
3. **Expected:** Row removed + toast.
4. **Fail:** Valid in-progress row removed without user action.

---

### R-H4 — Unescaped user content in match log HTML

**File:** `js/ui.js` — `renderLog()` note cells

**Pattern:** `${g.notes}` in template → `innerHTML`

**Risk:** Stored XSS in notes column; CSV export formula injection (see R-M9).

**Reproduction:** See AUDIT-REPORT H3.

---

### R-H5 — Concurrent save error leaves sync status red but UI optimistic

**Files:** `js/matches.js`, `js/supabase.js`

**Pattern:** `persistActiveGames` only calls `setGames(merged)` after successful `saveGames`. On throw, in-memory state unchanged — good. Caller must catch.

**Risk:** Some callers may not catch — user thinks save succeeded.

**Reproduction:**
1. Go offline after filling log form.
2. Submit log.
3. **Expected:** Error toast, no new row in table.
4. **Fail:** Toast success or row appears but gone after refresh.

---

## Medium

### R-M1 — Empty / comment-only catch blocks

| File | Line area | Behavior |
|------|-----------|----------|
| `js/auto-log-handlers.js` | ~66–76 | Swallows bridge consume errors (intentional) |
| `js/boot.js` | ~179 | QA import fail silent |
| `js/app.js` | ~438 | Bridge optional on clear |
| `js/setup-wizard.js` | ~339–440 | Bridge not ready |
| `js/bridge-client.js` | ~46 | Listener throw ignored |
| `js/sessions.js` | ~76 | localStorage quota |

**Risk:** Real errors hidden in dev console only.

**Reproduction:** Trigger each path (bridge down, QA import fail) — confirm user-visible fallback exists.

---

### R-M2 — JSON.parse without try/catch

| File | Guard? |
|------|--------|
| `js/supabase.js` `sbFetch` | **No** — trusts API JSON |
| `js/matches.js` deep clone | **N/A** — stringify own data |
| `js/groups.js` `parseRpcError` | Wrapped in try |
| `js/dock-ui.js` prefs | **Yes** |
| `js/sessions.js` session load | **Yes** |
| `js/quicklog.js` loadPrefs | **Yes** |
| `js/setup-wizard.js` | **Yes** |
| `js/auto-log-prefs.js` | **Yes** |

**Risk:** Supabase returns HTML error page → `JSON.parse` throw → boot failure ( surfaced in boot catch).

**Reproduction:** Block Supabase domain → refresh → boot error message shown (not blank screen).

---

### R-M3 — Network failure paths

| Path | Handling |
|------|----------|
| `sbFetch` | 25s timeout; throws on !ok |
| `loadUserData` boot | 30s timeout wrapper |
| Auth CDN import | Fallback sources + clear error |
| Bridge heartbeat | Grace periods; optimistic online while hidden |
| Avatar upload | Falls back to inline data URL |

**Reproduction:** Run checklist Auth + Supabase sections on slow 3G throttling.

---

### R-M4 — Race: rapid consecutive logs

**File:** `js/matches.js` — `persistChain = persistChain.then(task, task)`

**Mitigation:** Serializes saves per tab.

**Residual risk:** Two tabs open → last write wins across tabs.

**Reproduction:**
1. Open app in two browser tabs same account.
2. Log different matches simultaneously in both.
3. Refresh — **fail signal:** missing matches or duplicate match_num errors.

---

### R-M5 — Race: auto-dedupe during render

**File:** `js/app.js` — `renderMatchLogs()` auto-collapse dupes

**Risk:** Render re-entry while async dedupe in flight.

**Reproduction:** Navigate to Match Logs with dupe rows present; watch for double toast or flicker.

---

### R-M6 — Async state update after sign-out

**Files:** `js/auth.js`, `js/boot.js`, various `await saveGames`

**Risk:** Slow save completes after sign-out → error or wrong user scope.

**Reproduction:**
1. Log game → immediately sign out before sync completes.
2. **Fail:** Data written to wrong session or uncaught promise error in console.

---

### R-M7 — `clearGameHistory` is destructive

**File:** `js/matches.js` — confirms once, then `saveGames([], gameId)`

**Risk:** User confirms clear all Val history — irreversible except backups.

**Reproduction:** Click "Clear all Val history" → confirm → all Val rows gone; RL untouched.

---

### R-M8 — Rank baseline inference on boot

**File:** `js/boot.js` (lines ~113–117)

**Pattern:** If games exist but `rankBaselinesComplete` false, infer baselines and save settings.

**Risk:** Wrong baselines inferred from corrupted chain → affects auto-log start RR.

**Reproduction:** Fresh account with imported matches only — check rank setup wizard still prompts correctly.

---

### R-M9 — CSV export injection

**File:** `js/export.js`

**Risk:** Notes starting with `=`, `+`, `-`, `@` may execute as formulas in Excel.

**Reproduction:** Export match with note `=1+1` → open CSV in Excel → **fail:** cell evaluates formula.

---

### R-M10 — Post-match card auto-dismiss

**File:** `js/post-match.js` — 60s timer when MMR already confirmed

**Risk:** User misses tag/undo window.

**Reproduction:** Auto-log match → wait 60s without interaction → card hides.

---

### R-M11 — OAuth implicit flow token in URL hash

**File:** `js/auth.js` — `flowType: 'implicit'`

**Risk:** Token briefly in URL; stripped after load. Standard Supabase pattern.

**Reproduction:** Google sign-in → hash cleared from address bar after load.

---

## Low

### R-L1 — `ensureFounderUid` swallows errors (4s timeout)

### R-L2 — `loadUserGroups` catch → `[]` (Squads empty state)

### R-L3 — `formatApiError` JSON parse in try — plain text fallback OK

### R-L4 — Chart.js CDN — single point of failure for charts (not logging)

### R-L5 — `window.__saveRankBaselines` global hook from boot

### R-L6 — QA persist allowlist — dev only

### R-L7 — OneDrive sync on git clone — deploy process risk

### R-L8 — `persistChain` error handler `then(task, task)` runs task on rejection too — may retry failed save immediately

---

## localStorage corruption matrix

| Key | Module | try/catch | Corrupt data behavior |
|-----|--------|-----------|------------------------|
| `rl-grind-prefs` | quicklog, dock-ui, sessions | Yes | Falls back to defaults |
| `rl-grind-session:*` | sessions | Yes | Session not restored |
| `rl-grind-setup` | setup-wizard | Yes | Wizard shows full steps |
| `rl-grind-qa-dev` | qa-gate | N/A | QA off |

**Reproduction:** DevTools → Application → Local Storage → set `rl-grind-prefs` to `{invalid`. Refresh → app loads with default prefs.

---

## undefined access hotspots (manual spot-check)

| Location | Guard |
|----------|-------|
| `getElementById` chains in app.js | Mostly optional chaining or early return |
| `openEditModal` missing game | Returns early |
| `patchLastGame` empty games | Returns null |
| Squad member `profiles` join | Fallback `'Player'` display name |
| Val rank display `resolveValorantMatchDisplayRanks` | Uses chain resolver |

**Reproduction:** Open each page with zero games logged — no console errors, empty states shown.

---

## Pre-tag risk acceptance (Product Owner)

| ID | Accept for v1.0? | Notes |
|----|:----------------:|-------|
| R-H1 | ☐ | Verify upsert path in prod Supabase |
| R-H2 | ☐ | |
| R-H3 | ☐ | Intentional cleanup — confirm QA only |
| R-H4 | ☐ | |
| R-H5 | ☐ | |
| R-M4 | ☐ | Document "single tab" if accepted |
| R-M7 | ☐ | Confirm button label clear enough |
| R-M9 | ☐ | Defer CSV fix to v1.0.1 if needed |

---

## Related documents

- `docs/AUDIT-REPORT.md` — code quality findings
- `docs/STABILITY-REPORT.md` — per-system Pass/Warning/Fail
- `docs/RELEASE-CHECKLIST.md` — manual smoke test matrix

---

*Generated during v1.0 stabilization audit. No code was modified to produce this report.*
