# UI Migration Plan — v0 Design → Twans Ultimate Tracker SPA

**Scope:** Visual port only. No Next.js migration. No business-logic, Supabase, auth, auto-log, rank-chain, or routing changes.

**Design reference:** `app/`, `components/tracker/`, `app/globals.css` (v0 export — reference only, not shipped).

**Target stack:** `index.html` + `css/` + `js/` (vanilla ES modules, GitHub Pages).

---

## Phase 1 — Home / Dashboard ✅ (implemented)

| Area | Status | Notes |
|------|--------|-------|
| Home / Dashboard | ✅ | `dash-hero`, `dash-grid`, performance charts preserved |
| Sidebar navigation | ✅ | Desktop sidebar; mobile bottom nav unchanged |
| Hero section | ✅ | Glass card, rank emblem, stat grid |
| Stat cards | ✅ | MMR/RR, win rate, streak, session |
| Session panel | ✅ | `#dash-session-panel` replaces inline context line |

---

## Phase 2 — Match Logs, Review, Squad

| Page | Current | v0 target | Files | Risks |
|------|---------|-----------|-------|-------|
| **Match Logs** | `#page-log` table + full log form + filters | v0 card/table styling, filter pills | `index.html`, `css/`, `js/match-logs-ui.js`, `js/filters.js` | Table sort/filter hooks; dock integration |
| **Review (Focus)** | `#page-focus` insight cards | v0 section cards + typography | `js/focus.js`, `css/` | Tag correlation display unchanged |
| **Review (Analytics)** | `#page-analytics` stat grid + Chart.js | v0 performance grid + sparkline look | `js/analytics.js`, `js/charts.js`, `css/` | Many chart IDs; playlist tabs |
| **Review (Reports)** | `#page-reports` weekly grid | v0 card layout for weekly blocks | `js/reports-ui.js`, `css/` | Week navigation state |
| **Squad** | `#page-group` group UI | v0 squad list / detail panels | `js/groups.js`, `css/` | Async detail render; cache invalidation |

---

## Phase 3 — Analytics, Goals, Focus, Reports

| Page | Current | v0 target | Files | Risks |
|------|---------|-----------|-------|-------|
| **Analytics** | Overlaps Review analytics page | Unified v0 “Performance” patterns | Phase 2 carry-over | Duplicate styling if Phase 2 incomplete |
| **Goals** | `#goals-editor` on Reports page | v0 progress bars + goal cards | `js/goals.js`, `js/reports-ui.js` | Goal target from Supabase/local state |
| **Focus** | Home `#home-focus` + Focus page | Mission brief card styling | `js/home.js`, `js/focus.js` | Same insight source (`getTagLossCorrelations`) |
| **Reports** | Weekly report builder | Activity-feed style summaries | `js/reports.js`, `js/reports-ui.js` | Game-specific report fields |

---

## Global shell (Phase 1 partial)

| Area | Current | v0 target | Files | Risks |
|------|---------|-----------|-------|-------|
| **Top bar** | Orange-accent sticky bar | v0 glass topbar: brand mark, game pills, sync/profile | `index.html`, `css/v0-design-system.css`, `css/dashboard-v0.css` | Logo button `#logo-home-btn`; game switcher IDs |
| **Design tokens** | `:root` in `styles.css` | v0 oklch palette mapped to CSS vars | `css/v0-design-system.css` | Legacy pages still use old vars until phased |
| **Login** | `#login-screen` | Optional Phase 4 — match v0 dark theme | `css/` | OAuth callback overlay |

---

## Explicit non-goals

- No Next.js / React / Tailwind build step in production
- No Supabase schema or RLS changes
- No rank-chain or RR calculation changes
- No auto-log / bridge / launcher changes
- No new routes or page IDs

---

## Verification (Phase 1)

1. Sign in → Dashboard loads with sidebar + v0 hero
2. Switch RL ↔ Val → hero accent + stats update; charts swap
3. Start session → session panel shows live stats; dock unchanged
4. Log a game → activity feed updates; rank progress updates
5. Navigate via sidebar + mobile nav → same pages as before
6. GitHub Pages: no dependency on `public/` Next assets

---

## Reference file map (v0 → SPA)

| v0 component | SPA equivalent |
|--------------|----------------|
| `topbar.tsx` | `.v0-topbar` + existing `#game-switcher` |
| `hero.tsx` | `#dash-hero` via `renderDashHero()` |
| `rank-progress.tsx` | `#dash-rank-progress` |
| `quick-actions.tsx` | `#dash-quick-actions` |
| `performance.tsx` | `#dash-performance` + existing Chart.js canvases |
| `activity-feed.tsx` | `#dash-activity` + `renderHomeActivity()` |
