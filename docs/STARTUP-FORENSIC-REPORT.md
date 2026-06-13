# Startup Forensic Report

**Date:** 2026-06-12  
**Product:** Twans Ultimate Tracker  
**Method:** Static boot-path trace + instrumentation pass + targeted fixes with measurable intent  
**Runtime:** Electron EXE and signed-in browser **NOT RUN** in this pass (no test credentials; packaged EXE not launched). Timings below are **code-order + prior audit estimates** unless marked measured.

**Related:** [PERFORMANCE-FORENSIC-REPORT.md](./PERFORMANCE-FORENSIC-REPORT.md), [COMMERCIAL-POLISH-PASS.md](./COMMERCIAL-POLISH-PASS.md)

---

## Step 1 — Instrumentation (added this pass)

### SPA boot marks (`window.__BOOT_MARKS` / `[boot +Nms]`)

| Phase | Where | Purpose |
|-------|-------|---------|
| `dom-content-loaded` | `index.html:15-22` | HTML parsed, DOM ready |
| `inline-shell-visible` | `index.html:98-100` | Cached profile shell before `app.js` |
| `dom-ready` | `js/app.js:1304` | `init()` entered |
| `shell-visible` / `shell-painted` | `js/boot.js:84-101, 198-216` | Signed-in shell from cache |
| `first-paint` / `interactive` | `js/boot.js:105-106, 219-220` | Double rAF after overlay off |
| `supabase-init-begin` / `supabase-init-complete` | `js/auth.js:49-62` | CDN/module + client create |
| `auth-restore-begin` / `auth-restore-complete` | `js/auth.js:158-196` | Session restore |
| `auth-ready` | `js/app.js:1429` | `initAuth()` finished |
| `bridge-start-begin` / `bridge-ready` | `js/app.js:177`, `js/bridge-client.js:371-374` | Heartbeat probe (non-blocking) |
| `bridge-services-started` | `js/app.js:1411` | RL/Val live wired |
| `load-user-data-start` / `data-loaded` | `js/boot.js:228-234` | Supabase sync window |
| `profile-loaded` / `match-data-loaded` / `settings-loaded` | `js/supabase.js:633-644` | Parallel fetch milestones |
| `hydrate-state` | `js/boot.js:273` | Games + rank repair in memory |
| `dashboard-rendered` / `first-render-complete` | `js/boot.js:317-318` | First `renderAll()` |
| `boot-finished` | `js/boot.js:376` | Boot `finally` |
| `lazy-*-init` | `js/app.js:107-133` | Review/Squad/Analytics/Focus — **must not appear at warm boot** |
| `charts-init` | `js/charts.js:57-64` | First Chart.js draw — **deferred off critical path** |

Shared helper: `js/boot-marks.js` — `markBoot(phase)`.

### Electron `[startup +Nms]` (`config/bridge.log`)

| Phase | Where |
|-------|-------|
| `exe-process-start` | `tools/launcher/src/main.cjs:51` (dev console; t=0) |
| `electron-main-ready` | `main.cjs:709` |
| `protocol registered` | `main.cjs:751` |
| `browser-window-create-begin` / `browser-window-created` | `main.cjs:488-506` |
| `splash loaded` / `window-visible` | `main.cjs:532-533` |
| `bridge-start-begin` / `bridge process spawned` | `main.cjs:663, 764` |
| `loading twans:// immediately` | `main.cjs:767` |
| `tracker SPA loaded` | `main.cjs:516` (`did-finish-load` on `twans://`) |
| `backend services ready` | `main.cjs:577` (background poll; does **not** block SPA load) |

### Dev overlay (`?dev=1`)

Boot timeline lists all `__BOOT_MARKS` in order; summary rows for first-paint, interactive, auth-ready, data-loaded, dashboard-rendered.

---

## Step 2–4 — Critical path & blocking awaits

### Boot sequence (warm signed-in, profile cache present)

