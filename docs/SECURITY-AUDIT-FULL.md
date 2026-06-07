# Full Security Audit — Twans Ultimate Tracker

**Audit date:** 2026-06-02  
**Auditor:** Automated codebase review (static analysis)  
**Scope:** Client SPA (`js/`, `index.html`), local bridge (`scripts/`), Supabase SQL (`docs/supabase/`), deployment (`push-updates.bat`, GitHub Pages)  
**Method:** Repository grep, policy/SQL review, data-flow tracing. **Production Supabase live-verified 2026-06-02** (Supabase MCP — P0 `app_settings` dropped).

Related: [`SECURITY-AUDIT.md`](SECURITY-AUDIT.md), [`RELEASE-RISKS.md`](RELEASE-RISKS.md), [`PRODUCTION-READINESS.md`](PRODUCTION-READINESS.md)

---

## Security Score: **82 / 100**

| Tier | Count |
|------|------:|
| Critical | 0 |
| High | 0 (client XSS closed; upsert index verified on prod) |
| Medium | 8 |
| Low | 6 |

### Verdict: **CONDITIONALLY READY FOR V1.0**

Security blockers closed. Remaining: manual smoke test, enable leaked-password protection in Supabase Auth dashboard, optional avatar bucket listing hardening.

---

## SECTION 1 — SECRETS & CREDENTIALS

**Result: WARNING**

### Search results

| Pattern | Found in shipped/tracked source? | Notes |
|---------|-------------------------------|-------|
| OpenAI (`sk-proj-`) | **No** | — |
| Anthropic (`sk-ant-`) | **No** | — |
| Gemini (`AIza…`) | **No** | — |
| Henrik (`HDEV-`) | **No** in git-tracked files | Example in `config/example.grind-config.json`, `.env.example` |
| Riot (`RGAPI-`) | **No** in git-tracked files | Validation strings only in bridge |
| Discord webhooks | **No** | — |
| Supabase `service_role` | **No** | — |
| JWT secrets (server) | **No** | Bridge uses per-session random `BRIDGE_AUTH_TOKEN` |
| Hardcoded passwords | **No** | Login UI only |

### Verified

| Check | Status |
|-------|--------|
| No Henrik/Riot keys in browser bundle | **PASS** — keys read server-side from `config/grind-config.json` / `HENRIK_API_KEY` env |
| Supabase anon key in client | **Expected** — `js/core/app-config.js` (`role: anon`); access must rely on RLS |
| Secrets in git | **PASS** — `.gitignore` covers `config/grind-config.json`, `.env`, logs, bridge state |
| Secrets in logs | **WARNING** — `config/grind-config.json` on disk contains real keys locally (gitignored); rotate if ever committed |
| Secrets in error messages | **PASS** for API keys — `/setup/status` returns `henrikApiKeySet` boolean only (`scripts/local-setup.mjs`) |
| Error messages leak Supabase internals | **WARNING** — raw PostgREST JSON passed to UI via `formatApiError` / `parseRpcError` (`js/supabase.js`, `js/groups.js`) |

### Findings

| ID | Severity | File | Issue | Fix (minimal) |
|----|----------|------|-------|---------------|
| S1-1 | Medium | `config/grind-config.json` (local) | Real `HDEV-` / `RGAPI-` keys on disk | Prefer `HENRIK_API_KEY` in `.env`; rotate if exposed |
| S1-2 | Low | `js/core/app-config.js` | Public anon JWT (by design) | Ensure RLS on all tables; never add `service_role` to client |
| S1-3 | Medium | `js/supabase.js` | Raw API errors to toast/UI | Map known codes; generic message for 500/RLS |

**Ship gate:** S1-1 user hygiene; S1-3 → **SAFE FOR V1.1** unless exposing stack traces.

---

## SECTION 2 — SUPABASE SECURITY

**Result: PASS** (P0 closed 2026-06-02 — `app_settings` dropped on prod; `user_settings` RLS verified)

### Tables audited

