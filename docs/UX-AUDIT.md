# UX Audit — Phase 3 First-Time User Lens

**Product:** Twans Ultimate Tracker  
**Audit date:** June 7, 2026  
**Method:** Static review of `index.html`, navigation (`js/nav.js`), dashboard (`js/home.js`), dock (`quicklog.js`), setup wizard, mobile nav, accessibility patterns. **No UI changes made.**

**Severity scale:** Critical / High / Medium / Low

---

## Executive summary

The v0 dashboard redesign provides a **coherent authenticated shell** with clear game switching, a persistent quick-log dock, and section-based navigation (Home / Review / Squad). First-time friction centers on **(1)** the local launcher requirement for auto-log, **(2)** rank baseline setup before meaningful Val competitive logs, and **(3)** feature density on Analytics/Reports without progressive disclosure. Mobile bottom nav covers primary destinations but hides Auto Setup and Profile.

---

## First-time user journey

```
Land on login → Sign in (Google or email)
    → Loading overlay (boot)
    → Rank setup modal? (if no baselines)
    → Dashboard (hero + session + charts)
    → Bridge hint banner if auto-log off
    → Quick dock visible (log bar)
```

**Positive:** Login screen explains value prop ("Track Rocket League & Valorant in one place"). Legal links present. Boot failure messages are actionable (`index.html:530–556`).

**Friction:** User on GitHub Pages sees working tracker but **auto-log permanently off** with limited explanation unless they reach Auto Setup page.

---

## Critical findings

### UX-C1 — Auto-log dependency unclear on non-localhost hosts

| Attribute | Detail |
|-----------|--------|
| **Severity** | Critical (for users expecting auto-log from web URL) |
| **Evidence** | `js/env.js:needsLocalTrackerForAutoLog()` — true when not `localhost:8080`; bridge hint references `.bat` files |
| **User impact** | Player opens GitHub Pages link, signs in, plays Val/RL — no auto-log; may think product is broken |
| **Recommendation** | Prominent persistent callout when `!isLocalTrackerHost()` explaining launcher requirement + link to `docs/USER-SETUP.md` |

### UX-C2 — No guided onboarding wizard beyond rank setup

| Attribute | Detail |
|-----------|--------|
| **Severity** | Critical (first session completion rate) |
| **Evidence** | Rank modal (`rank-setup-ui.js`) only; setup wizard is opt-in nav item |
| **User impact** | New user may not discover dock, session start, or tag workflow |
| **Recommendation** | Optional 3-step coach marks (dock → log → dashboard) — defer to v1.0.1 if needed |

---

## High findings

### UX-H1 — Profile and Auto Setup absent from mobile nav

| Attribute | Detail |
|-----------|--------|
| **Severity** | High |
| **Evidence** | `index.html:437–443` mobile nav: Dashboard, Match Logs, Sessions, Review, Squad — no Setup, no Profile |
| **User impact** | Mobile-first users cannot reach Auto Setup or Profile without desktop sidebar |
| **Recommendation** | Add Profile to mobile nav or user menu; link Setup from bridge hint |

### UX-H2 — Val manual log requires Advanced stats for K/D/A

| Attribute | Detail |
|-----------|--------|
| **Severity** | High |
| **Evidence** | `app.js:694–697` blocks Val log when K+D+A=0 |
| **User impact** | User taps LOG without opening Advanced stats → error toast; non-obvious |
| **Recommendation** | Default K/D/A from last match or show inline K/D/A on dock (not hidden in details) |

### UX-H3 — Match Logs maintenance buttons expose destructive actions

| Attribute | Detail |
|-----------|--------|
| **Severity** | High |
| **Evidence** | `#matchlogs-clear-val-btn`, purge ghosts, dedupe — Val only (`app.js:409–456`) |
| **User impact** | "Clear all Val history" is irreversible; label is clear but placement next to Export is risky |
| **Recommendation** | Move destructive actions behind confirmation modal with typed confirm |

### UX-H4 — Information priority: Analytics page is dense

| Attribute | Detail |
|-----------|--------|
| **Severity** | High |
| **Evidence** | `#page-analytics` stacks stats grid, 2 charts, filters, action items, insights, coach report, trends, 2 more charts (`index.html:260–284`) |
| **User impact** | Cognitive overload; hard to find "what should I do next" |
| **Recommendation** | Focus page is better prioritized — consider linking Analytics → Focus CTA at top |

### UX-H5 — Sync status ambiguity

| Attribute | Detail |
|-----------|--------|
| **Severity** | High |
| **Evidence** | `#sync-label` states: Connecting / Live / Saving / Error (`ui.js:26–37`) |
| **User impact** | "Error" does not explain retry; user may not know data unsaved |
| **Recommendation** | Click sync indicator to show last error + retry hint |

---

## Medium findings

### UX-M1 — Duplicated logging surfaces

