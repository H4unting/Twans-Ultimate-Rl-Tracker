# Codebase Audit — Phase 1 Inventory

**Product:** Twans Ultimate Tracker  
**Audit date:** June 7, 2026  
**Scope:** Full repository scan — `index.html`, `js/**`, `css/**`, `scripts/**`, `integrations/**`, `legal/**`, `docs/**`, `config/**`, `app/` (Next scaffold), `components/`, `tools/launcher/`  
**Method:** Static file inventory, import graph tracing, route mapping from `js/nav.js` / `js/app.js` / game modules. **No code modified.**

---

## Executive summary

Twans Ultimate Tracker is a **vanilla ES-module SPA** (`index.html` → `js/app.js`) with a **parallel Next.js 16 scaffold** (`app/page.tsx`, `components/tracker/*`) that is **not** the production runtime. Daily use is served by `scripts/start-grind.mjs` on `localhost:8080`, with optional desktop bridge on port `49200`. The codebase is **~210 tracked files** (excluding `node_modules`, `.git`, `.next`), organized around a multi-game registry (`js/games/registry.js`) for Rocket League and Valorant.

---

## File counts by type

| Extension / category | Count | Notes |
|---------------------|------:|-------|
| `.js` (app + bridge + Overwolf) | 86 | Primary application logic |
| `.css` | 7 | 6 vanilla + `app/globals.css` (Next) |
| `.tsx` / `.ts` | ~15 | Next scaffold only |
| `.sql` | 14 | `docs/supabase/` — operator-run migrations |
| `.html` | 5 | `index.html`, `legal/*`, Overwolf background |
| `.mjs` | 8 | Bridge, launcher, setup scripts |
| `.bat` | 10 | Windows launchers |
| `.json` | ~12 | Config, manifests, lockfiles |
| Images / assets (`public/`, `integrations/`) | ~12 | Placeholders, icons |
| Docs (`.md`) | 40+ | Release, setup, prior audits |
| **Total (approx.)** | **~210** | Per workspace glob excluding deps |

**Dual-stack note:** Production = vanilla SPA. Next.js (`package.json` scripts `dev`/`build`) is a **UI migration scaffold** documented in `docs/UI-MIGRATION-PLAN.md` — not loaded by `index.html`.

**No `js/js/` duplicate directory** found. Compatibility shims exist: `js/state.js` → `js/core/state.js`, `js/games.js` → `js/games/registry.js`.

---

## Module map

### Entry & orchestration

| Module | Role |
|--------|------|
| `index.html` | Shell DOM, page containers, modals, script entry `js/app.js` |
| `js/app.js` | Auth gate, navigation, render orchestration, bridge wiring, game logging |
| `js/boot.js` | Post-auth data load, chain repair, ghost/dupe cleanup, rank setup |
| `js/nav.js` | Sidebar + mobile nav; section routing (home / review / squad) |
| `js/ui.js` | Shared DOM renderers, toasts, sync indicator, match log table |
| `js/core/state.js` | Central `state` object + `subscribe` / `notify` |
| `js/core/dom-safe.js` | `escapeHtml`, `escapeAttr`, `sanitizeImageUrl` |
| `js/core/error-log.js` | Global error handlers |
| `js/core/modal-a11y.js` | Focus trap for modals |
| `js/core/logging-session.js` | Session number helpers |
| `js/core/dates.js` | Date parsing/formatting |
| `js/core/version.js` | Version display |
| `js/core/app-config.js` | Supabase URL/key, legal contact, tracker URL |

### Auth & persistence

| Module | Role |
|--------|------|
| `js/auth.js` | Supabase Auth (Google OAuth PKCE, email/password), session tokens |
| `js/supabase.js` | REST CRUD: profiles, matches, settings, groups RPC, avatar upload, account delete |
| `js/matches.js` | Match CRUD facade; `persistChain` serializes saves |
| `js/config.js` | Re-exports from `core/app-config.js` + tag colors |

### Game registry (multi-game isolation)

| Path | Role |
|------|------|
| `js/games/registry.js` | `GAME_IDS`, `getGameModule`, nav/page copy per game |
| `js/games/router.js` | `routeActiveGame`, `getActiveGameModule` |
| `js/games/rocketleague/*` | RL normalize, rank chain, tags, insights, reports, stats |
| `js/games/valorant/*` | Val normalize, rank ladder, Henrik field mapping, tags, insights |

### Feature modules

