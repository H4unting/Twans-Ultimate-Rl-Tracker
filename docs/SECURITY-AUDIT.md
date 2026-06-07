# Security Audit — v1.0

**App:** Twans Ultimate Tracker  
**Audit date:** 2026-06-02  
**Focus:** API abuse, account abuse, cost leakage  
**Scope:** Client SPA, local bridge, Supabase backend  

Related: `docs/PRODUCTION-READINESS.md`, `scripts/bridge-security.mjs`, `docs/supabase/v1-full-setup.sql`

---

## Executive summary

| Area | Status |
|------|--------|
| API keys in browser | **PASS** (anon only; Henrik keys server-local) |
| Supabase RLS | **PASS (P0 closed 2026-06-02)** — `app_settings` dropped on prod via migration `drop_app_settings` |
| User input / XSS | **PASS** (2026-06-02 hardening — notes, names, print export, coach/focus) |
| Abuse protection | **PASS** (bridge); **WARNING** (Supabase client) |
| Local storage | **PASS** (no Henrik keys; Supabase session expected) |
| Error disclosure | **WARNING** (raw Supabase errors to UI) |

**No OpenAI, Discord webhook, or service_role keys found in shipped source.**

---

## P0 — `app_settings` (release blocker) — **CLOSED 2026-06-02**

Verified live on project `pwuxocijdnuhhghufizn` (Supabase MCP):

| Check | Result |
|-------|--------|
| `app_settings` exists | **false** |
| Open policy `Allow anon read/write app_settings` | **removed** |
| `user_settings` RLS | `user_id = auth.uid()` on ALL |

Migration applied: `drop_app_settings` (DROP POLICY + DROP TABLE).

### Code audit conclusion

| Question | Answer |
|----------|--------|
| Does app code use `app_settings`? | **No** — zero references in `js/` |
| What replaced it? | `user_settings` (`js/supabase.js` → `loadSettings` / `saveSettings`) |
| Was old policy safe? | **No** — `FOR ALL USING (true) WITH CHECK (true)` allowed anonymous read/write |
| Required for v1.0? | **No** — table is legacy pre-auth storage |

**Decision: DROP TABLE** (not lock to `auth.uid()` — redundant with `user_settings`).

### Production verification — **DONE**

~~Auto-probe from CI/agents is blocked~~ Live verification via Supabase MCP on 2026-06-02:

```sql
-- Result: app_settings_still_exists = false
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'app_settings'
) AS app_settings_still_exists;
```

| `app_settings_exists` | Action |
|-----------------------|--------|
| `false` | **Release unblocked** for this item ✓ |
| `true` | ~~Run full script~~ — no longer needed |

After drop, confirm:

```sql
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'app_settings'
) AS app_settings_still_exists;
-- Must return false
```

Optional anon REST check (browser DevTools, signed out):

```
GET /rest/v1/app_settings?select=id&limit=1
```

Expected after fix: **404** or `"relation \"public.app_settings\" does not exist"`.

### Final policy (post-remediation)

| Object | Policy | Anonymous access |
|--------|--------|------------------|
| **`app_settings`** | **Table must not exist** | N/A — dropped |
| **`user_settings`** | `FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())` | **Denied** — requires JWT |
| Cross-user settings write | **Impossible** via RLS — `user_id` must match `auth.uid()` on INSERT/UPDATE | |

Source: `docs/supabase/v1-full-setup.sql` (section 2), `docs/supabase/auth-schema.sql`

### Repo changes (P0 task)

| File | Change |
|------|--------|
| `docs/supabase/drop-app-settings.sql` | **New** — idempotent prod migration + verification queries |
| `docs/supabase/v1-full-setup.sql` | Removed `app_settings` creation (new projects never get it) |
| `docs/supabase/schema.sql` | Removed `app_settings`; points to drop script |

### Release blocker status

| Item | Status |
|------|--------|
| Code/templates fixed | **Done** |
| Production SQL executed | **Pending — owner must run `drop-app-settings.sql`** |
| C-1 closed | **After prod confirms `app_settings_still_exists = false`** |

---

## 1. API keys & secrets

### Search results

| Pattern | Found in repo? | Shipped to browser? |
|---------|----------------|---------------------|
| OpenAI (`sk-`, `OPENAI`) | **No** | — |
| Discord webhooks | **No** (roadmap mention only) | — |
| Supabase `service_role` | **No** | — |
| Henrik (`HDEV-`) | `config/grind-config.json` (gitignored), `.env.example`, docs | **No** — bridge only |
| Riot (`RGAPI-`) | `config/grind-config.json` (gitignored), validation messages | **No** — bridge only |
| Supabase anon JWT | `js/core/app-config.js` | **Yes** — by design |

### Supabase anon key (client)

