# Dev Overlay — reference

Read when extending counters, boot marks, or analyze heuristics.

## Module entry

| File | Exports |
|------|---------|
| `js/dev-overlay.js` | `isDevOverlayEnabled`, `initDevOverlay`, `runDevGuardrailCheck` |
| `js/boot.js` | `markBoot(phase)` → pushes `{ phase, ms }` to `window.__BOOT_MARKS` |
| `js/app.js` | `initDevOverlay()` after auth-ready; render counters on hot paths |

## Boot marks (typical order)

| Phase | Module | Notes |
|-------|--------|-------|
| `dom-ready` | `app.js` | Login shell, `applyAppMode` |
| `bridge-services-started` | `app.js` | Heartbeat wiring |
| `auth-ready` | `app.js` | `initAuth()` complete |
| `shell-visible` | `boot.js` | Overlay off, quick dock |
| `shell-painted` | `boot.js` | `renderDashboardShell()` |
| `first-paint` | `boot.js` | After double rAF |
| `interactive` | `boot.js` | Before `loadUserData` |
| `bridge-reachable` / `bridge-wait-capped` | `boot.js` | Desktop probe |
| `load-user-data-start` | `boot.js` | Supabase fetch begins |
| `data-loaded` | `boot.js` | `loadUserData()` resolved |
| `repair-chains-start` / `hydrate-state` | `boot.js` | Chain repair |
| `first-render-complete` | `boot.js` | Initial `renderAll()` |
| `deferred-maintenance-start/done` | `boot.js` | Idle ghost/dedupe |
| `boot-finished` | `boot.js` | `finally` block |

Console: `[boot +Nms] <phase>`.

## Render counters

| Counter | Increment site |
|---------|----------------|
| `__DASH_RENDER_COUNT` | `js/home.js` `renderHomePage` |
| `__MATCHLOG_RENDER_COUNT` | `js/app.js` match log render |
| `__REVIEW_RENDER_COUNT` | analytics / reports / focus |
| `__SQUAD_RENDER_COUNT` | `renderGroupsPage` |
| `__CHARTS_RENDER_COUNT` | `js/charts.js` |
| `__MATCH_SAVE_DASH_RENDERS` | targeted dash refresh on save |
| `__REFRESH_AFTER_GAME_DATA_CHANGE_COUNT` | coalesced refresh path |
| `__LAST_MATCH_SAVE_MS` | `submitGameLog` wall time |

## Network counters

| Counter | Site |
|---------|------|
| `__SUPABASE_REQUEST_COUNT` | `js/supabase.js` each `sbFetch` |
| `__BRIDGE_REQUEST_COUNT` | `js/bridge-client.js` each request |

## Cache instrumentation (extension target)

| Cache | File | Suggested hook |
|-------|------|----------------|
| Stats / filters | `js/perf-cache.js` | hit/miss on `cachedCalcStats`, `cachedApplyFilters` |
| MMR rows | `js/home.js` `getCachedPlaylistMMRRows` | hit when key matches |
| Profile shell | `js/profile-cache.js` | boot uses `loadProfileCache` before data |

Expose as `window.__PERF_CACHE_HITS` / `__PERF_CACHE_MISSES` when implemented.

## Overlay limitations

- **Timers/listeners:** patched only after `initDevOverlay()` — pre-existing Chart.js, bridge heartbeat not counted.
- **Memory:** Chrome/Electron only (`performance.memory`).
- **CPU:** no direct sampler; use FPS + save ms as proxy.
- **Panel buttons:** re-bind listeners each `refreshPanel()` tick — acceptable for dev-only UI.

## Analyze thresholds (current)

| Signal | Threshold | Hint |
|--------|-----------|------|
| Dash renders | > 20 high, > 8 moderate | page-gate, save throttle |
| Listeners | > 120 | innerHTML re-bind leaks |
| Bridge req | > 60 idle session | poll stacking |
| loadUserData | > 2500ms | network/Supabase |
| first-paint→interactive | > 500ms | shell skeleton |

## Guardrail text

`submitGameLog` must use `scheduleRefreshAfterGameDataChange`, not `renderAll`. See `js/app.js` GUARDRAIL comment above `renderAll()`.
