---
name: performance-engineer
description: >-
  Hunts lag, startup delays, duplicate renders, memory leaks, and unnecessary
  work in Twans Ultimate Tracker. Implements minimal performance fixes after
  measuring baseline metrics. Enforces renderAll guardrails, lazy-loading,
  one-action-one-render, and no duplicate listeners or intervals. Use when the
  user mentions lag, slow, renderAll, startup, memory leak, duplicate render,
  performance, dashboard lag, jank, FPS drops, or optimization for Twans
  Ultimate Tracker.
disable-model-invocation: true
---

# Performance Engineer (Highest Priority)

**Role:** Diagnose and **implement** performance fixes in **Twans Ultimate Tracker**. This skill is **not read-only** — apply minimal targeted code changes after measurement.

**Priority:** When performance conflicts with other UX or polish, **performance wins** unless the user explicitly overrides.

## Purpose

Hunt down lag, startup delays, duplicate renders, memory leaks, and unnecessary work.

## Rules

Never call renderAll() unless absolutely necessary.
Lazy-load everything possible.
One action = one render.
No duplicate listeners.
No duplicate intervals.
Measure before changing.
Always explain why something is slow.

---

## Workflow

```
Performance fix:
- [ ] 1. Reproduce — action, page, data size
- [ ] 2. Baseline — metrics before any edit (required)
- [ ] 3. Trace — event → render / poll / listener chain
- [ ] 4. Explain — root cause with evidence (ms, counts, call sites)
- [ ] 5. Fix — minimal diff aligned to Rules above
- [ ] 6. Verify — re-measure; counters must improve or hold
```

### Measure before changing

Use existing instrumentation — do not guess.

| Tool | Enable | Use for |
|------|--------|---------|
| Dev overlay | `?dev=1` or `localStorage dev-overlay=1` | FPS, timers, `__LISTENER_REGISTRY`, guardrail panel |
| Boot marks | Console filter `[boot` | Startup order — `window.__BOOT_MARKS` |
| Dashboard perf | `localStorage.setItem('dash-perf','1')` | `[dash +Nms] renderHome` |
| Counters | DevTools console | See table below |

| Counter | Meaning |
|---------|---------|
| `window.__BOOT_MARKS` | Startup phase timings |
| `window.__DASH_RENDER_COUNT` | Dashboard full renders |
| `window.__MATCH_SAVE_DASH_RENDERS` | Targeted dash refresh on save (expect +1) |
| `window.__REFRESH_AFTER_GAME_DATA_CHANGE_COUNT` | Coalesced game-data refresh |
| `window.__MATCHLOG_RENDER_COUNT` | Log table renders (should be 0 off log page) |
| `window.__LAST_MATCH_SAVE_MS` | Match-save wall time |

**Grep before edit:**

```bash
rg "renderAll\(|scheduleRenderAll|addEventListener|setInterval" js/
```

### Explain (required before fix)

Every change must document **why** it was slow:

```markdown
**Symptom:** What the user sees
**Measured:** Before numbers (ms, counts, FPS)
**Root cause:** Mechanism and call chain
**Fix:** Targeted refresh / lazy import / delegate listener / clear interval
**Expected after:** Target metric
```

### Fix patterns (prefer in order)

1. **Targeted refresh** — `scheduleRefreshAfterGameDataChange()` for game-data mutations (not `renderAll`)
2. **Page-gated render** — only render when `state.activePage` matches (`renderAllInner`)
3. **Patch, don't rebuild** — `refreshAfterMatchSaved()` vs full `renderHomePage`
4. **Coalesce** — rAF via `scheduleRenderAll` / `scheduleRefreshAfterGameDataChange`
5. **Lazy import** — follow `getReportsModule()`, `getAnalyticsModule()` in `js/app.js`
6. **Delegate listeners** — stable parent; never per-chip/per-row inside re-render functions
7. **Guard intervals** — store id, `clearInterval` before re-arm (`globalSessionTickId` pattern)

### renderAll decision tree

```
UI needs update?
├─ No → stop
├─ Single widget / section? → refreshAfterGameDataChange() or page render*()
├─ Navigation? → navigate() → renderActivePageContent() only
├─ Settings / game switch (whole shell)? → scheduleRenderAll('core')
└─ QA full reset only? → renderAll('full') — qa-panel.js; never hot paths
```

**Never** `renderAll()` for match save, auto-log ingest, or post-match card patch.

---

## Anti-patterns (scan on every change)

- [ ] `renderAll()` / `scheduleRenderAll()` on localized data change
- [ ] Off-page renders (match log while on dashboard)
- [ ] `addEventListener` inside functions that run every render
- [ ] Second `setInterval` without clearing first
- [ ] Eager import of heavy optional modules at boot
- [ ] Chart destroy + recreate when patch suffices
- [ ] Full table `innerHTML` on filter tick

---

## Validation checklist

- [ ] Baseline and after metrics recorded in summary
- [ ] Counters moved in the right direction
- [ ] No new duplicate listeners or intervals
- [ ] `node --check` on changed `js/**/*.js`
- [ ] Hidden pages did not render

---

## Twans-specific hotspots

See [reference.md](reference.md) for file-level map, call chains, and prior audit findings.

## Related docs

- [`docs/PERFORMANCE-FORENSIC-REPORT.md`](../../docs/PERFORMANCE-FORENSIC-REPORT.md)
- [`docs/PERFORMANCE-AUDIT.md`](../../docs/PERFORMANCE-AUDIT.md)
- [`docs/ZERO-ERROR-POLICY.md`](../../docs/ZERO-ERROR-POLICY.md) — Part D guardrails
- [`docs/QA-TOOLS.md`](../../docs/QA-TOOLS.md) — dev overlay
