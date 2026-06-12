# Performance Engineer — Twans Ultimate Tracker Reference

Hotspots and call chains for targeted investigation. Read when tracing a specific symptom.

## Scope map

| Area | Primary paths | Concern |
|------|---------------|---------|
| Render orchestration | `js/app.js` | `renderAll`, `scheduleRenderAll`, `refreshAfterGameDataChange` |
| Boot / startup | `js/boot.js` | First paint, `loadUserData`, initial `renderAll`, deferred maintenance |
| Dashboard | `js/home.js` | `DASH_RENDER_HARD_MS` (500ms), `refreshAfterMatchSaved`, charts |
| Match log | `js/matches.js`, `js/quicklog.js` | Full table redraw, tag chip re-wiring |
| Session UI | `js/sessions.js` | `globalSessionTickId`, quiet refresh |
| Navigation | `js/nav.js` | `navigate()` → `renderActivePageContent` only |
| Bridge / polling | `js/bridge-ui.js`, `js/diagnostics-ui.js`, `js/bridge-client.js` | Heartbeat, duplicate intervals |
| Lazy modules | `js/app.js` dynamic `import()` | reports, focus, groups, analytics, QA panel |
| Dev instrumentation | `js/dev-overlay.js` | FPS, timers, listeners, guardrail checks |

## Key functions (`js/app.js`)

- `renderAll(scope)` — `'core'` skips analytics/reports/focus; still runs active-page work
- `scheduleRenderAll()` — rAF coalesce + dashboard throttle (`DASH_RENDER_MIN_MS` 500ms) + scroll pause
- `refreshAfterGameDataChange()` — **preferred** for game-data mutations; increments `__REFRESH_AFTER_GAME_DATA_CHANGE_COUNT`
- `scheduleRefreshAfterGameDataChange()` — rAF coalesce for burst updates (match save + session notify)
- `renderAllInner()` — gates dashboard/log/analytics/reports/focus/group/sessions/profile on `state.activePage`
- Guardrail comment at line ~535: do not call `renderAll()` for match-save

## Dashboard throttles (`js/home.js`)

- `DASH_RENDER_HARD_MS = 500` — hard throttle inside `renderHomePage`
- `refreshAfterMatchSaved(games, goals)` — patch widgets after match save; increments `__MATCH_SAVE_DASH_RENDERS`
- `window.__DASH_RENDER_COUNT` — full dashboard renders; idle 10s should stay ≤ +2

## Boot sequence (`js/boot.js`)

Marks via `markBoot(phase)` → `[boot +Nms] <phase>` and `window.__BOOT_MARKS`:

1. `shell-visible` — loading overlay
2. `first-paint` — double rAF
3. `load-user-data-start` → `data-loaded` — Supabase fetch
4. `hydrate-state` — `setGames` + rank repair
5. `first-render-complete` — initial `ctx.renderAll()`
6. `boot-finished` — `finally`
7. `deferred-maintenance-*` — idle ghost/dedupe (may call `renderAll('core')` if dupes removed)

Desktop bridge probe (`waitForDesktopServices`) runs in background — must not block first paint.

## Common call chains

```
Match save → scheduleRefreshAfterGameDataChange() → rAF → refreshAfterGameDataChange()
           → refreshAfterMatchSaved() (dashboard) | renderMatchLogs() (log page)

Game switch → boot.js onChange → renderAll()          ← audit necessity

tracker-data-changed → scheduleRenderAll('core')      ← scope narrow?

navigate(page) → renderActivePageContent(page) only   ← correct; no full renderAll
```

## Symptom → first checks

| Symptom | Likely cause | First check |
|---------|--------------|-------------|
| Lag after match save | `renderAll('core')` instead of coalesced refresh | `__MATCH_SAVE_DASH_RENDERS` vs `__DASH_RENDER_COUNT` |
| Dashboard idle stutter | Throttle bypass, bridge events, chart redraw | 10s idle: `__DASH_RENDER_COUNT` ≤ +2 |
| Slow startup | Auth + bridge probe + first `renderAll` | `__BOOT_MARKS`, `first-render-complete` |
| Growing memory | Uncleared intervals/listeners | dev overlay timer count; `diagnostics-ui.js` pollId |
| Filter jank | Full `innerHTML` table rebuild | `renderMatchLogs`, analytics filters |
| Duplicate work | Handler registered every render | `quicklog.js` tag chips, modal wiring |

## Known hotspots (forensic audit)

| Location | Issue | Preferred fix |
|----------|-------|---------------|
| `js/quicklog.js` | Click handler per chip on every `rerenderQuickTags()` | Delegate or guard with dataset flag |
| `js/home.js` | Chart full redraw on every `renderHomePage` | Patch via `refreshAfterMatchSaved` |
| `js/matches.js` | Full log table rebuild | Patch rows when feasible |
| `js/reports-ui.js` | Full `innerHTML` + listeners every `renderReportsPage` | Wire once or delegate |
| `js/groups.js` | Handlers re-bound every `renderGroupsPage` | Wire once or delegate |
| `js/diagnostics-ui.js` | `setInterval(refresh, 4000)` | Clear `pollId` before re-arm |
| `js/sessions.js` | `globalSessionTickId` | Clear on sign-out |
| `js/rl-live.js`, `js/valorant-live.js` | Listeners persist after stop | Remove on teardown |

## Lazy-loading patterns (extend, don't regress)

- Dynamic imports: `reports-ui.js`, `focus.js`, `groups.js`, `analytics.js`, `qa-panel.js`
- Images: `loading="lazy"` on rank icons and setup wizard assets
- Auth: dynamic import of sign-in library in `auth.js`

## Invoke examples

| User says | Start here |
|-----------|------------|
| "Match save feels slow" | Trace `submitGameLog` → must hit `scheduleRefreshAfterGameDataChange` |
| "Startup is slow" | `window.__BOOT_MARKS`, bridge log, defer non-critical imports |
| "Dashboard stutters" | `__DASH_RENDER_COUNT` over 10s idle; chart + throttle path |
| "Memory grows" | dev overlay intervals/listeners; sign-out teardown |
| "Page X laggy" | Lazy import for X; render gated on `activePage` |
