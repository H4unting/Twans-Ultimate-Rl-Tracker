# Production Readiness Report

**App:** Twans Ultimate Tracker  
**Version:** 1.0.0-rc1 (`version.json`)  
**Audit date:** 2026-06-02  
**Scope:** Full-stack audit — static SPA + local bridge + Supabase backend  

This document records current production readiness by area. It is based on codebase review, existing docs (`RELEASE-RISKS.md`, `AUDIT-REPORT.md`, `STABILITY-REPORT.md`), and targeted fixes applied during this audit.

---

## Summary

| Area | Verdict |
|------|---------|
| 1. Frontend | **WARNING** |
| 2. Database | **WARNING** |
| 3. Authentication | **PASS** |
| 4. Version control | **WARNING** |
| 5. APIs | **WARNING** |
| 6. Hosting / deployment | **WARNING** |
| 7. Security | **WARNING** |
| 8. Rate limiting | **PASS** |
| 9. Caching | **WARNING** |
| 10. Error tracking | **WARNING** |

**Production Readiness Score: 72 / 100**

Suitable for **personal / small-audience v1.0-rc1** with documented caveats. Not yet a **PASS** across all areas for wide public release.

---

## 1. Frontend

**Verdict: WARNING**

### Structure

| Layer | Location | Notes |
|-------|----------|-------|
| Shell | `index.html` (~494 lines) | Single-page app, one ES module entry |
| CSS | `css/styles.css`, `css/valorant-theme.css`, `css/layout-polish.css` | Game-themed split; `styles.css` is ~3,074 lines |
| JS | `js/app.js` → ~70 modules | `core/`, `games/`, feature modules, optional `qa/` |

**PASS:** Clear module boundaries, game registry pattern, no bundler dependency for GitHub Pages.

### Issues

| Issue | Severity | Detail |
|-------|----------|--------|
| CSS monolith | Medium | `css/styles.css` should be split over time (nav, log, profile, dock) — not blocking |
| Duplicate helpers | Low | `getLastModeForGame` pattern repeated in `quicklog.js`, `dock-ui.js`, `sessions.js` |
| Orphan constants | Low | `js/core/version.js` rarely imported at runtime |
| Notes XSS | **Fixed in audit** | `js/ui.js` now escapes match notes via `js/core/dom-safe.js` |
| CDN Chart.js | Low | No SRI on `index.html` Chart.js script |
| `.sr-only` unused | Low | Defined in CSS but not applied to mobile nav labels |

### Mobile & accessibility

**PASS (baseline):** Breakpoints at 768px / 400px, mobile bottom nav, table horizontal scroll, `prefers-reduced-motion`, modal focus trap (`js/core/modal-a11y.js`), `aria-label` on nav.

**WARNING gaps:** Loading overlay lacks `aria-live`; session modal uses inline `onclick`; emoji-only mobile nav labels.

### Performance

**WARNING:** No minification; all ES modules load individually. Entry-point cache bust only (`?v=` on `app.js` + CSS). Acceptable for current scale.

---

## 2. Database

**Verdict: WARNING**

### Schema source

No Supabase CLI migrations folder. Canonical SQL: **`docs/supabase/v1-full-setup.sql`** (manual apply in Supabase SQL editor).

### Tables & features

| Table / feature | RLS | Notes |
|-----------------|-----|-------|
| `matches` | Yes | Upsert via `(user_id, game, match_num)` — requires index in `sync-matches.sql` |
| `profiles` | Yes | Avatar URL, display name, colors |
| `user_settings` | Yes | Goals, riot ID, rank baselines JSON |
| `groups` / `group_members` | Yes | Squad RPCs: create/join/leave |
| `storage.objects` (avatars) | Yes | Own-folder upload only |
| `app_settings` (legacy) | **Open** | World-writable if table still exists — drop or lock down |

### Performance & integrity

**PASS:** Indexed upsert path when `v1-full-setup.sql` applied.

**WARNING:**

- Legacy fallback in `js/supabase.js` — `syncGameSliceLegacy()` deletes all matches for user+game then re-inserts on upsert failure (data-loss risk).
- `loadSettings()` / `loadUserGroups()` fail silently to defaults (now logs via `error-log.js`).
- JSON blobs in `user_settings.data` — acceptable for v1; normalize later if settings grow.

### Pre-release gate

Confirm production Supabase has **`docs/supabase/v1-full-setup.sql`** applied and console does **not** show upsert fallback warnings.

---

## 3. Authentication

**Verdict: PASS**

| Check | Status |
|-------|--------|
| Google OAuth | Works via Supabase (`js/auth.js`) |
| Email sign-in / sign-up / reset | Implemented |
| Session persistence | `persistSession`, `autoRefreshToken` |
| Token on REST | `Authorization: Bearer` in `js/supabase.js` |
| Sign-out cleanup | Bridge heartbeat stopped, boot state reset |
| CRUD gate | `requireSignedIn()` on match mutations |
| Expired session | Supabase client refresh; boot re-runs on auth change |

**Warnings (accepted for v1):**

