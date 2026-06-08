# Logic Audit — Phase 2 System Review

**Product:** Twans Ultimate Tracker  
**Audit date:** June 7, 2026  
**Method:** Static code review per major system — internal consistency, impossible states, circular deps, broken workflows, stale state, race conditions. **No code modified.**

**Legend:** **PASS** = logic sound for v1.0 if smoke test confirms · **WARNING** = edge cases or silent degradation · **FAIL** = blocker if reproduced

---

## Summary matrix

| System | Verdict | Primary evidence |
|--------|---------|------------------|
| Auth | **PASS** (Warning) | `js/auth.js` — PKCE OAuth, session gate on CRUD |
| Supabase | **PASS** (Warning) | `js/supabase.js` — upsert + legacy fallback |
| Rocket League | **PASS** | `js/games/rocketleague/rank-chain.js`, `rl-live.js` |
| Valorant | **PASS** (Warning) | `js/games/valorant/rank-ladder.js`, `valorant-live.js` |
| Sessions | **PASS** (Warning) | `js/sessions.js` — localStorage + timer |
| Goals | **PASS** | `js/goals.js`, Reports editor |
| Focus | **PASS** | `js/focus.js` — tag-driven coaching |
| Reports | **PASS** (Warning) | `js/reports-ui.js` — Val uses RL report module in squads |
| Analytics | **PASS** | `js/analytics.js`, `js/insights.js` |
| Squads | **WARNING** | `js/groups.js` — RPC errors, empty catch → `[]` |
| Review (nav) | **PASS** | `js/nav.js` — section routing |
| Auto-log | **PASS** (Warning) | `js/auto-log-handlers.js` — RR estimation paths |
| Desktop bridge | **WARNING** | `js/bridge-client.js` — expected off on GH Pages |
| Profile | **PASS** (Warning) | `js/profile-ui.js` — deletion needs SQL RPC |
| Settings | **WARNING** | `js/supabase.js:loadSettings` silent default fallback |

**No FAIL ratings** from static review. Product Owner smoke test required.

---

## Auth

**Verdict: PASS** (Warning)

### Evidence

- `js/auth.js`: Supabase client with `flowType: 'pkce'` (not legacy implicit).
- CDN fallbacks: jsdelivr → esm.sh → `./vendor/supabase-js.mjs`.
- `getAccessToken()` feeds `sbFetch` Authorization header.
- `matches.js:requireSignedIn()` blocks saves when logged out.
- OAuth hash recovery: `recoverSessionFromUrlHash`, `hasPendingAuthHash`, boot failure UI in `index.html`.

### Internal consistency

- `onAuthChange` in `app.js` gates `bootApp()` — logged-out users never load remote data.
- Sign-out path: `clearSessionTimer`, `resetAppState`, `stopBridgeServices`, `resetBootState`.

### Warnings

| ID | Issue | File |
|----|-------|------|
| L-A1 | CDN blocked → boot failure (Brave Shields) | `auth.js:35–39` |
| L-A2 | `signOut` after `deleteOwnAccount` may throw if user already deleted — caught in `app.js:501` | `app.js:497–504` |

### Race conditions

| Scenario | Mitigation | Residual |
|----------|------------|----------|
| Slow save after sign-out | Session cleared client-side; save throws "Not signed in" | Uncaught promise if caller omits catch — most paths use try/catch |

---

## Supabase

**Verdict: PASS** (Warning)

### Evidence

- Load: `loadUserData()` — profile, matches, settings, groups sequential.
- Save: `syncGameSlice` upsert on `(user_id, game, match_num)` then DELETE orphans (`supabase.js:227–255`).
- `persistChain` in `matches.js:25–34` serializes concurrent writes per tab.
- Boot repairs chains and may persist fixes (`boot.js:89–109`).

### Warnings

| ID | Issue | Evidence | Impact |
|----|-------|----------|--------|
| L-S1 | Legacy delete-all fallback | `syncGameSliceLegacy` | Partial failure → empty remote history |
| L-S2 | Silent settings reset | `loadSettings` catch → defaults (`supabase.js:326–340`) | Goals/riot ID appear reset |
| L-S3 | `sbFetch` JSON.parse without try | `supabase.js:70` | HTML error page → boot throw |
| L-S4 | Multi-game column missing | Explicit error pointing to SQL | Blocks save until migration |

### Impossible states

- `match_num` renumbered on delete (`matches.js:107–108`) — consistent within slice.
- Val ghost matches (K+D+A=0) purged on boot (`boot.js:119–126`) — may remove edge-case manual rows.

---

## Rocket League

**Verdict: PASS**

### Evidence

