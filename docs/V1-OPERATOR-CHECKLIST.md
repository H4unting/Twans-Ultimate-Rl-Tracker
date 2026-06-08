# V1 Operator Checklist

**Product:** Twans Ultimate Tracker  
**Last verified:** June 7, 2026 (Supabase MCP + code quick wins)

Use this before tagging `v1.0.0-beta.1` or `v1.0.0`.

---

## Code quick wins (implemented)

| Item | Status |
|------|--------|
| Host-aware banner on non-`localhost:8080` with USER-SETUP link | Done (`js/env.js`, `js/bridge-ui.js`, `js/game-ui.js`) |
| Toast when `loadSettings` falls back to defaults | Done (`js/supabase.js`) |
| Remove `[REVIEW]` / `[SQUAD]` debug `console.log` | Done |
| README: production = `.bat` launchers, not `npm run dev` | Done |
| LOW cleanup: `renderWelcomeHeader`, deprecated env helpers, empty `onLoad` stubs | Done |
| Deprecation banner on `docs/supabase/schema.sql` | Done |

---

## Supabase — live project status

**Project:** `pwuxocijdnuhhghufizn` (H4unting's Project) — **ACTIVE_HEALTHY**

### Tables (RLS enabled)

| Table | Rows | RLS |
|-------|-----:|-----|
| `matches` | 100 | ON |
| `profiles` | 3 | ON |
| `user_settings` | 2 | ON |
| `groups` | 1 | ON |
| `group_members` | 2 | ON |

`app_settings` — **absent** (expected).

`matches.game` + `matches.stats` columns — **present** (multi-game migration applied).

### RLS policies (verified)

- `matches` — own insert/update/delete; select via `can_view_player_stats` (squad-aware)
- `profiles` — own + squad peer read; own update
- `user_settings` — own ALL
- `groups` / `group_members` — member read

**No** `Allow anon read/write matches` policy — legacy SEC-H1 risk **not present**.

### RPCs (verified)

`can_view_player_stats`, `claim_founder_uid`, `create_grind_squad`, `delete_own_account`, `handle_new_user`, `is_group_member`, `join_grind_squad`, `leave_grind_squad`, `shares_group_with`

### SQL files — when to run

| File | Run if… | Prod status |
|------|---------|-------------|
| `v1-full-setup.sql` | Fresh project or missing tables/RLS | **Applied** (inferred from live schema) |
| `harden-public-access.sql` | After v1 setup; revokes PUBLIC on DEFINER RPCs | **Verify** — advisors still warn on DEFINER execute |
| `delete-own-account.sql` | Account deletion UI | **Applied** (`delete_own_account` exists) |
| `avatar-storage.sql` | Avatar bucket upload (optional — inline fallback works) | **Likely applied** (avatars bucket exists; listing warning) |
| `multi-game.sql` | Older DB missing `game` column | **Applied** |
| `groups-schema.sql` / `groups-schema-fix.sql` | Squad features on legacy DB | **Applied** (groups tables + policies) |
| `drop-app-settings.sql` | Legacy `app_settings` present | **N/A** (table absent) |
| `schema.sql` | — | **DO NOT RUN** (deprecated, unsafe anon policy) |

**Do not apply** `schema.sql` or destructive drops without backup.

---

## Dashboard actions (manual)

- [ ] **Auth → Email** — enable [leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) (SEC-M4; currently disabled per advisor)
- [ ] **Auth → URL configuration** — confirm `localhost:8080` + GitHub Pages URL in redirect allowlist
- [ ] **Auth → Providers** — Google OAuth enabled
- [ ] Re-run `harden-public-access.sql` if security advisor DEFINER warnings are unacceptable
- [ ] Optional: tighten avatars bucket listing policy (advisor WARN on public list)

---

## Smoke tests (required before tag)

Run on `localhost:8080` with both games per `docs/RELEASE-CHECKLIST.md`:

1. [ ] Sign in (Google + email)
2. [ ] RL manual log → edit → delete
3. [ ] Val manual log → edit → delete
4. [ ] RL auto-log with launcher running
5. [ ] Val auto-log end-to-end (Henrik key + `priorEnd` path)
6. [ ] Squad create / join / view member stats
7. [ ] Account deletion on staging (type `DELETE`)
8. [ ] GitHub Pages bookmark — confirm **Manual log only** banner + manual log works
9. [ ] Settings load error path — refresh; confirm toast before save

---

## Release sign-off

- [ ] `docs/RELEASE-RISKS.md` acceptance table signed
- [ ] `docs/V1-ACCEPTED-RISKS.md` updated for known gaps (auto-log on Pages, CSV injection, etc.)
- [ ] Tag recommendation: `v1.0.0-beta.1` before stable `v1.0.0`

---

## Remaining V1 blockers (not code-fixable here)

1. No automated regression test suite
2. Leaked-password protection (dashboard toggle)
3. Manual smoke matrix must pass
4. Product owner sign-off on accepted risks