| Attribute | Detail |
|-----------|--------|
| **Severity** | Medium |
| **Evidence** | Quick dock (primary) + collapsed "Full log form" details on Match Logs page (`index.html:200–233`) |
| **User impact** | Two paths to same action; full form hidden in `<details>` |
| **Recommendation** | Keep dock primary; rename details to "Manual entry (all fields)" |

### UX-M2 — Review section requires two clicks

| Attribute | Detail |
|-----------|--------|
| **Severity** | Medium |
| **Evidence** | Main nav "Review" → sub-nav pills Focus / Analytics / Reports (`nav.js:75–94`) |
| **User impact** | Extra step vs flat nav; acceptable on desktop, cramped on mobile |
| **Recommendation** | Mobile: default to Focus when tapping Review |

### UX-M3 — Dead space in legacy sr-only containers

| Attribute | Detail |
|-----------|--------|
| **Severity** | Medium |
| **Evidence** | `#home-summary`, `#val-dashboard` sr-only (`index.html:165–167`) |
| **User impact** | None visible — CSS may still target unused selectors |
| **Recommendation** | Cleanup in v1.0.1 (see CLEANUP-PLAN) |

### UX-M4 — Game switcher label inconsistency

| Attribute | Detail |
|-----------|--------|
| **Severity** | Medium |
| **Evidence** | RL nav "Match Logs" vs Val may differ in `PAGE_COPY`; dock hint game-specific |
| **User impact** | Minor terminology shift when switching games |
| **Recommendation** | Acceptable; document in help |

### UX-M5 — Post-match card 60s auto-dismiss

| Attribute | Detail |
|-----------|--------|
| **Severity** | Medium |
| **Evidence** | `js/post-match.js` — timer when MMR confirmed |
| **User impact** | User may miss tag/undo window during queue |
| **Recommendation** | Extend to 120s or pause while tab hidden |

### UX-M6 — Squads empty state vs error state indistinguishable

| Attribute | Detail |
|-----------|--------|
| **Severity** | Medium |
| **Evidence** | `loadUserGroups` failure → `[]`; RPC error only on render (`app.js:607–611`) |
| **User impact** | "No squads" when actually failed to load |
| **Recommendation** | Distinct error empty state with retry |

### UX-M7 — Keyboard shortcuts undiscoverable

| Attribute | Detail |
|-----------|--------|
| **Severity** | Medium |
| **Evidence** | L/S/F shortcuts in `app.js:643–659` — no UI hint |
| **User impact** | Power feature invisible |
| **Recommendation** | Footer hint or `?` popover |

---

## Low findings

### UX-L1 — Login password minimum 6 chars matches Supabase default

Low friction; acceptable.

### UX-L2 — Emoji in nav icons

Accessible names present on buttons; emoji may render inconsistently — Low.

### UX-L3 — Chart.js CDN — charts empty until library loads

Defer attribute on script — brief flash possible.

### UX-L4 — `console.log('[REVIEW]'` / `[SQUAD]` debug noise

Dev only; no user impact.

### UX-L5 — Top bar Profile vs user-bar profile duplicate entry points

Both navigate to profile — redundant but harmless.

---

## Area ratings

| Area | Rating | Top issue |
|------|--------|-----------|
| Navigation | Good | Mobile missing Setup/Profile |
| Dashboard | Good | Bridge hint only when auto-log off |
| Match logging | Fair | Val K/D/A hidden in Advanced |
| Review / Squad | Fair | Analytics density; squad error state |
| Mobile | Fair | Incomplete nav parity |
| Accessibility | Fair | Modals have `aria-modal`; tag chips have keyboard; tables lack row headers |
| Onboarding | Poor | No first-run tour beyond rank modal |
| Empty states | Good | "No games logged yet" in match table (`ui.js:118`) |

---

## Navigation map (user mental model)

```
Dashboard ─┬─ Session panel (start/end)
           ├─ Focus slot (home)
           ├─ Rank progress
           ├─ Charts + activity
           └─ Quick actions

Match Logs ─── Filters + table + export

Sessions ───── History blocks

Review ─┬─ Focus (coaching)
        ├─ Analytics (stats/charts)
        └─ Reports (weekly + goals)

Squad ──────── Create/join/compare

Auto Setup ─── Bridge wizard (sidebar only)

Profile ────── Avatar, colors, delete account (top bar)
```

---

## Findings vs recommendations

### Findings

1. Core happy path (sign in → log from dock → see dashboard) is navigable.
2. Auto-log setup is the largest first-time UX gap for players using the web URL only.
3. Val competitive logging UX punishes users who don't discover Advanced stats.
4. Mobile nav lags desktop feature parity.

### Recommendations (prioritized, not implemented)

1. **Critical:** Host-aware banner for non-8080 / GitHub Pages users.
2. **High:** Surface K/D/A on Val quick dock main row.
3. **High:** Add Profile (+ Setup link) to mobile nav.
4. **Medium:** Destructive Val history clear → typed confirmation.
5. **Low:** Keyboard shortcut cheat sheet in footer.

---

*Phase 3 complete. No UI modified.*
