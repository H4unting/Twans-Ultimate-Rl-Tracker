# Security Audit V1 — Phase 4

**Product:** Twans Ultimate Tracker  
**Audit date:** June 7, 2026  
**Scope:** RLS policies, Supabase permissions, auth flows, upload validation, XSS, localStorage, API exposure, rate limiting, session handling  
**Sources:** `docs/supabase/*.sql`, `js/supabase.js`, `js/auth.js`, `js/env.js`, `js/core/app-config.js`, `js/core/dom-safe.js`, `scripts/bridge-security.mjs`, `scripts/start-grind.mjs`, `docs/LEGAL-AUDIT.md`  
**Method:** Static analysis + cross-reference with `docs/SECURITY-AUDIT-FULL.md` (2026-06-02). **No code modified.**

**Security score: 80 / 100** — Conditionally ready for v1.0 with operator verification.

---

## Verdict

| Tier | Count |
|------|------:|
| Critical | 0 |
| High | 1 (operator-dependent) |
| Medium | 7 |
| Low | 5 |

**Ship gate:** Production Supabase must run `v1-full-setup.sql` + `harden-public-access.sql` + `delete-own-account.sql`. Client XSS in match notes **mitigated** in current `ui.js`.

---

## 1. RLS policies

### Intended production posture (`docs/supabase/v1-full-setup.sql`)

| Table / object | RLS | Policy summary |
|----------------|-----|----------------|
| `matches` | ON | `user_id = auth.uid()` FOR ALL |
| `profiles` | ON | SELECT own; squad peers via `shares_group_with`; UPDATE own |
| `user_settings` | ON | `user_id = auth.uid()` FOR ALL |
| `groups` | ON | SELECT if `is_group_member` |
| `group_members` | ON | SELECT own membership or shared squad |
| `avatars` (storage) | Bucket policies | Upload/update/delete own `{uid}/`; public read |

### Squad cross-user read

- `can_view_player_stats(viewer, target)` — SECURITY DEFINER RPC.
- `matches` SELECT extended for squad/coach roles in `groups-schema.sql` / `v1-full-setup.sql`.

### Operator-critical: legacy unsafe schema

| ID | Severity | File | Issue |
|----|----------|------|-------|
| SEC-H1 | **High** | `docs/supabase/schema.sql:35–37` | `CREATE POLICY "Allow anon read/write matches" FOR ALL USING (true)` — **world writable** if this file alone was applied |
| SEC-M1 | Medium | Prod operator | Must verify anon policy dropped and `matches own` active |

**Manual step:** Operator runs `docs/supabase/v1-full-setup.sql` once. Re-run `docs/supabase/harden-public-access.sql` to revoke PUBLIC execute on SECURITY DEFINER RPCs.

### Legacy `app_settings`

- Dropped per P0 (`docs/supabase/drop-app-settings.sql`). **Do not recreate.**

---

## 2. Supabase permissions & API exposure

### Client credentials

| Item | Location | Assessment |
|------|----------|------------|
| Anon key | `js/core/app-config.js` | Expected for SPA — security = RLS |
| Service role | Not in repo | **PASS** |
| User JWT | `auth.js` → `getAccessToken()` | Sent as `Authorization: Bearer` in `sbFetch` |

### REST surface (`js/supabase.js`)

- All queries scoped by `getAuthUser().id` or RLS-enforced filters.
- RPCs: `create_grind_squad`, `join_grind_squad`, `leave_grind_squad`, `delete_own_account`, `claim_founder_uid`.
- `sbFetch` 25s timeout; throws on `!res.ok` with raw body text.

| ID | Severity | Issue | File |
|----|----------|-------|------|
| SEC-M2 | Medium | Raw PostgREST errors to toast via `formatApiError` | `supabase.js:29–44` |
| SEC-M3 | Medium | `JSON.parse` on response without try in `sbFetch` | `supabase.js:70` |

### Henrik / Riot keys

