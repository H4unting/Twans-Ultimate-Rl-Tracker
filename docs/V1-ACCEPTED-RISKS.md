# V1.0 Accepted Risks

**Version:** `1.0.0-rc1` → target `v1.0.0`  
**Date:** 2026-06-03  
**Purpose:** Document Warning-tier items from `STABILITY-REPORT.md` and release audits. Product Owner marks acceptance before tag.

**Legend — Likelihood:** Low = rare edge / specific env · Medium = plausible in normal use · High = expected for some users

---

## Primary candidates (explicit review)

| # | Risk | Impact | Likelihood | Accepted for v1.0? |
|---|------|--------|:----------:|:--------------------:|
| 1 | **`syncGameSliceLegacy` DELETE→POST fallback** (`js/supabase.js`) — if upsert fails, all rows for a game deleted then re-inserted; POST failure = empty remote history | **Critical** data loss for one game slice | **Low** (only if unique index missing or upsert errors) | ☐ Yes ☐ No |
| 2 | **`loadSettings` silent catch** (`js/supabase.js:325`) — network/auth failure returns default goals, riot ID, baselines with no toast | User sees reset settings; may overwrite remote settings on next save | **Medium** on flaky network | ☐ Yes ☐ No |
| 3 | **`persistChain` race** (`js/matches.js`) — `state.activeGame` read at task run time; `clearGameHistory` bypasses queue | Wrong-game save or deleted matches reappearing after clear | **Low** | ☐ Yes ☐ No |
| 4 | **Squads Val weekly snapshot** (`js/groups.js:108`) — `buildWeeklyReport(..., 0)` omits Val `gameId` | Val squad weekly card shows 0 / wrong RR gain | **High** for Val squad users | ☐ Yes ☐ No |
| 5 | **Overwolf RR estimation** (`scripts/valorant-bridge.mjs`, `auto-log-handlers.js`) — no RR on Overwolf path | Every Overwolf match needs manual RR confirm; chain estimated | **High** for Overwolf users | ☐ Yes ☐ No |
| 6 | **Boot auto-purge** (`js/boot.js`) — silent ghost + duplicate Val row removal on load | Unexpected row removal without confirm (intended cleanup) | **Medium** if bad auto-log rows exist | ☐ Yes ☐ No |

---

## Additional warnings (STABILITY-REPORT)

| # | Risk | Impact | Likelihood | Accepted for v1.0? |
|---|------|--------|:----------:|:--------------------:|
| 7 | **Auth CDN dependency** (`js/auth.js`) — Supabase JS from CDN; blocked = no sign-in | Cannot use app | **Low** (Brave/offline) | ☐ Yes ☐ No |
| 8 | **Two-phase sync orphan rows** (`syncGameSlice` upsert then DELETE) — DELETE fails → zombie rows reload | Phantom duplicate matches | **Low** | ☐ Yes ☐ No |
| 9 | **`loadUserGroups` silent `[]`** (`js/supabase.js:484`) — any error → empty squads | Squads appear broken, no error | **Low** | ☐ Yes ☐ No |
| 10 | **Session localStorage silent fail** (`js/sessions.js:76`) — quota/private mode | Session not restored on refresh | **Low** | ☐ Yes ☐ No |
| 11 | **Bridge offline on GitHub Pages** (by design) | No auto-log on live site; manual only | **High** for Pages-only users | ☐ Yes ☐ No |
| 12 | **Val 0/0/0 premature auto-log** — ghost rows; mitigated by boot purge + toast | Bad row briefly exists | **Medium** | ☐ Yes ☐ No |
| 13 | **Auto-dedupe on Match Logs render** (`js/app.js:389`) — collapses dupes without button click | Surprise data mutation on page visit | **Low** | ☐ Yes ☐ No |
| 14 | **Notes unescaped in match log** (`js/ui.js`) — stored HTML in notes column | Self-XSS / markup in table | **Low** | ☐ Yes ☐ No |
| 15 | **Squad member cache on game switch** (`js/groups.js` `ui.gamesCache`) | Stale member stats when switching RL↔Val | **Medium** | ☐ Yes ☐ No |
| 16 | **`savePrefs` no try/catch** (`js/quicklog.js:209`) — localStorage quota | Uncaught exception mid-boot | **Low** | ☐ Yes ☐ No |
| 17 | **RL bridge 30s TCP delay** (`scripts/rl-bridge.mjs`) — auto-log ON but stats not connected yet | Miss first RL auto-log if instant queue | **Low** | ☐ Yes ☐ No |
| 18 | **`isValorantRunning` semantic** — true when armed, not when game process open | Misleading status pill | **Medium** (cosmetic) | ☐ Yes ☐ No |

---

## Recommended default stance (agent — PO overrides)

| # | Risk | Recommend accept v1.0? | Rationale |
|---|------|:----------------------:|-----------|
| 1 | syncGameSliceLegacy | **No** — verify Supabase schema instead | Confirm upsert path in prod; accept only if SQL migrated |
| 2 | loadSettings silent catch | **Yes** with monitoring | Defer toast to v1.0.1; document in SETUP |
| 3 | persistChain race | **Yes** | Rare; document “don’t clear history during save” |
| 4 | Squads Val snapshot | **Yes** if squads are secondary | Fix in v1.0.1 if Val squads are launch feature |
| 5 | Overwolf RR | **Yes** | Post-match confirm is acceptable workaround |
| 6 | Boot auto-purge | **Yes** | Intentional; reduces bad auto-log junk |
| 7–11 | Infra / design | **Yes** | Documented limitations |
| 12–18 | Edge / cosmetic | **Yes** | Track in v1.0.1 backlog |

---

## Preconditions before accepting risk #1

- [ ] Supabase project has run `docs/supabase/multi-game.sql`
- [ ] Unique constraint on `(user_id, game, match_num)` exists
- [ ] Normal save shows upsert POST in Network tab — **no** console line: `upsert unavailable — falling back to replace save`

---

## Sign-off

| Product Owner | Date | Accept warnings marked Yes above | Proceed to tag |
|---------------|------|:--------------------------------:|:--------------:|
| | | ☐ | ☐ |

**If any item marked No is reproduced in smoke test → treat as release blocker; do not tag until fixed or re-accepted.**