| Table / object | RLS (v1-full-setup) | Anonymous | Cross-user read | Cross-user write |
|----------------|---------------------|-----------|-----------------|------------------|
| `profiles` | Enabled | Denied | Squad peers only (`shares_group_with`) | Denied (own UPDATE only) |
| `matches` | Enabled | Denied | Squad/coach via `can_view_player_stats` | Denied (own INSERT/UPDATE/DELETE) |
| `user_settings` | Enabled | Denied | Denied | Denied |
| `groups` | Enabled | Denied | Members only (`is_group_member`) | Via RPC only (`SECURITY DEFINER`) |
| `group_members` | Enabled | Denied | Shared squad roster | Via RPC only |
| `avatars` (storage) | Bucket policies | Public **read** (intended) | N/A | Own folder `{uid}/` only |
| `app_settings` (legacy) | Was `USING (true)` | **World writable** | **All users** | **Must not exist** |
| Legacy `docs/supabase/schema.sql` | `matches FOR ALL USING (true)` | **Full access** | **All** | **All** |

### DELETE / UPDATE

- **matches:** DELETE/UPDATE scoped to `user_id = auth.uid()` ✓
- **profiles:** UPDATE own row only ✓
- **Squad mutations:** `create_grind_squad`, `join_grind_squad`, `leave_grind_squad` — auth required, `SECURITY DEFINER` ✓
- **No direct INSERT** policy on `groups` for clients — good ✓

### Findings

| ID | Severity | File | Attack path | Fix |
|----|----------|------|-------------|-----|
| S2-1 | **CLOSED** | Prod DB | ~~`app_settings` with open RLS~~ Dropped 2026-06-02 (migration `drop_app_settings`) | Verified absent |
| S2-2 | **High** | Prod DB | Old `schema.sql` applied → anyone with anon key reads/writes all `matches` | Apply `v1-full-setup.sql`; drop anon policies |
| S2-3 | Medium | `docs/supabase/schema.sql` | Template still documents unsafe policy | Already noted deprecated; do not run on prod |
| S2-4 | Low | Storage | Avatar bucket public read | Accept for v1.0; URLs are unguessable paths |

**Repro S2-1 (signed out):**

```
GET {SUPABASE_URL}/rest/v1/app_settings?select=*
Authorization: Bearer {anon_key}
```

Expected after fix: 404 / relation does not exist.

**Ship gate:** ~~S2-1~~ **closed**. S2-2 → **MUST FIX BEFORE V1.0** if legacy schema ever deployed.

---

## SECTION 3 — AUTHENTICATION

**Result: PASS** (PKCE enabled 2026-06-02 — `flowType: 'pkce'` in `js/auth.js`)

### Verified

| Check | Status |
|-------|--------|
| Cloud sync requires login | **PASS** — `saveGames`, `loadGames`, profile, squads check `getAuthUser()` |
| Unauthorized Supabase writes | **PASS** (with correct RLS) — JWT required; anon bearer alone blocked |
| Auth state changes | **PASS** — `onAuthStateChange` → boot or `showLoggedOut()` (`js/app.js`) |
| Session refresh | **PASS** — `autoRefreshToken: true` (`js/auth.js`) |
| Logout clears session | **PASS** — `signOut()` + `notifyAuth(null)` + `resetBootState()` |
| Privilege escalation | **PASS** — no client-side role assignment; squad roles set in RPC |

### Findings

| ID | Severity | File | Attack path | Fix |
|----|----------|------|-------------|-----|
| S3-1 | **High** | `js/auth.js` | OAuth `flowType: 'implicit'` — access token in URL `#hash` stealable via XSS | Migrate to PKCE (`flowType: 'pkce'`) |
| S3-2 | Medium | GH Pages | App usable signed-out only in memory — no cloud leak, but user may think data is saved | UX disclosure (not security block) |
| S3-3 | Low | `js/auth.js` | OAuth hash errors logged to console | Accept |

**Ship gate:** S3-1 → **MUST FIX BEFORE V1.0** if any XSS remains (combines with Section 4); else **SAFE FOR V1.1** with XSS fixes.

---

## SECTION 4 — XSS

**Result: PASS** (2026-06-02 — `escapeHtml` on notes/names/export; `sanitizeImageUrl` on profile avatars; PKCE auth)