- **Not in browser bundle** — loaded server-side from `config/grind-config.json` (gitignored) or env (`scripts/local-setup.mjs`).
- Setup status returns boolean flags only — **PASS**.

---

## 3. Auth flows

### Implementation (`js/auth.js`)

| Flow | Mechanism | Assessment |
|------|-----------|------------|
| Google OAuth | `signInWithOAuth` + `flowType: 'pkce'` | **PASS** — modern flow |
| Email/password | `signInWithPassword` / `signUp` | **PASS** |
| Password reset | `resetPasswordForEmail` | **PASS** |
| Session persist | `persistSession: true`, `autoRefreshToken: true` | **PASS** |
| OAuth callback | Hash stripped via `stripAuthHashFromUrl` | **PASS** |

**Note:** `RELEASE-RISKS.md` R-M11 references legacy `flowType: 'implicit'` — **outdated**; code uses PKCE.

| ID | Severity | Issue |
|----|----------|-------|
| SEC-L1 | Low | CDN supply chain for `@supabase/supabase-js` — fallbacks mitigate |
| SEC-M4 | Medium | No leaked-password protection documented in dashboard — enable in Supabase Auth settings |

### Session handling

- Sign-out clears client session (`signOut` → `notifyAuth(null)`).
- Account delete calls RPC then sign-out (`app.js:497–514`).
- Access token not stored in localStorage manually — Supabase client handles storage.

---

## 4. Upload validation (avatars)

**File:** `js/supabase.js` → `uploadProfileAvatar()`

| Control | Status |
|---------|--------|
| Auth required | **PASS** |
| Client MIME check `image/*` | **PASS** |
| Path scoped `{user.id}/avatar.{ext}` | **PASS** |
| Bucket missing → compressed data URL fallback | **PASS** (size cap `AVATAR_INLINE_MAX_CHARS`) |
| Display sanitization | `sanitizeImageUrl()` — http(s) + data:image only (`dom-safe.js`) |

| ID | Severity | Issue |
|----|----------|-------|
| SEC-M5 | Medium | No server-side image re-encoding — rely on Storage + client |
| SEC-L2 | Low | Public read on avatar bucket — UUID paths mitigate enumeration |

**SQL:** `docs/supabase/avatar-storage.sql` — operator must run for Storage bucket.

---

## 5. XSS

### Mitigations present

| Area | Helper | File |
|------|--------|------|
| Match notes | `escapeHtml`, `escapeAttr` | `ui.js:134–136`, `165–167` |
| Tags | `escapeHtml` | `ui.js:42`, `renderInlineTags` |
| User name | `escapeHtml` | `ui.js:196–197` |
| Avatar src | `escapeAttr` + `sanitizeImageUrl` | `ui.js:189–191` |
| CSS color | `escapeCssColor` | `ui.js:208` |

### Residual vectors

| ID | Severity | Vector | Evidence |
|----|----------|--------|----------|
| SEC-M6 | Medium | Tag chip `data-tag` not escaped in template | `ui.js:53–54` — tag names from static game definitions, not user input |
| SEC-M7 | Medium | Squad member names from `profiles.display_name` | `groups.js` — verify `escapeHtml` on render (spot-check in smoke) |
| SEC-L3 | Low | `innerHTML` used extensively — user fields generally escaped |

**Prior finding R-H4 (unescaped notes):** **CLOSED** in current `ui.js` — notes use `escapeHtml`.

### CSV export injection

| ID | Severity | Issue | File |
|----|----------|-------|------|
| SEC-M8 | Medium | Formula injection in Excel | `js/export.js` — notes starting with `=`, `+`, `-`, `@` |

---

## 6. localStorage

| Key | Module | Sensitive? | try/catch |
|-----|--------|------------|-----------|
| `rl-grind-prefs` | quicklog, dock-ui | Prefs only — no secrets | Yes |
| `rl-grind-session:{game}:{uid}` | sessions | Session metadata — no auth tokens | Yes |
| `rl-grind-setup` | setup-wizard | Setup progress | Yes |
| `rl-grind-qa-dev` | qa-gate | Dev flag | N/A |

