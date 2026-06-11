# Performance Forensic Report

**Date:** 2026-06-11  
**Product:** Twans Ultimate Tracker  
**Repo:** `C:\Users\H4unt\rl-grind-tracker`  
**Method:** Read-only static audit + existing instrumentation + limited runtime probes  
**Status:** Fix applied — targeted match-save refresh (see note below). Prior pass was read-only documentation only.

**Fix applied (2026-06-11):** Match save and `tracker-data-changed` now call `scheduleRefreshAfterGameDataChange()` → coalesced `refreshAfterMatchSaved()` instead of `renderAll('core')`. `renderAll` scope flags: `touchLog` and `touchDashboard` are page-gated only (`page === 'log'` / `page === 'dashboard'`), not `scope === 'core'`. Match-save coalesce (same pass): `addGame` uses quiet session refresh; post-match card uses quiet session refresh; `rl-session-ui-refresh` skips dashboard widgets while a coalesced refresh is pending — target **1** `window.__MATCH_SAVE_DASH_RENDERS` per save on dashboard.

**Related:** [PERFORMANCE-OPTIMIZATION-REPORT.md](./PERFORMANCE-OPTIMIZATION-REPORT.md) (prior sprint fixes), [PERFORMANCE-AUDIT.md](./PERFORMANCE-AUDIT.md) (June 7 baseline)

---

## Investigation constraints

Per user directive: **no optimizations, refactors, rewrites, UI removal, or cleanup fixes.** This pass documents behavior and measurement procedures only.

---

## STEP 1 — Instrumentation report template

### Existing marks (verified in source)

| Phase | Mark / probe | Where | How to measure | Run status |
|-------|----------------|-------|----------------|------------|
| Electron tray/window startup | `[startup +Nms] <message>` | `tools/launcher/src/main.cjs:77-81` | Open desktop app; read `config/bridge.log` or dev console | **NOT RUN** (Electron + packaged path not exercised in this pass) |
| Splash paint | `[startup +Nms] splash loaded` | `main.cjs:533-534` | Same log file on cold Electron launch | **NOT RUN** |
| SPA navigation | `[startup +Nms] tracker SPA loaded` | `main.cjs:515-519` | `did-finish-load` on `twans://` URL | **NOT RUN** |
| Backend ready | `[startup +Nms] backend services ready` | `main.cjs:577-578` | After `waitForTrackerReady` | **NOT RUN** |
| DOM bootstrap | `[boot +Nms] dom-ready` | `js/app.js:1225-1226` | DevTools console on page load | **NOT RUN** (auth-gated) |
| Bridge services wired | `[boot +Nms] bridge-services-started` | `js/app.js:1321-1322` | DevTools console | **NOT RUN** |
| Auth probe done | `[boot +Nms] auth-ready` | `js/app.js:1345-1346` | DevTools console | **NOT RUN** |
| Shell visible | `[boot +Nms] shell-visible` | `js/boot.js:133` | After signed-in boot | **NOT RUN** |
| First paint | `[boot +Nms] first-paint` | `js/boot.js:142-143` | Double rAF after loading overlay | **NOT RUN** |
| User data | `[boot +Nms] load-user-data-start` → `data-loaded` | `js/boot.js:149-155` | Supabase `loadUserData()` duration | **NOT RUN** |
| State hydrate | `[boot +Nms] hydrate-state` | `js/boot.js:192` | After `setGames` + rank repair | **NOT RUN** |
| First dashboard render | `[boot +Nms] first-render-complete` | `js/boot.js:232` | After initial `ctx.renderAll()` | **NOT RUN** |
| Boot complete | `[boot +Nms] boot-finished` | `js/boot.js:274` | `finally` block | **NOT RUN** |
| Deferred maintenance | `[boot +Nms] deferred-maintenance-*` | `js/boot.js:98-108` | `requestIdleCallback` ghost/dedupe pass | **NOT RUN** |
| Dashboard render | `[dash +Nms] renderHome` | `js/home.js:1087-1095` | Enable perf mode (below) | **NOT RUN** |
| Render count | `window.__DASH_RENDER_COUNT` | `js/home.js:1068-1069` | Console counter | **NOT RUN** |

### Enabling dashboard perf marks

