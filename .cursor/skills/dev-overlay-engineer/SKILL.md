---
name: dev-overlay-engineer
description: >-
  Implements and enhances dev overlay instrumentation, performance metrics, and
  measurable diagnostics for Twans Ultimate Tracker. Owns FPS, startup marks,
  render counters, Supabase/bridge request counts, memory, timers, listeners,
  and analyze/guardrail panels. Use when the user mentions dev overlay, FPS,
  render count, performance metrics, measurable optimization, ?dev=1,
  diagnostics, or Twans Ultimate Tracker performance instrumentation.
disable-model-invocation: true
---

# Dev Overlay Engineer

**Role:** **Implement** and extend the dev validation overlay and its metrics in **Twans Ultimate Tracker**. Unlike review agents, this skill **writes code** in `js/dev-overlay.js` and counter hooks — minimal diffs only.

**Pairing:** Hand measured regressions to `performance-engineer` for hot-path fixes; coordinate with `startup-optimizer` on boot-mark gaps and shell timing.

## Owns

FPS
Startup time
Memory
Render count
Supabase calls
Bridge calls
CPU
Event listeners
Timers
Duplicate renders
Cache hits

## Rules

Every optimization should be measurable.

---

## Purpose

Make performance visible before fixing it. Extend instrumentation when a metric is missing; do not ship overlay UI that misleads (stale counters, pre-patch blind spots).

## Global constraints

- **Overlay off by default** — `isDevOverlayEnabled()` (`?dev=1` or `localStorage dev-overlay=1`); zero production overhead when disabled.
- **Minimal diffs** — add counters at source (fetch/render), not duplicate polling in overlay.
- **Do not break guardrails** — overlay analyze text must stay aligned with [`docs/ZERO-ERROR-POLICY.md`](../../docs/ZERO-ERROR-POLICY.md) Part C/D.
- **Measure before recommending** — overlay suggests; `performance-engineer` implements fixes unless user asks this skill to wire both.

---

## Workflow

```
Dev overlay task:
- [ ] 1. Enable — ?dev=1 or localStorage dev-overlay=1; confirm panel renders
- [ ] 2. Baseline — record live panel values + __BOOT_MARKS before change
- [ ] 3. Gap — identify missing metric or misleading threshold in analyzePerformance()
- [ ] 4. Instrument — hook at source (sbFetch, bridge fetch, render*, perf-cache)
- [ ] 5. Surface — add row / analyze line / guardrail check in dev-overlay.js
- [ ] 6. Verify — re-run soak; numbers must move predictably; node --check
```

### Enable overlay

| Method | Example |
|--------|---------|
| Query | `?dev=1` (persists `dev-overlay=1`) |
| localStorage | `localStorage.setItem('dev-overlay','1')` + reload |
| Disable | remove key; reload without `?dev=1` |

Wired: `initDevOverlay()` at end of `app.js` `init()` after auth-ready.

### Metric map (existing)

| Owns | Panel / source |
|------|----------------|
| FPS | `requestAnimationFrame` loop in `dev-overlay.js` |
| Startup time | `window.__BOOT_MARKS` from `markBoot()` in `boot.js` / `app.js` |
| Memory | `performance.memory.usedJSHeapSize` (Chrome/Electron) |
| Render count | `__DASH_RENDER_COUNT`, `__MATCHLOG_RENDER_COUNT`, `__REVIEW_RENDER_COUNT`, `__SQUAD_RENDER_COUNT`, `__CHARTS_RENDER_COUNT` |
| Supabase calls | `__SUPABASE_REQUEST_COUNT` in `supabase.js` `sbFetch` |
| Bridge calls | `__BRIDGE_REQUEST_COUNT` in `bridge-client.js` |
| Event listeners | `__LISTENER_REGISTRY` (patched post-init only) |
| Timers | patched `setTimeout` / `setInterval` counts |
| Duplicate renders | analyze thresholds + off-page counter leaks |
| Cache hits | **gap** — add hooks in `perf-cache.js` / `home.js` MMR cache when extending |

**CPU:** not directly sampled today — infer from FPS drops + main-thread save ms (`__LAST_MATCH_SAVE_MS`).

### Boot phases (`markBoot`)

Key phases for startup-time ownership:

```
dom-ready → auth-ready → shell-visible → shell-painted → first-paint → interactive
→ load-user-data-start → data-loaded → first-render-complete → boot-finished
```

Analyze uses gaps: first-paint→interactive, loadUserData duration, dom→auth.

### Analyze & guardrail buttons

- **Analyze Performance** — `analyzePerformance()` heuristics (dash > 20, listeners > 120, bridge > 60 idle).
- **Test save guardrail** — `runGuardrailCheck()`; expects `refreshAfterGameDataChange`, not `renderAll`.

Export for QA: `window.__runDevGuardrailCheck`.

### Soak targets (from ZERO-ERROR-POLICY)

| Check | Target |
|-------|--------|
| Idle dashboard 10s | `__DASH_RENDER_COUNT` ≤ +2 |
| Match save | `__MATCH_SAVE_DASH_RENDERS` +1, not full renderAll spike |
| Off-page | match log / review / squad counters 0 on dashboard |
| Bridge idle | ~10 req/min heartbeat; higher → poll stacking |

---

## Extension patterns

1. **New counter** — increment at source; read in `refreshPanel()` + optional analyze line.
2. **New boot mark** — `markBoot('phase')` in owning module; document in reference.md.
3. **Cache hit ratio** — expose `window.__PERF_CACHE_HITS` / `__PERF_CACHE_MISSES` in `perf-cache.js`; panel row when added.
4. **Threshold tune** — change analyze text only with measured evidence from soak logs.

**Never:** patch timers/listeners before overlay init without documenting blind spot in reference.md.

---

## Validation checklist

- [ ] Overlay absent when disabled; no console errors
- [ ] Panel refreshes every 1s; FPS updates
- [ ] Baseline and after metrics recorded in summary
- [ ] `node --check` on changed `js/**/*.js`
- [ ] [`docs/ZERO-ERROR-POLICY.md`](../../docs/ZERO-ERROR-POLICY.md) Part C table still accurate if counters moved

---

## Related docs

- [reference.md](reference.md) — counter locations, boot mark list, limitations
- [`docs/ZERO-ERROR-POLICY.md`](../../docs/ZERO-ERROR-POLICY.md) — Part C overlay, Part D guardrails
- [`docs/QA-TOOLS.md`](../../docs/QA-TOOLS.md)
- `performance-engineer` — implements fixes guided by these metrics
- `startup-optimizer` — boot sequence and shell-first paint