### Escaped correctly (PASS)

| Field | Mechanism | Files |
|-------|-----------|-------|
| Match notes (table) | `escapeHtml` / `escapeAttr` | `js/ui.js` |
| Tags (inline) | `escapeHtml` | `js/ui.js` |
| Squad names, invite codes, member names | `escapeHtml` / `escapeAttr` | `js/groups.js` |
| Profile name, bio (profile page) | `escapeHtml` / `escapeAttr` | `js/profile-ui.js` |
| Auth bar name | `escapeHtml` | `js/ui.js` |
| Squad avatars | `sanitizeImageUrl` | `js/groups.js` |

### Unescaped / vulnerable (FAIL partial)

| ID | Severity | File | User field | Attack path | Fix |
|----|----------|------|------------|-------------|-----|
| S4-1 | **High** | `js/match-logs-ui.js:154` | `notes` | Log `<img onerror=…>` in notes → HTML injected in Match Logs | `escapeHtml(g.notes)` |
| S4-2 | **High** | `js/ui.js:208` | `display.name` | Profile name `<script>` → welcome header HTML | `escapeHtml(display.name)` |
| S4-3 | **High** | `js/export.js:82-104` | `playerName`, coach lines, `topMistake` | Print report `document.write` without escape | Escape all dynamic strings |
| S4-4 | Medium | `js/ui.js:326-349` | Insight/coach `l.text`, `item.text` | Tag-derived strings in `innerHTML` | `escapeHtml` on text fields |
| S4-5 | Medium | `js/focus.js:106-127` | `goals.focusTag`, action item titles | Focus page `innerHTML` | Escape user-facing strings |
| S4-6 | Medium | `js/profile-ui.js:49` | Avatar URL | `escapeAttr` without `sanitizeImageUrl` — `javascript:` URI | Use `sanitizeImageUrl` like `groups.js` |
| S4-7 | Low | `js/match-logs-ui.js` | `g.mode`, `g.agent`, `g.map` | Usually enum; if corrupted data | Escape for defense in depth |

**Repro S4-1:**

1. Sign in → quick-log a match.
2. Notes: `<img src=x onerror="alert(document.cookie)">`
3. Open **Match Logs** → expand row → script runs.

**Ship gate:** S4-1, S4-2, S4-3 → **MUST FIX BEFORE V1.0**. Others → **SAFE FOR V1.1**.

---

## SECTION 5 — CSRF / REQUEST ABUSE

**Result: WARNING**

### Supabase writes

- Browser sends `Authorization: Bearer {user JWT}` — classic CSRF less relevant (no cookie session).
- Attacker needs stolen JWT or XSS.

### Bridge endpoints

| Control | Status |
|---------|--------|
| Bind `127.0.0.1` only | **PASS** — `scripts/rl-bridge.mjs`, `scripts/start-grind.mjs` |
| CORS allowlist | **PASS** — `localhost:8080` only (`scripts/bridge-security.mjs`) |
| Proxy path allowlist | **PASS** — `PROXY_BRIDGE_ALLOWLIST` |
| POST token | **PASS** — `X-Bridge-Token` on mutating routes; token from `/status` via same-origin proxy |
| Overwolf POST | **WARNING** — optional `OVERWOLF_BRIDGE_TOKEN`; without it, rate limit only |
| Body size cap | **PASS** — 32 KiB |
| Schema validation | **PASS** — `validateSetupApply`, `validateOverwolfMatch` |

### Findings

| ID | Severity | File | Attack path | Fix |
|----|----------|------|-------------|-----|
| S5-1 | Medium | `scripts/bridge-security.mjs` | Local malware on PC POSTs to `:49200` without token on non-auth routes | Accept for v1.0 (localhost threat model) |
| S5-2 | Medium | Overwolf routes | Fake match injection if token unset | Set `OVERWOLF_BRIDGE_TOKEN` in prod bridge env |
| S5-3 | Low | `scripts/start-grind.mjs` | `/status` injects `authToken` to any caller on `:8080` | By design for tracker tab |

**Ship gate:** S5-2 → **SAFE FOR V1.1** (recommended for competitive integrity).

---

