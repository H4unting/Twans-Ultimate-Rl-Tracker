# Commercial Desktop Polish Pass

**Date:** 2026-06-12  
**Goal:** One EXE → install → sign in → play → automatic. No localhost, browser, or terminal visible to the user.

## Boot mark targets

| Phase | Target | Notes |
|-------|--------|-------|
| `inline-shell-visible` | 0ms | `index.html` paints auth bar + dash skeleton from profile cache |
| `window-visible` | <150ms | Electron splash in `tools/launcher/src/main.cjs` |
| `interactive` | <500ms | Shell painted before `load-user-data-start` |
| `load-user-data-start` | after interactive | Supabase sync never blocks first paint |
| `first-render-complete` | <1s warm | Full dashboard after `loadUserData` |
| `boot-finished` | <1.5s warm | Deferred maintenance via `requestIdleCallback` |

Measure with `?dev=1` → Boot marks panel, or DevTools filter `[boot`.

## Match-save render expectations

| Counter | Expected on match save |
|---------|------------------------|
| `__MATCH_SAVE_DASH_RENDERS` | +1 (targeted patch via `refreshAfterMatchSaved`) |
| `__DASH_RENDER_COUNT` | unchanged (no full `renderHome`) |
| `__REFRESH_AFTER_GAME_DATA_CHANGE_COUNT` | +1 (coalesced rAF) |

Guardrail: `submitGameLog` / auto-log ingest use `scheduleRefreshAfterGameDataChange`, never `renderAll`.

## Changes by category

### Startup (`startup-optimizer`)
- Preserved inline shell + cached profile boot path (`index.html`, `js/boot.js`)
- `renderDashboardShell` no longer wipes a painted hero/focus during warm reload
- Desktop setup copy uses app name instead of loopback URLs (`js/env.js`, `js/setup-wizard.js`)

### Performance (`performance-engineer`)
- Quick-action buttons use one delegated listener (no duplicate handlers on re-render)
- Activity feed prepends a single new row on auto-log instead of rebuilding the list
- Match-save path unchanged: targeted dashboard refresh only

### Desktop / bridge (`desktop-engineer`)
- Bridge spawn already uses `windowsHide: true`, `BRIDGE_NO_BROWSER:1`, `twans://` UI
- User-facing tracker label: `getUserFacingTrackerLabel()` → app name on `twans://`

### Auto-log (`auto-logging-specialist`, `logic-validator`)
- RL match-end burst polling verified (`js/rl-live.js` — 500ms for 45s after in-match → idle)
- Val post-exit tail verified (`js/valorant-live.js` — 180s window, 1.5s poll)
- **New:** status pill shows **Processing match…** immediately on match end (`js/bridge-ui.js`, `js/status-copy.js`)

### UI polish (`ui-ux-designer`)
- Today's Focus leads on mobile; wider column ratio on desktop (`css/dashboard-v0.css`)

### Icons (`desktop-engineer`)
- Launcher icons generated from `assets/brand/logo-master.png` via `tools/launcher/scripts/generate-icon.mjs` (prebuild hook)

### Security (`security-engineer` quick scan)
- No new secrets in frontend; Supabase anon key remains RLS-gated
- Bridge binds `127.0.0.1` only; `bridge-security.mjs` allowlist unchanged
- User-facing copy strips localhost from titles/tooltips where possible

## Remaining blockers

1. **Cold boot without profile cache** — first sign-in still waits on Supabase before full dashboard (expected)
2. **Henrik API key** — Val auto-log requires one-time setup in Auto-Log Setup (by design)
3. **Dev browser tab** — localhost URL still shown for wrong-port / GitHub Pages users (not desktop EXE)
4. **OAuth** — Google sign-in briefly uses internal `127.0.0.1:8080` callback; launcher redirects to `twans://`

## Verify locally

```bash
node --check js/env.js js/status-copy.js js/bridge-client.js js/bridge-ui.js js/setup-wizard.js js/home.js js/rl-live.js js/valorant-live.js
cd tools/launcher && npm run build
```

Desktop smoke: launch EXE → sign in → dashboard <1s → Play → finish match → pill shows **Processing match…** → match appears without full dashboard flash.
