# Zero-Error Policy & Startup Stability

**Mandate:** Every uncaught JavaScript error is a **release blocker**. Forensic first → fix → permanent guardrails.

---

## Part A — `applyAppMode` forensic

### Dependency map

| Symbol | Defined in | Imported by | Call sites |
|--------|------------|-------------|------------|
| `applyAppMode()` | `js/env.js:22` | `js/app.js:7`, `js/boot.js:3` | `app.js:1262` (`init()`), `boot.js:135`, `boot.js:221` |
| `isDesktopHost()` | `js/env.js:9` | `js/boot.js:3`, `js/app.js:7` | `app.js:1408`, `app.js:1426` (auth-failure copy) |
| `isLocalTrackerHost()` | `js/env.js:32` | `js/boot.js:3` | `boot.js:77` (`waitForDesktopServices`) |
| `isTwansAppHost()` | `js/env.js:14` | *(via env helpers)* | Used inside `isLocalTrackerHost()` |

```
env.js (applyAppMode, isDesktopHost, …)
    ├── boot.js ── bootApp() shell + post-data render
    └── app.js  ── init() dom-ready + auth-failure paths
```

### Root cause (fixed at `4882d5a`)

**Scenario:** After desktop boot refactors, `init()` in `app.js` called `applyAppMode()` without importing it from `env.js`. `boot.js` already imported it correctly, so the error only surfaced on the **login shell path** before `bootApp()` ran.

**Symptom:** `ReferenceError: applyAppMode is not defined` → global error handler toast on login screen.

**Fix:** `import { applyAppMode } from './env.js';` in `app.js` (commit `4882d5a4922cb6a5c3df851f85a6427049b6028`).

**Current status:** ✅ Present in current code (`js/app.js:7`, `js/app.js:1262`).

### Similar missing-import scan (`init()` / boot callers)

| File | Issue | Status |
|------|-------|--------|
| `app.js` | `applyAppMode` without import | ✅ Fixed `4882d5a` |
| `app.js` | `isDesktopHost()` used in auth-failure copy without import | ✅ Fixed (added to `env.js` import) |
| `boot.js` | All `init*`, `render*`, `apply*` helpers imported at top | ✅ Clean |
| `app.js` | `initAuth`, `initSessionUI`, `initQuickLog`, `initPostMatch`, `initRlLive`, `initValorantLive` | ✅ All imported |

**Prevention:** Before calling any cross-module symbol, verify a top-level `import`. Run `node --check` on touched files.

---

## Part B — Static error audit

### `node --check js/**/*.js`

**Date:** 2026-06-11  
**Result:** ✅ **93/93 files pass** — no syntax errors.

### ReferenceError pattern scan (`app.js` cross-module calls)

Audited exported helpers called from `app.js` against import block. No additional missing imports beyond `isDesktopHost` (fixed this pass).

### Global error surface

| Layer | Module | Behavior |
|-------|--------|----------|
| Uncaught errors | `js/core/error-log.js` | `installGlobalErrorHandlers()` in `init()` |
| Boot timeout | `index.html` | 30s watchdog if `__appReady` never set |
| Auth timeout | `app.js` | `withTimeout(initAuth(), 20000)` |

---

## Part C — Developer validation overlay

**Module:** `js/dev-overlay.js`  
**Wired:** `initDevOverlay()` at end of `app.js` `init()` after auth-ready (no-op when disabled).

### Toggle

| Method | Example |
|--------|---------|
| Query param | `twans://app/index.html?dev=1` or `http://127.0.0.1:8080/?dev=1` |
| localStorage | `localStorage.setItem('dev-overlay', '1')` then reload |
| Disable | `localStorage.removeItem('dev-overlay')` and reload without `?dev=1` |

`?dev=1` persists `dev-overlay=1` in localStorage for subsequent loads.

### Live metrics

| Metric | Source |
|--------|--------|
| Startup | Last `window.__BOOT_MARKS` entry (`boot.js` + `app.js`) |
| Dash renders | `window.__DASH_RENDER_COUNT` (`home.js`) |
| Match log | `window.__MATCHLOG_RENDER_COUNT` (`app.js`) |
| Review | `window.__REVIEW_RENDER_COUNT` (analytics / reports / focus) |
| Squad | `window.__SQUAD_RENDER_COUNT` (`renderGroupsPage`) |
| Charts | `window.__CHARTS_RENDER_COUNT` (`charts.js`) |
| Timers / intervals | Patched `setTimeout` / `setInterval` after overlay init only |
| Supabase requests | `window.__SUPABASE_REQUEST_COUNT` (`supabase.js` `sbFetch`) |
| Memory | `performance.memory.usedJSHeapSize` (Chrome/Electron only) |
| Last match save | `window.__LAST_MATCH_SAVE_MS` (`submitGameLog`) |
| Bridge requests | `window.__BRIDGE_REQUEST_COUNT` (`bridge-client.js`) |
| Save refresh path | `window.__REFRESH_AFTER_GAME_DATA_CHANGE_COUNT` (`refreshAfterGameDataChange`) |
| Analyze / guardrail | **Analyze Performance** + **Test save guardrail** buttons in overlay |

