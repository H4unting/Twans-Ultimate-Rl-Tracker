# Code Audit Report — v1.0.0-rc1

**Date:** 2026-06-02  
**Mode:** Stabilization (read-only audit — no deletions performed)  
**Scope:** `js/`, `css/`, `index.html`, `scripts/` (excludes `tools/launcher/node_modules/`)

---

## Summary

| Severity | Count | Release impact |
|----------|------:|----------------|
| Critical | 1 | **Fixed** — Val auto-log ReferenceError (`priorEnd`) |
| High | 5 | Manual verification recommended before tag |
| Medium | 12 | Track for v1.0.1 |
| Low | 14 | Hygiene / maintainability |

No automatic deletions were made. Every item below includes reproduction steps for Product Owner verification.

---

## Critical

### C1 — Valorant auto-log ReferenceError (`priorEnd` undeclared) — **FIXED**

**Location:** `js/auto-log-handlers.js` line 158 (in `handleValorantAutoLog`)

**Finding:** `priorEnd` was only defined in the RL handler (`handleAutoLog`). Val handler referenced it when building `autoLogNote`, throwing `ReferenceError` on every Val auto-log. Error swallowed by `valorant-live.js` outer catch → match never logged, consume never called, 5s poll loop.

**Fix applied:** `priorEnd === ''` → `!priorState.hasPrior`

### C2 — Edit modal Save button stuck disabled — **FIXED**

**Location:** `js/app.js` — `handleSaveEdit()`  
**Finding:** Early `return` when `updateGame` returns null skipped button re-enable.  
**Fix applied:** `btn.disabled` reset moved to `finally` block.

### C3 — Session timer leak on sign-out — **FIXED**

**Location:** `js/sessions.js`, `js/app.js` — `handleSignOut()`  
**Finding:** `resetAppState()` replaced `state.session` without `clearInterval`.  
**Fix applied:** Export `clearSessionTimer()`; call before sign-out reset.

### C4 — Val live listener leak on re-login — **FIXED**

**Location:** `js/valorant-live.js` — `initValorantLive` / `stopValorantLive`  
**Finding:** Document listeners added each init, never removed.  
**Fix applied:** Named handlers removed in `stopValorantLive()`.

**Reproduction (verify fix):**
1. Bridge + Henrik configured; finish Val Competitive match.
2. Wait for auto-log poll.
3. **Pass:** Match appears in log, toast shown, no console ReferenceError.
4. **Fail:** No match logged; ReferenceError every ~5s in console.

---

## High

### H1 — Legacy Supabase save path deletes before insert

**Location:** `js/supabase.js` — `syncGameSliceLegacy()` (lines ~210–214)

**Finding:** If upsert fails, fallback runs `DELETE` on all rows for a game slice, then `POST` new rows. A network failure between DELETE and POST would leave remote data empty while local state still holds matches.

**Reproduction:**
1. Sign in with a test account that has RL + Val matches.
2. In DevTools → Network, throttle to Offline immediately after triggering a save (edit any match).
3. If upsert path fails and legacy fallback runs, refresh page — compare match count vs pre-edit.
4. **Expected (pass):** Matches still load from Supabase or clear error toast; count unchanged.
5. **Fail signal:** Match history empty in DB but UI still shows data until refresh, then data gone.

**Note:** Upsert path is primary; legacy is fallback only. Verify `docs/supabase/multi-game.sql` and unique constraint exist in production Supabase.

---

### H2 — Boot auto-purges Val ghost/duplicate rows without confirm

**Location:** `js/boot.js` (lines ~119–126), `js/matches.js` — `purgeGhostValorantMatches`, `collapseDuplicateValorantMatchesInState`

**Finding:** On every successful boot, ghost (0/0/0) and duplicate Val rows are removed silently (`silent: true`), with toast only if rows were removed. User did not explicitly confirm.

**Reproduction:**
1. Enable QA tools (`Ctrl+Shift+D` on localhost).
2. Generate Val matches including a 0/0/0 ghost row and a duplicate signature pair.
3. Hard refresh the app.
4. **Expected (pass):** Toast reports removed count; rows gone from match log.
5. **Fail signal:** Valid rows removed, or no toast but rows missing, or boot crash.

---

### H3 — Match log notes rendered without HTML escaping

**Location:** `js/ui.js` — `renderLog()` note cells (lines ~133–146, ~160–177)

