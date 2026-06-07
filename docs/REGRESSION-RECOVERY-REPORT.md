# V1.0 Regression Recovery Report

**Sprint goal:** Restore broken functionality. No UI redesign. No new features beyond existing baseline system verification.

**Status:** P0 blockers addressed. P1 baseline system already exists in codebase — verification steps below.

---

## 1. Valorant section broken — FIXED

### Root cause
During the v0 shell refactor, `onGameSwitchClick` was extracted from `initGameSwitcher` but **`getSettingsPayload` was not captured** in module scope. Clicking Rocket League ↔ Valorant threw:

`ReferenceError: getSettingsPayload is not defined`

The handler aborted before `onGameChange()` → `renderAll()`, so the active game in UI could desync and stats/actions appeared frozen.

### Files changed
- `js/game-ui.js` — store `getSettingsPayloadFn` in `initGameSwitcher`; use it in `onGameSwitchClick`

### Verification
1. Sign in, open DevTools console (should be clean).
2. Switch **Rocket League → Valorant** via top pills or mobile switch.
3. Confirm: dashboard stats update, dock shows Val queue, match log filters Val games.
4. Log a Val match from dock — dashboard and match history update.
5. Switch back to RL — same checks.

---

## 2. Review tab broken — FIXED

### Root cause
`updateNavUI()` sets `document.body.dataset.page` and `document.body.dataset.section`. The sidebar click handler used unscoped `e.target.closest('[data-page]')`, which matched **`document.body`** (an ancestor of every nav button) before reaching `button[data-section]`.

Result:
- Clicking **Review** while on Dashboard re-navigated to `body.dataset.page` (`dashboard`) — no visible change.
- Clicking **Review** while on Squad re-navigated to `group` — appeared stuck on Squad.
- Review sub-nav pills had the same bug via unscoped `[data-page]`.

### Files changed
- `js/nav.js` — scope nav clicks to `#main-nav` / `#review-sub-nav` buttons only; add `[REVIEW]` / `[SQUAD]` nav logs
- `js/app.js` — route/render diagnostic logs for Review + Squad pages

### Verification
1. Hard refresh (`Ctrl+F5`) — script cache bust `js/app.js?v=20260607a`.
2. Click **Review** in sidebar → lands on **Focus** (`#page-focus.active`).
3. Review sub-pills → **Analytics** / **Reports** switch correctly.
4. Console shows `[REVIEW] nav clicked` → `[REVIEW] route entered` → `[REVIEW] render started/completed`.
5. Log a match while on Analytics → page refreshes in place.

---

## 3. Squad tab broken — FIXED

### Root cause
Same **`closest('[data-page]')` → `document.body`** bug as Review (see §2). Clicking **Squad** often re-navigated to the current `body.dataset.page` instead of `group`.

Secondary: `loadUserGroups()` swallows Supabase errors and returns `[]` (empty squads, not an error state).

### Files changed
- `js/nav.js` — scoped section clicks (fixes Squad nav)
- `js/app.js` — `[SQUAD]` route/render logs; async error surface on squad page
- `js/groups.js` — `[SQUAD]` query/render logs
- `js/supabase.js` — `[SQUAD] query completed with error` on failed group fetch

### Verification
1. Click **Squad** in sidebar → `#page-group.active`, create/join panel visible.
2. Console: `[SQUAD] nav clicked` → `[SQUAD] route entered` → `[SQUAD] query started/completed` → `[SQUAD] render completed`.
3. Create/join squad — detail panel loads.
4. If Supabase fails — console `[SQUAD] query completed with error` + toast (not silent blank).

---

## 4. Dashboard rank image overlap — FIXED (CSS only)

### Root cause
Dashboard hero used `rankBadgeHTML(..., 96)` which renders a **~115px wiki rank icon plus label text**, overflowing the fixed emblem container after the v0 dashboard layout landed.

### Files changed
- `css/dashboard-v0.css` — constrain `.dash-hero-emblem .rank-icon`, hide label in hero, `overflow: hidden`
- `js/home.js` — pass correct Val rank object to badge (display fix, not rank-chain); reduced icon size param to 48

### Verification
1. Open Dashboard with logged RL games — rank icon stays inside hero card.
2. Switch to Val with logged matches — no overlap into queue pills or stat grid.
3. Resize mobile/desktop — emblem remains contained.

---

## P1 — Rank baseline systems (already implemented)

Baseline setup **already exists** — not new work in this sprint:

| Feature | Location | Behavior |
|---------|----------|----------|
| Val rank + RR baseline | `js/rank-setup-ui.js`, `js/rank-baseline-store.js` | First sign-in modal: rank select + RR per Val queue |
| RL MMR baseline | Same modal | 1's / 2's / 3's MMR fields |
| First match start | `js/games/valorant/rank-chain.js` → `getStoredValorantBaseline` | Uses baseline when no prior match |
| RL first match | `js/games/rocketleague/rank-chain.js` → `getStoredRankBaseline` | Uses baseline MMR as start |

Modal shows when `needsRankSetup()` → no games yet and `rankBaselinesComplete` is false (`js/rank-baselines.js`).

### P1 verification (manual)
1. New account or clear `rankBaselinesComplete` in settings — modal appears on boot.
2. Set **Gold 2 / 47 RR** for Competitive — save.
3. Log first Val match — start rank should be Gold 2 · 47 RR; end rank applies +/− RR with promotion at 100.
4. Set RL **2's MMR 850** — first RL 2's log uses 850 as start MMR.

### P1 gap (not fixed this sprint)
Users with **existing broken chains** and `rankBaselinesComplete: true` will not see the modal again. Re-open via **Auto-Log Setup → rank baseline** if exposed, or reset baselines in settings. Say if you want a “Reset rank baseline” action in Setup.

---

## Remaining blockers

| Item | Status |
|------|--------|
| Valorant switch / refresh | Fixed — verify on device |
| Review pages stale after log | Fixed — verify on device |
| Squad silent failures | Hardened — verify Supabase RPC |
| Rank image overlap | Fixed — verify visually |
| P1 baseline for new users | Already built — smoke test |
| P1 baseline for existing bad data | Needs manual reset or follow-up |

---

## Files changed (this sprint)

- `js/game-ui.js`
- `js/app.js`
- `js/groups.js`
- `js/home.js` (minimal display fix for Val emblem data)
- `css/dashboard-v0.css`
- `docs/REGRESSION-RECOVERY-REPORT.md` (this file)

**Not changed:** rank-chain logic, Supabase schema, auto-log, routing IDs, Review/Squad business logic.

---

## Recommended next steps

1. Hard refresh (`Ctrl+F5`) and run P0 verification checklist above.
2. Confirm game switch in console produces **no** `ReferenceError`.
3. If Squad still fails, capture `[squad]` console error + Supabase RPC name for targeted fix.
4. Defer all v0 UI migration (Phase 2+) until P0 sign-off.