- Location: `js/core/app-config.js`
- JWT role: **`anon`** (not `service_role`)
- Security model: Row Level Security on all user data tables
- **PASS** if RLS policies are applied in production

### Henrik / Riot keys

| Storage | Risk |
|---------|------|
| `config/grind-config.json` | Plaintext on disk; **gitignored** — never commit |
| `HENRIK_API_KEY` env | Preferred; not in browser |
| Setup wizard POST | Sent to localhost bridge only; not stored in Supabase |
| `/setup/status` | Returns `henrikApiKeySet` boolean only — no key material |

**Action:** Rotate keys if `grind-config.json` was ever shared or committed. Use `.env` per `.env.example`.

### Bridge auth token

- Generated at launcher start; returned on `/status` to allowed localhost origins
- Held in memory in `js/bridge-client.js` (not localStorage)
- Required on mutating bridge POSTs via `X-Bridge-Token`

**PASS** for localhost threat model.

---

## 2. Supabase security

### Tables & RLS summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `matches` | Own + squad rules via `can_view_player_stats()` | `user_id = auth.uid()` | Own only | Own only |
| `profiles` | Own + squad `shares_group_with()` | Own only | Own only | — (cascade) |
| `user_settings` | Own | Own | Own | Own |
| `group_members` | Self or same group | Via RPC only | — | Via RPC |
| `groups` | Members only | Via RPC | — | Via RPC |
| `storage.objects` (avatars) | Public read | Own folder | Own folder | Own folder |
| **`app_settings`** | **Removed** — must not exist in prod | — | — | — |

Source: `docs/supabase/v1-full-setup.sql` (legacy table removed — see P0 section)

### Cross-user access paths

| Path | Protected? | Notes |
|------|------------|-------|
| Read own matches | Yes | `matches select own or group` |
| Read squad member matches | Yes | `can_view_player_stats(viewer, player)` enforces role rules (coach vs member) |
| Insert match as another user | **Blocked** | `WITH CHECK (user_id = auth.uid())` |
| PATCH another user's profile | **Blocked** | `profiles update own` |
| Read another user's settings | **Blocked** | `user_settings own` |
| Join squad without invite | **Blocked** | `join_grind_squad` RPC |
| Enumerate all groups | **Blocked** | No list policy without membership |
| **`app_settings` read/write** | **N/A after drop** | Run `drop-app-settings.sql` if table still exists |

### Squad RPCs

- `create_grind_squad`, `join_grind_squad`, `leave_grind_squad` — `SECURITY DEFINER` with `auth.uid()` checks
- Squad name min length 2 (server-side)
- Invite codes normalized server-side

### Indexes & integrity

- Unique: `(user_id, game, match_num)` — prevents duplicate match numbers per user/game
- Upsert path in `js/supabase.js` preferred over legacy delete-all fallback

### Verdict: **PASS** (after prod drop confirmed)

**Release blocker:** Execute `docs/supabase/drop-app-settings.sql` on production if Step A returns `true`.

**Can wait until v1.1:** Automated post-deploy RLS smoke test in CI.

---

## 3. User input & XSS

### Display escaping audit

| Field | Render path | Escaped? | Severity |
|-------|-------------|----------|----------|
| Match notes | `js/ui.js` `renderLog()` | **Yes** (audit fix) | Was High |
| Tags (inline) | `js/ui.js` `renderInlineTags()` | **Yes** (audit fix) | Medium (tags from predefined list; DB could hold legacy values) |
| Profile bio/name | `js/profile-ui.js` | Yes | — |
| Squad member name/avatar | `js/groups.js` | **Yes** (prior audit) | Was High |
| Squad name / invite code | `js/groups.js` detail header | **Yes** (audit fix) | Medium |
| Auth bar name/avatar | `js/ui.js` `renderAuthBar()` | **Yes** (audit fix) | Medium |
| Welcome header name | `js/ui.js` `renderWelcomeHeader()` | **No** | Low (own profile name) |
| Coach insight text | `js/groups.js` `insightsHTML()` | **No** | Low (generated strings, not user HTML) |
| Post-match / quick tags | Chip UI only | N/A | Tags from fixed definitions |
| Session names | Numeric session IDs only | N/A | No free-text session names |

### Input validation (write path)

| Field | Validation |
|-------|------------|
| Squad name | RPC min 2 chars; client should trim |
| Profile bio | Saved to Supabase; escaped on render |
| Match notes | No server-side length cap in client; Postgres `text` |
| Henrik key | Bridge schema: `HDEV-*` format, max 128 chars |
| Riot ID | Bridge schema: `Name#TAG` regex |

### Verdict: **WARNING** → trending **PASS** after v1.0 XSS fixes deploy

**Must fix before v1.0:** Deploy note/tag/auth-bar/squad name escaping (done in code — verify after release).

