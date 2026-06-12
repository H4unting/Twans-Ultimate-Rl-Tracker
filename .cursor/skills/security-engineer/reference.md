# Security Engineer — Twans Ultimate Tracker Reference

File map and patterns for security implementation. Read when fixing RLS, XSS, bridge abuse, or secrets exposure.

## vs review-security-auditor

| Skill | Mode | Output |
|-------|------|--------|
| `review-security-auditor` | Read-only | `docs/SECURITY-AUDIT.md` findings |
| `security-engineer` | Implement | Minimal code/SQL fixes in repo |

## DOM-safe helpers (`js/core/dom-safe.js`)

| Export | Use |
|--------|-----|
| `escapeHtml(s)` | Text nodes in HTML templates |
| `escapeAttr(s)` | Attribute values |
| `sanitizeImageUrl(url)` | `img src` — http/https/data:image only |
| `escapeCssColor(c, fallback)` | User hex colors in inline styles |

Call sites: `js/ui.js`, `js/groups.js`, `js/profile-ui.js`. Grep for new `innerHTML` and apply the same helpers.

## Supabase client (`js/supabase.js`)

- Uses anon JWT from `js/core/app-config.js` — **never** add `service_role`.
- All user rows scoped by `user_id = auth.uid()` in RLS (see SQL).
- `formatApiError` — sanitize errors shown in UI; avoid leaking schema hints.
- Offline queue: ensure queued writes cannot bypass auth when flushed.

## RLS source of truth (`docs/supabase/`)

| File | Purpose |
|------|---------|
| `v1-full-setup.sql` | Full prod setup — matches, profiles, user_settings, groups, storage |
| `auth-schema.sql` | Auth-linked profiles |
| `harden-public-access.sql` | Public read tightening |
| `drop-app-settings.sql` | Remove legacy `app_settings` (P0) |
| `groups-schema.sql` | Squad RPC + membership |
| `avatar-storage.sql` | Storage bucket policies |

Policy pattern for owned rows:

```sql
FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

Tables: `matches`, `profiles`, `user_settings`. Groups via RPC (`join_grind_squad`, etc.) — not open INSERT on `group_members`.

## Bridge security (`scripts/bridge-security.mjs`)

| Control | Detail |
|---------|--------|
| Bind | `127.0.0.1` only (start-grind / rl-bridge) |
| Body size | `MAX_BODY_BYTES` 32 KiB |
| CORS | `ALLOWED_ORIGINS` — localhost:8080 / 127.0.0.1:8080 |
| Auth POST | `AUTH_REQUIRED_POST` + `X-Bridge-Token` |
| Overwolf | `OVERWOLF_POST` — rate-limited, no token |
| Proxy allowlist | `PROXY_BRIDGE_ALLOWLIST` prefix match |
| Rate limits | `ROUTE_LIMITS` per route; `DEFAULT_LIMIT` fallback |
| Henrik | `checkHenrikRateLimit` — protect API cost |

Token lifecycle: `initBridgeAuth`, env `BRIDGE_AUTH_TOKEN`, exposed on `/status` to allowed origins only; held in memory in `js/bridge-client.js`.

Consumers: `scripts/start-grind.mjs`, `scripts/rl-bridge.mjs`, `scripts/valorant-bridge.mjs`.

## Secrets inventory

| Secret | Allowed location | Never |
|--------|------------------|-------|
| Supabase anon JWT | `js/core/app-config.js` | service_role in client |
| Henrik `HDEV-` | `.env`, gitignored `config/grind-config.json` | `js/`, Supabase |
| Riot `RGAPI-` | Same as Henrik | browser |
| Bridge token | Generated at launch; env override | localStorage |

`.env.example` documents env vars; `config/grind-config.json` is gitignored.

## Grep patterns (audit / pre-fix)

```
innerHTML
eval(
service_role
USING (true)
apikey
HDEV-
RGAPI-
document.write
```

## Related docs

- `docs/SECURITY-AUDIT.md` — open findings and verified-safe areas
- `docs/SECURITY-AUDIT-V1.md` — v1 scope snapshot
- `docs/PRODUCTION-READINESS.md` — release gates
- `docs/RELEASE-RISKS.md` — security-related release risks
