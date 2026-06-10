# Twans Ultimate Tracker — Roadmap

Planning doc only. **Desktop-first** as of the [`DESKTOP-VISION.md`](DESKTOP-VISION.md) pivot.

Engineering reference: [`ARCHITECTURE.md`](ARCHITECTURE.md). Desktop regression: [`REGRESSION-CHECKLIST-DESKTOP.md`](REGRESSION-CHECKLIST-DESKTOP.md).

Current version: **1.3.0-desktop** → target: **v1.0.0 tag** (desktop installer GA)

**Product reset rule:** Remove friction only — no new features, no cosmetic redesigns until v1.0 ships.

Maintained by **Product Owner**. Implementation order follows [`TEAM-WORKFLOW.md`](TEAM-WORKFLOW.md) — one owning role per task.

---

## Current priorities (now)

**Desktop app is the product.** GitHub Pages remains a manual-log bookmark only.

| # | Priority | Owner | Status |
|---|----------|-------|--------|
| 1 | **Phase 1 desktop foundation** — embedded window, human status, tray, auto sessions, hide manual Start, boot gate, onboarding, offline queue, ARCHITECTURE.md | Desktop / Frontend | **Done** — [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| 2 | **Installer smoke test** — fresh Windows VM: Setup.exe → sign in → Play → auto-log one match | QA Lead | **NOT RUN** |
| 3 | **Complete release smoke** — [`REGRESSION-CHECKLIST-DESKTOP.md`](REGRESSION-CHECKLIST-DESKTOP.md) + `RELEASE-CHECKLIST.md` | QA Lead | Static **PASS** (89/89 `node --check`); manual **NOT RUN** |
| 4 | **Phase 2 in-app settings** — no JSON / `.bat` for players | Frontend Lead | Planned |
| 5 | **Ship v1.0.0** — tag, push, announce with **TwansUltimateTrackerSetup.exe** | Release Manager | Blocked on #2–#3 |

---

## Desktop phases (primary track)

See full detail in [`DESKTOP-VISION.md`](DESKTOP-VISION.md).

| Phase | Goal | Gate |
|-------|------|------|
| **1 — Foundation** ✅ | Exe + embedded UI + friendly status + sessions + onboarding | Friend completes loop unaided |
| **2 — In-app config** | Henrik key, Riot ID, paths in UI; hide grind-config | Zero file editing for new player |
| **3 — Runtime** | Bundled Node, stronger Val detection | Clean install on fresh VM |
| **4 — Polish & updates** | Notifications, auto-update like Discord | 5+ daily installer users |
| **5 — Expansion** | macOS evaluation, optional slim builds | Demand-driven |

---

## Sprint: V1.0 Release (desktop GA)

**Goal:** Ship the **installer** as the default download — not batch files or GitHub Pages auto-log.

1. Phase 1 desktop ✅  
2. Installer + portable smoke on real hardware  
3. Feature freeze except blockers (crash, data loss, sync, onboarding)  
4. Tag `v1.0.0` with **`TwansUltimateTrackerSetup.exe`** artifact  
5. Announce: Install → Sign in → Play  

### Feature freeze (until v1.0.0)

Do **not** build:

- Replay analysis / import  
- AI chatbots or AI coaching  
- Public leaderboards · social feeds  
- New game support  
- Coach payments / marketplace · Discord economy  
- Native mobile app  

OK to fix: crashes, broken workflows, data corruption, sync failures, onboarding blockers, desktop connection issues.

---

## V1.0 — Stability (desktop)

Ship:

- Auth (Google + email)  
- Multi-game (RL + Valorant)  
- Manual + auto logging via **desktop app**  
- Sessions (auto start/end on process)  
- Goals, focus, reports, analytics  
- Supabase sync + offline queue retry  
- **TwansUltimateTrackerSetup.exe** + portable exe  
- GitHub Pages — manual log bookmark only  

**Gate:** Desktop smoke test passes → tag `v1.0.0`.

---

## V1.1 — Onboarding polish

**Goal:** Random player → first logged game in ~5 minutes (installer path only).

- Refine wizard copy / skip paths  
- Tiny in-app help: auto-log, RL name, Val Riot ID, goals  
- Remove remaining technical hints in setup wizard  

**Gate:** Friend with zero context completes onboarding unaided via **Setup.exe**.

---

## V1.2 — Weekly Reports

**Goal:** Give users a reason to come back.

- In-app weekly summary (games, win rate, MMR/RR delta)  
- Optional email digest (later)  

**Gate:** Report generates correctly from real match data.

---

## V1.3 — Coaching Improvements

**Goal:** Move from stats → insights.

- Primary weakness detection (e.g. tilt patterns in losses)  
- Actionable recommendations  
- Extend `insights.js` per game — don't rewrite  

**Gate:** Insights match manual review of same data.

---

## V2.0 — Desktop depth (was “Electron polish”)

**Goal:** Discord-tier daily driver on gaming PC.

- Phase 2–4 from desktop vision (settings, bundled Node, auto-update)  
- Tray notifications, single-instance focus  
- Tauri evaluation **only after** Electron installer proves adoption  

**Gate:** 5+ users run **installer** daily without hand-holding.

---

## V3.0 — Replay Support

**Goal:** Rocket League depth feature.

1. BakkesMod auto-log (maintain)  
2. Replay import → auto-fill result, score, stats  
3. Tracker Network sync  
4. Advanced replay analysis (far future)  

**Gate:** Replay import works for common replay formats.

---

## V4.0 — Public Beta

**Goal:** Strangers, not just friends.

- Custom domain (e.g. twanstracker.com)  
- Landing page → **Download for Windows**  
- Invite flow · 5–10 real users  

**Gate:** Non-friend completes full **desktop** loop without DM support.

---

## What we are not building (distraction list)

Leaderboards · social feeds · AI chat · marketplace · replay AI · mobile app · Discord bots  

Revisit only after V4.0 feedback.

---

## Recommended 30-day cadence (desktop-first)

| Week | Focus |
|------|-------|
| 1 | Phase 1 done ✅ · installer smoke · v1.0 tag blockers |
| 2 | Phase 2 in-app settings · help center |
| 3 | V1.2 weekly reports · V1.3 coaching start |
| 4 | Phase 3 bundled Node · Phase 4 auto-update pilot |

Feedback from real **installer** users beats another feature every time.