| Module | Role |
|--------|------|
| `js/home.js` | Dashboard hero, session panel, activity feed, charts hookup |
| `js/quicklog.js` | Quick dock state, prefs (`rl-grind-prefs`), auto-log toggles |
| `js/sessions.js` | Session timer, localStorage persistence, session modal |
| `js/sessions-ui.js` | Session history page |
| `js/goals.js` | Goals normalization + progress |
| `js/focus.js` | Focus page from tag mistakes |
| `js/analytics.js` | Insights, trends, coach report |
| `js/reports-ui.js` / `js/reports.js` | Weekly reports + goals editor |
| `js/groups.js` | Squad create/join/leave, member stats |
| `js/profile-ui.js` | Profile editor, avatar, account deletion |
| `js/setup-wizard.js` | Auto-log setup wizard |
| `js/match-logs-ui.js` | Quick filters, log page helpers |
| `js/export.js` | CSV export |
| `js/charts.js` | Chart.js lifecycle (`destroyChart` before recreate) |
| `js/filters.js` | Date/session/tag filters |
| `js/rank-baselines.js` / `js/rank-baseline-store.js` | Rank baseline storage |
| `js/rank-setup-ui.js` | First-run rank modal |
| `js/post-match.js` | Post-match confirm card (MMR/tags/undo) |
| `js/game-ui.js` | Game switcher, page copy, edit modal sync |
| `js/dock-ui.js` | Dock collapse, mode pills |
| `js/insights.js` | Tilt detection (shared) |

### Auto-log & bridge

| Module | Role |
|--------|------|
| `js/bridge-client.js` | Heartbeat, `bridgeFetch`, auth token, online/reachable state |
| `js/bridge-ui.js` | Status badges, cached Val status |
| `js/rl-live.js` | RL Stats API polling via bridge |
| `js/valorant-live.js` | Val Henrik/Overwolf polling, `armValorantPolling` |
| `js/auto-log-handlers.js` | `handleAutoLog`, `handleValorantAutoLog` |
| `js/auto-log-prefs.js` | Auto-log sound/toggle prefs |
| `scripts/start-grind.mjs` | HTTP server :8080, static files, `/api/bridge` proxy |
| `scripts/rl-bridge.mjs` | RL bridge :49200 |
| `scripts/valorant-bridge.mjs` | Val bridge endpoints |
| `scripts/bridge-security.mjs` | Rate limit, `X-Bridge-Token` |
| `scripts/local-setup.mjs` | `grind-config.json` loader |
| `integrations/overwolf/` | Optional Overwolf Valorant extension (dev path) |
| `tools/launcher/` | Tray app build (`Twans Auto-Log.exe`) |

### QA (dev-only)

| Module | Role |
|--------|------|
| `js/qa/qa-gate.js` | URL param / shortcut to enable QA |
| `js/qa/qa-panel.js` | In-app QA tools panel |
| `js/qa/qa-generators.js` | Test data generators |
| `js/qa/qa-export.js` | QA export helpers |
| `js/qa/qa-constants.js` | QA constants |

### Next.js scaffold (non-production)

| Path | Role |
|------|------|
| `app/page.tsx` | Renders `components/tracker/dashboard` |
| `components/tracker/*` | v0-style React dashboard components |
| `lib/tracker-data.ts` | Mock/static data for Next demo |

---

## Dependency map

```
index.html
  └── js/app.js (ESM entry)
        ├── js/env.js, js/boot.js, js/auth.js, js/supabase.js
        ├── js/state.js → js/core/state.js
        ├── js/games.js → js/games/registry.js
        │     ├── js/games/rocketleague/index.js
        │     └── js/games/valorant/index.js
        ├── js/matches.js → js/supabase.js, js/games/router.js
        ├── js/nav.js → js/games.js
        ├── js/bridge-client.js ← scripts/start-grind.mjs (/api/bridge)
        ├── js/rl-live.js, js/valorant-live.js → bridge-client
        ├── js/auto-log-handlers.js → quicklog, sessions, matches
        └── js/charts.js → Chart.js (CDN defer in index.html)

External runtime deps (browser):
  - @supabase/supabase-js (CDN ESM, fallbacks in auth.js)
  - Chart.js 4.4.1 (cdnjs)

External runtime deps (Node launcher):
  - Node built-ins only (http, fs, crypto) in scripts/*.mjs
  - Henrik / Riot keys from config/grind-config.json (gitignored)

package.json (Next scaffold only):
  - next 16, react 19, tailwind 4, shadcn, lucide-react
```

**Circular dependencies:** None detected at module import level. Game modules do not import `app.js`. `matches.js` dynamically imports `sessions.js` for UI refresh (async, not circular at load time).

---

## Route map

Navigation is **client-side** — no URL router. `state.activePage` + `showPage()` toggle `.page` visibility.

### Top-level nav (`js/nav.js` → `TOP_NAV_ORDER`)

| Nav item | Type | Default target | DOM `#page-*` |
|----------|------|----------------|---------------|
| Dashboard | page | `dashboard` | `#page-dashboard` |
| Match Logs | page | `log` | `#page-log` |
| Sessions | page | `sessions` | `#page-sessions` |
| Review | section | `focus` (first review page) | sub-nav pills |
| Squad | section | `group` | `#page-group` |
| Auto Setup | page | `setup` | `#page-setup` |
| Profile | top bar button | `profile` | `#page-profile` |

