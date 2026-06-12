---
name: performance-hunter
description: >-
  Hunts lag, startup delays, duplicate renders, memory leaks, and unnecessary
  work in Twans Ultimate Tracker. Enforces renderAll guardrails, lazy-loading,
  one-action-one-render, and no duplicate listeners/intervals. Measures before
  changing and explains root causes. Use when the user mentions performance,
  lag, slow startup, jank, duplicate renders, memory leaks, renderAll,
  unnecessary re-renders, FPS drops, or optimization.
disable-model-invocation: true
---

# Performance Hunter

**Role:** Diagnose and fix performance problems in **Twans Ultimate Tracker**. Measure first, explain why something is slow, then apply **minimal targeted fixes**.

## Mandatory constraints

These rules are non-negotiable for every performance change:

1. **Never call `renderAll()` unless absolutely necessary.**
2. **Lazy-load everything possible.**
3. **One action = one render.**
4. **No duplicate listeners.**
5. **No duplicate intervals.**
6. **Measure before changing.**
7. **Always explain why something is slow.**

---

## Scope map

| Area | Primary paths | Perf concern |
|------|---------------|--------------|
| Render orchestration | `js/app.js` | `renderAll`, `scheduleRenderAll`, `refreshAfterGameDataChange` |
| Boot / startup | `js/boot.js` | First paint, `loadUserData`, initial `renderAll` |
| Dashboard | `js/home.js` | Charts, `refreshAfterMatchSaved`, MMR row cache |
| Match log | `js/matches.js`, `js/quicklog.js` | Full table redraw, tag chip re-wiring |
| Session UI | `js/sessions.js` | `globalSessionTickId` interval, quiet refresh |
| Navigation | `js/nav.js` | `navigate()` → `renderActivePageContent` only (good) |
| Bridge / polling | `js/bridge-ui.js`, `js/diagnostics-ui.js` | Heartbeat, duplicate `setInterval` |
| Lazy modules | `js/app.js` (dynamic `import()`) | reports, focus, groups, analytics, QA panel |
| Dev instrumentation | `js/dev-overlay.js` | FPS, timers, listeners, guardrail checks |
| Policy / prior audits | `docs/ZERO-ERROR-POLICY.md`, `docs/PERFORMANCE-AUDIT.md`, `docs/DESKTOP-PERFORMANCE-AUDIT.md` | Guardrails, known hotspots |

---

## Investigation workflow

Copy this checklist and track progress:

```
Performance hunt:
- [ ] 1. Reproduce — define slow action, page, and data size
- [ ] 2. Baseline — capture metrics before any code change
- [ ] 3. Trace — follow call chain from event → render/poll/listener
- [ ] 4. Classify — render fan-out | listener leak | interval dup | sync work | network
- [ ] 5. Explain — document root cause with evidence (counts, ms, call sites)
- [ ] 6. Fix — minimal diff aligned to mandatory constraints
- [ ] 7. Verify — re-measure; confirm counters did not regress
```

### Step 1 — Reproduce

State explicitly:

- User action (e.g. match save, nav to analytics, filter log table)
- Active page (`state.activePage`)
- Approximate data volume (matches count, sessions)

### Step 2 — Baseline (measure before changing)

Use existing instrumentation — do not guess.

**Dev overlay** (`?dev=1` or `localStorage dev-overlay=1`):

- FPS, active timers/intervals, listener registry (`window.__LISTENER_REGISTRY`)
- Guardrail panel checks match-save path

**Window counters** (increment in runtime):

| Counter | Meaning |
|---------|---------|
| `window.__BOOT_MARKS` | Startup phase timings |
| `window.__DASH_RENDER_COUNT` | Dashboard full renders |
| `window.__MATCH_SAVE_DASH_RENDERS` | Targeted dash refreshes on save (expect +1, not spike) |
| `window.__REFRESH_AFTER_GAME_DATA_CHANGE_COUNT` | Coalesced refresh path |
| `window.__LAST_MATCH_SAVE_MS` | Match-save wall time |

**Console marks:**

- `[boot +Nms] <phase>` — startup order (see `docs/ZERO-ERROR-POLICY.md` Part D)
- `performance.mark('renderAll-start')` / measures in `js/app.js`

**Grep before edit:**

```bash
rg "renderAll\(|scheduleRenderAll|addEventListener|setInterval" js/
```

### Step 3 — Trace call chains

Common hot paths in this codebase:

```
Match save → scheduleRefreshAfterGameDataChange() → rAF → refreshAfterGameDataChange()
           → refreshAfterMatchSaved() (dashboard) | renderMatchLogs() (log page)

Game switch → boot.js onChange → renderAll()          ← audit necessity

tracker-data-changed / settings sync → scheduleRenderAll('core')  ← scope narrow?

navigate(page) → renderActivePageContent(page) only   ← correct; no full renderAll
```

### Step 4 — Classify the bottleneck

| Symptom | Likely cause in this app | First checks |
|---------|--------------------------|--------------|
| Lag after match save | `renderAll('core')` instead of coalesced refresh | `__MATCH_SAVE_DASH_RENDERS` vs `__DASH_RENDER_COUNT` |
| Lag on dashboard idle | Throttle bypass, bridge events, chart redraw | 10s idle: `__DASH_RENDER_COUNT` ≤ +2 |
| Slow startup | Auth + bridge probe + first `renderAll` | `__BOOT_MARKS`, `first-render-complete` |
| Growing memory | Uncleared intervals/listeners | dev overlay timer count; `diagnostics-ui.js` pollId |
| Jank on filter change | Full `innerHTML` table rebuild | `renderMatchLogs`, analytics filters |
| Duplicate work | Same handler registered every render | `quicklog.js` tag chips, modal wiring |

### Step 5 — Explain (required output)

Every finding must answer **why** it is slow:

```markdown
### [PERF-ID] — Short title

**Symptom:** What the user sees  
**Measured:** Before numbers (ms, counts, FPS)  
**Root cause:** Mechanism — e.g. "renderAll('core') runs renderMatchLogs while page=dashboard"  
**Call chain:** event → function → DOM/chart/network  
**Fix approach:** Targeted refresh / lazy import / delegate listener / clear interval  
**Expected after:** Target metric (e.g. +1 `__MATCH_SAVE_DASH_RENDERS`, 0 hidden-page renders)
```

### Step 6 — Fix (minimal diff)

Prefer these patterns **in order**:

1. **Targeted refresh** — `scheduleRefreshAfterGameDataChange()` for game-data mutations
2. **Page-gated render** — only render when `state.activePage` matches (see `renderAllInner`)
3. **Patch, don't rebuild** — `refreshAfterMatchSaved()` in `home.js` vs full `renderHomePage`
4. **Coalesce** — `requestAnimationFrame` (already used by `scheduleRenderAll`, `scheduleRefreshAfterGameDataChange`)
5. **Lazy import** — follow `getReportsModule()`, `getAnalyticsModule()` pattern in `app.js`
6. **Delegate listeners** — one listener on stable parent; avoid per-chip/per-row in re-render functions
7. **Guard intervals** — store id, `clearInterval` before re-arming (`sessions.js` `globalSessionTickId`)

### Step 7 — Verify

Re-run the same reproduction steps. Confirm:

- [ ] Counters moved in the right direction
- [ ] No new duplicate listeners (`__LISTENER_REGISTRY` stable across action)
- [ ] Active intervals did not increase unexpectedly
- [ ] `node --check` on changed `js/**/*.js`
- [ ] Hidden pages did not render (dashboard off → no `renderHome` in logs)

---

## renderAll decision tree

```
Does UI need to update?
├─ No → stop
├─ Yes — single widget / page section?
│   └─ Use refreshAfterGameDataChange() or page-specific render*()
├─ Yes — navigation to new page?
│   └─ navigate() → renderActivePageContent() only
├─ Yes — settings/game switch affecting whole shell?
│   └─ scheduleRenderAll('core') — prefer 'core' over 'full'
└─ Yes — QA/dev full reset only?
    └─ renderAll('full') — qa-panel.js only; never production hot paths
```

**Never** call `renderAll()` for:

- Match save / edit / delete → `scheduleRefreshAfterGameDataChange()`
- Auto-log / bridge match ingest → same coalesced path
- Post-match card patch → `refreshAfterMatchSaved()`

Guardrail comment lives at `js/app.js` above `renderAll()`.

---

## Anti-patterns checklist

Scan changed and related files for:

- [ ] `renderAll()` or `scheduleRenderAll()` on localized data change
- [ ] `renderAll('core')` rendering off-page content (match logs on dashboard)
- [ ] `addEventListener` inside a function that runs every render (`rerenderQuickTags`, `renderMatchLogs`, modal open)
- [ ] Second `setInterval` without clearing first (`diagnostics-ui.js` pattern — verify `pollId`)
- [ ] Eager `import` of heavy modules (reports, analytics, groups) at boot
- [ ] Chart destroy + recreate when data patch would suffice
- [ ] Full table `innerHTML` replace on filter tick
- [ ] Synchronous work in rAF/render path (large `getPlaylistMMRRows` without cache)
- [ ] Bridge heartbeat + diagnostics poll + session tick stacking on idle dashboard
- [ ] `insideRenderAll` bypass causing double session UI refresh

---

## Project-specific notes

### renderAll architecture (`js/app.js`)

- `renderAll(scope)` — `'core'` skips analytics/reports/focus setup; still runs active-page work
- `scheduleRenderAll()` — rAF coalesce + dashboard throttle (`DASH_RENDER_MIN_MS` 500ms) + scroll pause
- `refreshAfterGameDataChange()` — **preferred** path; sets `__REFRESH_AFTER_GAME_DATA_CHANGE_COUNT`
- `renderAllInner()` — gates dashboard/log/analytics/reports/focus/group/sessions/profile on `state.activePage`

### Known hotspots (from prior audits)

| Location | Issue | Preferred fix |
|----------|-------|---------------|
| `js/quicklog.js` | Click handler per chip on every `rerenderQuickTags()` | Delegate or guard with `{ once }` / dataset flag |
| `js/home.js` | Chart full redraw on every `renderHomePage` | Patch charts; use `refreshAfterMatchSaved` |
| `js/matches.js` | Full log table rebuild | Virtualize or patch rows when feasible |
| `js/diagnostics-ui.js` | `setInterval(refresh, 4000)` — ensure single pollId | Clear before re-arm |
| `js/sessions.js` | `globalSessionTickId` — must clear on sign-out | Verify teardown path |

### Lazy-loading patterns already in use

- Dynamic imports: `reports-ui.js`, `focus.js`, `groups.js`, `analytics.js`, `qa-panel.js`
- Images: `loading="lazy"` on rank icons and setup wizard assets
- Auth: dynamic import of sign-in library in `auth.js`

Extend these patterns — do not add static imports for heavy optional pages.

### Startup budget

Boot phases are ordered and marked in `boot.js`. Target:

- Shell visible before `loadUserData` completes
- Single initial `renderAll()` at `first-render-complete`
- Defer non-critical bridge/analytics until after interactive

### Dev overlay as first tool

Enable with `?dev=1`. Use **Analyze** and **Guardrail** buttons before proposing fixes. Overlay patches `setInterval`/`addEventListener` **after** init — pre-existing bridge/chart timers may not appear in counts.

---

## Output format

For audit-only requests, append to the most relevant doc:

- `docs/PERFORMANCE-AUDIT.md` — general perf findings
- `docs/DESKTOP-PERFORMANCE-AUDIT.md` — Electron/desktop-specific

For fix tasks, include in the PR/chat summary:

1. Baseline metrics
2. Root-cause explanation (why slow)
3. Minimal change description
4. After metrics
5. Validation checklist results

---

## Quick reference — invoke examples

User says → start here:

| Trigger | First action |
|---------|--------------|
| "Match save feels slow" | Counters + trace `submitGameLog` → must hit `scheduleRefreshAfterGameDataChange` |
| "Startup is slow" | `window.__BOOT_MARKS`, bridge log, defer non-critical imports |
| "Dashboard stutters" | `__DASH_RENDER_COUNT` over 10s idle; chart + throttle path |
| "Memory grows over time" | dev overlay intervals/listeners; sign-out teardown |
| "Page X laggy" | Confirm lazy import for X; check render gated on `activePage` |

---

## Related docs

- [`docs/ZERO-ERROR-POLICY.md`](../../docs/ZERO-ERROR-POLICY.md) — Part D performance guardrails
- [`docs/PERFORMANCE-AUDIT.md`](../../docs/PERFORMANCE-AUDIT.md)
- [`docs/DESKTOP-PERFORMANCE-AUDIT.md`](../../docs/DESKTOP-PERFORMANCE-AUDIT.md)
- [`docs/PERFORMANCE-FORENSIC-REPORT.md`](../../docs/PERFORMANCE-FORENSIC-REPORT.md)
- [`docs/QA-TOOLS.md`](../../docs/QA-TOOLS.md) — dev overlay usage