**Finding:** User notes are injected into `innerHTML` via template string without `escapeHtml()`. A note containing `<script>` or `<img onerror=…>` could execute markup in the match log table.

**Reproduction:**
1. Log a match with note: `[QA] test <b>bold</b> & "quotes"`
2. Open Match Logs — note should display as plain text, not bold HTML.
3. Log note: `<img src=x onerror=alert(1)>` (use a throwaway account).
4. **Fail signal:** Alert fires or HTML renders as active markup.

**Risk:** Mostly self-XSS; still worth fixing pre-1.0 if notes sync across devices.

---

### H4 — Auto-dedupe runs during match log render

**Location:** `js/app.js` — `renderMatchLogs()` (lines ~389–393)

**Finding:** When duplicate Val signatures exist, `collapseDuplicateValorantMatchesInState()` is invoked automatically inside render (not only via maintenance button). Side effect during paint can surprise users and cause extra Supabase writes on every log page visit.

**Reproduction:**
1. Import or QA-generate two Val rows with identical signature (same date, mode, K/D/A, ranks).
2. Navigate to Match Logs once.
3. **Expected:** Duplicates collapse without clicking "Remove duplicates".
4. **Fail signal:** Wrong row kept (lost Henrik `id:` row), or repeated save toasts / sync errors on every visit.

---

## Medium

### M1 — Duplicate `getLastModeForGame` logic

**Locations:** `js/quicklog.js`, `js/dock-ui.js` (lines 6–12), `js/sessions.js` (`getActiveLogMode`)

**Finding:** Same localStorage read pattern copied in three modules. Drift risk if prefs shape changes.

**Reproduction:** Change `lastModes` in Application → Local Storage; confirm dock pills, session mode, and full form all agree on active mode.

---

### M2 — Deprecated compatibility shims (intentional)

**Locations:**
- `js/state.js` → re-exports `js/core/state.js`
- `js/valorant-config.js` → re-exports `js/games/valorant/config.js`
- `js/ranks.js` imports `./core/state.js` while most modules use `./state.js`

**Finding:** Not dead code; dual import paths increase confusion for contributors.

**Reproduction:** N/A — documentation only.

---

### M3 — Duplicate CSS for tables

**Locations:** `css/styles.css` (`.table-wrap`, `.log-table`, `.note-cell`) and `css/layout-polish.css` (`.table-wrap`, `.log-table th/td` padding)

**Finding:** Intentional layering; not conflicting at audit time. Long-note fix lives in `styles.css` only.

**Reproduction:** Open Match Logs with QA long-note row — column wraps, page scrolls vertically.

---

### M4 — `renderMatchLogs()` calls `wireLogTableActions()` twice per pass

**Location:** `js/app.js` — `renderAll()` and `renderMatchLogs()`

**Finding:** Redundant but uses `onclick` assignment (not stacked listeners). Minor perf waste.

---

### M5 — Squads page rebuilds DOM and re-wires listeners each render

**Location:** `js/groups.js` — `renderGroupsPage()`, `wireSquadList()`

**Finding:** Full `innerHTML` replace destroys old nodes; listeners do not accumulate on `#group-list`. Acceptable pattern.

**Reproduction:** Switch Home → Squad → Home → Squad 10 times; squad list should still respond once per click.

---

### M6 — `insights.js` facade over game modules

**Location:** `js/insights.js` vs `js/games/*/insights.js`

**Finding:** Not duplicate logic — thin delegate. OK for release.

---

### M7 — Root `config.js` vs game `config.js` files

**Finding:** Three different `config.js` files (root, RL, Val). Naming collision risk for new contributors only.

---

### M8 — `handleSaveEdit` variable naming (Val RR vs rank tier)

**Location:** `js/app.js` — `handleSaveEdit()` (lines ~828–848)

**Finding:** Local vars `startRank`/`endRank` hold RR numeric field values from `#e-startmmr`/`#e-endmmr`; tier names use `#e-startrank`/`#e-endrank`. Confusing names; functionally uses `mod.META.startRankField` in `openEditModal`.

**Reproduction:**
1. Log Val match with known start/end RR and tier.
2. Edit → change end RR only → Save.
3. Match log End column and +/- RR should update; tier arrows only on promotion.

---

### M9 — Chart instances — partial cleanup

**Location:** `js/charts.js`, `js/app.js`

**Finding:** `destroyAllCharts()` called when home charts hidden; analytics charts use `destroyChart(id)` per chart. Navigating away from Analytics may leave Chart.js instances until re-render.