### Review sub-pages (`js/games/*/meta.js` → `NAV.review`)

| Page ID | RL label | Val label | Container |
|---------|----------|-----------|-----------|
| `focus` | Focus | Focus | `#page-focus` / `#focus-content` |
| `analytics` | Analytics | Analytics | `#page-analytics` |
| `reports` | Reports | Reports | `#page-reports` |

### Game-specific labels

RL and Val share the same page IDs; copy differs via `PAGE_COPY` in each game's `meta.js`. Game switcher in `js/game-ui.js` sets `state.activeGame` and re-renders.

### Keyboard shortcuts (`js/app.js`)

| Key | Action |
|-----|--------|
| `L` | Navigate to Match Logs, focus end rank |
| `S` | Click session start |
| `F` | Navigate to Focus |

### Global hooks (window)

`__endSession`, `__refreshHome`, `__navigate`, `showPage`, `startNextSession`, `goToDashboardFromSession`, `__saveRankBaselines` (boot).

---

## State flow map

```
┌─────────────┐     onAuthChange      ┌──────────────┐
│  js/auth.js │ ────────────────────► │  js/boot.js  │
│  session    │                       │  loadUserData│
└─────────────┘                       └──────┬───────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    ▼                        ▼                        ▼
            setProfile()              setGames()               setGoals()
            js/core/state.js          matches[]                user_settings
                    │                        │
                    │         subscribe()    │
                    ▼                        ▼
            renderAll() / renderActivePageContent()  (js/app.js)
                    │
        ┌───────────┼───────────┬──────────────┐
        ▼           ▼           ▼              ▼
   home.js    match-logs    analytics    groups.js ...
```

**UI-local state** (not in `state` object): login form mode, bridge online flags, chart instances (`charts.js`), QA panel, edit modal tags (`state.ui`).

**Sync status:** `connecting` → `live` / `saving` / `error` via `setSyncStatus()` in `js/supabase.js`, reflected in `#sync-dot`.

---

## Data flow map

### Read path (boot)

1. `initAuth()` → JWT in memory (`js/auth.js`)
2. `loadUserData()` (`js/supabase.js`):
   - `profiles` → `setProfile`
   - `matches?user_id=eq.{id}` → normalize → `setGames`
   - `user_settings` → goals, riot ID, rank baselines, active game
   - `group_members` join → `state.groups`
3. `boot.js` repairs RL `repairPlaylistMMRChain` and Val `repairRankChain`; may write back if drift
4. Ghost/duplicate Val cleanup (`purgeGhostValorantMatches`, `collapseDuplicateValorantMatchesInState`)

### Write path (log/edit/delete)

1. User action → `addGame` / `updateGame` / `deleteGame` (`js/matches.js`)
2. Game module `buildGameFromForm` / `buildGameUpdate` (`js/games/*/matches.js`)
3. `persistActiveGames` → `saveGames(merged, activeGame)` (`js/supabase.js`)
4. Upsert `matches?on_conflict=user_id,game,match_num` + delete orphans
5. On success: `setGames(merged)`; on failure: toast + `syncStatus: error`

### Settings path

Profile save → `saveSettings` (JSONB `user_settings.data`) + `saveProfile` (profiles columns) + optional `uploadProfileAvatar` (Storage or inline data URL).

---

## Supabase interaction map

| Client function | HTTP / RPC | Tables / storage |
|-----------------|------------|------------------|
| `loadProfile` | GET/PATCH `profiles` | `profiles` |
| `loadGames` | GET `matches` | `matches` |
| `saveGames` | POST upsert + DELETE orphans | `matches` |
| `loadSettings` / `saveSettings` | GET/POST `user_settings` | `user_settings` |
| `loadUserGroups` | GET `group_members` + embed `groups` | `group_members`, `groups` |
| `createGroup` | RPC `create_grind_squad` | `groups`, `group_members` |
| `joinGroup` | RPC `join_grind_squad` | `group_members` |
| `leaveGroup` | RPC `leave_grind_squad` | `group_members` |
| `loadGroupMembers` | GET join `profiles` | `group_members`, `profiles` |
| `loadMemberGames` | GET `matches` by `user_id` | `matches` (squad view) |
| `uploadProfileAvatar` | POST Storage `avatars/{uid}/avatar.*` | `avatars` bucket |
| `deleteOwnAccount` | RPC `delete_own_account` | auth + cascade |
| `ensureFounderUid` | RPC `claim_founder_uid` | `profiles.profile_number` |

