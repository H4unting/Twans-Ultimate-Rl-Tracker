---
name: startup-optimizer
description: >-
  Optimizes Twans Ultimate Tracker startup so the window and signed-in shell
  appear instantly and data loads progressively after first paint. Implements
  boot-path fixes — cached UI, deferred auth/sync, asset preload, non-blocking
  bridge probe. Use when the user mentions startup, slow launch, first paint,
  boot, cached UI, preload, sync later, Twans Ultimate Tracker cold start, or
  dashboard lag on open.
disable-model-invocation: true
---

# Startup Optimizer

**Role:** Implement startup and first-paint fixes in **Twans Ultimate Tracker**. Unlike review agents, this skill **applies minimal code changes** on the boot path — not read-only reports.

**Ownership:** First paint, shell visibility, progressive hydration, Electron window timing. **Coordinate with** `performance-engineer` for post-boot render churn; **coordinate with** `desktop-engineer` for `twans://` / launcher packaging; do not duplicate their scope.

## Purpose

Optimize app startup so the window/shell appears instantly and data loads progressively — highest priority for user frustration reduction.

## Rules

Window appears immediately.
Background tasks never block UI.
Show cached UI first.
Authenticate later.
Sync later.
Preload assets.
Cache icons.
Cache rank images.
No synchronous network calls before first paint.

---

## Workflow

```
Startup fix:
- [ ] 1. Reproduce — cold vs warm; desktop EXE vs browser; signed-in vs logged-out
- [ ] 2. Baseline — boot marks before any edit (required)
- [ ] 3. Trace — Electron show → SPA init → shell paint → auth → sync
- [ ] 4. Explain — what blocked first paint (ms, await chain, network)
- [ ] 5. Fix — minimal diff aligned to Rules above
- [ ] 6. Verify — marks improved; shell before load-user-data-start
```

### Measure before changing

| Layer | Tool | Target marks |
|-------|------|--------------|
| Electron | `config/bridge.log` filter `[startup` | `window-visible` <150ms; splash before `twans://` |
| SPA boot | DevTools filter `[boot` | `interactive` before `load-user-data-start` |
| Overlay | `?dev=1` → Boot total / First paint | `window.__BOOT_MARKS` |

**Required order (signed-in warm boot):**

1. `shell-visible` → `shell-painted` → `first-paint` → `interactive`
2. Then `load-user-data-start` → `data-loaded` → `first-render-complete` → `boot-finished`
3. `deferred-maintenance-*` only after idle — never on critical path

### Fix patterns (prefer in order)

1. **Paint shell from cache** — `loadProfileCache()` + `renderDashboardShell()` before network (`js/boot.js`)
2. **Defer network** — never `await` Supabase/bridge before `markBoot('interactive')`
3. **Background bridge** — `void waitForDesktopServices()`; cap probe; do not block overlay removal
4. **Lazy modules** — dynamic `import()` for QA, reports, analytics; no eager heavy imports in `app.js` init
5. **Idle maintenance** — ghost/dedupe via `requestIdleCallback` after first render
6. **Asset preload** — `<link rel="preload">` or in-memory cache for rank icons and tray/window icons
7. **Electron first** — splash data-URL immediately on `createMainWindow`; load `twans://` without waiting for backend

### Anti-patterns (scan every boot change)

- [ ] `await loadUserData()` / `await initAuth()` before shell paint
- [ ] `await waitForDesktopServices()` before `first-paint`
- [ ] Blocking `renderAll()` before cached skeleton visible
- [ ] Synchronous `fetch` / Supabase in `init()` before `wireBootContext`
- [ ] Eager import of optional pages at module top level
- [ ] Spinner overlay during cached warm boot when profile cache exists
- [ ] Launcher waits for `waitForTrackerReady` before `window-visible`

---

## Scope map

| Layer | Primary paths |
|-------|----------------|
| SPA boot | `js/boot.js`, `js/app.js` (`init`, `onAuthChange`) |
| Profile cache | `js/profile-cache.js` |
| Dashboard shell | `js/home.js` (`renderDashboardShell`) |
| Auth deferral | `js/auth.js` |
| Electron launcher | `tools/launcher/src/main.cjs` |
| Boot instrumentation | `js/dev-overlay.js`, `window.__BOOT_MARKS` |

---

## Validation checklist

- [ ] `[boot]` marks show `interactive` before `load-user-data-start`
- [ ] Warm boot: auth bar name/avatar from cache without network
- [ ] `[startup]` `window-visible` before `backend services ready`
- [ ] No new sync network calls in `init()` hot path
- [ ] `node --check` on changed `js/**/*.js`
- [ ] Criteria in [`docs/PREMIUM-DESKTOP-POLISH.md`](../../docs/PREMIUM-DESKTOP-POLISH.md) §1 still pass

---

## Additional resources

- Boot sequence, Electron timing, call chains: [reference.md](reference.md)
- Post-boot render rules: `performance-engineer` skill
- Packaging / `twans://`: `desktop-engineer` skill
- [`docs/PERFORMANCE-FORENSIC-REPORT.md`](../../docs/PERFORMANCE-FORENSIC-REPORT.md)
- [`docs/PREMIUM-DESKTOP-POLISH.md`](../../docs/PREMIUM-DESKTOP-POLISH.md)