```
EXE process start
  → Electron splash (data URL)                    [startup window-visible]
  → twans:// index.html
  → inline-shell-visible (0ms, profile cache)       [index.html]
  → dom-content-loaded
  → app.js module parse (static import graph)       [heavy sync — not awaited but blocks dom-ready]
  → dom-ready → warmSupabaseClient() (void)         [parallel CDN fetch]
  → paintCachedShellEarly → interactive             [2× rAF]
  → wireInteractiveApp (deferred 2× rAF)
  → initAuth() awaited                              [blocks bootApp]
      → loadSupabaseModule (CDN)                    [auth.js:26-40]
      → getSession                                  [auth.js:164]
  → auth-ready → bootApp()
  → load-user-data-start
  → Promise.all(loadProfile, loadGames, loadSettings, loadUserGroups)  [supabase.js:646-648]
  → repair-chains (sync CPU)                        [boot.js:249-271]
  → renderAll → dashboard-rendered
  → boot-finished
  → deferred-maintenance (requestIdleCallback)
```

### Every `await` / `fetch` / `Promise.all` on critical path

| Location | Call | Blocks UI before paint? | Verdict |
|----------|------|-------------------------|---------|
| `index.html:13-110` | sync localStorage paint | No — runs before module | **Required** (cache) |
| `js/app.js:1304` | `warmSupabaseClient()` | No — void, parallel | **Defer** (overlap) |
| `js/app.js:1428` | `await initAuth()` | No paint; blocks hydration | **Required** before `loadUserData` |
| `js/auth.js:30` | `await importWithTimeout(CDN)` | Inside initAuth | **Required** but slow — overlap via warm |
| `js/auth.js:164` | `await client.auth.getSession()` | Inside initAuth | **Required** |
| `js/boot.js:218` | `await waitForFirstPaint()` | Only cold path (no early shell) | **Required** for cold |
| `js/boot.js:229-233` | `await loadUserData()` | After interactive | **Defer** after paint ✓ |
| `js/supabase.js:178` | `await sbFetch(profiles)` | Inside loadUserData | **Defer** — now parallel |
| `js/supabase.js:207-215` | `await sbFetch(matches)` | Inside loadUserData | **Defer** — now parallel |
| `js/supabase.js:334` | `await sbFetch(user_settings)` | Inside loadUserData | **Defer** — now parallel |
| `js/supabase.js:522` | `await sbFetch(group_members)` | Inside loadUserData | **Defer** — now parallel |
| `js/boot.js:225` | `void waitForDesktopServices()` | No | **Defer** ✓ |
| `js/boot.js:157-161` | ghost/dedupe awaits | Idle only | **Lazy** ✓ |
| `js/app.js:107-132` | lazy `import()` review/squad | Nav only | **Lazy** ✓ |
| `tools/launcher/main.cjs:549` | `await loadURL(twans://)` | Electron only; splash first | **Required** |
| `tools/launcher/main.cjs:566-576` | `waitForTrackerReady` | Background void | **Defer** ✓ |

### Static import graph at boot (sync parse cost)

`js/app.js` top-level imports include `charts.js`, `home.js`, `rl-live.js`, `valorant-live.js`, `quicklog.js`, `sessions.js`, etc. — **not lazy**. This adds main-thread parse/compile before `dom-ready` but does not await network.

---

## Step 5 — Cache audit

| Data | Cached? | Source | Gap |
|------|---------|--------|-----|
| Profile name/avatar/colors | **Yes** | `profile-cache.js` + `index.html` inline | — |
| Active game pref | **Yes** | profile cache `activeGame` | — |
| Dashboard hero/focus stats | **No** | Requires `loadGames()` | Skeleton only until `data-loaded` |
| Activity feed | **No** | Built from games | Deferred section after hydrate |
| Rank badges/MMR | **Partial** | `rank-preload.js` icons only | Numbers from network |
| Settings/goals | **No** | `loadSettings()` | Defaults until sync |
| Match list | **No** | `loadGames()` | Expected |

---

## Step 6 — Lazy load verification

