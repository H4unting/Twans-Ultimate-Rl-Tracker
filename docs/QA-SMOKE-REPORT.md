# QA Smoke Report — Priority #4

**Date:** June 8, 2026  
**Tester:** QA Lead (automated + limited browser)  
**Commit base:** `900b3d6` (local uncommitted changes on priorities 1–3)  
**Server:** `http://localhost:8080` via `node scripts/start-grind.mjs --val-only` (`BRIDGE_NO_BROWSER=1`)

---

## Summary

| Result | Count |
|--------|------:|
| **PASS** | 18 |
| **WARNING** | 5 |
| **FAIL** | 0 |
| **NOT RUN** | 42 |

**Verdict:** Automated / structural checks pass. **Not ready for priority #5 (`v1.0.0` tag)** until the manual smoke matrix (you + friend) completes and release prep items are done.

---

## 1. Static / automated checks

| Check | Status | Evidence |
|-------|:------:|----------|
| `node --check` on 13 priority JS files + `app.js` | **PASS** | All files: `profile-ui`, `home`, `game-ui`, `match-logs-ui`, `rank-setup-ui`, `ui`, `games/registry`, `valorant/*`, `app.js` |
| Relative import resolution after `rank-ladder.js` | **PASS** | All `./` imports in 13 files resolve to existing modules; 12 consumers of `rank-ladder.js` verified |
| `index.html` DOM IDs for `home.js` | **PASS** | `dash-hero`, `dash-quick-actions`, `dash-rank-progress`, `dash-session-panel`, `dash-perf-stats`, `dash-perf-mode-label`, `home-focus`, `home-activity`, `val-match-feed`, legacy sinks, `session-start-btn` — all present |
| `index.html` DOM IDs for `profile-ui.js` | **PASS** | Mount point `#profile-content` present; profile/delete IDs rendered by `renderProfilePage()` |
| `app.js` entry imports (priority modules) | **PASS** | Imports `home.js`, `profile-ui.js`, `game-ui.js`, `match-logs-ui.js`, `rank-setup-ui.js` without syntax errors |
| Nav tabs — no `[REVIEW]`/`[SQUAD]` debug `console.log` | **PASS** | `nav.js` clean; `groups.js` retains `console.warn` only when `#group-content` missing (defensive) |
| Auth sign-in structure | **PASS** | `#login-screen`, `#email-login-form`, `#google-signin-btn`, mode toggle, forgot-password wired in `index.html`; `app.js` imports `auth.js` handlers |
| Account deletion UI wiring | **PASS** | `profile-ui.js` → `onDeleteAccount` callback; `app.js:492` passes `handleDeleteAccount` → `deleteOwnAccount()` RPC |
| Bridge status banner code path | **PASS** | `#bridge-hint-banner` in HTML; `bridge-ui.js` + `game-ui.js` + `env.js` toggle/show logic |
| Val rank display consistency (code) | **PASS** | Hero (`formatRankDisplay`), rank progress (`RANK_LADDER`/`rankIndex`), profile (`formatRankDisplay`), match feed/logs (`formatRRDelta` → `formatRankDisplay`) all source from `rank-ladder.js` |
| Version / cache alignment (current tree) | **WARNING** | `version.json`, `version.js`, and `index.html ?v=` all use `20260602e` — aligned today, but **must bump cache** again when priorities 1–3 land (JS/CSS changed) |

---

## 2. Browser smoke (`localhost:8080`)

| Check | Status | Evidence |
|-------|:------:|----------|
| Local server start | **PASS** | `start-grind.mjs --val-only` listening on 8080; HTTP 200 for `/` |
| Page load (logged out) | **PASS** | Title "Twans Ultimate Tracker"; login form visible |
| Key DOM present at boot | **PASS** | CDP: `dashHero`, `profileContent`, `bridgeBanner`, `mainNav` all `true` |
| JS module HTTP delivery | **PASS** | `fetch` 200 for `js/home.js`, `js/profile-ui.js`, `js/games/valorant/rank-ladder.js`, `js/app.js` |
| Boot-time JS errors (logged out) | **PASS** | `window.__bootErrors` empty; `bodyClass`: `logged-out app-unified` |
| RL dashboard render (with data) | **NOT RUN** | Requires authenticated session + match data |
| Val dashboard render + rank UI | **NOT RUN** | Requires authenticated session + Val match data |
| Quick actions / session panel interaction | **NOT RUN** | Requires logged-in state |
| Profile card layout (live) | **NOT RUN** | Requires logged-in state |
| Match logs / Val RR formatting (live) | **NOT RUN** | Requires logged-in state + Val matches |
| Navigation tabs (Review, Squad) — live click | **NOT RUN** | Requires logged-in state; static analysis only |
| Auth flows (sign-up, Google, login, logout) | **NOT RUN** | No test credentials in QA session |
| Manual log / edit / delete | **NOT RUN** | Requires authenticated session |
| Auto-log / bridge end-to-end | **NOT RUN** | Requires gaming PC + BakkesMod / Henrik key |
| Desktop `.bat` launchers | **NOT RUN** | Out of scope for this automated pass |
| GitHub Pages / `push-updates.bat` | **NOT RUN** | Pre-tag step |

**Manual launch note:** For full smoke, run `Rocket League Tracker.bat` or `Valorant Tracker.bat` on the gaming PC (or `node scripts/start-grind.mjs` with bridge). Browser automation confirmed the app shell loads when the server is up.

---