```js
localStorage.setItem('dash-perf', '1'); location.reload();
// or: window.__DASH_PERF = true before boot (earlier in page life)
```

### Proposed read-only probes (not implemented — zero behavior change)

| Probe | Purpose | Suggested insertion point |
|-------|---------|---------------------------|
| `performance.mark('renderAll-start')` / `measure` | Per-scope `renderAll` wall time | `js/app.js:525-531` |
| `performance.mark('renderHome-deferred')` | Idle-section latency | `js/home.js:1012-1023` |
| `window.__BRIDGE_HEARTBEAT_COUNT` | Idle heartbeat frequency proof | `js/bridge-client.js:255-289` |
| `window.__MATCHLOG_RENDER_COUNT` | Log page churn when on dashboard | `js/app.js:634` |

### Backend startup probe (this pass)

```powershell
cd C:\Users\H4unt\rl-grind-tracker
node scripts/start-grind.mjs --val-only
```

| Observation | Result |
|-------------|--------|
| Syntax check | **PASS** — `node --check` on `js/app.js`, `js/boot.js`, `js/home.js`, `js/charts.js`, `js/bridge-client.js`, `js/supabase.js`, `scripts/start-grind.mjs` |
| Bridge bind | **RUN** — console reports `Stats bridge → http://127.0.0.1:49200` immediately |
| Tracker HTTP | **RUN** — `http://localhost:8080` advertised; browser auto-open attempted |
| Structured `[startup +Nms]` from Electron | **NOT RUN** — CLI path does not use `main.cjs logStartup()` |
| Time-to-bridge-ready (ms) | **NOT CAPTURED** — no timestamped milestone in CLI stdout; prior sprint estimate ~6s backend-only remains |

### Browser MCP / live console timing

| Path | Status |
|------|--------|
| `http://localhost:8080` cold load + `[boot +Nms]` | **NOT RUN** — requires Google/email sign-in; no test credentials in repo |
| `twans://app/index.html` Electron shell | **NOT RUN** — Electron not launched in this pass |
| Idle `__DASH_RENDER_COUNT` 30s soak | **NOT RUN** — auth-gated |
| Post-match log render trace | **NOT RUN** — auth-gated |