| Module | Load trigger | Boot eager? |
|--------|--------------|-------------|
| Review (`reports-ui.js`) | `getReportsModule()` on nav | **No** — mark `lazy-reports-init` only on nav |
| Squad (`groups.js`) | `getGroupsModule()` on nav | **No** |
| Analytics (`analytics.js`) | `getAnalyticsModule()` on nav | **No** |
| Focus (`focus.js`) | `getFocusModule()` on nav | **No** |
| Charts (`charts.js`) | Static import in `app.js`; **create** via idle `renderHomeCharts` | Module parsed at boot; **Chart.js CDN + draw deferred** — `charts-init` should appear after scroll/idle, not before `interactive` |
| QA panel | dynamic `import('./qa/qa-panel.js')` after boot | **No** |

**Finding:** Review/Squad/Analytics correctly lazy. `charts.js` module is eagerly imported (parse cost) but chart **initialization** is gated by `renderHomeCharts` + `IntersectionObserver` — acceptable if `charts-init` mark absent before `boot-finished`.

---

## Step 7 — Bridge timing

| Layer | Behavior | Blocks paint? |
|-------|----------|---------------|
| Electron `startBridge()` | Spawn `start-grind.mjs` at app ready | **No** — parallel with splash/SPA |
| `openTrackerOnStart()` | Loads `twans://` without waiting for `:8080` | **No** |
| `waitForTrackerReady` | Background loop after SPA load | **No** |
| SPA `ensureBridgeServices()` | Starts heartbeat; deferred rAF when cached shell | **No** |
| `waitForDesktopServices()` | 4s cap probe in `boot.js` | **No** — void |

UI must not await bridge before paint — **verified** in current code.

---

## Step 8 — Timeline table (estimated warm boot)

| Milestone | Target | Estimated | Confidence | Source |
|-----------|--------|-----------|------------|--------|
| `exe-process-start` | — | 0ms | High | `main.cjs` t0 |
| `window-visible` (splash) | <150ms | 80–200ms | Low | Electron not run |
| `inline-shell-visible` | 0ms | 0ms | High | Sync inline script |
| `dom-content-loaded` | — | 50–150ms | Medium | HTML size + CSS |
| `dom-ready` | — | 200–800ms | Medium | `app.js` import graph |
| `interactive` | <500ms | 250–900ms | Medium | Cache path + rAF |
| `supabase-init-complete` | — | 500–3000ms | Medium | CDN `@supabase/supabase-js` |
| `auth-ready` | — | 550–3200ms | Medium | Module + getSession |
| `load-user-data-start` | after interactive | ✓ order correct | High | Code order |
| `data-loaded` | — | 800–4500ms | Medium | Network RTT × parallel max |
| `dashboard-rendered` | <2s hydrated | 900–5000ms | Medium | + repair + renderAll |
| `boot-finished` | <1.5s warm target | 950–5200ms | Low | Often misses 1.5s on cold CDN |
| `lazy-*-init` at boot | absent | absent (expected) | High | Static analysis |
| `backend services ready` | after SPA | +2–8s | Low | Node spawn + HTTP |

**Live capture procedure:** Launch EXE or `?dev=1` → Console filter `[boot` + overlay timeline → copy `window.__BOOT_MARKS`.

---

## Top 3 bottlenecks (evidence-ranked)

### 1. Supabase JS module load from CDN (auth gate)

**Evidence:** `js/auth.js:6-40` — `loadSupabaseModule()` tries jsdelivr/esm.sh with 10s timeout before any session read. `initAuth()` is awaited at `js/app.js:1428` before `bootApp()`. Warm path now overlaps via `warmSupabaseClient()` at `js/app.js:1305-1307` but CDN latency still dominates `auth-ready`.

**Impact:** Delays `load-user-data-start` by hundreds of ms to several seconds on slow/offline CDN.

---

### 2. Supabase `loadUserData` network fan-out (was sequential)

**Evidence (before fix):** `js/supabase.js:632-636` (prior) — `loadProfile` → `loadGames` → `loadSettings` → `loadUserGroups` serially; each `sbFetch` at `js/supabase.js:79`.

**Impact:** Total wait ≈ sum of 4 RTTs (often 1–3s+). **Fix applied:** `Promise.all` with per-resource marks — wait ≈ max RTT.

---

### 3. Synchronous rank-chain repair + first full `renderAll()` before `boot-finished`

**Evidence:** `js/boot.js:249-273` — `RL.repairPlaylistMMRChain` + `VAL.repairRankChain` on all games; `js/boot.js:316` — `ctx.renderAll()` triggers `renderHome` + session UI + quicklog tags before `boot-finished`.