**Can wait until v1.1:** Escape `renderWelcomeHeader()` display name; sanitize CSV export (formula injection).

---

## 4. Abuse protection

### Local bridge (cost: Henrik API quota)

| Control | Location | Limit |
|---------|----------|-------|
| Per-route rate limits | `scripts/bridge-security.mjs` | e.g. 8/min `/setup/apply`, 40/min Overwolf match |
| Henrik outbound cap | `checkHenrikRateLimit()` | 45 calls/min |
| Body size cap | 32 KiB JSON max | Prevents payload bombs |
| CORS allowlist | localhost:8080 only | Blocks cross-site bridge abuse |
| Auth token on POST | `X-Bridge-Token` | Prevents unauthenticated local mutation |
| Proxy path allowlist | `start-grind.mjs` | Blocks arbitrary path forwarding |
| Auto-log dedupe | `autoLogInFlight`, `consumed`, `matchId` in notes | Prevents duplicate auto-logs |
| Duplicate Overwolf match | Same `matchId` rejected | `valorant-bridge.mjs` |

**Verdict: PASS**

### Client / Supabase (cost: DB writes, egress)

| Control | Status |
|---------|--------|
| Log button disable while saving | Yes (`js/app.js`) |
| `persistChain` serializes saves per tab | Yes (`js/matches.js`) |
| Multi-tab save coordination | **No** — last write wins |
| Client-side save rate limit | **No** |
| Supabase row-level insert throttle | **No** (relies on RLS + user good faith) |

**Verdict: WARNING** — malicious signed-in user could spam match inserts (self-inflicted cost + DB growth).

**Can wait until v1.1:** Debounce rapid log clicks; optional server-side rate limit via Edge Function.

### Auto-log loops

| Guard | File |
|-------|------|
| `autoLogInFlight` mutex | `js/rl-live.js`, `js/valorant-live.js` |
| Bridge `consumed` flag | `rl-bridge.mjs`, `valorant-bridge.mjs` |
| Val duplicate `id:matchId` skip | `js/auto-log-handlers.js` |
| Henrik baseline filter | `valorant-bridge.mjs` |

**Verdict: PASS**

---

## 5. Local storage

| Key | Content | Sensitive? |
|-----|---------|------------|
| Supabase auth (via library) | `access_token`, `refresh_token` | **Expected** — session tokens, not API keys |
| `rl-grind-prefs` | UI prefs, riot ID display, filters | Low — no Henrik key |
| `rl-grind-setup` | Setup wizard dismiss state | No |
| Session storage keys | Active session per game | No |
| `rl-grind-error-log` | Error messages (sessionStorage) | Must not log keys — **currently safe** |
| QA dev flags | localhost only | No |
| Bridge auth token | **Memory only** (`bridge-client.js`) | Not persisted |

**Henrik keys are NOT stored in localStorage.**

**Verdict: PASS**

---

## 6. Error handling & information disclosure

| Path | Behavior | Risk |
|------|----------|------|
| `sbFetch()` failure | `throw new Error(await res.text())` — full Postgres/PostgREST body | **Medium** — may expose schema hints to user toast |
| Setup apply toast | Shows `e.message` from bridge | Low if bridge returns generic messages |
| Bridge errors | JSON `{ error: "..." }` — validated messages | Low |
| `loadSettings()` catch | Logs via `error-log.js`; silent to user | Low |
| Error log buffer | Stores message + truncated stack | Low — no key logging |

**Recommendations:**

- Map Supabase errors to user-safe messages before `showToast` (**v1.1**)
- Never log request bodies containing API keys in `error-log.js` (**ongoing discipline**)

**Verdict: WARNING**

---

## 7. Findings by severity

### Critical

| ID | Finding | Must fix v1.0? |
|----|---------|----------------|
| C-1 | **`app_settings` open RLS** | **Mitigated in repo** — run `drop-app-settings.sql` on prod to close |
| C-2 | **Real keys in local `config/grind-config.json`** — catastrophic if committed to git | **Yes** — verify gitignore + rotate if ever pushed |

### High

| ID | Finding | Must fix v1.0? |
|----|---------|----------------|
| H-1 | Match notes XSS | **Fixed** — deploy and verify |
| H-2 | Squad member profile XSS (name/avatar) | **Fixed** — deploy and verify |
| H-3 | Legacy Supabase save (`delete all` then insert) on upsert failure | **Yes** — verify upsert works; remove fallback when stable |
| H-4 | Cross-site bridge abuse via open CORS | **Fixed** — bridge-security CORS allowlist |

### Medium