## SECTION 6 — RATE LIMITING

**Result: WARNING**

### Bridge (PASS)

- Per-route limits in `ROUTE_LIMITS` (`scripts/bridge-security.mjs`).
- Henrik outbound cap 45/min.
- 429 responses with `Retry-After`.

### Client / Supabase (WARNING)

| Surface | Limit | Risk |
|---------|-------|------|
| Quick log / save | None | Double-click spam → duplicate saves / Supabase load |
| Match edit | None | Rapid PATCH storms |
| Squad RPC | Supabase default | Theoretical invite spam |
| Auto-log loop | Bridge consume limits | Partial |

| ID | Severity | File | Attack path | Fix |
|----|----------|------|-------------|-----|
| S6-1 | Medium | `js/app.js` / `js/quicklog.js` | Double-click Save → duplicate match rows | Disable button / debounce 500ms |
| S6-2 | Medium | Supabase | Authenticated user floods REST API | Edge function or Supabase rate limits (v1.1) |
| S6-3 | Low | Auto-log | Replay consume | Idempotent `matchId` dedup exists in handlers |

**Ship gate:** **SAFE FOR V1.1** (monitor abuse).

---

## SECTION 7 — DATA INTEGRITY

**Result: PASS** (prod has `matches_user_game_match_num_key` unique index — legacy delete-all fallback unlikely)

### Destructive patterns found

| Pattern | Location | Risk |
|---------|----------|------|
| Delete-all then insert | `syncGameSliceLegacy` | **High** — DELETE succeeds, POST fails → empty history |
| Delete orphans after upsert | `syncGameSlice` | Medium — failure mid-flight |
| Empty slice deletes all | `syncGameSlice` line 228-230 | Intentional clear |
| Legacy fallback trigger | `isUpsertUnavailable` | Missing unique index on prod |

| ID | Severity | File | Attack path | Fix |
|----|----------|------|-------------|-----|
| S7-1 | **High** | `js/supabase.js:211-250` | Network error after DELETE in legacy fallback | Ensure prod has upsert index; remove fallback or use transaction |
| S7-2 | Medium | `js/supabase.js` | Race: two tabs save concurrently | Last-write-wins; document |
| S7-3 | Medium | Auto-log | Duplicate match if dedup misses | Verify `matchId` in notes (`js/auto-log-handlers.js`) |
| S7-4 | Low | QA tools | `Clear + Supabase` on wrong account | QA gate only (`docs/QA-TOOLS.md`) |

**Repro S7-1:**

1. Force legacy fallback (console: upsert unavailable message).
2. Simulate POST failure after DELETE.
3. Remote match history for game = empty.

**Ship gate:** S7-1 → **MUST FIX BEFORE V1.0** if prod lacks upsert key (verify `multi-game.sql` applied).

---

## SECTION 8 — FILES & UPLOADS

**Result: WARNING**

### Avatar uploads (`js/supabase.js`)

| Check | Status |
|-------|--------|
| Auth required | **PASS** |
| MIME check client | **PASS** — `file.type.startsWith('image/')` |
| Size limit client | **PARTIAL** — compress to inline data URL ~120KB; no pre-check on raw file size |
| Size limit server | **PASS** — 2 MiB in `avatar-storage.sql` |
| Path traversal | **PASS** — path `{user.id}/avatar.{ext}` |
| Type allowlist server | **PASS** — jpeg/png/webp/gif |
| Inline fallback | **WARNING** — stores base64 in `profiles.avatar_url` if bucket missing — bypasses storage RLS but scoped to own profile |

| ID | Severity | Fix |
|----|----------|-----|
| S8-1 | Medium | Reject files > 2 MiB before upload attempt |
| S8-2 | Low | Run `avatar-storage.sql` on prod to avoid huge inline URLs |

**Ship gate:** **SAFE FOR V1.1**.

---

## SECTION 9 — BRIDGE SECURITY

**Result: PASS** (with Overwolf token caveat)

### `scripts/rl-bridge.mjs`

| Check | Status |
|-------|--------|
| localhost bind | **PASS** — `127.0.0.1` |
| Token auth | **PASS** — via `requireBridgeAuth` |
| Malformed JSON | **PASS** — rejected |
| RL UDP | Local BakkesMod port only |