- OAuth implicit flow — tokens briefly in URL hash (`js/auth.js`).
- CDN dependency for `@supabase/supabase-js` — blocked CDN breaks boot.
- Sign-out race — in-flight save may error (`RELEASE-RISKS.md` R-M6).

Pages fail safely: unsigned users see login screen; data loads only after `bootApp()` succeeds.

---

## 4. Version Control

**Verdict: WARNING**

### `.gitignore`

**PASS:** Secrets gitignored — `config/grind-config.json`, `.env`, `qa.local.js`, bridge state, logs, launcher `node_modules/` / `dist/`.

**Gaps:** No `.DS_Store` / `Thumbs.db`; deploy lives in separate GitHub clone (OneDrive path).

### Release workflow

```
version.json  →  scripts/sync-version.mjs  →  index.html ?v=
                                              →  js/core/version.js (fixed in audit)
push-updates.bat  →  copy to GitHub clone  →  git commit  →  git push main
```

| File | Role |
|------|------|
| `version.json` | `app`, `bridge`, `cache`, `minDb` |
| `scripts/sync-version.mjs` | Syncs cache token to HTML + `version.js` |
| `push-updates.bat` | Manual deploy to `Twans-Ultimate-Rl-Tracker` repo |

**WARNING:**

- Hardcoded `REPO=` path in `push-updates.bat` (machine-specific).
- Dev workspace may not be the git root — drift risk between folders.
- No GitHub Actions CI/CD.

**Recommended workflow:**

1. Bump `version.json` `cache` when **any** JS/CSS changes.
2. Run `node scripts/sync-version.mjs`.
3. Smoke test locally on `:8080`.
4. Run `push-updates.bat`.
5. Hard refresh GitHub Pages (`Ctrl+Shift+R`).

---

## 5. APIs

**Verdict: WARNING**

### Rocket League (BakkesMod Stats API)

| Aspect | Status |
|--------|--------|
| Transport | TCP `127.0.0.1:49123` → HTTP bridge `:49200` |
| Setup | `DefaultStatsAPI.ini` patched by `scripts/local-setup.mjs` |
| Offline | Reconnect every 15s; user can manual log |
| Malformed data | JSON slice parser tolerates partial TCP chunks |

### Valorant (Henrik API + Overwolf)

| Aspect | Status |
|--------|--------|
| Henrik | Poll via `scripts/valorant-bridge.mjs`; RGAPI keys rejected |
| Errors | User-facing messages for 401/403/404/429 |
| Overwolf | Schema-validated POST; duplicate `matchId` guard |
| Offline | Bridge status UI; manual log always available |

### Local bridge security (recent hardening)

**PASS:** `scripts/bridge-security.mjs` — rate limits, CORS allowlist, body size cap, input validation, `X-Bridge-Token` on mutating POSTs, proxy path allowlist.

**WARNING:** GitHub Pages users have no bridge — auto-log unavailable (by design).

---

## 6. Hosting / Deployment

**Verdict: WARNING**

| Check | Status |
|-------|--------|
| GitHub Pages URL | `https://h4unting.github.io/Twans-Ultimate-Rl-Tracker/` |
| Deploy method | Manual `push-updates.bat` only |
| `.nojekyll` | **Added in audit** — ensures `_` paths work on Pages |
| CI/CD | None |
| Secrets in deploy | Excluded — only `example.grind-config.json` copied |

**Recovery:** Re-run `push-updates.bat` or revert commit on GitHub clone. No automated rollback.

---

## 7. Security

**Verdict: WARNING** (improved during audit; no open Critical)

### Severity list

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| S-H1 | **High** | Match notes XSS in log table | **Fixed** — `escapeHtml` in `js/ui.js` |
| S-H2 | **High** | Squad member name/avatar XSS | **Fixed** — `js/groups.js` + `dom-safe.js` |
| S-H3 | **High** | Legacy delete-all Supabase save fallback | Open — monitor upsert path |
| S-H4 | **High** | `app_settings` open RLS if legacy table exists | Open — verify prod DB |
| S-M1 | Medium | Henrik key plaintext in `config/grind-config.json` | Mitigated — prefer `.env` (`HENRIK_API_KEY`) |
| S-M2 | Medium | OAuth implicit flow (hash tokens) | Accepted v1 |
| S-M3 | Medium | Overwolf POST optional token | Set `OVERWOLF_BRIDGE_TOKEN` for extra protection |
| S-M4 | Medium | Bridge auth token in `/status` for localhost | Required for client POSTs |
| S-M5 | Medium | CSV export formula injection | Open |
| S-M6 | Medium | Multi-tab last-write-wins on saves | Documented |
| S-M7 | Medium | `sbFetch` JSON parse on error HTML | Open |
| S-L1 | Low | `localStorage` quota throws uncaught | Open |
| S-L2 | Low | Supabase anon key in client | Expected — RLS must enforce |
| S-L3 | Low | QA dev gate localhost only | OK |

### Client-side trust

- All match/profile data treated as user-controlled — escape on render.
- Bridge binds `127.0.0.1` only; never expose Henrik keys to Supabase.

---

## 8. Rate Limiting

**Verdict: PASS**