| ID | Finding | Timing |
|----|---------|--------|
| M-1 | Henrik key plaintext on disk (`grind-config.json`) | v1.0: prefer `.env`; v1.1: CLI-only key entry |
| M-2 | OAuth implicit flow (tokens in URL hash briefly) | v1.1 — PKCE migration |
| M-3 | Overwolf POST optional token (`OVERWOLF_BRIDGE_TOKEN`) | v1.0 optional hardening |
| M-4 | Auth bar / squad name XSS | **Fixed** in audit |
| M-5 | Tag inline XSS (DB-stored tags) | **Fixed** in audit |
| M-6 | Raw Supabase error text shown to users | v1.1 |
| M-7 | No client-side Supabase write rate limit | v1.1 |
| M-8 | Multi-tab last-write-wins on saves | v1.1 |
| M-9 | CSV export formula injection | v1.1 |
| M-10 | `renderWelcomeHeader()` unescaped display name | v1.1 (self-XSS only) |

### Low

| ID | Finding | Timing |
|----|---------|--------|
| L-1 | Supabase anon key public in bundle | Accepted — RLS required |
| L-2 | Bridge token in `/status` for localhost | Accepted |
| L-3 | Founder email hardcoded in `supabase.js` | v2.0 — move to RPC-only |
| L-4 | QA dev panel on localhost | Accepted |
| L-5 | Chart.js CDN without SRI | v1.1 |

---

## 8. Cost leakage scenarios

| Scenario | Mitigation | Residual risk |
|----------|------------|---------------|
| Henrik API spam | Bridge rate limits + 45/min outbound | Localhost attacker with token |
| Bridge setup spam | 8/min on `/setup/apply` | Low |
| Fake Overwolf matches | Schema validation + rate limit + dedupe | Optional token not set |
| Supabase match insert spam | RLS limits to own rows only | Signed-in user can still insert many rows |
| Supabase egress (squad views) | Intended feature; RLS limits to squad | Normal |
| **`app_settings` abuse** | **Eliminated after table drop** | None once migration run |

---

## 9. v1.0 release checklist (security)

### Must fix before v1.0

- [ ] **P0:** Run Step A query; if `app_settings_exists = true`, run **`docs/supabase/drop-app-settings.sql`**
- [ ] **P0:** Confirm `app_settings_still_exists = false` (release blocker)
- [ ] Run `docs/supabase/v1-full-setup.sql` on new projects only (no longer creates `app_settings`)
- [ ] Confirm upsert save works (no legacy delete-all in console)
- [ ] Verify `config/grind-config.json` is **not** in git remote
- [ ] Rotate Henrik/Riot keys if exposure suspected
- [ ] Deploy XSS fixes (`ui.js`, `groups.js`, `dom-safe.js`)
- [ ] Restart launcher after bridge security changes (auth token)
- [ ] Prefer `HENRIK_API_KEY` in `.env` over wizard for production PCs

### Can wait until v1.1

- [ ] Supabase error message sanitization
- [ ] OAuth PKCE flow
- [ ] Client save debounce / rate limit
- [ ] CSV formula neutralization
- [ ] `OVERWOLF_BRIDGE_TOKEN` for extension
- [ ] Remove legacy Supabase delete-all fallback code
- [ ] Escape remaining display names in welcome header

### Can wait until v2.0

- [ ] Edge Function for match insert rate limiting
- ~~Remove `app_settings` from SQL template entirely~~ **Done (P0)**
- [ ] Server-side audit logging table
- [ ] Move founder UID logic fully to Supabase RPC config

---

## 10. Fixes applied during this audit

| Fix | Files |
|-----|-------|
| Escape match notes | `js/ui.js` |
| Escape inline tags | `js/ui.js` |
| Escape auth bar name + sanitize avatar URL | `js/ui.js` |
| Escape squad name + invite code in detail | `js/groups.js` |
| Prior: squad member XSS, dom-safe helpers | `js/groups.js`, `js/core/dom-safe.js` |
| Prior: bridge rate limits, CORS, validation | `scripts/bridge-security.mjs` |
| Prior: central error log | `js/core/error-log.js` |
| P0: remove `app_settings` from setup SQL | `v1-full-setup.sql`, `schema.sql` |
| P0: production drop migration | `docs/supabase/drop-app-settings.sql` |

---

## 11. Verification commands (manual)

```bash
# Confirm no service_role or OpenAI keys in tracked source
rg -i "service_role|sk-proj|openai|discord.com/api/webhooks" --glob "!node_modules/**" --glob "!tools/launcher/**"

# Confirm grind-config not tracked
git ls-files config/grind-config.json

# Confirm anon role in client key (decode JWT payload middle segment)
# Should contain "role":"anon"
```

After deploy, smoke test:

1. Log match with `<script>alert(1)</script>` in notes — should render as text
2. Squad member with HTML in display name — should render as text
3. Rapid bridge POST — should receive 429
4. Sign in as User A — cannot PATCH User B's matches via REST (403/RLS)

---

*Re-audit after Supabase schema changes or new external integrations.*