- `buildGameFromForm` / `repairPlaylistMMRChain` maintain per-playlist MMR chain.
- Quick dock + full form share `submitGameLog` (`app.js:668–779`).
- Auto-log: `handleAutoLog` (`auto-log-handlers.js:173+`) uses `getLastMMR`, `estimateMMRDelta`.
- Post-match MMR confirm: `post-match.js` + `patchLastGame`.

### Workflows verified (logic)

1. Manual log → chain computes start from prior end → save → toast.
2. Edit match → `repairActiveGameChain` → persist.
3. Undo last → confirm → renumber matches.

### Stale state

- `state.homeChartMode` updated after log (`app.js:767`) — drives dashboard chart filter.

---

## Valorant

**Verdict: PASS** (Warning)

### Evidence

- Rank ladder: `applyRRDelta`, `normalizeRankName` (`rank-ladder.js`).
- Henrik path: `henrikRank` branch in `handleValorantAutoLog` (`auto-log-handlers.js:106–118`).
- Overwolf path: `valorant-live.js:94` — `source !== 'overwolf'` skips unarmed polling.
- Duplicate detection: notes contain `id:{matchId}` (`auto-log-handlers.js:63–69`).
- Display ranks: `resolveValorantMatchDisplayRanks` in log table (`ui.js`).

### Warnings

| ID | Issue | Evidence |
|----|-------|----------|
| L-V1 | RR estimated when Henrik rank missing | `auto-log-handlers.js:159` note `RR estimated` |
| L-V2 | First Competitive log without baseline → Iron 1 default | `auto-log-handlers.js:131–136` |
| L-V3 | Boot ghost purge may delete 0/0/0 rows | `boot.js:119`, `matches.js` purge helpers |
| L-V4 | Manual log requires K+D+A > 0 | `app.js:694–697` |

### Race conditions

- `autoLogInFlight` flag in `valorant-live.js:125–134` prevents double auto-log per poll cycle.
- `renderMatchLogs` auto-collapse dupes async (`app.js:402–406`) — possible render re-entry flicker.

---

## Sessions

**Verdict: PASS** (Warning)

### Evidence

- Timer: `setInterval` in `activateSession`; cleared via `clearSessionTimer` (`sessions.js:88–95`).
- Persistence: `localStorage` key `rl-grind-session:{gameId}:{userId}` (`sessions.js:53–77`).
- Stale session: `STALE_SESSION_MS` 6h check on restore.
- Session # sync: dock + form + `state.session.sessionNum`.

### Warnings

| ID | Issue | Evidence |
|----|-------|----------|
| L-SE1 | Session history local-only (not Supabase) | `sessions.js` — by design |
| L-SE2 | localStorage quota catch silent | `sessions.js:76` |
| L-SE3 | Open session inference may mismatch user intent | `inferOpenSession` |

### Listener leaks

- Session timer cleared on sign-out (`app.js:274`) — **PASS**.

---

## Goals

**Verdict: PASS**

### Evidence

- `normalizeGoalsStorage` on boot (`boot.js:128`).
- Saved via Reports page → `saveSettings` (`app.js:474–480`).
- Progress: `getGoalProgress` in `ui.js:212` and home dashboard.

### Consistency

- Goals are global (not per-game) in `user_settings.data` — UI does not split by active game (acceptable product choice).

---

## Focus

**Verdict: PASS**

### Evidence

- `renderFocusPage(games, goals, display)` (`focus.js`).
- Tag correlations from game module `getTagLossCorrelations`, `getRecurringMistakes`.
- Keyboard shortcut `F` navigates to focus (`app.js:655–657`).

### Empty state

- Zero games → coaching empty state (verify in smoke test).

---

## Reports

**Verdict: PASS** (Warning)

### Evidence

- `renderReportsPage` — week offset navigation (`state.reportsWeekOffset`).
- Weekly builders: `js/games/*/reports.js` `buildWeeklyReport`.
- Goals editor embedded on Reports page.

### Warning

| ID | Issue | Evidence |
|----|-------|----------|
| L-R1 | Squad Val weekly snapshot may use RL report shape | Noted in `STABILITY-REPORT.md` — squad cross-game display |

---

## Analytics

**Verdict: PASS**

### Evidence

- Playlist tabs filter games (`app.js:344–349`).
- Charts: `mmrChart`, `wlChart`, `rollingChart`, `trendChart` — destroyed before recreate (`charts.js`).
- Lock overlay: `#analytics-lock` for insufficient data.
- Insights grid from `analytics.js` + game `calcInsights`.

### Expensive operations

- Full analytics re-render on filter change — acceptable for typical match counts (<500).

---

## Squads

**Verdict: WARNING**

### Evidence

