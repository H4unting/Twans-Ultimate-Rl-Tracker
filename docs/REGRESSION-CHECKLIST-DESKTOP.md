# Desktop Regression Checklist

Manual smoke matrix for **Twans Ultimate Tracker** desktop path, plus automated/static results from the product reset session.

Reference: [`RELEASE-CHECKLIST.md`](RELEASE-CHECKLIST.md), [`ARCHITECTURE.md`](ARCHITECTURE.md), [`DESKTOP-VISION.md`](DESKTOP-VISION.md).

**Legend:** PASS · FAIL · NOT RUN

---

## Automated / static (2026-06-10)

| Check | Result | Notes |
|-------|:------:|-------|
| `node --check` all `js/**/*.js` (89 files) | **PASS** | 0 syntax errors |
| Import resolution (edited modules) | **PASS** | `boot.js`, `env.js`, `sessions.js`, `home.js`, `app.js` |
| `buildProfilePatch` in `supabase.js` | **PASS** | Restored in prior session (not re-broken) |
| Electron `main.cjs` spawns `start-grind.mjs` | **NOT RUN** | Requires packaged exe smoke |
| Bridge heartbeat `/api/bridge/status` | **NOT RUN** | Runtime integration |
| Offline queue flush | **NOT RUN** | Requires airplane-mode test |

---

## Authentication

| Test | Automated | Manual desktop | Pass |
|------|:---------:|:--------------:|:----:|
| Google sign-in | NOT RUN | NOT RUN | |
| Email sign-in / sign-up | NOT RUN | NOT RUN | |
| Logout → login screen | NOT RUN | NOT RUN | |
| Password reset email | NOT RUN | NOT RUN | |
| Boot gate — loading until services ready (Electron) | NOT RUN | NOT RUN | |
| Auth error copy (no localhost jargon) | **PASS** | NOT RUN | Static string review |

---

## Sync & data integrity

| Test | Automated | Manual desktop | Pass |
|------|:---------:|:--------------:|:----:|
| `loadUserData()` on boot | NOT RUN | NOT RUN | |
| RL `repairPlaylistMMRChain` on boot | NOT RUN | NOT RUN | |
| Val `repairRankChain` on boot | NOT RUN | NOT RUN | |
| Offline queue enqueue on network fail | NOT RUN | NOT RUN | |
| Offline queue flush on reconnect | NOT RUN | NOT RUN | |
| Profile save (`buildProfilePatch`) | NOT RUN | NOT RUN | |

---

## Rocket League

| Test | Automated | Manual desktop | Pass |
|------|:---------:|:--------------:|:----:|
| Onboarding RL MMR step | NOT RUN | NOT RUN | |
| Play RL → launch | NOT RUN | NOT RUN | |
| Auto session start on process | NOT RUN | NOT RUN | |
| Auto session end on quit | NOT RUN | NOT RUN | |
| Manual Start hidden (desktop) | **PASS** | NOT RUN | Code path `shouldHideManualSessionControls()` |
| Auto-log match end | NOT RUN | NOT RUN | |
| Post-match MMR confirm | NOT RUN | NOT RUN | |
| Manual log from dock | NOT RUN | NOT RUN | |
| Edit / delete match | NOT RUN | NOT RUN | |
| Dashboard / analytics charts | NOT RUN | NOT RUN | |

---

## Valorant

| Test | Automated | Manual desktop | Pass |
|------|:---------:|:--------------:|:----:|
| Onboarding val-rank + val-rr steps | NOT RUN | NOT RUN | |
| Henrik setup Apply & Go | NOT RUN | NOT RUN | |
| RR promotion ≥100 carry (`applyRRDelta`) | NOT RUN | NOT RUN | |
| Demotion below 0 | NOT RUN | NOT RUN | |
| Auto-log after match | NOT RUN | NOT RUN | |
| Manual log K/D/A + RR | NOT RUN | NOT RUN | |
| Val status pill human labels | **PASS** | NOT RUN | No "Val API error" in UI text |

---

## Sessions

| Test | Automated | Manual desktop | Pass |
|------|:---------:|:--------------:|:----:|
| Auto start on game process | NOT RUN | NOT RUN | |
| Auto end on process exit | NOT RUN | NOT RUN | |
| End early button when active | NOT RUN | NOT RUN | |
| Session summary modal | NOT RUN | NOT RUN | |
| Session persist across refresh | NOT RUN | NOT RUN | |

---

## Review / squad / goals

| Test | Automated | Manual desktop | Pass |
|------|:---------:|:--------------:|:----:|
| Focus page loads | NOT RUN | NOT RUN | |
| Reports page loads | NOT RUN | NOT RUN | |
| Goals persist | NOT RUN | NOT RUN | |
| Squad create / join | NOT RUN | NOT RUN | |

---

## Desktop shell

| Test | Automated | Manual desktop | Pass |
|------|:---------:|:--------------:|:----:|
| Embedded window (not external browser) | NOT RUN | NOT RUN | |
| Close window → tray remains | NOT RUN | NOT RUN | |
| Tray Open / Quit | NOT RUN | NOT RUN | |
| Status pill: Starting → Waiting → Tracking | NOT RUN | NOT RUN | |
| NSIS installer fresh VM | NOT RUN | NOT RUN | |

---

## Onboarding wizard (4 steps after sign-in)

| Step | Spec | Code | Pass |
|------|------|------|:----:|
| 1. Choose games | `onboarding-wizard.js` `games` | Implemented | **PASS** (static) |
| 2. RL MMR baseline | `rl-mmr` (if RL picked) | Implemented | **PASS** (static) |
| 3. Val rank | `val-rank` (if Val picked) | Implemented | **PASS** (static) |
| 4. Val RR | `val-rr` (if Val picked) | Implemented | **PASS** (static) |
| Skip if existing matches | `games.length > 0` | Implemented | **PASS** (static) |
| End-to-end new account | — | — | **NOT RUN** |

---

## Sign-off

| Role | Status |
|------|--------|
| Static regression | **PASS** (89/89 JS syntax) |
| Desktop manual smoke | **NOT RUN** — blocker for v1.0 tag |
| Installer VM smoke | **NOT RUN** — blocker for v1.0 tag |

Next: run § Manual smoke in [`DESKTOP-VISION.md`](DESKTOP-VISION.md) on real hardware with `TwansUltimateTrackerSetup.exe`.
