# Twans UI Reference — UI/UX Designer

Read this when applying dashboard or shell polish. One level deep from [SKILL.md](SKILL.md).

## CSS layers (load order matters)

| File | Scope |
|------|--------|
| `css/styles.css` | Legacy tokens (`--radius`, `--accent`), `.home-focus-*` base |
| `css/dashboard-v0.css` | Logged-in v0 shell, hero, priority row, actions, focus featured |
| `css/valorant-theme.css` | `body[data-active-game="valorant"]` focus/hero overrides |
| `css/layout-polish.css` | Cross-page spacing tweaks — check before duplicating |

Logged-in dashboard rules often use `body:not(.logged-out)` in `dashboard-v0.css` to override `styles.css`.

## Spacing scale (dashboard-v0)

Canonical gaps already in use — prefer these over new values:

```
8px   — .dash-hero-badges gap, .v0-mobile-game-switch gap
12px  — .dash-quick-actions gap, compact action padding
16px  — .dash-priority-row gap, .dash-perf-grid gap, stat padding
20px  — .dash-priority-row margin-top, .dash-hero-rank gap
24px  — .dash-hero padding, .page padding (mobile), card radius context
32px  — .dash-hero-inner gap, .page padding (desktop ≥768px)
```

Page shell: `.v0-main .page` → `24px 16px 100px` (mobile), `32px 32px 100px` (≥768px).  
Max content width: `1400px`.

## v0 design tokens

Defined on `:root` / v0 theme (see `dashboard-v0.css`, `valorant-theme.css`):

- `--v0-primary`, `--v0-primary-foreground`, `--v0-game-accent`
- `--v0-border`, `--v0-card`, `--v0-background`, `--v0-foreground`
- `--v0-muted-foreground`, `--v0-secondary`
- `--v0-font-heading`

Use `color-mix(in oklch, var(--v0-primary) N%, transparent)` for tinted surfaces.

## Dashboard DOM order (`index.html` / `js/home.js`)

Typical render sequence in `renderHomePage`:

1. `#dash-hero` — `renderDashHero()`
2. `.dash-quick-actions-compact` — log / session / focus shortcuts
3. `.dash-priority-row` — `#dash-session-panel` + `#home-focus`
4. `#dash-rank-progress` — `.dash-rank-featured`
5. `.dash-grid` — `#dash-performance`, `#dash-activity`

Do not move focus below activity without explicit user request.

## Today's Focus (`js/home.js`)

| Item | Detail |
|------|--------|
| Container | `#home-focus` |
| Render | `renderHomeFocus(games)` |
| Label | `"Today's Focus"` (RL) / `"Today's Mission"` (Valorant) |
| Featured class | `home-focus-card-featured` on all states |
| Empty copy | Tag mistakes after losses… |
| Filled structure | `.home-focus-label`, `.home-focus-tag-name`, `.home-focus-stat`, `.home-focus-tip` |
| Patch path | `patchHomeFocus()` when `dataset.wired === '1'` |

Featured CSS (`dashboard-v0.css`):

```css
body:not(.logged-out) .home-focus-card-featured {
  border-left: 5px solid var(--v0-primary);
  padding: 20px 22px 22px;
  background: linear-gradient(135deg, ...);
  box-shadow: 0 0 32px color-mix(in oklch, var(--v0-primary) 12%, transparent);
}
```

## Hero (`#dash-hero`)

- Patch-friendly: `patchDashHero()`, `patchDashHeroQueueRow()` — prefer over full `innerHTML` when signature unchanged
- Glow elements: `.dash-hero-glow-a/b` — keep subtle; disabling removes premium feel
- Stats: `.dash-hero-stats .dash-stat-card`
- **Perf:** `#page-dashboard .dash-hero` has `backdrop-filter: none`

## Quick actions

| Class | Role |
|-------|------|
| `.dash-quick-actions-compact` | 3-column grid ≥640px |
| `.dash-action-btn` | Default tile CTA |
| `.dash-action-btn.primary` | Filled primary — must be obvious |
| `.dash-action-label` / `.dash-action-desc` | Title + subtitle (desc hidden in compact row) |

Primary ordering: `.dash-quick-actions-compact .dash-action-btn.primary { order: -1; }`

## React prototypes (`components/tracker/`)

Reference only — production UI is vanilla JS + CSS:

| File | Maps to |
|------|---------|
| `hero.tsx` | `#dash-hero` |
| `dashboard.tsx` | Overall grid / priority layout |
| `quick-actions.tsx` | `.dash-quick-actions*` |
| `rank-progress.tsx` | `#dash-rank-progress` |
| `performance.tsx` / `activity-feed.tsx` | Secondary columns |
| `topbar.tsx` | `.v0-topbar` |

Use for spacing proportions and hierarchy intent; implement in `dashboard-v0.css` + `home.js`.

## Priority row layout

```css
.dash-priority-row {
  display: grid;
  gap: 16px;
  margin: 20px 0 0;
}
@media (min-width: 900px) {
  .dash-priority-row {
    grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
    align-items: stretch;
  }
}
```

Focus slot: `.dash-focus-slot` — `min-width: 0` prevents grid blowout. Session: `.dash-session-featured`.

## Secondary demotion

Already partially styled:

```css
.dash-performance-secondary,
.dash-activity-secondary { opacity: 0.95; }
```

Tighten padding or font-size here before adding new wrapper elements.

## Game-specific focus (Valorant)

`valorant-theme.css` overrides `.home-focus-card`, `.home-focus-label`, `.home-focus-tag-name`, `.home-focus-stat` under `body[data-active-game="valorant"]`. Keep RL and Valorant parity when changing focus prominence.