**Assessment:** No JWT or API keys in localStorage. **PASS**

| ID | Severity | Issue |
|----|----------|-------|
| SEC-L4 | Low | Session history readable on shared PC — expected for local app |

---

## 7. Local bridge API exposure

**Files:** `scripts/start-grind.mjs`, `scripts/bridge-security.mjs`, `js/bridge-client.js`

| Control | Status |
|---------|--------|
| Bind localhost | **PASS** — 127.0.0.1 / localhost |
| Per-launch `BRIDGE_AUTH_TOKEN` | **PASS** — random 32 bytes |
| `X-Bridge-Token` on mutating proxy requests | **PASS** |
| Rate limiting | `checkRateLimit` in bridge-security.mjs — **PASS** |
| CORS | Local only — not exposed to internet by default |

| ID | Severity | Issue |
|----|----------|-------|
| SEC-L5 | Low | Direct :49200 access bypasses tracker proxy — token still required for POSTs |
| SEC-M9 | Medium | Bridge trusts local game APIs — acceptable threat model for desktop app |

---

## 8. Account deletion & legal alignment

Per `docs/LEGAL-AUDIT.md`:

- UI: type `DELETE` + confirm (`profile-ui.js`).
- RPC: `docs/supabase/delete-own-account.sql` — **operator must run**.
- Privacy/Terms/Disclaimer pages linked from login + app footer.

| ID | Severity | Issue |
|----|----------|-------|
| SEC-M10 | Medium | Deletion RPC missing → user sees operator email message — acceptable fallback |

---

## 9. GitHub Pages deployment

| Risk | Assessment |
|------|------------|
| Anon key in static bundle | Mitigated by RLS if prod DB hardened |
| Auto-log bridge | Unavailable — reduces attack surface |
| OAuth redirect | Must whitelist Pages URL in Supabase dashboard |

---

## 10. Rate limiting (Supabase)

- No client-side rate limiting on REST calls.
- Relies on Supabase platform limits + RLS.
- Bridge has local rate limiting — **PASS** for local API.

---

## Operator checklist (must run manually)

| SQL file | Purpose |
|----------|---------|
| `docs/supabase/v1-full-setup.sql` | Full schema + RLS + RPCs |
| `docs/supabase/harden-public-access.sql` | Revoke PUBLIC on DEFINER functions |
| `docs/supabase/delete-own-account.sql` | Account deletion RPC |
| `docs/supabase/avatar-storage.sql` | Avatar bucket (optional if inline fallback OK) |
| `docs/supabase/claim-founder-uid.sql` | Optional founder UID |

**Verify in Supabase Dashboard:**

- [ ] Google provider enabled
- [ ] Site URL / redirect URLs include localhost:8080 and GitHub Pages URL
- [ ] Leaked password protection enabled (Auth → Providers → Email)
- [ ] No `Allow anon read/write` policies on `matches`
- [ ] `app_settings` table absent

---

## Findings vs recommendations

### Findings

1. Client auth uses PKCE; notes XSS mitigated in match log renderer.
2. Security depends on correct Supabase SQL applied in production — legacy `schema.sql` is unsafe.
3. Bridge secrets stay server-side; anon key exposure is by-design for SPA.
4. CSV formula injection remains an export-side risk.

### Recommendations (not executed)

1. Verify production RLS via Supabase advisors before v1 tag.
2. Prefix CSV cells that start with formula characters.
3. Map PostgREST errors to generic user messages for 5xx/RLS failures.
4. Enable leaked-password protection in Supabase Auth dashboard.

---

*Phase 4 complete. Cross-reference: `docs/SECURITY-AUDIT-FULL.md`, `docs/LEGAL-AUDIT.md`.*
