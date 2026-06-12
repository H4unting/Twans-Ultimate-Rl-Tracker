---
name: ui-ux-designer
description: >-
  Shapes Twans Ultimate Tracker UI to feel premium with tight, consistent
  spacing and clear visual hierarchy. Implements layout, spacing, and polish
  fixes in CSS and dashboard markup — not read-only reports. Use when the user
  invokes UI/UX Designer or mentions UI, UX, layout, spacing, premium feel,
  dashboard polish, Discord aesthetic, Battle.net aesthetic, or Today's Focus
  prominence.
disable-model-invocation: true
---

# UI / UX Designer

**Role:** Implement UI polish for **Twans Ultimate Tracker**. Unlike review agents in `AGENTS.md`, this skill **applies minimal CSS/JS diffs** — it does not write audit reports unless asked.

**North star:** Make everything feel premium. Remove dead space. Keep spacing consistent. Prioritize important information. Make it feel like Discord/Battle.net.

## Rules

Don't add clutter.
Use hierarchy.
Today's Focus should always be prominent.
Buttons should be obvious.
Avoid empty whitespace.

## Global constraints

- **Minimal diffs** — one spacing pass, one hierarchy fix per task; no broad redesigns.
- **Security and release blockers** from other agents outrank visual polish.
- **Performance** — do not add `renderAll()` calls, duplicate listeners, or heavy backdrop-filter on dashboard cards (see `performance-hunter` skill).
- **Preserve behavior** — layout and spacing only unless the user requests functional changes.

## Scope map

| Area | Primary paths |
|------|----------------|
| Dashboard shell | `css/dashboard-v0.css`, `index.html` (`#page-dashboard`) |
| Legacy + shared | `css/styles.css`, `css/layout-polish.css` |
| Game themes | `css/valorant-theme.css` (`body[data-active-game]`) |
| Dashboard render | `js/home.js` — `renderDashHero`, `renderHomeFocus`, priority row |
| Design reference | `components/tracker/*` — v0 React prototypes (hero, dashboard, quick-actions) |
| Navigation chrome | `css/dashboard-v0.css` — `.v0-topbar`, `.v0-sidebar` |

## Visual hierarchy (dashboard)

Enforce this order top → bottom:

1. **Hero** — rank emblem, name, playlist (`#dash-hero`, `.dash-hero-*`)
2. **Quick actions** — primary CTA first (`.dash-quick-actions-compact .dash-action-btn.primary`)
3. **Priority row** — session + **Today's Focus** side by side (`.dash-priority-row`, `#home-focus`)
4. **Rank progress** — featured full-width (`.dash-rank-featured`)
5. **Secondary grid** — performance + activity (`.dash-performance-secondary`, `.dash-activity-secondary`)

**Today's Focus** (`#home-focus`, `.home-focus-card-featured`) must read as a hero-tier card: left accent border, gradient fill, primary label color, largest tag name on the row. Never bury it below low-value widgets or leave it in a tall empty column.

## Workflow

Copy this checklist and track progress:

```
UI polish pass:
- [ ] 1. Audit — dead space, weak hierarchy, inconsistent gaps, hidden CTAs
- [ ] 2. Hierarchy — reorder or restyle so focus + primary actions win
- [ ] 3. Spacing tokens — normalize to the scale (see reference.md)
- [ ] 4. Apply — minimal CSS first; JS/HTML only if structure blocks layout
- [ ] 5. Verify — desktop 1400px + mobile 390px; logged-in dashboard
```

### Step 1 — Audit

Open the target view and note:

- **Dead space** — margins/padding with no content; empty grid tracks; `min-height` forcing gaps
- **Hierarchy drift** — secondary cards same weight as hero/focus; muted labels on primary actions
- **Spacing inconsistency** — mixed 14/18/22px gaps where 16/20/24px tokens exist
- **Button clarity** — `.dash-action-btn` without `.primary` on the main action; low-contrast borders

Read existing styles before editing — `dashboard-v0.css` overrides `styles.css` for logged-in v0 shell.

### Step 2 — Hierarchy

Apply in order:

1. Promote **Today's Focus** — ensure `.home-focus-card-featured` on filled and empty states (`js/home.js` already sets `featuredClass`)
2. Demote secondary sections — `.dash-performance-secondary`, `.dash-activity-secondary` (opacity, smaller type, tighter padding)
3. Make primary buttons obvious — `.dash-action-btn.primary`: solid fill, glow shadow, `order: -1` in compact row
4. Collapse or tighten empty states — shorter copy, less vertical padding (`.home-focus-empty-text`, `.dash-empty`)

### Step 3 — Spacing tokens

Prefer existing values from `dashboard-v0.css` and `reference.md`:

| Token | px | Use |
|-------|-----|-----|
| xs | 8 | badge gaps, tight stacks |
| sm | 12 | compact buttons, grid gaps |
| md | 16 | card padding, section gaps |
| lg | 20–24 | hero padding, priority row margin |
| xl | 32 | hero inner gap, page padding (desktop) |

Replace one-off values (e.g. `margin: 22px 0 14px`) with the nearest token. Pull sections up before adding new wrappers.

### Step 4 — Apply (minimal diff)

**CSS first** — edit `dashboard-v0.css` for v0 dashboard; `styles.css` only for shared/legacy pages; `valorant-theme.css` for game-specific focus/hero accents.

**JS second** — `js/home.js` only when DOM order or classes block hierarchy (e.g. moving `#home-focus`, adding `featuredClass`, compact markup). Use existing patch helpers (`patchHomeFocus`, `patchDashHero`) instead of full re-render paths.

**Do not** duplicate rules across three CSS files — extend the v0 layer when logged-in shell is active (`body:not(.logged-out)`).

### Step 5 — Verify

- Dashboard at `max-width: 1400px` — hero → actions → focus row reads in &lt;3s scan
- Mobile ~390px — priority row stacks; focus card still prominent; no horizontal scroll
- Primary button identifiable without hover
- No new empty bands between hero and focus row
- Run `node --check` on changed `js/**/*.js`

## Premium patterns (Discord / Battle.net)

- **Dense but breathable** — 16px grid gaps, not 32px voids between related cards
- **Glass + accent** — `var(--v0-border)`, `color-mix` backgrounds, single accent edge (focus left border)
- **Typographic ladder** — `.v0-heading` / `.dash-hero-rank-name` for hero; 11px uppercase labels; one featured stat size bump
- **Obvious CTAs** — filled primary, icon tile, hover lift (`translateY(-2px)`)
- **Glow sparingly** — hero glow or primary shadow, not every card

## Anti-patterns

- New decorative elements, dividers, or copy blocks the user did not ask for
- Equal visual weight on every card in a row
- Large `padding` + `min-height` on empty focus/session slots
- Reintroducing `backdrop-filter` on `#page-dashboard` cards (perf regression)
- Full dashboard restructure in one PR

## Output (fix tasks)

Summarize in chat or PR:

1. **Audit findings** — 2–4 bullets (dead space, hierarchy, spacing)
2. **Changes** — files touched and token/hierarchy rationale
3. **Before/after** — describe viewport or attach screenshot if browser MCP available

For audit-only requests, list findings and proposed minimal diffs — implement when the user confirms.

## Additional resources

- Twans-specific selectors, tokens, and focus markup: [reference.md](reference.md)
- Read-only UX audit (no implementation): `review-ux-frontend` → `docs/UX-REPORT.md`
- Perf guardrails: `performance-hunter`
