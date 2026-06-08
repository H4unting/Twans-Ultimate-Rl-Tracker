# Performance Audit — Phase 5

**Product:** Twans Ultimate Tracker  
**Audit date:** June 7, 2026  
**Scope:** Render patterns, memory/listener leaks, timers, DOM updates, Supabase call frequency, chart redraws  
**Method:** Static analysis of hot paths in `js/app.js`, `charts.js`, `sessions.js`, bridge pollers, boot flow. **No code modified.**

---

## Executive summary

Performance is **adequate for personal-scale data** (hundreds of matches per user). Main costs: **full `renderAll()` on many events**, **chart destroy/recreate**, and **bridge heartbeat every 2.5s**. No evidence of unbounded memory growth if user signs out (timers cleared). Large match tables re-render entire `innerHTML` on each filter change.

**Overall rating: PASS with optimizations deferred**

---

## 1. Duplicate renders

### `renderAll()` fan-out

**File:** `js/app.js:327–380`

Triggered by:

- Every `tracker-data-changed` event (`app.js:1054–1056`)
- After log/edit/delete (`renderAll('core')` or `'full'`)
- Game switch (`game-ui.js` → `onChange: () => ctx.renderAll()`)
- QA panel actions

**`renderAll('core')` scope** (`app.js:333–341`): Skips playlist tabs, analytics filters setup, groups, reports, focus — still runs home, match logs, session UI, active page.

| ID | Severity | Issue | Impact |
|----|----------|-------|--------|
| P-M1 | Medium | `tracker-data-changed` always calls full `renderAll()` | Redundant work after single-field patch |
| P-M2 | Medium | Navigating to dashboard calls `renderHomePage` via `renderActivePageContent` AND `renderAll` may have already run | Minor duplicate chart draw |

### Per-page render on navigate

`navigate()` → `renderActivePageContent(pageId)` only — **good**. Does not full `renderAll` on nav alone.

### Recommendation

Debounce `renderAll` or narrow event payloads (`{ scope: 'core', pages: ['log'] }`).

---

## 2. Memory leaks

### Chart instances

**File:** `js/charts.js`

- `destroyChart(id)` before each create — **PASS**
- `destroyAllCharts()` when no chart data (`app.js:312`)
- Charts object `charts = {}` holds references until destroy — **PASS** if destroy called

| Canvas ID | Created from |
|-----------|--------------|
| `homeMMR`, `homeWL` | `renderHomePage` |
| `valHomeRR`, `valHomeWL` | `renderHomePage` (Val) |
| `dashMMR`, `dashWL` | `renderAnalyticsPage` |
| `rollingChart`, `trendChart` | `renderAnalytics` |

**Risk:** Switching games rapidly without destroy — mitigated by `destroyChart` at start of each `*Chart()` function.

### Event listeners