**Timer limitation:** Counts only timers/intervals created **after** overlay patches run (post `initDevOverlay`). Pre-existing timers (Chart.js, bridge heartbeat) are not retroactively tracked.

See also [`PREMIUM-DESKTOP-POLISH.md`](./PREMIUM-DESKTOP-POLISH.md) for full success criteria.

---

## Part D — Performance guardrails

### No `renderAll` for localized updates

Match save, auto-log, and post-match patches must use **`refreshAfterGameDataChange()`** (coalesced via `scheduleRefreshAfterGameDataChange()`), not `renderAll()`.

```javascript
// GUARDRAIL in js/app.js above renderAll()
// GUARDRAIL: Do not call renderAll() for match-save — use refreshAfterGameDataChange()
```

See `refreshAfterGameDataChange()` → `refreshAfterMatchSaved()` for dashboard; `renderMatchLogs()` when on log page.

### Hidden pages never render

`renderAllInner()` gates on `state.activePage`:

- Dashboard → `renderHomePage()` only when `page === 'dashboard'`
- Log → `renderMatchLogs()` only when `page === 'log'`
- Analytics / reports / focus / group / sessions / profile → respective blocks only when active

Do not add unconditional full-page renders outside this gate.

### One event = one UI update

- Match save: `scheduleRefreshAfterGameDataChange()` coalesces to one rAF
- Dashboard throttle: `DASH_RENDER_MIN_MS` (500ms) + scroll pause deferral
- Session UI: `rl-session-ui-refresh` patches widgets only, skips when inside `renderAll`

### Startup order (SPA — 9 steps)

Console marks: `[boot +Nms] <phase>` and `window.__BOOT_MARKS`.

| Step | Phase | Module |
|------|-------|--------|
| 1 | `dom-ready` | `app.js` — `applyAppMode`, login shell |
| 2 | `bridge-services-started` | `app.js` — heartbeat / bridge wiring |
| 3 | `auth-ready` | `app.js` — `initAuth()` complete |
| 4 | `shell-visible` | `boot.js` — overlay off, quick dock |
| 5 | `first-paint` | `boot.js` — after `waitForFirstPaint()` |
| 5b | `interactive` | `boot.js` — shell skeleton painted, before `loadUserData` |
| 5c | `shell-painted` | `boot.js` — `renderDashboardShell()` |
| 6 | `load-user-data-start` | `boot.js` — parallel Supabase + bridge |
| 7 | `data-loaded` | `boot.js` — `loadUserData()` resolved |
| 8 | `first-render-complete` | `boot.js` — initial `renderAll()` |
| 9 | `boot-finished` | `boot.js` — `finally`, overlay hidden |

Electron shell adds `[startup +Nms]` in `config/bridge.log` (`main.cjs`) before SPA marks.

### Permanent validation checklist

- [ ] `node --check` on all changed `js/**/*.js`
- [ ] Desktop cold boot: no error toast on login shell
- [ ] Signed-in boot: `[boot +Nms] boot-finished` in console
- [ ] Match save: `__LAST_MATCH_SAVE_MS` updates; dash `__DASH_RENDER_COUNT` does not spike (+1 targeted refresh, not full `renderAll`)
- [ ] Idle dashboard 10s: `__DASH_RENDER_COUNT` ≤ +2 (throttle proof)
- [ ] Dev overlay: `?dev=1` shows panel; remove flag → panel absent, no console errors
- [ ] Hidden page: navigate away from dashboard → no `renderHome` in perf logs while on log/setup

---

## Related docs

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — startup flow diagram
- [`PREMIUM-DESKTOP-POLISH.md`](./PREMIUM-DESKTOP-POLISH.md) — polish pass checklist
- [`PERFORMANCE-OPTIMIZATION-REPORT.md`](./PERFORMANCE-OPTIMIZATION-REPORT.md) — render/throttle details
- [`RELEASE-CHECKLIST.md`](./RELEASE-CHECKLIST.md) — ship gates