- Create/join/leave via SECURITY DEFINER RPCs (`supabase.js:492–506`).
- `loadUserGroups` catch → `[]` (`supabase.js:485–488`) — silent empty squads.
- Member games: `loadMemberGames` — relies on `can_view_player_stats` RLS (SQL).
- Render errors surfaced in `app.js:607–611` with empty state HTML.

### Warnings

| ID | Issue | Impact |
|----|-------|--------|
| L-G1 | RPC missing → join/create fails with raw PostgREST error | User confusion |
| L-G2 | `loadUserGroups` failure shows empty squad, not error | Silent degradation |
| L-G3 | `groups-schema-fix.sql` may be required on older DBs | Operator dependency |

---

## Review (navigation cluster)

**Verdict: PASS**

### Evidence

- Section routing: `getSectionForPage`, review sub-nav pills (`nav.js`).
- `renderActivePageContent` dispatches focus/analytics/reports (`app.js:579–622`).
- Console debug logs `[REVIEW]` — dev noise only.

---

## Auto-log

**Verdict: PASS** (Warning)

### Evidence

- RL: `rl-live.js` polls bridge, calls `handleAutoLog`.
- Val: `valorant-live.js` polls, arms polling, consumes match after log.
- Toggle: `isAutoLogEnabled` from `quicklog.js` / `auto-log-prefs.js`.
- Disabled auto-log: toast + consume without save (`valorant-live.js:119–122`).

### Fixed issue (verified in code)

- `priorEnd` ReferenceError in Val handler — **fixed** (`auto-log-handlers.js:157–159` uses `priorState.hasPrior`).

### Warnings

| ID | Issue |
|----|-------|
| L-AL1 | Bridge consume errors swallowed (`auto-log-handlers.js:66–68`) |
| L-AL2 | Overwolf RR always estimated (no Henrik on that path) |
| L-AL3 | Activity=0 consume + error toast — user may miss match |

---

## Desktop bridge

**Verdict: WARNING** (expected limitations)

### Evidence

- Heartbeat 2.5s (`bridge-client.js:5–9`).
- Online grace 120s visible / 15min hidden tab (`HIDDEN_GRACE_MS`).
- Wrong port detection: Live Server on :5500 → `needsLocalTrackerForAutoLog` (`env.js`).
- Mutating requests need `X-Bridge-Token` (`bridge-client.js:153–162`).
- Rate limiting in `scripts/bridge-security.mjs`.

### Expected off states

- GitHub Pages: bridge permanently unreachable — manual logging only.
- Bridge down: banner + setup wizard nudges (`setup-wizard.js`, `#bridge-hint-banner`).

---

## Profile

**Verdict: PASS** (Warning)

### Evidence

- Save: settings + profile PATCH + optional avatar (`app.js:532–577`).
- Delete: type `DELETE` + confirm → `deleteOwnAccount` (`supabase.js:535–551`).
- Avatar: Storage upload or inline fallback (`uploadProfileAvatar`).

### Warning

| ID | Issue |
|----|-------|
| L-P1 | `delete_own_account` RPC must exist in Supabase — graceful error if missing |
| L-P2 | `profileSchemaExtended` flag avoids PATCH on missing columns |

---

## Settings

**Verdict: WARNING**

### Evidence

- Stored in `user_settings.data` JSONB: goals, bio, riotId, rankBaselines, activeGame, colors.
- `loadSettings` empty catch returns defaults without user notification (`supabase.js:326–340`).
- Rank baselines inferred on boot if games exist but incomplete (`boot.js:113–117`).

### Risk

- Transient network failure on settings load → user sees defaults → save overwrites good remote data if user clicks save.

---

## Cross-cutting checks

### Circular dependencies

**PASS** — Module graph is acyclic at load time.

### Broken workflows (static)

| Workflow | Status |
|----------|--------|
| Sign in → boot → dashboard | PASS |
| Log → sync → refresh persists | PASS |
| Game switch → re-render all | PASS |
| Sign out → login screen | PASS |
| Account delete → login screen | PASS (if RPC exists) |

### Multi-tab race

**WARNING** — Two tabs logging simultaneously: last write wins (`RELEASE-RISKS R-M4`). `persistChain` only serializes within one tab.

---

## Findings vs recommendations

### Findings

1. Core logging, edit, delete, and chain repair logic is coherent for both games.
2. Silent degradation paths exist for settings load and squad load failures.
3. Auto-log is inherently environment-dependent (local launcher required).
4. No automated tests validate these flows.

### Recommendations (not executed)

1. Add toast when `loadSettings` falls back to defaults after authenticated load.
2. Surface squad load errors instead of empty state when RPC fails.
3. Document single-tab recommendation for concurrent logging.
4. Manual smoke matrix in `docs/RELEASE-CHECKLIST.md` before v1 tag.

---

*Phase 2 complete. No code modified.*