| Source | Wired once? | Leak risk |
|--------|-------------|-----------|
| `wireNavigation` | `dataset.wired` on login form; nav re-render replaces innerHTML (old listeners GC'd) | Low |
| `wireLogTableActions` | Re-bound on each `renderMatchLogs` — old buttons removed with table | Low |
| `bridge-client` visibility | `visibilityWired` guard | **PASS** |
| `valorant-live` visibility | Added in `initValorantLive`, removed in `stopValorantLive` | Verify stop on sign-out — **PASS** (`stopBridgeServices`) |
| Global `keydown` in `wireKeyboardShortcuts` | Once at init | **PASS** |
| `subscribe` / `subscribeBridgeOnline` | Sets never cleaned | Low — singleton app lifetime |

### Bridge / live pollers

| Poller | Interval | Stopped on sign-out? |
|--------|----------|-------------------|
| Bridge heartbeat | 2500ms | `stopBridgeHeartbeat` — **PASS** |
| RL live | varies | `stopRlLive` — **PASS** |
| Val live | 3000ms | `stopValorantLive` — **PASS** |

### Session timer

**File:** `js/sessions.js:88–95`

- `clearSessionTimer` on sign-out (`app.js:274`, `497`) — **PASS**
- `clearInterval` on session end — **PASS**

### Post-match card timer

**File:** `js/post-match.js` — 60s auto-dismiss timer; should clear on card close (verify in smoke — static review assumes single timer per card).

---

## 3. Listener leaks (detail)

| ID | Severity | Location | Notes |
|----|----------|----------|-------|
| P-L1 | Low | `authListeners` Set in `auth.js` | Grows only if `onAuthChange` called repeatedly without unsubscribe — app calls once |
| P-L2 | Low | `subscribeBridgeOnline` listeners | Same pattern — acceptable |
| P-M3 | Medium | `renderMainNav` replaces innerHTML — new click handlers each `updateNavUI` | Old handlers eligible for GC with removed nodes |

---

## 4. Session timer leaks

**Verdict: PASS**

- `state.session.timerId` nulled after `clearInterval`
- Sign-out and account delete paths call `clearSessionTimer`

---

## 5. Large DOM updates

### Match log table

**File:** `js/ui.js:111–184` — `renderLog`

- Rebuilds entire `<thead>` + `<tbody>` via `innerHTML` on every filter change.
- No virtual scrolling; all rows rendered.

| Match count | Expected UX |
|-------------|-------------|
| < 200 | Fine |
| 500+ | Noticeable filter lag on low-end hardware |
| 1000+ | Recommend pagination (not implemented) |

| ID | Severity | Issue |
|----|----------|-------|
| P-M4 | Medium | O(n) table rebuild on each keystroke in filters if wired to input events — filters use apply button pattern (verify `filters.js` UI) |

### Dashboard home

**File:** `js/home.js` — multiple section `innerHTML` updates (hero, session panel, activity feed). Acceptable for dashboard refresh frequency.

### Groups page

**File:** `js/groups.js` — member list + stats rendered in one pass. Squad size typically small.

---

## 6. Repeated Supabase calls

### Boot (once per session)

`loadUserData()` — 4 queries: profile, matches, settings, groups. **Acceptable.**

### Each save

`saveGames` — upsert batch + DELETE orphans per game slice. One save per log action. **Acceptable.**

### Boot chain repair

If MMR/rank drift detected, extra `saveGames` on boot (`boot.js:101–108`) — rare.

### Squads page

`renderGroupsPage` may call `loadGroupMembers` + `loadMemberGames` per member — **N+1 pattern** for large squads.

| ID | Severity | Issue | File |
|----|----------|-------|------|
| P-M5 | Medium | Squad member stats fetch per member | `groups.js` — acceptable for 2–5 members |

### Settings save frequency

Profile save on explicit user action only — **PASS**.

---

## 7. Expensive chart redraws

**File:** `js/charts.js`

Every `mmrChart` / `wlChart` / `rollingChart` / `trendChart`:

1. `destroyChart(id)`
2. `new Chart(...)`

**Triggers:**

- `renderHomePage` — every home refresh (includes `tracker-data-changed`)
- `renderAnalyticsPage` — playlist tab change, filter change
- `renderAnalytics` — rolling + trend charts

| ID | Severity | Issue | Mitigation present |
|----|----------|-------|-------------------|
| P-M6 | Medium | Home charts redraw on every log | `destroyChart` prevents leak; still CPU cost |
| P-L3 | Low | Chart.js loaded from CDN — network single point of failure | Not perf — availability |

**rollingChart** computes rolling windows O(n²) for win rate buckets — fine for n < 500.

---

## 8. Bridge / network overhead

| Call | Frequency | Notes |
|------|-----------|-------|
| `/status` heartbeat | 2.5s | Lightweight JSON |
| Val `/valorant/status` + `/last-match` | 3s when Val active | Only when game = Val and bridge up |
| RL live poll | Similar | When RL active |

**Hidden tab:** Bridge stays optimistic 15 min (`HIDDEN_GRACE_MS`) — reduces false offline, continues polling.

| ID | Severity | Issue |
|----|----------|-------|
| P-L4 | Low | Heartbeat continues when logged out until `stopBridgeHeartbeat` — sign-out stops it |

---

## 9. JSON deep clone on every mutation

**File:** `js/matches.js:47, 67, 80`

`JSON.parse(JSON.stringify(getActiveGames()))` — O(n) copy per add/update/patch.

Acceptable for hundreds of games; would hurt at thousands.

---

## 10. CSS / asset weight

| Asset | Size concern |
|-------|--------------|
| 6 CSS files in `index.html` | Multiple round trips — cache-busted `?v=20260602e` |
| Chart.js CDN | ~200KB — deferred load |
| Rank icons (Fandom hotlinks) | External latency per icon in table |

| ID | Severity | Issue |
|----|----------|-------|
| P-L5 | Low | Six Stylesheet requests on cold load |

---

## Hot path summary

```
User logs match
  → addGame → persistActiveGames → saveGames (network)
  → renderAll('core')
      → renderHomePage → mmrChart + wlChart (destroy + create)
      → renderMatchLogs → full table innerHTML
      → refreshSessionUI
      → renderActivePageContent
```

**Bottleneck order:** Network save > table innerHTML > chart recreate > home sections.

---

## Findings vs recommendations

### Findings

1. Chart lifecycle is correctly managed — no chart leak pattern found.
2. Timers and bridge pollers are stopped on sign-out.
3. `renderAll` is the main over-invalidation mechanism.
4. No pagination on match history — scale limit ~500 comfortable matches.
5. No automated performance tests or Lighthouse CI.

### Recommendations (not executed)

1. Narrow `tracker-data-changed` to scope parameter (v1.0.1).
2. Paginate or virtualize match log table if users exceed 300 rows.
3. Update chart data in place via `chart.data.datasets[0].data = ...; chart.update()` instead of full recreate.
4. Bundle CSS for production deploy (single file).
5. Batch squad member game loads in one RPC (future).

---

*Phase 5 complete. No code modified.*