**Procedure when unblocked:** Sign in → DevTools Console → filter `[boot` / `[dash` → run idle count script from [PERFORMANCE-OPTIMIZATION-REPORT.md](./PERFORMANCE-OPTIMIZATION-REPORT.md#dev-instrumentation).

---

## STEP 2 — Duplicate work (exhaustive grep)

### `addEventListener` without matching `removeEventListener`

| File | Line(s) | Duplicate risk | Evidence |
|------|---------|----------------|----------|
| `js/rl-live.js` | 58-60 | **Medium** | `tracker-data-changed`, `rl-session-start`, `rl-session-ui-refresh` wired once via `dashEventWired`; **never removed** on `stopRlLive` (only visibility listener removed at 99) |
| `js/valorant-live.js` | 190-192 | **Medium** | Same pattern as RL; `tracker-data-changed` listeners persist after `stopValorantLive` |
| `js/app.js` | 1309-1317 | **Low** | `tracker-data-changed` → `scheduleRenderAll`; guarded `trackerDataListenerWired` |
| `js/quicklog.js` | 446-447, 485 | **High** | `renderQuickTags()` adds click handler per chip **on every** `rerenderQuickTags()` / `renderAll` |
| `js/home.js` | 110-119 | **Medium** | `wireQuickActions` binds per-button listeners each time quick-actions `innerHTML` rebuilt |
| `js/reports-ui.js` | 24-112 | **High** | Full page `innerHTML` + new listeners every `renderReportsPage` |
| `js/groups.js` | 327-457 | **High** | List/detail handlers re-bound every `renderGroupsPage` |
| `js/ui.js` | 325-329 | **Medium** | Filter bar inputs rebound when filter bar re-rendered |
| `js/nav.js` | 146-183 | **Low** | Wired once at init; `renderMainNav` replaces `innerHTML` (old buttons GC'd) |
| `js/bridge-client.js` | 311-317 | **Low** | `visibilityWired` guard; single listener |
| `js/diagnostics-ui.js` | 185-197 | **Low** | Visibility handler; interval cleared when hidden |
| `js/post-match.js` | 154-175 | **Low** | Wired once at init |
| `js/setup-wizard.js` | 728-741 | **Low** | Dropdown uses `{ once: true }` for outside click |

### `setInterval` / `setTimeout`

| File | Line(s) | Purpose | Cleanup | Duplicate risk |
|------|---------|---------|---------|----------------|
| `js/bridge-client.js` | 302-305 | Heartbeat chain | `clearTimeout` on reschedule / `stopBridgeHeartbeat` | **Low** — single timer |
| `js/sessions.js` | 96 | Session clock 1 Hz | `stopGlobalSessionTick` on end/sign-out | **Low** — patches DOM text only |
| `js/app.js` | 364, 418, 475, 613 | Dash scroll defer, chart throttle, render throttle | Cleared on next fire | **Medium** — stacked timers if bursts |
| `js/home.js` | 1053-1056 | `DASH_RENDER_HARD_MS` queue | Cleared on flush | **Medium** — parallel with `app.js` 500ms throttle |
| `js/rl-live.js` | 45-48 | Bridge poll | `stopPolling` / hidden pause | **Low** when idle dashboard |
| `js/valorant-live.js` | 177-180 | Val poll | `stopValorantLive` | **Low** when idle dashboard |
| `js/diagnostics-ui.js` | 183, 195 | Profile diagnostics 4s | `stopDiagnosticsPanel` | **Low** — profile page only |
| `tools/launcher/src/main.cjs` | 772 | Tray status 3s | App quit | N/A (main process) |
| `integrations/overwolf/background.js` | 87 | Overwolf ping | Extension lifecycle | Out of SPA scope |

### `scheduleRenderAll` / `renderAll` / `renderHome` call sites

| File | Line | Trigger | Scope / notes |
|------|------|---------|---------------|
| `js/app.js` | 525-627 | Central scheduler | rAF coalesce + 500ms dash throttle |
| `js/app.js` | 540 | `renderAllInner` | `touchDashboard` → `renderHomePage()` |
| `js/app.js` | 1007 | `submitGameLog` | `renderAll('core')` after match save |
| `js/app.js` | 1317 | `tracker-data-changed` | `scheduleRenderAll('core')` |
| `js/boot.js` | 106, 227, 231, 241 | Boot / maintenance | `'core'` or full |
| `js/home.js` | 1048 | `renderHome` | Hard 500ms cap + deferred sections |
| `js/setup-wizard.js` | 551, 563 | Setup mutations | Dispatches `tracker-data-changed` |
| `js/qa/qa-panel.js` | 64, 110, 138 | QA tools | `renderAll('full')` |

### Supabase `loadSettings` / `loadMatches` (via `loadGames`)

| Function | File:line | When called | Repeats on idle dashboard? |
|----------|-----------|-------------|----------------------------|
| `loadUserData` | `supabase.js:619-639` | Once per `bootApp()` | **No** (unless re-boot) |
| `loadSettings` | `supabase.js:309-361` | Inside `loadUserData` only | **No** on idle |
| `loadGames` | `supabase.js:196-214` | Inside `loadUserData` only | **No** on idle |
| `saveGames` | `supabase.js:240+` | On log/edit/delete | **No** while idle |
| `loadGroupMembers` | `supabase.js:582+` | Groups page member select | **No** on dashboard |
| `loadMemberGames` | `supabase.js:596+` | Squad coach view | **No** on dashboard |

**Finding:** Idle dashboard does **not** re-fetch Supabase match/settings data. Network churn is bridge/local, not Postgres.

### Chart destroy / create

| File | Line | Behavior |
|------|------|----------|
| `js/charts.js` | 15-19 | `destroyChart(id)` |
| `js/charts.js` | 57-62, 96-101 | Signature skip or in-place `update('none')` |
| `js/app.js` | 453 | `destroyAllCharts()` when no chart games |
| `js/app.js` | 402-457 | `renderHomeCharts` gated by `perfSectionVisible`, idle sig, 1s min interval |

**Duplicate risk:** **Low** after optimization — rebuild only on sig change. First scroll into `#dash-performance` can still create both charts (`mmrChart` + `wlChart`).

### Bridge heartbeat triggers

| File | Line | Interval (visible, idle dashboard) | Evidence |
|------|------|-----------------------------------|----------|
| `js/bridge-client.js` | 7-11, 292-297 | **6000ms** (`HEARTBEAT_DASH_IDLE_MS`) | `getHeartbeatMs()` + `isDashboardIdle()` |
| `js/bridge-client.js` | 255-289 | `heartbeatTick` → `fetch` `/status` | Every scheduled tick |
| `js/bridge-client.js` | 311-316 | Visibility resume | Extra tick when tab visible |
| `js/rl-live.js` | 27-30, 39-48 | **No periodic poll** when `isDashboardIdle()` | `shouldPeriodicPoll` false |
| `js/valorant-live.js` | 159-163, 171-180 | **No periodic poll** when idle dashboard | Same pattern |

---

## STEP 3 — Memory leaks (static + soak procedure)

### Static findings

| Source | Leak class | Severity | Notes |
|--------|------------|----------|-------|
| `rl-live.js` / `valorant-live.js` dash listeners | Permanent `document` listeners | Medium | Survive `stop*Live`; fire on every `tracker-data-changed` / session event |
| `quicklog.js` `renderQuickTags` | Accumulating chip listeners | Medium | Old chips removed from DOM → likely GC'd; risk if dock hidden not removed |
| `charts.js` `charts{}` map | Chart instance retention | Low | Destroyed on sig mismatch / `destroyAllCharts` |
| `bridge-client.js` listener `Set`s | Subscriber growth | Low | No unsubscribe on sign-out for `subscribeBridgeOnline` callbacks from diagnostics |
| `sessions.js` `globalSessionTickId` | Interval | Low | Cleared via `clearSessionTimer` / `stopGlobalSessionTick` |
| `groups.js` `ui.membersCache` / `gamesCache` | Unbounded cache | Low | Per-group; scales with squad count |

### Manual soak procedure (not run in this pass)

1. Sign in → dashboard → note `performance.memory.usedJSHeapSize` (Chrome/Electron).
2. **5 min:** Idle on dashboard; record `__DASH_RENDER_COUNT` delta (expect 0–2).
3. **15 min:** Switch RL ↔ Val once; return dashboard idle.
4. **30 min:** Open/close profile (diagnostics interval), return dashboard.
5. **60 min:** Repeat; heap growth &gt; ~30% without corresponding data growth → investigate listeners/timers.
6. **8 hr:** Not run — document only. Compare morning vs evening heap; watch `config/bridge.log` size.

**This pass:** No 1hr soak executed (auth + time). Methodology documented for manual QA.

---

## STEP 4 — Dashboard component profile

| Section | DOM anchor | Render function | Runs every `renderAll`? | Est. cost |
|---------|------------|-----------------|-------------------------|-----------|
| Hero overview | `#dash-hero` | `renderDashHero` | Yes (via `renderHome`) | **High** — rank badges, stats; patch path reduces cost |
| Quick actions | `#dash-quick-actions` | `renderDashQuickActions` | Yes | **Medium** — full rebuild when session visibility changes |
| Rank progress | `#dash-rank-progress` | `renderDashRankProgress` | Yes | **Medium** — bar + meta; patch path |
| Session panel | `#dash-session-panel` | `renderDashSessionPanel` | Yes | **Medium** — via `renderHomeContext` |
| Home focus | `#home-focus` | `renderHomeFocus` | **Deferred** (`scheduleHomeDeferred`) | **Medium** — insights correlation; 30s throttle when idle |
| Perf stats | `#dash-perf-stats` | `renderDashPerfStats` | Deferred | **Medium** — stat grid HTML or patch |
| Perf charts | `#homeMMR`, `#homeWL`, `#valHomeRR`, `#valHomeWL` | `renderHomeCharts` | Deferred + IO gate | **Very high** — Chart.js layout |
| Activity feed | `#home-activity`, `#val-match-feed` | `renderHomeActivity` | Deferred | **Medium** — list `innerHTML` |
| Legacy sinks | `#home-summary`, `#home-context`, `#val-dashboard` | `renderHomeSummary` | Yes | **Trivial** — clears only |

### `renderAll('core')` on dashboard — always runs

From `js/app.js:534-550`:

- `renderHomePage()` → `renderHome()` (critical path every time)
- `renderMatchLogs()` — **even when `page !== 'log'`** because `touchLog = scope === 'core'`
- `refreshSessionUI({ quiet: true })`
- `wireLogTableActions()` when `touchLog`
- `rerenderQuickTags()` → full tag chip rebuild
- `renderActivePageContent(page)` + `updateNavUI` + `mountDock`

---

## STEP 5 — Full rerender detection (logging one match)

### Code path (actual behavior)

```
submitGameLog('form'|'quick'|'auto')
  → addGame()                          [matches.js:44-61]
      → persistActiveGames → saveGames (Supabase POST)
      → notifySessionUIRefresh()       [matches.js:13-14]
          → refreshSessionUI()           [sessions.js:638-640]
              → dispatch 'rl-session-ui-refresh'  (NOT quiet)
  → dashRenderBypass = true
  → renderAll('core')                  [app.js:1006-1007]
```

**`tracker-data-changed` is NOT dispatched by `addGame`.** Only `setup-wizard.js` and QA dev shortcut fire it.

### Parallel listeners on `rl-session-ui-refresh`

| Listener | Action |
|----------|--------|
| `app.js:1309-1314` | If dashboard: `refreshDashSessionWidgets` only (session + quick actions) |
| `rl-live.js:54-57` | `pollBridge({ forceUi: true })` + resume poll schedule |
| `valorant-live.js:186-189` | `poll({ forceUi: true })` + resume poll schedule |
| `quicklog.js:485` | `updateCollapsedStripLabel` |

### `renderAll('core')` scope effects (on dashboard page)

| Subsystem | Re-renders? |
|-----------|-------------|
| Dashboard hero/stats/session | **Yes** — full `renderHome` (may defer focus/activity/charts) |
| Match log table + filters | **Yes** — `renderMatchLogs()` despite hidden `#page-log` |
| Analytics / reports / focus pages | **No** — early return at `app.js:543-550` |
| Charts | **Maybe** — `requestIdleCallback` + `perfSectionVisible` + idle sig |
| Bridge polls | **Yes** — one-shot from `rl-session-ui-refresh` |

### Throttle interaction on match log

Even with `dashRenderBypass = true`, `renderHome` has its own `DASH_RENDER_HARD_MS = 500` queue (`home.js:1049-1058`) independent of `app.js` bypass.

---

## STEP 6 — Network audit

### Fetch / Supabase / bridge call sites (SPA)

| Call site | File:line | Idle dashboard? | Notes |
|-----------|-----------|-----------------|-------|
| Bridge heartbeat `/status` | `bridge-client.js:216` | **Yes ~every 6s** | Primary idle network source |
| RL `/last-match` | `rl-live.js:136` | No (poll off idle) | Event-driven refresh only |
| RL `/setup/status` | `rl-live.js:185` | On demand | Setup wizard |
| Val `/valorant/status` | `valorant-live.js:103` | No (poll off idle) | Event-driven |
| Val `/valorant/last-match` | `valorant-live.js:116` | When polling active | |
| Val `POST /valorant/arm` | `valorant-live.js:56` | On Val init / session | |
| `bridgeFetch` mutations | `bridge-client.js:243-252` | On user action | Token from status |
| Supabase REST `sbFetch` | `supabase.js:59-72` | **No** while idle | Boot + saves only |
| Avatar storage upload | `supabase.js:461+` | Profile save only | |
| Chart.js CDN | `index.html:13` | Once at load | External |

### Electron main process

| Call | File:line | Interval |
|------|-----------|----------|
| `pollStatus` → `:49200/status` + `:8080/api/bridge/status` | `main.cjs:585-589` | 3000ms (`statusTimer`) |

---

## STEP 7 — Logo audit

### Asset inventory

| Asset | Path | Role | Quality notes |
|-------|------|------|---------------|
| **Canonical brand** | `integrations/overwolf/icon.png` | Source for ICO generation (`tools/launcher/scripts/generate-icon.mjs:14`) | Teal rounded square + black star; adequate for 256px; slight edge aliasing at low DPI |
| Desktop ICO/PNG | `tools/launcher/assets/icon.ico`, `icon.png` | Electron window + tray (copied from Overwolf source) | Same artwork as canonical |
| Navbar mark | `index.html:78-79` | Inline SVG star (`viewBox="0 0 24 24"`) | **Vector — crisp at all DPI**; uses `currentColor` (theme-aware) |
| Web PWA icon | `public/icon.svg` | Next.js/Vercel-style **letter logo**, not Twans star | **Wrong brand asset** for tracker identity |
| Favicon variants | `public/icon-light-32x32.png`, `icon-dark-32x32.png` | Small raster favicons | Not audited at pixel level; likely generic |
| Placeholders | `public/placeholder-logo.png`, `placeholder.svg` | Template residue | Should not ship as user-facing brand |
| Rank/avatar | `public/rank-emblem.png`, `avatar-gamer.png` | In-app illustrations | Separate from app icon |

### Screenshot vs source problem

User-reported blurry tray/window icon matches **raster scaling** of `integrations/overwolf/icon.png` rather than navbar SVG. Electron `createTrayIcon` in `main.cjs:370-408` procedurally redraws a star at small sizes — tray may differ from PNG source.

### Recommendations (audit only — no replacements this pass)

1. **Single source of truth:** Export master SVG (star-in-teal) from design tool → generate PNG @16/32/48/256 and ICO via existing `generate-icon.mjs`.
2. **Replace `public/icon.svg`** with Twans star mark or remove from Electron build path to avoid confusion.
3. **Navbar:** Keep inline SVG (`index.html:78-79`) as reference geometry for generated raster assets.
4. **High-DPI:** Provide `@2x` PNG for 32px tray slot; verify `nativeImage` path in `main.cjs`.

---

## STEP 8 — Lost UI (git diff analysis)

**Comparison baseline:** `843783b` (pre-optimization spree) → `HEAD` (`4882d5a`), plus sprint commits `d90f943`, `6aab631`, `7329c85`, `05f3063`.

### `index.html` — DOM structure

**No dashboard sections removed.** `#dash-hero`, `#dash-quick-actions`, `#dash-rank-progress`, `#dash-session-panel`, `#home-focus`, `#dash-performance`, `#dash-activity`, chart canvases — all present in both revisions.

| Change type | Detail |
|-------------|--------|
| Copy/branding | Bridge hint bat names → "Twans Ultimate Tracker" |
| Added | `#onboarding-modal`, `#session-play-btn`, `friendlyBootMessage()` |
| Dock label | `live-bridge-status` default "Starting…" vs "Auto-log off" |

### `js/home.js` — behavioral / visibility (not DOM removal)

| Change | User-visible effect | Commit era |
|--------|---------------------|------------|
| `shouldHideManualSessionControls()` hides session quick-action on desktop | "Start Session" button absent when auto-session enabled | `env.js:52-59` + `home.js:505-531` |
| `scheduleHomeDeferred` + `requestIdleCallback` | Focus, perf stats, activity appear **after** critical path | `7329c85`+ |
| `renderHomeFocus` 30s idle throttle | Focus card stale up to 30s on idle dashboard | `PERFORMANCE-OPTIMIZATION-REPORT` pass 2 |
| `content-visibility: auto` on below-fold sections | Sections may not paint until scroll/near-viewport | `css/dashboard-v0.css:303-305` |
| `renderHomeCharts` requires `perfSectionVisible` | Charts empty until `#dash-performance` intersects | `app.js:375-409` |
| Hero/quick-actions **patch paths** | Reduced rebuilds; patch failure falls back to full `innerHTML` | `05f3063` |

### `js/profile-ui.js`

| Change | Effect |
|--------|--------|
| Hero layout restructure (`profile-card-hero`) | Visual redesign — not removal |
| `mountProfileDiagnosticsSlot()` added | New diagnostics block |
| Banner gradient `color-mix` | Darker banner — aesthetic |

### Legacy sinks (intentionally empty)

`#home-summary`, `#home-context`, `#val-dashboard` remain `sr-only` — content moved to v0 dashboard sections in earlier migration; **not a regression from optimization spree**.

### Likely "lost UI" reports mapped to code

| User report | Root in code |
|-------------|--------------|
| "Session button gone" | `shouldHideManualSessionControls()` + desktop auto-session |
| "Focus empty briefly" | Deferred `renderHomeFocus` + idle throttle |
| "Charts missing" | Off-screen `content-visibility` + `perfSectionVisible` false until scroll |
| "Performance section blank" | Idle chart skip (`isDashboardIdle`) until data sig changes |

---

## STEP 9 — Review & Squad init paths

### `js/focus.js`

| Item | Detail |
|------|--------|
| Entry | `renderFocusPage` exported; lazy-loaded via `getFocusModule()` in `app.js:734-737` |
| Init | No `wire*` — pure render into `#focus-content` |
| Cost | `calcStats`, `buildWeeklyReport`, `getPerformanceInsights`, `getTagLossCorrelations` on every focus nav |
| Risk | **Medium CPU** on focus page open; not on dashboard idle path |

### `js/groups.js`

| Item | Detail |
|------|--------|
| Entry | `renderGroupsPage(ctx)` from `app.js:740-742` |
| Network | `loadGroupMembers` on group select (`groups.js:351`); `loadMemberGames` for coach view |
| Listeners | Re-bound every render — duplicate risk if rapid re-renders |
| Init | No eager init; errors caught in `app.js:849-857` with toast |
| Risk | **Supabase RPC** latency on first squad open; unrelated to dashboard lag |

### Nav routes (`js/nav.js`)

| Route | `renderAll` on nav? |
|-------|---------------------|
| `navigate(pageId)` | `renderActivePageContent` only — **no full renderAll** |
| Dashboard | `renderHomePage({ userAction: true })` at `app.js:872` |
| Review sub-nav | Pills → `onNavigate` |

**Risk:** Low for nav-only switches; dashboard return forces full home refresh (by design).

---

## STEP 10 — Startup UX audit

### `tools/launcher/src/main.cjs`

| Stage | Behavior | Blank-window risk |
|-------|----------|-------------------|
| Window create | `show: true`, `backgroundColor: '#0a0a0f'` | Low — dark chrome immediate |
| First paint | `loadURL(getSplashDataUrl())` data-URL splash | **Low** — branded splash before SPA |
| SPA load | `twans://app/index.html` after `waitForTrackerReady` (async, non-blocking) | **Medium** — SPA may load before `:8080` ready; bridge retries client-side |
| Load failure | 3 retries @ 400ms × n (`APP_LOAD_RETRY_MS`) | Fallback dialog after exhaustion |
| HW accel | `app.disableHardwareAcceleration()` line 75 | May affect paint perf on some GPUs |

### `js/boot.js`

| Stage | UX |
|-------|-----|
| `showLoading(false)` before data | Shell + dock visible quickly (`shell-visible` → `first-paint`) |
| `waitForDesktopServices` | **Non-blocking** background probe (max 4s); does not block `loadUserData` |
| Error path | Toast + login screen; `boot-finished` still marked |

### `index.html` boot guard

30s timeout (`index.html:571-577`) shows `boot-failure-note` if `window.__appReady` never set — prevents infinite spinner.

---

## STEP 11 — Targets vs current estimated state

| Target | Sprint goal | Current estimate (forensic) | Confidence | Gap driver |
|--------|-------------|-------------------------------|------------|------------|
| Cold startup desktop | 1.5–2.5s | **2–3.5s** | Low (not measured live) | Supabase `loadUserData` + rank repair still on critical path (`boot.js:149-191`) |
| Warm startup | 0.7–1.2s | **1–1.8s** | Low | Auth cache helps; bridge probe + first `renderAll` remain |
| Render after match | 25–60ms | **80–200ms** | Medium (static) | `renderAll('core')` still runs hidden match logs + `renderHome` + tag rebuild |
| Idle dashboard CPU | Near zero polls | **~0.17 bridge fetches/s** (6s heartbeat) | Medium | `HEARTBEAT_DASH_IDLE_MS`; RL/Val polls correctly stopped |
| `__DASH_RENDER_COUNT` / 10s idle | ≤ +2 | **Unknown** | Not run | Throttles exist but `renderAll('core')` on unrelated events may still increment |
| 8hr memory stable | Stable | **Likely OK** | Low | Session tick + heartbeat bounded; listener accumulation minor |
| 60fps UI | Smooth | **Chart-bound** | Medium | Chart.js on scroll-into-view still jank risk |
| Lost UI parity | Full dashboard | **Perceived gaps** | High | Deferral + `content-visibility` + hidden session controls |

---

## STEP 12 — Final report (10 required bullets)

1. **Instrumentation exists and is sufficient for boot/dashboard diagnosis** — `[boot +Nms]`, `[startup +Nms]`, `window.__DASH_RENDER_COUNT`, and `localStorage dash-perf` are wired; live capture was **blocked by auth** in this pass.

2. **Idle dashboard Supabase traffic is not the problem** — `loadSettings`/`loadGames` run only inside `loadUserData` at boot; no repeating Postgres reads while idle.

3. **`renderAll('core')` over-renders hidden match logs on every match save** — `touchLog = scope === 'core'` forces `renderMatchLogs()` even on dashboard (`app.js:537-541`).

4. **Match log does not use `tracker-data-changed`; it uses direct `renderAll` + `rl-session-ui-refresh`** — duplicate bridge polls and split refresh paths (`matches.js:53`, `app.js:1007`, `sessions.js:640`).

5. **Three independent 500ms throttle layers stack** — `app.js` `DASH_RENDER_MIN_MS`, `home.js` `DASH_RENDER_HARD_MS`, and `scheduleRenderAll` rAF coalescing can defer or partial-render (`criticalOnly`) dashboard sections.

6. **Deferred dashboard sections explain "missing" focus/activity/charts** — `scheduleHomeDeferred` + 30s focus throttle + `IntersectionObserver` chart gate (`home.js:1012-1032`, `app.js:375-409`).

7. **Bridge heartbeat remains the primary idle network/CPU source** — ~6s `/status` ping on idle dashboard (`bridge-client.js:11`, `296-297`); game pollers correctly paused.

8. **Logo inconsistency: canonical star PNG vs wrong `public/icon.svg` (Vercel mark)** — navbar SVG is correct; tray/window rasters should be regenerated from `integrations/overwolf/icon.png` or new master SVG.

9. **Git diff shows no dashboard DOM removals since `843783b`** — "lost UI" aligns with **conditional hide** (`shouldHideManualSessionControls`), **CSS `content-visibility`**, and **deferred render**, not deleted HTML.

10. **Optimization sprint changes are in production code but live verification was not completed** — `node --check` passes; browser/Electron timing **NOT RUN**; recommend signed-in soak before further optimization.

---

## Executive summary — top 3 root causes (evidence)

### 1. `renderAll('core')` rebuilds match logs while user is on dashboard

**Evidence:** `js/app.js:537-541` — `touchLog = scope === 'core' || page === 'log'` causes `renderMatchLogs()` on every match log, filter bar rebuild, and log table virtualization work while `#page-log` is hidden.

**Impact:** Dominant unnecessary DOM/CPU on the hottest user action (logging a match).

---

### 2. Stacked render throttles and deferred sections produce partial or late dashboard paint

**Evidence:**

- `js/app.js:83-84, 466-511, 598-627` — `DASH_RENDER_MIN_MS`, scroll pause, rAF batching
- `js/home.js:29-32, 1048-1092` — `DASH_RENDER_HARD_MS` queue independent of `dashRenderBypass`
- `js/home.js:1012-1032` — focus/activity/stats deferred to `requestIdleCallback`
- `css/dashboard-v0.css:303-305` — `content-visibility: auto` on `#dash-performance`, `#dash-activity`, etc.

**Impact:** Users perceive "missing" or "laggy" dashboard sections after optimizations; charts/focus may appear seconds late or only after scroll.

---

### 3. Bridge heartbeat continues on idle dashboard (~6s interval)

**Evidence:** `js/bridge-client.js:11` (`HEARTBEAT_DASH_IDLE_MS = 6000`), `292-305` (`scheduleHeartbeat` → `heartbeatTick` → `fetch /status`).

**Impact:** Steady background network + status UI update path; pairs with `rl-session-ui-refresh` one-shot polls (`rl-live.js:54-57`, `valorant-live.js:186-189`) on every match for multiplicative bridge traffic.

---

## Files referenced (no modifications)

| File | Role |
|------|------|
| `docs/PERFORMANCE-FORENSIC-REPORT.md` | This document |
| `docs/PERFORMANCE-OPTIMIZATION-REPORT.md` | Updated with pause pointer |

**Code changes this pass:** None (correct per directive).