**Impact:** CPU/DOM work 100–500ms+ proportional to match count; blocks `dashboard-rendered` mark. Deferrable partially (repair saves already deferred at 319-333) but in-memory repair remains on path.

---

## Blocking vs deferrable matrix

| Work | Before first paint | Before interactive | Before hydrated dashboard | Recommendation |
|------|--------------------|--------------------|---------------------------|----------------|
| Inline profile shell | ✓ | ✓ | — | Keep |
| Supabase module CDN | — | — | ✓ (blocks data) | Bundle vendor locally (future) |
| Auth getSession | — | — | ✓ | Keep; overlap warm |
| loadUserData fetches | — | — | ✓ | Parallel ✓ (done) |
| Rank repair CPU | — | — | ✓ | Consider idle defer if >500ms measured |
| renderAll first pass | — | — | ✓ | Partial: hero/session only (future) |
| Bridge heartbeat | — | — | — | Keep deferred ✓ |
| Review/Squad/Charts pages | — | — | — | Keep lazy ✓ |
| Ghost/dedupe maintenance | — | — | — | Idle ✓ |

---

## Step 9 — Success criteria vs gap

| Criterion | Target | Status | Gap driver |
|-----------|--------|--------|------------|
| Window visible | <150ms | **Likely OK** (splash) | Not measured live |
| First paint | <300ms | **At risk** | `app.js` import graph after inline shell |
| Interactive | <500ms | **At risk** | dom-ready + rAF; cache helps |
| Hydrated dashboard | <2s | **Miss** (est. 0.9–5s) | CDN auth module + Supabase fetches + renderAll |
| Bridge before paint | Must not block | **Pass** | void / background |
| Lazy pages at boot | No init marks | **Pass** (static) | — |

---

## Step 10 — Fixes applied (measurable intent)

| Fix | File | Expected mark delta |
|-----|------|---------------------|
| Parallel `loadUserData` fetches | `js/supabase.js` | `data-loaded` −30–60% vs serial (network-bound) |
| Early `warmSupabaseClient()` on cache hit | `js/app.js` | `supabase-init-complete` closer to `dom-ready`; shorter `auth-ready` −Δ |
| Full boot instrumentation | multiple | Enables before/after comparison |

### Before/after (to verify when signed in)

```js
// DevTools after warm reload (?dev=1)
const m = (p) => window.__BOOT_MARKS.find(x => x.phase === p)?.ms;
({
  interactive: m('interactive'),
  authReady: m('auth-ready'),
  dataLoaded: m('data-loaded'),
  loadUserDataMs: m('data-loaded') - m('load-user-data-start'),
  bootFinished: m('boot-finished'),
  lazyAtBoot: window.__BOOT_MARKS.filter(x => x.phase.startsWith('lazy-')),
});
```

**Prior serial `loadUserData`:** `loadUserDataMs ≈ t(profile)+t(games)+t(settings)+t(groups)`.  
**After parallel:** `loadUserDataMs ≈ max(t(profile), t(games), t(settings), t(groups))`.

---

## Electron rebuild

**Yes** — `tools/launcher/src/main.cjs` changed (`[startup]` milestones, t0 from process start). Rebuild:

```bash
cd tools/launcher && npm run build
```

---

## Files changed

| File | Change |
|------|--------|
| `js/boot-marks.js` | New shared `markBoot()` |
| `js/boot.js` | Import marks; `dashboard-rendered` |
| `js/auth.js` | Auth/supabase phase marks; `warmSupabaseClient()` |
| `js/supabase.js` | Parallel loadUserData + fetch marks |
| `js/app.js` | Unified marks; warm supabase; lazy marks |
| `js/bridge-client.js` | `bridge-ready` mark |
| `js/charts.js` | `charts-init` mark |
| `js/dev-overlay.js` | Boot timeline panel |
| `index.html` | `dom-content-loaded` mark |
| `tools/launcher/src/main.cjs` | Process-t0 + window/bridge milestones |
| `docs/STARTUP-FORENSIC-REPORT.md` | This report |