**Operator requirement:** SQL in `docs/supabase/v1-full-setup.sql` (and optionally `harden-public-access.sql`, `delete-own-account.sql`) must be run manually in Supabase SQL Editor. App detects missing schema via PostgREST error messages in `boot.js`.

**Legacy path:** `syncGameSliceLegacy` delete-all-then-insert if upsert index missing (`js/supabase.js:218–251`).

---

## Auto-log interaction map

```
Game (RL / Val)
    │
    ▼
scripts/rl-bridge.mjs or valorant-bridge.mjs (:49200)
    │  RL: BakkesMod / Stats API
    │  Val: Henrik API (+ optional Overwolf integrations/overwolf/)
    ▼
scripts/start-grind.mjs
    │  Serves index.html :8080
    │  Proxies /api/bridge → :49200 (X-Bridge-Token)
    ▼
js/bridge-client.js (heartbeat /status)
    ├── js/rl-live.js → poll /rl/* → handleAutoLog (RL)
    └── js/valorant-live.js → poll /valorant/* → handleValorantAutoLog (Val)
              │
              ▼
        js/auto-log-handlers.js → submitGameLog('auto') → js/matches.js → Supabase
```

**Arming:** Val requires `POST /valorant/arm` when bridge up (`valorant-live.js:armValorantPolling`). RL polls when bridge online and auto-log enabled.

**Consume:** After log, `POST /valorant/last-match/consume` or RL equivalent prevents double-log.

**GitHub Pages:** `js/env.js:needsLocalTrackerForAutoLog()` — auto-log **unavailable** on static hosting; manual logging + cloud sync still work.

---

## Dead / duplicate / unused inventory (document only)

### Likely dead code

| Item | Evidence | Risk if removed |
|------|----------|-----------------|
| `renderWelcomeHeader()` in `js/ui.js:204` | Targets `#welcome-header` — **not present** in `index.html` | LOW — never called in grep of codebase |
| `isGlanceMode()` / `isGrindHost()` in `js/env.js` | Marked `@deprecated`; only `applyAppMode` used | LOW |
| `js/games/rocketleague/index.js` `onLoad()` | Empty stub | LOW |
| Next.js `app/` + `components/tracker/*` | Not referenced by production `index.html` | MEDIUM — migration scaffold |

### Legacy DOM sinks (intentional)

| Element | Location | Purpose |
|---------|----------|---------|
| `#home-summary`, `#val-dashboard` | `index.html` sr-only | Cleared/populated by `js/home.js` for backward compat |
| `#welcome-header` | Missing from HTML | Orphaned renderer in `ui.js` |

### Duplicate / parallel implementations

| Area | Files | Notes |
|------|-------|-------|
| State export | `js/state.js`, `js/core/state.js` | Shim re-export (intentional) |
| Games export | `js/games.js`, `js/games/registry.js` | Shim re-export |
| Config | `js/config.js`, `js/core/app-config.js` | `config.js` adds tag colors |
| Dashboard UI | `js/home.js` (production) vs `components/tracker/dashboard.tsx` | Dual stack |
| Reports | `js/reports.js` + per-game `reports.js` | Game-specific weekly builders — not duplicate |

### Unused CSS (candidates)

| Stylesheet | Unused selectors (candidates) |
|------------|------------------------------|
| `css/styles.css` | `.home-summary-*` — element is sr-only; v0 dashboard uses `#dash-*` |
| `css/valorant-theme.css` | `.val-dashboard` display rules — container sr-only |
| `app/globals.css` | Entire file — Next scaffold only |

### Unused assets (candidates)

| Asset | Notes |
|-------|-------|
| `public/placeholder*.png/svg/jpg` | Next scaffold placeholders |
| `public/avatar-gamer.png` | Verify usage — may be Next-only |

### Unused functions (candidates — verify before cleanup)

| Function | File | Notes |
|----------|------|-------|
| `renderWelcomeHeader` | `js/ui.js` | No DOM target |
| `isGlanceMode` / `isGrindHost` | `js/env.js` | Deprecated, no callers found |

---

## Findings vs recommendations

### Findings

1. Production runtime is a single vanilla SPA; Next.js is an inactive parallel scaffold.
2. Multi-game architecture is clean — RL and Val modules share router/registry without cross-imports.
3. Bridge + auto-log are tightly coupled to `localhost:8080` launcher workflow.
4. Supabase schema is versioned as SQL files requiring **manual operator execution**.
5. Several legacy DOM/CSS artifacts remain from UI migration to v0 dashboard.

### Recommendations (not executed)

1. Document in README that `npm run dev` starts Next demo, not the tracker.
2. Add `CODEBASE-AUDIT` cross-link in `docs/STRUCTURE.md` for onboarding.
3. Track dead `welcome-header` renderer in `CLEANUP-PLAN.md` for safe removal in v1.0.1.

---

*Phase 1 complete. No files deleted or modified.*
