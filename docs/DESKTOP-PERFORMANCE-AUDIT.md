# Desktop Performance Audit

**Date:** 2026-06-10  
**Scope:** Twans Ultimate Tracker desktop (Electron + SPA)  
**Goal:** Commercial desktop feel without tracking regressions.

---

## Executive summary

Audited timers, listeners, and full-DOM rebuilds across `js/`. Implemented **5 low-risk fixes** this session. Deferred heavier work (animations, images, nav precache, native OS notifications) to Phase 2.

| Category | Finding count | Fixed this session |
|----------|---------------|-------------------|
| `setInterval` without hide cleanup | 6 | 1 (diagnostics) |
| Eager page renders in `renderAll` | 1 | 1 |
| Eager module imports in `app.js` | 3 | 3 |
| Full `innerHTML` dashboard rebuilds | Many in `home.js` | 1 (quick actions patch) |
| Electron security | 0 issues | Verified |

---

## Timers (`setInterval`)

| File | Interval | Cleanup | Action |
|------|----------|---------|--------|
| `js/bridge-client.js` | 2500ms heartbeat | `stopBridgeHeartbeat()` | **Kept** — visibility refresh on tab show |
| `js/rl-live.js` | 1500ms poll | `stopRlLive()` | Phase 2 — consider backoff when idle |
| `js/valorant-live.js` | dynamic poll | `stopValorantLive()` + visibility | **Kept** |
| `js/process-session.js` | POLL_MS | `stopProcessSessionWatcher()` | **Kept** |
| `js/sessions.js` | 1000ms session timer | `clearSessionTimer()` | **Kept** |
| `js/diagnostics-ui.js` | 4000ms | `stopDiagnosticsPanel()` | **Fixed** — pauses when tab hidden |
| `tools/launcher/src/main.cjs` | 3000ms status | `before-quit` clear | **Adjusted** from 2500ms |

---

## Event listeners

| Pattern | Files | Risk | Action |
|---------|-------|------|--------|
| `document.addEventListener` without remove | `app.js` (keydown), `quicklog.js`, `bridge-client.js` | Low — single init | **Kept** (guarded by `wired` flags where needed) |
| Per-render listeners on `innerHTML` | `home.js` `wireHomeLinks`, `ui.js` filter bars | Medium | Phase 2 — delegate clicks on stable parent |
| Duplicate wiring | `setup-wizard.js`, `game-ui.js` | Low | Already uses `dataset.wired` guards |

---

## Full DOM rebuilds (`innerHTML`)

### `js/home.js`

| Function | Rebuild scope | Action |
|----------|---------------|--------|
| `renderDashHero` | Full hero | Phase 2 — diff rank/MMR text only |
| `renderDashRankProgress` | Full section | Phase 2 |
| `renderDashQuickActions` | 4 buttons | **Fixed** — patch session button when wired |
| `renderDashPerfStats` | Stat grid | Phase 2 — update values only |
| `renderHomeActivity` | Activity list | Phase 2 — append new row on log |
| `renderHomeFocus` | Focus card | Phase 2 |

### `js/game-ui.js`

Switcher listeners wired once via `initGameSwitcher` — **OK**.

---

## Fixes applied (this session)

### 1. Lazy module imports (`js/app.js`)

Deferred static imports of:

- `./reports-ui.js`
- `./focus.js`
- `./groups.js`

Loaded on first navigation to Reports, Focus, or Squads.

### 2. Scoped `renderAll()` (`js/app.js`)

Previously re-rendered analytics, reports, focus, groups, sessions, and profile on every data change. Now renders off-page content only when that page is active (dashboard still always refreshes home charts).

### 3. Dashboard quick-actions patch (`js/home.js`)

Session start/end toggles update button label/icon without rebuilding all four quick-action buttons.

### 4. Diagnostics poll pause (`js/diagnostics-ui.js`)

`setInterval` cleared when `document.visibilityState === 'hidden'`; resumed on show.

### 5. Boot shell-first paint (`js/boot.js`)

App shell (navbar, dock shell) visible before Supabase `loadUserData()` completes; desktop bridge wait runs in parallel via `Promise.all`.

### 6. Electron startup (`tools/launcher/src/main.cjs`)

- Load `twans://` app shell immediately (do not block on `:8080` ready)
- Tray/window use branded `icon.ico`
- Block reload shortcuts in production
- Status poll 2500ms → 3000ms

### 7. Auto-recovery UX (`js/status-copy.js`, `js/bridge-client.js`, `js/bridge-ui.js`)

- `Reconnecting…` pill when bridge drops after prior success
- `Tracking resumed` toast on reconnect (no manual restart prompt)

---

## Electron hardening (verified)

```javascript
// tools/launcher/src/main.cjs — BrowserWindow webPreferences
nodeIntegration: false,
contextIsolation: true,
sandbox: true,
devTools: IS_DEV,
```

Tracker app bundled via `extraResources` → `tracker-app/` (unchanged).

---

## Phase 2 deferrals

| Item | Target files | Effort |
|------|--------------|--------|
| Nav / dock micro-animations | `css/layout-polish.css`, `js/nav.js` | Medium |
| Avatar / chart image lazy-load | `js/profile-ui.js`, `index.html` | Low |
| Narrow-window dashboard | `css/dashboard-v0.css` | Medium |
| Nav module precache after idle | `js/app.js` `requestIdleCallback` | Low |
| Native OS notifications (match logged) | `tools/launcher/src/main.cjs` IPC stub | Medium |
| `home.js` incremental stat updates | `js/home.js` | Medium |
| RL live poll backoff when idle | `js/rl-live.js` | Low |
| Event delegation for home links | `js/home.js` | Low |

### Native notifications (#14)

**Deferred.** Recommended approach:

1. `main.cjs`: `ipcMain.handle('notify-match-logged', …)` using `Notification` API (Windows 10+).
2. `auto-log-handlers.js`: post-save hook calls `window.twans?.notify?.()` if exposed via preload + contextBridge.

Not implemented — in-app `showToast` remains sufficient for MVP desktop feel.

### Reduced motion

Already present in `css/styles.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

No additional hook required.

---

## Regression guardrails

- Tracking pipelines (`rl-live`, `valorant-live`, `auto-log-handlers`) unchanged except status copy
- Supabase load/repair logic unchanged — only parallelized with bridge wait
- `twans://` OAuth callback redirect preserved
- Rank chain repair still runs on boot after data load

---

## Files changed this sprint

| File | Change |
|------|--------|
| `tools/launcher/package.json` | `icon.ico`, `png-to-ico`, `prebuild` |
| `tools/launcher/scripts/generate-icon.mjs` | New — ICO generator |
| `tools/launcher/assets/icon.ico` | Generated |
| `tools/launcher/src/main.cjs` | Icon, startup, reload block, poll interval |
| `js/boot.js` | Shell-first, parallel load |
| `js/app.js` | Lazy imports, scoped renderAll |
| `js/home.js` | Quick-actions patch |
| `js/bridge-client.js` | Reconnecting state |
| `js/bridge-ui.js` | Reconnecting/resumed UX |
| `js/status-copy.js` | New labels |
| `js/diagnostics-ui.js` | Visibility poll pause |
| `docs/ARCHITECTURE.md` | Startup + icon note |
| `docs/DESKTOP-PERFORMANCE-AUDIT.md` | This file |
| `docs/DESKTOP-PERFORMANCE-SPRINT.md` | Sprint checklist |