### `scripts/valorant-bridge.mjs`

| Check | Status |
|-------|--------|
| Henrik key server-only | **PASS** |
| Config validation | **PASS** |
| Error messages | User-safe strings for RGAPI block |

### `scripts/start-grind.mjs`

| Check | Status |
|-------|--------|
| Tracker on `127.0.0.1:8080` | **PASS** |
| Bridge proxy + rate limits | **PASS** |
| Static file path normalization | **PASS** — `path.normalize` + root check implied |

**Ship gate:** **PASS** for v1.0 local bridge threat model.

---

## SECTION 10 — DEPLOYMENT

**Result: WARNING**

| Check | Status |
|-------|--------|
| GitHub Pages secrets | **PASS** — only static assets; no `.env` in deploy |
| `push-updates.bat` | **PASS** — copies templates only; not `grind-config.json` |
| `sync-version.mjs` | **PASS** — bumps `?v=` in `index.html` + `js/core/version.js` |
| Cache bust current | **WARNING** — run sync after each release (`version.json` cache field) |
| `.nojekyll` | Present for GH Pages |
| Supabase URL/key in bundle | Expected public anon |

| ID | Severity | Issue | Fix |
|----|----------|-------|-----|
| S10-1 | Low | Stale cache if forget sync | Release checklist item |
| S10-2 | Low | Anon key in public repo | RLS is the control |

**Ship gate:** **PASS** with process discipline.

---

## SECTION 11 — DEPENDENCIES

**Result: PASS**

| Package | Location | Notes |
|---------|----------|-------|
| `@supabase/supabase-js` | CDN / optional vendor | Loaded at runtime in browser |
| `electron`, `electron-builder` | `tools/launcher/package.json` | Dev/build only; not shipped to GH Pages |
| Root `package.json` | **None** | SPA has no npm runtime deps |

- No OpenAI/Anthropic SDKs in app.
- Electron 33 — keep updated for tray app; not in web attack surface.
- Run `npm audit` in `tools/launcher` before tray releases.

**Ship gate:** **PASS** for web v1.0.

---

## SECTION 12 — ATTACK SCENARIOS

### 1. Authenticated malicious user

| | |
|-|-|
| **Likelihood** | Medium |
| **Impact** | Medium — spam matches, pollute own data, stress Supabase |
| **Mitigation** | RLS contains to own rows; rate limits on bridge only; consider Supabase quotas |

### 2. Anonymous visitor

| | |
|-|-|
| **Likelihood** | High (public GH Pages URL) |
| **Impact** | Critical **if legacy RLS** — read/write all matches; Low with v1-full-setup |
| **Mitigation** | Apply v1-full-setup; drop `app_settings`; verify anon denied |

### 3. Script spammer (browser automation)

| | |
|-|-|
| **Likelihood** | Low |
| **Impact** | Medium — API cost, account ban risk |
| **Mitigation** | Client debounce; Supabase rate limits (future) |

### 4. API abuser (Henrik via bridge)

| | |
|-|-|
| **Likelihood** | Low (localhost only) |
| **Impact** | Medium — quota exhaustion on gaming PC |
| **Mitigation** | `checkHenrikRateLimit`, local-only bind |

### 5. Browser console attacker

| | |
|-|-|
| **Likelihood** | Medium (self) |
| **Impact** | Low — can mutate own in-memory state; cannot bypass RLS for others |
| **Mitigation** | RLS; no secrets in `window` |

### 6. XSS attacker

| | |
|-|-|
| **Likelihood** | Medium (notes/name vectors) |
| **Impact** | **High** — steal implicit OAuth token from hash, act as user |
| **Mitigation** | Fix S4-* ; migrate PKCE |

### 7. Match-history corruption attacker

| | |
|-|-|
| **Likelihood** | Low |
| **Impact** | **High** — delete-all sync wipes remote history |
| **Mitigation** | Upsert-only path on prod; backup; fix S7-1 |

---

## FINAL REPORT — FINDINGS BY SEVERITY

### Critical