**Reproduction:** Open Analytics → switch to Home 20 times; monitor memory in DevTools Performance (optional).

---

### M10 — `groups.js` member games cached in module `ui.gamesCache`

**Finding:** Cache not invalidated on game switch; stale squad member stats possible if viewing same member after switching RL ↔ Val.

**Reproduction:**
1. Open Squad, view member stats in RL.
2. Switch game to Val, re-open same member detail.
3. **Fail signal:** RL stats shown under Val context.

---

### M11 — QA tools ship in production bundle

**Location:** `js/qa/*`, dynamic import in `js/boot.js`

**Finding:** Gated by localhost / `?qa=enable` / dev flag — not a runtime risk on GitHub Pages for normal users.

**Reproduction:** Open live GitHub Pages URL — QA panel should not appear without gate.

---

### M12 — `index.html` boot timeout shows generic failure

**Location:** `index.html` (lines ~484–492)

**Finding:** 30s timeout may mask slow Supabase vs CDN failure. Acceptable for v1.

---

## Low

### L1 — Hardcoded founder email in `supabase.js` (`FOUNDER_EMAIL`)

### L2 — `TAG_COLORS`, `PLAYLISTS` imported in `ui.js` from root `config.js` — RL-centric names

### L3 — `js/core/version.js` — verify sync with `version.json` via `scripts/sync-version.mjs` before tag

### L4 — OneDrive git clone layout drift (legacy `launcher/` at repo root vs `tools/launcher/` in dev) — process issue, not runtime

### L5 — Line-ending CRLF warnings in GitHub Desktop for JS files

### L6 — `[submodule] active = .` in OneDrive clone `.git/config` — unusual; git CLI still works

### L7 — `post-match.js` 60s auto-dismiss timer — may hide card before user confirms RR

### L8 — `wireKeyboardShortcuts()` binds `S` to session start globally — may conflict if focus not in input

### L9 — `export.js` / CSV export — no audit of formula injection in Excel for notes fields

### L10 — `integrations/overwolf/` — optional path; not in critical smoke path

### L11 — `js/env.js` — GitHub Pages cannot use bridge (by design)

### L12 — Duplicate rank display helpers in `js/games/valorant/ranks.js` (large file, display-only)

### L13 — `match-logs-ui.js` vs `ui.js` both render Val rank cells — parallel render paths

### L14 — No project-wide ESLint/TypeScript — manual review only

---

## Dead code / orphaned files

| Item | Status |
|------|--------|
| `js/state.js`, `js/valorant-config.js` | **Active shims** — not dead |
| `js/core/*` | **Used** via utils, insights, app, rank-setup |
| `js/analytics.js`, `js/focus.js` | **Used** from `app.js` |
| `js/rl-live.js`, `js/valorant-live.js` | **Used** from app, boot, auto-log |
| Root-level stray `.js` in git clone | **Removed from clone** during cleanup — not in dev tree |

No orphaned production modules identified in `rl-grind-tracker` dev tree.

---

## Circular dependency risks

| Chain | Risk |
|-------|------|
| `matches.js` → `ui.js` → `games.js` → … | **Low** — no cycle back to matches |
| `auto-log-prefs.js` split from `quicklog.js` | **Resolved** — comment documents cycle break |
| `matches.js` → dynamic `import('./sessions.js')` | **Low** — async, one-way |

No hard circular import cycles detected at module load time.

---

## Event listener / memory notes

- **No `removeEventListener`** anywhere in `js/` — acceptable where DOM is replaced via `innerHTML` or `onclick` reassignment.
- **`nav.js` / `app.js` init** — one-time wiring on boot; maintenance buttons use `dataset.wired` guard.
- **`bridge-client.js` heartbeat** — `setInterval` cleared by `stopBridgeHeartbeat()` on sign-out path — verify in smoke test.
- **Chart.js** — see M9.

---

## Broken references

None found in `index.html` script/CSS paths or primary module graph at audit time. Cache bust query `?v=20260601a` matches `version.json` `cache` field.

---

## Recommended pre-tag verification (Product Owner)

1. Run full `docs/RELEASE-CHECKLIST.md` — both You and Friend columns.
2. Manually verify **H1–H4** reproduction steps above.
3. Run `push-updates.bat` after any fixes; hard refresh (Ctrl+Shift+R) on GitHub Pages.

---

*Generated during v1.0 stabilization audit. No code was modified to produce this report.*
