# V1.0 Release Smoke Test

Run this **before** tagging `v1.0.0` or running `push-updates.bat`.

**Rule:** Fix only blockers (crashes, broken workflows, data corruption, sync failures, onboarding blockers). No new features until the tag lands.

**Testers:**
- **You** — RL matches, Valorant matches, desktop bridge, existing account
- **Friend** — fresh ZIP install, fresh account, onboarding flow

---

## Prep

- [ ] `version.json` bumped (`app`: `1.0.0`, `cache` bumped if JS/CSS changed)
- [ ] Run `node scripts/sync-version.mjs`
- [ ] Confirm `js/core/version.js` matches `version.json`
- [ ] Feature freeze in effect — no replay, AI, leaderboards, social, or new games

---

## Authentication

| Test | You | Friend | Pass |
|------|:---:|:------:|:----:|
| Email sign-up | | ✓ | |
| Google sign-up | ✓ | ✓ | |
| Email login | | ✓ | |
| Google login | ✓ | | |
| Logout → login screen | ✓ | ✓ | |
| Password reset email sends | | ✓ | |
| Existing user login (data loads) | ✓ | | |

**Notes:**

---

## Rocket League

| Test | You | Friend | Pass |
|------|:---:|:------:|:----:|
| First-run rank setup (1's / 2's / 3's MMR) | | ✓ | |
| Manual log from dock | ✓ | ✓ | |
| Auto-log on match end | ✓ | | |
| Post-match card → confirm MMR | ✓ | | |
| Edit match → Save Changes persists | ✓ | ✓ | |
| Delete match | ✓ | ✓ | |
| Session start | ✓ | ✓ | |
| Session end | ✓ | ✓ | |
| Goals page — set goal, persists after refresh | ✓ | | |
| Focus page loads and reflects data | ✓ | | |
| Reports page loads | ✓ | | |
| Rank chain repair (boot with inconsistent MMR) | ✓ | | |
| Game switcher → RL dashboard/charts correct | ✓ | ✓ | |

**Notes:**

---

## Valorant

| Test | You | Friend | Pass |
|------|:---:|:------:|:----:|
| First-run rank setup (Competitive RR only) | | ✓ | |
| Manual log (K/D/A, RR) | ✓ | ✓ | |
| Auto-log on match end (Henrik key configured) | ✓ | | |
| RR updates across multiple logs | ✓ | | |
| Edit match → Save Changes persists | ✓ | ✓ | |
| Delete match | ✓ | ✓ | |
| Rank chain repair (boot with inconsistent RR) | ✓ | | |
| Goals page | ✓ | | |
| Reports page | ✓ | | |
| Focus page | ✓ | | |
| Swiftplay does **not** prompt for RR in rank setup | | ✓ | |

**Notes:**

---

## Database / account types

| Scenario | Pass | Notes |
|----------|:----:|-------|
| **Fresh account** — sign up, rank setup, first log saves | | |
| **Existing account** — login, data loads, edit/delete works | | |
| **Empty account** — no matches, dashboard empty state OK | | |
| **Large account** (100+ matches) — boot < 30s, pages load | | |
| Squads page — no policy / recursion error | | |
| `docs/supabase/v1-full-setup.sql` on new project (if applicable) | | |

---

## Desktop (gaming PC)

| Test | Pass | Notes |
|------|:----:|-------|
| `Rocket League Tracker.bat` starts without bridge errors | | |
| RL bridge connects (BakkesMod Stats API) | | |
| `Valorant Tracker.bat` / Val bridge starts clean | | |
| **Twans Auto-Log.exe** tray app runs | | |
| Tray → Open tracker works | | |
| Auto-log toggle in dock syncs with bridge | | |
| Sync status indicator accurate (online/offline) | | |
| Auto startup (optional — if configured) | | |

---

## Deployment

| Test | Pass | Notes |
|------|:----:|-------|
| `push-updates.bat` completes (copy + commit + push) | | |
| GitHub Pages loads after hard refresh (`Ctrl+Shift+R`) | | |
| Cache bust — new `?v=` in `index.html` loads updated JS | | |
| Supabase connectivity on live URL (not just localhost) | | |
| Friend with old auto-log ZIP told to re-download if bridge changed | | |

---

## Blockers found

| # | Area | Steps to reproduce | Severity | Fixed? |
|---|------|-------------------|----------|--------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

**Severity:** `blocker` = cannot ship · `major` = workaround exists · `minor` = ship with known issue

---

## Release gate

All **blockers** resolved. Major issues documented or fixed.

```bat
git tag v1.0.0
git push origin v1.0.0
```

- [ ] Tag pushed
- [ ] Live site verified post-tag
- [ ] Announce: **Twans Ultimate Tracker v1.0 Released**

**Date tested:** ___________  
**Testers:** ___________
