# Twans Ultimate Tracker — Roadmap

Planning doc only. **Do not start a phase until the previous gate is done.**

Current version: **1.0.0-rc1** → target: **v1.0.0 tag**

---

## Sprint: V1.0 Release (now)

**Goal:** Declare the app done enough to ship. Validation, not features.

1. Expand smoke test → `RELEASE-CHECKLIST.md`
2. **Feature freeze** until tag lands
3. Smoke test (you + one friend)
4. Fix blockers only
5. `git tag v1.0.0` → push → announce

### Feature freeze (until v1.0.0)

Do **not** build:

- Replay analysis / import
- AI chatbots or AI coaching
- Public leaderboards
- Social feeds
- New game support
- Coach payments / marketplace
- Discord economy
- Native mobile app

OK to fix: crashes, broken workflows, data corruption, sync failures, onboarding blockers.

---

## V1.0 — Stability

**Status:** RC1 built. Awaiting smoke test + tag.

Ship:

- Auth (Google + email)
- Multi-game (RL + Valorant)
- Manual + auto logging
- Sessions, goals, focus, reports, analytics
- Supabase sync
- GitHub Pages deploy
- Desktop bridge + tray prototype

**Gate:** Full smoke test passes → tag `v1.0.0`.

---

## V1.1 — Onboarding

**Goal:** Random player → first logged game in ~5 minutes.

- First-launch wizard (welcome → choose game → set rank → set goal → start tracking)
- Tiny help center:
  - How auto-log works
  - Rocket League setup
  - Valorant setup
  - Goals
  - Focus

**Gate:** Friend with zero context completes onboarding unaided.

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
- Build on existing `insights.js` per game — extend, don't rewrite

**Gate:** Insights match manual review of same data.

---

## V2.0 — Desktop Polish

**Goal:** Adoption on gaming PC, not a rewrite.

- Electron tray app polish (already prototyped)
- Reliable auto-start, bridge health, clearer sync status
- Tauri evaluation **after** Electron proves adoption

**Gate:** 5+ users run tray app daily without hand-holding.

---

## V3.0 — Replay Support

**Goal:** Rocket League depth feature.

Priority order:

1. BakkesMod auto-log (mostly done — maintain)
2. Replay import → auto-fill result, score, stats
3. Tracker Network sync (rank / MMR import)
4. Advanced replay analysis (far future)

**Gate:** Replay import works for common replay formats.

---

## V4.0 — Public Beta

**Goal:** Strangers, not just friends.

- Custom domain (e.g. twanstracker.com)
- Landing page (analytics, auto-log, coaching, reports)
- Invite flow
- 5–10 real users; watch what breaks

**Gate:** Non-friend completes full loop without DM support.

---

## What we are not building (distraction list)

Leaderboards · social feeds · AI chat · marketplace · replay AI · mobile app · Discord bots

Revisit only after V4.0 feedback says users want them.

---

## Recommended 30-day cadence

| Week | Focus |
|------|-------|
| 1 | Smoke test · v1.0 tag · blocker fixes |
| 2 | V1.1 onboarding wizard + help center |
| 3 | V1.2 weekly reports · V1.3 coaching start |
| 4 | V2.0 Electron polish · friend testing |

Feedback from real users beats another feature every time.
