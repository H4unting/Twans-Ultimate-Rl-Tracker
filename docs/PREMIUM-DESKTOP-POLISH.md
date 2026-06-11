# Premium Desktop Polish — Success Criteria

**Product:** Twans Ultimate Tracker (Electron + SPA)  
**Date:** 2026-06-11

Measurable improvements only. No feature creep.

---

## 1. Startup instant shell

| Criterion | Target | Verify |
|-----------|--------|--------|
| Electron splash | Window + splash data-URL **&lt;150ms** after `app.whenReady` | `config/bridge.log`: `[startup +Nms] window-visible` |
| Signed-in shell before data | Dashboard visible **before** `loadUserData` resolves | No `is-loading` overlay during fetch; `shell-painted` mark |
| Cached profile | Auth bar + skeleton use `localStorage` `twans-profile-cache` | Name/avatar instant on warm boot |
| Bridge probe non-blocking | `waitForDesktopServices` never awaited before shell | `[boot +Nms] interactive` before `load-user-data-start` |
| Boot marks | `first-paint`, `interactive`, `boot-finished` in `window.__BOOT_MARKS` | DevTools console filter `[boot` |

---

## 2. Progressive rendering

| Criterion | Target | Verify |
|-----------|--------|--------|
| Lazy modules | reports / focus / groups / analytics import on nav only | No network/module load for review on dashboard idle |
| Charts IO gate | Chart.js only when `#dash-performance` intersects | `perfSectionVisible` + `__CHARTS_RENDER_COUNT` 0 until scroll |
| Page-gated renderAll | review / squad / reports / analytics only when `state.activePage` matches | Dev overlay Review/Squad = 0 on dashboard |
| No content-visibility delay | Removed from below-fold dashboard sections | CSS uses `contain: layout style` only |

---

## 3. Dashboard / match-save rules

| Criterion | Target | Verify |
|-----------|--------|--------|
| Match save path | `scheduleRefreshAfterGameDataChange()` only | `__REFRESH_AFTER_GAME_DATA_CHANGE_COUNT` increments; no `renderAll('core')` on save |
| Targeted dash refresh | `__MATCH_SAVE_DASH_RENDERS` +1 per save on dashboard | Dev overlay → **Test save guardrail** |
| Idle dash churn | `__DASH_RENDER_COUNT` ≤ +2 / 10s idle | Dev overlay → **Analyze Performance** |

---

## 4. Dev overlay (`?dev=1`)

| Metric | Source |
|--------|--------|
| Boot total / first paint / interactive | `__BOOT_MARKS` |
| Render counts | `__DASH_*`, `__REVIEW_*`, `__SQUAD_*`, `__CHARTS_*` |
| Bridge / Supabase | `__BRIDGE_REQUEST_COUNT`, `__SUPABASE_REQUEST_COUNT` |
| Memory / FPS | `performance.memory`, rAF loop |
| Last save | `__LAST_MATCH_SAVE_MS` |
| **Analyze Performance** | Diagnosis text from counters + boot marks |
| **Test save guardrail** | Refresh-path verification hook |

---

## 5. Logo system

| Asset | Path |
|-------|------|
| Master | `integrations/overwolf/icon.png` or `assets/brand/logo-master.png` |
| Generator | `tools/launcher/scripts/generate-icon.mjs` |
| Docs | `assets/brand/README.md` |
| Navbar | Inline SVG in `index.html` (no raster crop) |

---

## 6. Zero errors

```powershell
Get-ChildItem js -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

All files must pass. No missing cross-module imports in `app.js` / `boot.js`.

---

## Deferred (not this pass)

- Live Electron cold-start timing capture (requires signed-in QA machine)
- Duplicate listener cleanup in quicklog / groups (documented only)
- `public/icon.svg` brand replacement (web-only legacy)
- 8hr memory soak

---

## Related

- [`ZERO-ERROR-POLICY.md`](./ZERO-ERROR-POLICY.md)
- [`PERFORMANCE-FORENSIC-REPORT.md`](./PERFORMANCE-FORENSIC-REPORT.md)