| Layer | Implementation |
|-------|----------------|
| Bridge inbound | Per-route limits, 429 + `Retry-After` (`bridge-security.mjs`) |
| Tracker proxy | Same limits on `/api/bridge/*` |
| Henrik outbound | 45 calls/min cap |
| Body size | 32 KiB max JSON |
| Client duplicate guards | `autoLogInFlight`, `persistChain`, button disable on log/edit/setup |
| Auto-log dedupe | `matchId` in notes, bridge `consumed` flag |

**Gaps:** No client-side Supabase rate limit; multi-tab not coordinated.

---

## 9. Caching

**Verdict: WARNING**

| Mechanism | Status |
|-----------|--------|
| `version.json` → `?v=` on CSS + `app.js` | Works |
| `sync-version.mjs` → `version.js` | **Fixed in audit** |
| ES module subgraph | **Not busted** — child imports load without `?v=` |
| `index.html` document | No query param — users may need hard refresh after deploy |
| Static asset headers | `no-store` on HTML/JS/CSS from `:8080` |
| Chart.js CDN | Pinned URL, no app-controlled bust |

**Mitigation:** Bump `cache` on every JS change; tell users to hard refresh after deploy. Long-term: import-map build step or service worker.

---

## 10. Error Tracking

**Verdict: WARNING** (improved during audit)

### Before audit

- ~39 silent `catch {}` patterns
- 12 `console.error` calls
- No global handlers

### Implemented (lightweight)

| Item | File |
|------|------|
| Central error ring buffer | `js/core/error-log.js` |
| Global `error` + `unhandledrejection` | `js/app.js` `init()` |
| Settings load logging | `js/supabase.js` |

**Usage:**

```javascript
import { logError, getErrorLog } from './core/error-log.js';
logError('myFeature', err, { toast: true, userMsg: 'Something failed' });
```

**QA:** Call `getErrorLog()` from browser console or wire into QA panel later.

**Remaining gaps:** Background bridge poll failures still mostly silent (by UX choice); no persistent server-side error table.

---

## Final Report

### Production Readiness Score: **72 / 100**

Scoring weights: Security & data integrity (30%), deploy/cache (20%), UX resilience (20%), code health (15%), observability (15%).

---

### Release Blockers

None for **personal v1.0-rc1** if Supabase SQL is applied and deploy smoke test passes.

For **wide public v1.0**, treat as blockers:

1. Confirm `v1-full-setup.sql` on prod + upsert path active  
2. Remove or lock `app_settings` legacy table  
3. Verify XSS fixes deployed (notes + squad)  
4. Hard refresh / cache bump after every release  

---

### MUST FIX BEFORE V1.0

| Item | Area |
|------|------|
| Apply `docs/supabase/v1-full-setup.sql` to production Supabase | Database |
| Verify upsert save works (no legacy delete-all fallback in console) | Database |
| Escape user content in logs and squad UI | Security — **fixed in code, verify after deploy** |
| Bump `version.json` cache + run `sync-version.mjs` before each release | Caching |
| Drop or restrict `app_settings` if present | Security |

---

### SAFE FOR V1.1

| Item | Area |
|------|------|
| Split `styles.css` into feature files | Frontend |
| ES module cache bust build step | Caching |
| CSV formula neutralization | Security |
| `sbFetch` safe error body parsing | Security |
| Mobile nav `sr-only` labels + loading `aria-live` | A11y |
| Chart.js SRI | Frontend |
| GitHub Actions Pages deploy | Deployment |
| Parameterize `push-updates.bat` REPO path | Version control |
| Wire `getErrorLog()` into QA panel export | Error tracking |
| Incremental `logError()` in bridge poll catches | Error tracking |

---

### SAFE FOR V2.0

| Item | Area |
|------|------|
| OAuth PKCE flow (replace implicit) | Auth |
| Bundler (Vite) + hashed assets | Frontend / cache |
| Supabase CLI migrations | Database |
| Server-side error_events table | Error tracking |
| Multi-tab save coordination (BroadcastChannel) | Data integrity |
| Move Henrik key entry off browser POST entirely | Security |

---

## Lightweight fixes applied in this audit

| Fix | Files |
|-----|-------|
| Production readiness documentation | `docs/PRODUCTION-READINESS.md` |
| Central error logger + global handlers | `js/core/error-log.js`, `js/app.js`, `js/supabase.js` |
| XSS escaping utilities | `js/core/dom-safe.js` |
| Match notes escaping | `js/ui.js` |
| Squad name/avatar escaping | `js/groups.js` |
| `sync-version.mjs` updates `version.js` | `scripts/sync-version.mjs` |
| GitHub Pages `.nojekyll` | `.nojekyll` |

---

## Related docs

- `docs/RELEASE-RISKS.md` — Known risk register  
- `docs/RELEASE-CHECKLIST.md` — Pre-tag checklist  
- `docs/AUDIT-REPORT.md` — Prior code audit  
- `docs/STABILITY-REPORT.md` — Runtime stability notes  
- `docs/supabase/v1-full-setup.sql` — Database setup  
- `.env.example` — Local bridge secrets  

---

*Re-run this audit after major features or before tagging v1.0.0.*
