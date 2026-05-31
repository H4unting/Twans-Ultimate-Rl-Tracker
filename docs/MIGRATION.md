# RL / Val Module Separation — Migration Notes

## Final folder structure

```
js/
  core/
    app-config.js      # Supabase URL, app name, launcher paths
    dates.js           # Date/week formatting
    game-stats.js      # Generic tag counts, streaks, sessions
    trends.js          # Win-rate trends (game-agnostic)
    state.js           # Global app state

  games/
    registry.js        # Composes both games; facade for tags/playlists/meta
    router.js          # activeGame routing + loadRocketLeague/loadValorant
    rocketleague/
      index.js         # Module entry point
      config.js        # MMR, playlists, RL tags, coaching tips
      normalize.js     # RL match schema only
      rank-chain.js    # MMR chain repair + estimates
      matches.js       # Form → RL match builder
      meta.js          # NAV + page copy
      tags.js          # RL tag analytics
      stats.js         # Playlist MMR rows
      insights.js      # RL coaching engine
      reports.js       # Weekly MMR reports
      ranks.js         # RL rank icons + MMR tables
    valorant/
      (same layout — RR, K/D/A, Val tags, agents/maps)

  # Compatibility shims (old import paths still work)
  games.js → games/registry.js
  state.js → core/state.js
  config.js → core/app-config + RL config exports
  valorant-config.js → games/valorant/config.js
  ranks.js → games/rocketleague/ranks.js

  # Shared shell (unchanged location)
  app.js, auth.js, supabase.js, ui.js, charts.js, filters.js, …
```

## What changed

| Area | Before | After |
|------|--------|-------|
| Match normalize | Single `utils.normalizeGame` with RL/Val branches | Each game module owns `normalizeGame` |
| Tags / analytics | `if (activeGame === VAL)` scattered | `games/*/tags.js`, `insights.js` |
| Rank systems | Shared `endMMR` for both | RL: `endMMR` / Val: `endRR` (no cross-fields in modules) |
| MMR repair at boot | All games | Rocket League only (`RL.repairPlaylistMMRChain`) |
| Val auto-log RR input | Wrote to `quick-endmmr` | Uses `quick-endrr` via `getQuickEndRankInput()` |
| Insights / reports | Monolithic with game branches | Delegates to active game module |

## Active game routing

```javascript
import { routeActiveGame, getActiveGameModule } from './games/router.js';

routeActiveGame(state.activeGame); // on boot + game switch
const mod = getActiveGameModule();
mod.buildGameFromForm(...);
```

## Breaking changes

1. **In-memory Val match shape** — normalized Val matches no longer duplicate stats into `goals`/`assists`/`saves` or alias RR into `endMMR`. UI code should use `getRankValue()` / game module fields.
2. **Legacy DB rows** — `supabase.js` still maps old Val rows that stored K/D in `goals`/`assists` columns at load time (migration layer, not in Val modules).
3. **Import paths** — prefer `games/registry.js` and `games/router.js` for new code; root shims remain for now.

## Remaining Phase 2 (optional)

These files still live at `js/` root and could move into `core/` without behavior change:

- `supabase.js`, `filters.js`, `ui.js`, `charts.js` → `core/`
- `rl-live.js` → `games/rocketleague/live.js`
- `valorant-live.js` → `games/valorant/live.js`
- `dock-ui.js`, `setup-wizard.js` — split per-game panels further

## Testing checklist

- [ ] Boot on Rocket League — MMR chain repair, rank badges, auto-log
- [ ] Switch to Valorant — RR dock input, K/D/A fields, Val tags only
- [ ] Log match in each game — confirm other game's data unchanged in Supabase
- [ ] Analytics / Focus / Reports on each tab — game-specific copy and categories
- [ ] Ctrl+F5 on `http://localhost:8080` after cache bust (`?v=20260531aa`)
