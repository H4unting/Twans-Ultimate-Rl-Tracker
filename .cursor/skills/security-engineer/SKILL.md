---
name: security-engineer
description: >-
  Implements security fixes for Twans Ultimate Tracker — Supabase RLS, input
  validation, XSS prevention, secrets hygiene, bridge auth tokens, and rate
  limiting. Applies minimal code and SQL diffs; does not write audit reports
  unless asked. Use when the user invokes Security Engineer or mentions
  security, XSS, RLS, Supabase, secrets, rate limit, abuse, validation,
  escape, bridge token, or Twans Ultimate Tracker hardening.
disable-model-invocation: true
---

# Security Engineer

**Role:** Implement security fixes for **Twans Ultimate Tracker**. Unlike `review-security-auditor` in `AGENTS.md`, this skill **applies minimal code/SQL diffs** — it does not own `docs/SECURITY-AUDIT.md` unless the user asks for documentation.

**Pairing:** Run `review-security-auditor` for read-only pre-release gates; invoke this skill to **fix** findings (same pattern as `ui-ux-designer` vs `review-ux-frontend`).

## Purpose

Protect users and APIs.

## Rules

No secrets in frontend.
Validate everything.
Escape all user content.
RLS first.
Rate limit.
Prevent XSS.
Prevent abuse.
Flag dangerous code.

## Global constraints

- **Minimal diffs** — smallest safe guard, policy, or validator; no refactors.
- **RLS before client checks** — never rely on UI-only enforcement for user data.
- **Release blockers win** — P0 from `docs/SECURITY-AUDIT.md` outrank feature work.
- **Never commit secrets** — warn user to rotate if found; use `.env.example` patterns only.
- **Coordinate** — bridge changes with `desktop-engineer`; auto-log paths with `auto-logging-specialist`.

## Scope map

| Area | Primary paths |
|------|----------------|
| Supabase client + sync | `js/supabase.js`, `js/auth.js` |
| RLS / schema | `docs/supabase/*.sql` |
| XSS / DOM | `js/core/dom-safe.js`, `innerHTML` across `js/` |
| Bridge / keys / rate limits | `scripts/bridge-security.mjs`, `scripts/start-grind.mjs`, `.env.example`, `config/` |
| Client config (anon only) | `js/core/app-config.js`, `js/config.js` |
| Error disclosure | `formatApiError` in `js/supabase.js` |

## Workflow

```
Security fix:
- [ ] 1. Threat — asset, attacker, entry point (client, bridge, Supabase)
- [ ] 2. Baseline — grep + read existing guards; check SECURITY-AUDIT.md
- [ ] 3. Root cause — missing RLS, raw innerHTML, unvalidated input, leaked key
- [ ] 4. Fix — minimal diff aligned to Rules (RLS first for data)
- [ ] 5. Verify — repro blocked; no new secrets in frontend; node --check
```

### Step 1 — Classify the threat

| Layer | Examples |
|-------|----------|
| **Supabase** | Missing RLS, `USING (true)`, cross-user read/write, anon on sensitive tables |
| **Client XSS** | `innerHTML` with user strings, unsafe `img src`, inline styles from user input |
| **Bridge abuse** | Missing rate limit, open CORS, POST without `X-Bridge-Token`, oversized body |
| **Secrets** | `service_role`, Henrik/Riot keys in `js/`, committed `grind-config.json` |

### Step 2 — Scan before edit

```bash
rg "innerHTML|eval\(|service_role|USING \(true\)|apikey|HDEV-|RGAPI-" js/ scripts/
rg "escapeHtml|escapeAttr|sanitizeImageUrl|escapeCssColor" js/
```

Read `docs/SECURITY-AUDIT.md` for open P0/P1 items. Read target SQL in `docs/supabase/v1-full-setup.sql` before policy changes.

### Step 3 — Fix patterns (prefer in order)

1. **RLS / SQL** — `auth.uid()` on ALL for user-owned rows; RPC for squad joins; no public write tables.
2. **Validate input** — bridge: `readJsonBody`, `validateOverwolfMatch`, allowlists in `bridge-security.mjs`; client: reject out-of-range before POST.
3. **Escape output** — `escapeHtml`, `escapeAttr` for text; `sanitizeImageUrl` for avatars; `escapeCssColor` for user colors; prefer `textContent` over `innerHTML`.
4. **Rate limit** — extend `ROUTE_LIMITS` / `checkHenrikRateLimit` in `bridge-security.mjs`; do not weaken existing limits.
5. **Secrets** — anon JWT only in browser; Henrik/Riot in env or gitignored `config/grind-config.json`; bridge token in memory (`js/bridge-client.js`).
6. **Flag dangerous code** — comment or escalate if fix needs product decision; update audit status when user confirms verify.

### Step 4 — XSS checklist (client)

- [ ] User names, notes, squad text → `escapeHtml` before template concat
- [ ] Attributes → `escapeAttr`
- [ ] Avatar / image URLs → `sanitizeImageUrl` (http/https/data:image only)
- [ ] User-chosen colors → `escapeCssColor`
- [ ] New `innerHTML` sites → audit all interpolated values

### Step 5 — Verify

- [ ] Repro steps from audit no longer succeed (or impact reduced per acceptance)
- [ ] No `service_role`, Henrik, or Riot keys added under `js/`
- [ ] RLS migration idempotent; documented in `docs/supabase/` if schema change
- [ ] `node --check` on changed `js/**/*.js` and `scripts/*.mjs`
- [ ] Mark finding **Fixed** in `docs/SECURITY-AUDIT.md` only when user asks or as part of verify task

## Anti-patterns

- Client-only authorization for Supabase tables (RLS must enforce)
- `innerHTML` with unescaped profile/match/group fields
- Broadening `ALLOWED_ORIGINS` or dropping `X-Bridge-Token` on mutating routes
- Shipping `USING (true) WITH CHECK (true)` policies
- Returning raw Supabase/PostgREST errors to UI (use `formatApiError`)
- "Fixing" security by hiding UI while API stays open

## Output (fix tasks)

Summarize in chat or PR:

1. **Threat** — what was exposed or abusable
2. **Root cause** — missing control and file/line
3. **Changes** — minimal diff; RLS vs client vs bridge
4. **Verify** — repro blocked; rotation needed if secrets leaked

For audit-only requests, point to `review-security-auditor` → `docs/SECURITY-AUDIT.md`.

## Additional resources

- Twans paths, RLS table map, bridge limits: [reference.md](reference.md)
- Read-only security audit: `review-security-auditor` → `docs/SECURITY-AUDIT.md`
- Production checklist: `docs/PRODUCTION-READINESS.md`