| ID | File | Attack path | Fix | Ship |
|----|------|-------------|-----|------|
| S2-1 | Production Supabase | ~~Open `app_settings`~~ | **CLOSED** 2026-06-02 | **Done** |

### High

| ID | File | Attack path | Fix | Ship |
|----|------|-------------|-----|------|
| S2-2 | Production Supabase | Legacy `schema.sql` world-writable `matches` | Apply v1-full-setup | **MUST FIX BEFORE V1.0** |
| S4-1 | `js/match-logs-ui.js` | Stored XSS in notes | `escapeHtml` | **MUST FIX BEFORE V1.0** |
| S4-2 | `js/ui.js` | Stored XSS in display name | `escapeHtml` | **MUST FIX BEFORE V1.0** |
| S4-3 | `js/export.js` | XSS in print view | Escape dynamic HTML | **MUST FIX BEFORE V1.0** |
| S7-1 | `js/supabase.js` | Delete-all fallback data loss | Prod upsert index; avoid fallback | **MUST FIX BEFORE V1.0** |
| S3-1 | `js/auth.js` | Token theft via XSS + implicit flow | PKCE | **MUST FIX BEFORE V1.0** (with XSS) |
| S1-3 | `js/supabase.js` | Error disclosure | Sanitize errors | **SAFE FOR V1.1** |

### Medium (selected)

| ID | File | Fix | Ship |
|----|------|-----|------|
| S4-4 | `js/ui.js` | Escape coach/action HTML | **SAFE FOR V1.1** |
| S4-5 | `js/focus.js` | Escape focus tag / actions | **SAFE FOR V1.1** |
| S4-6 | `js/profile-ui.js` | `sanitizeImageUrl` on avatar | **SAFE FOR V1.1** |
| S5-2 | Bridge env | Set `OVERWOLF_BRIDGE_TOKEN` | **SAFE FOR V1.1** |
| S6-1 | Quick log UI | Save debounce | **SAFE FOR V1.1** |
| S8-1 | `js/supabase.js` | Client file size cap | **SAFE FOR V1.1** |

### Low (selected)

| ID | Ship |
|----|------|
| S1-2 | **SAFE FOR V2.0** (document only) |
| S10-1 | Process — **SAFE FOR V1.1** |

---

## REMEDIATION PRIORITY (minimal diffs)

1. **Production SQL** — verify + drop `app_settings`; confirm RLS matches `v1-full-setup.sql`.
2. **XSS** — `escapeHtml` in `match-logs-ui.js`, `ui.js` welcome, `export.js` print template.
3. **Data integrity** — confirm unique key on `(user_id, game, match_num)`; monitor for legacy fallback log line.
4. **Auth** — PKCE after XSS fixes.
5. **Bridge** — optional Overwolf token for competitive users.

---

## VERIFICATION COMMANDS (maintainer)

```bash
# Secrets in tracked files (exclude node_modules, launcher dist)
rg -i "service_role|sk-proj|sk-ant-|AIzaSy|discord.com/api/webhooks|HDEV-[a-z0-9]|RGAPI-" \
  --glob "!node_modules/**" --glob "!tools/launcher/dist/**" --glob "!config/grind-config.json"

# XSS sinks
rg "innerHTML|insertAdjacentHTML|document\.write" js/

# Open RLS policies in SQL
rg "USING \(true\)" docs/supabase/
```

---

## READY FOR V1.0?

# **CONDITIONALLY READY FOR V1.0**

**Closed 2026-06-02:**

- [x] Production Supabase P0 — `app_settings` dropped
- [x] Legacy `Tracker` table dropped
- [x] Anon RPC execute revoked (PUBLIC → authenticated only)
- [x] XSS fixes shipped (S4-1–S4-6)
- [x] PKCE auth flow
- [x] Upsert index on prod (`matches_user_game_match_num_key`)

**Before tag:**

- [ ] Manual smoke test (signed-in, localhost + GH Pages)
- [ ] Enable leaked-password protection in Supabase Auth settings
- [ ] Deploy via `push-updates.bat` (cache `20260602e`)

---

*Generated by full static audit. No code changes made in this pass.*