## 3. RELEASE-CHECKLIST matrix

### Prep

| Item | Status | Notes |
|------|:------:|-------|
| `version.json` bumped to `app: 1.0.0` | **NOT RUN** | Still `1.0.0-rc1` |
| `node scripts/sync-version.mjs` | **NOT RUN** | Required at tag time |
| `js/core/version.js` matches `version.json` | **PASS** | Both `1.0.0-rc1` / cache `20260602e` |
| Feature freeze | **PASS** | No new features in smoke pass |

### Authentication

| Test | Status |
|------|:------:|
| Email sign-up | **NOT RUN** |
| Google sign-up | **NOT RUN** |
| Email login | **NOT RUN** |
| Google login | **NOT RUN** |
| Logout → login screen | **NOT RUN** |
| Password reset email | **NOT RUN** |
| Existing user login (data loads) | **NOT RUN** |
| Auth UI structure | **PASS** |

### Rocket League

| Test | Status |
|------|:------:|
| First-run rank setup | **NOT RUN** |
| Manual log from dock | **NOT RUN** |
| Auto-log on match end | **NOT RUN** |
| Post-match card → confirm MMR | **NOT RUN** |
| Edit / delete match | **NOT RUN** |
| Session start / end | **NOT RUN** |
| Goals / Focus / Reports pages | **NOT RUN** |
| Rank chain repair | **NOT RUN** |
| Game switcher → RL dashboard | **NOT RUN** |

### Valorant

| Test | Status |
|------|:------:|
| First-run rank setup (Competitive RR) | **NOT RUN** |
| Manual log (K/D/A, RR) | **NOT RUN** |
| Auto-log (Henrik key) | **NOT RUN** |
| RR updates across logs | **NOT RUN** |
| Edit / delete match | **NOT RUN** |
| Rank chain repair | **NOT RUN** |
| Goals / Reports / Focus | **NOT RUN** |
| Swiftplay no RR in rank setup | **NOT RUN** |
| Val rank UX (priorities 1–3 code) | **PASS** | Unified `formatRankDisplay` / `formatRRDelta` paths verified in code |

### Database / account types

| Scenario | Status |
|----------|:------:|
| Fresh / existing / empty / large account | **NOT RUN** |
| Squads page (no RLS recursion) | **NOT RUN** |
| `v1-full-setup.sql` on new project | **N/A** | Live project already applied (per `V1-OPERATOR-CHECKLIST`) |

### Desktop (gaming PC)

| Test | Status |
|------|:------:|
| RL / Val `.bat` launchers | **NOT RUN** |
| Bridge connect | **NOT RUN** |
| Tray app | **NOT RUN** |
| Auto-log toggle / sync indicator | **NOT RUN** |

### Deployment

| Test | Status |
|------|:------:|
| `push-updates.bat` | **NOT RUN** |
| GitHub Pages post-deploy | **NOT RUN** |
| Cache bust on live URL | **NOT RUN** |
| Supabase on live URL | **NOT RUN** |

### V1 operator checklist (subset)

| Item | Status |
|------|:------:|
| Sign in (Google + email) | **NOT RUN** |
| RL / Val manual log → edit → delete | **NOT RUN** |
| RL / Val auto-log E2E | **NOT RUN** |
| Squad create / join / view stats | **NOT RUN** |
| Account deletion (type `DELETE`) | **NOT RUN** | Wiring **PASS** in code |
| GitHub Pages manual-log banner | **NOT RUN** |
| Settings load error toast | **NOT RUN** |
| Leaked-password protection (Supabase dashboard) | **WARNING** | Still disabled per operator checklist |

---

## 4. Blockers for v1.0.0 ship (priority #5)

| # | Area | Severity | Status |
|---|------|----------|--------|
| 1 | **Manual smoke matrix incomplete** — RELEASE-CHECKLIST requires you + friend on localhost:8080 | **blocker** | Open |
| 2 | **Version bump** — `app` → `1.0.0`, cache bump + `sync-version.mjs` before tag | **blocker** | Open |
| 3 | **Operator sign-off** — `RELEASE-RISKS.md`, `V1-ACCEPTED-RISKS.md`, Supabase auth dashboard toggles | **blocker** | Open |
| 4 | Leaked-password protection (Supabase Auth setting) | **major** | Open — dashboard toggle |
| 5 | No automated regression suite | **major** | Accepted risk (documented) |

**No code FAIL items** from priorities 1–3 smoke pass. No trivial import/syntax blockers found.

---

## 5. Recommended fixes (FAIL items only)

*None — zero FAIL results.*

### Warnings (release prep, not code changes in this pass)

1. **Before tag:** Bump `version.json` (`app: 1.0.0`, new `cache` token) and run `node scripts/sync-version.mjs`.
2. **Before tag:** Complete manual smoke per `RELEASE-CHECKLIST.md` (you + friend).
3. **Before tag:** Enable leaked-password protection in Supabase Auth (SEC-M4).
4. **At deploy:** Re-bump cache after committing priorities 1–3 JS/CSS changes.

---

## 6. Ready for priority #5?

**No.** Automated smoke is green; ship gate is **blocked** on manual matrix, version bump, and release sign-off. Proceed to Release Manager (#5) only after manual checklist rows are PASS.

---

**Next actions for human tester**

1. Commit or stash priorities 1–3, then run full manual matrix on `localhost:8080`.
2. Record PASS/FAIL in this doc or a follow-up pass.
3. Hand off to Release Manager for tag once all blockers are cleared.
