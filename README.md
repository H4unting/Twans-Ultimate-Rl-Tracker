# Twans Ultimate Tracker

Vanilla JS Rocket League self-improvement tracker for solo grinding or coach review. Hosted on GitHub Pages with Supabase sync.

## Project Structure

```
rl-grind-tracker/
├── index.html          # Shell HTML — no business logic
├── css/
│   └── styles.css      # All styles, responsive breakpoints
├── js/
│   ├── app.js          # Entry point — wiring, navigation, init
│   ├── config.js       # Constants: players, tags, Supabase URL
│   ├── state.js        # Central state + pub/sub
│   ├── supabase.js     # Data persistence (load/save)
│   ├── utils.js        # Pure stat functions (no DOM)
│   ├── filters.js      # Composable filter engine
│   ├── ranks.js        # MMR → rank conversion
│   ├── matches.js      # Match CRUD
│   ├── sessions.js     # Live session timer + panel
│   ├── insights.js     # Coach-style performance insights
│   ├── analytics.js    # Analytics page rendering
│   ├── charts.js       # Chart.js lifecycle wrappers
│   └── ui.js           # DOM rendering, toasts, modals
└── assets/             # Future: icons, favicon
```

## Architecture Principles

### Module Responsibilities

| Module | Responsibility |
|--------|----------------|
| `config.js` | Static data only — players, tag definitions, API keys |
| `state.js` | Single source of truth for runtime state; lightweight pub/sub |
| `utils.js` | Pure functions — stats, normalization, no side effects |
| `filters.js` | Composable predicates applied in one pass |
| `supabase.js` | All network I/O; normalizes data on load |
| `insights.js` | Derived analytics — correlations, trends, coach notes |
| `ui.js` | DOM only — no business calculations |
| `app.js` | Glue — connects modules, handles events |

### How Modules Communicate

```
User Action → app.js → feature module (matches/sessions)
                    → supabase.js (persist)
                    → state.setData() (update)
                    → render pipeline (ui + charts + analytics)
```

- **Downward flow**: `app.js` orchestrates; feature modules never touch DOM directly except through `ui.js`
- **Data flow**: All stats computed via `utils.js` from filtered games
- **State**: `state.js` holds runtime data; components read from state, never duplicate it
- **No circular imports**: `utils` and `filters` have zero dependencies on UI

### Vanilla ES Module Pattern

```javascript
// utils.js — pure, exported functions
export function calculateWinrate(games) { ... }

// app.js — imports and wires
import { calculateWinrate } from './utils.js';
const wr = calculateWinrate(filteredGames);
```

Works on GitHub Pages with `<script type="module">` — no build step required.

## Centralized Utilities (`utils.js`)

All analytics should use these instead of inline calculations:

- `getPlayerMatches(data, playerId)` — normalized game list
- `calculateWinrate(games)` — win percentage
- `calculateMMRGain(games)` — total MMR delta
- `getSessionStats(games, sessionNum?)` — session-level stats
- `getMostCommonTag(games, { lossesOnly })` — top mistake
- `getPlaylistStats(games)` — per-mode breakdown
- `getRollingWinrate(games, windowSize)` — rolling WR array
- `applyFilters(games, filters)` — in `filters.js`

## Supabase Data Model

**Current (kept for simplicity):**

```
Tracker table:
  id       — auto
  Player   — 'anthony' | 'trystan'
  games    — JSON array of match objects
```

Each match object:
```json
{
  "date": "05/25/26",
  "session": 1,
  "match": 1,
  "mode": "1's",
  "result": "W",
  "goals": 4,
  "assists": 0,
  "saves": 3,
  "startMMR": 809,
  "endMMR": 817,
  "mmrDiff": 8,
  "notes": "",
  "tags": ["Tilt", "Slow Rotations"]
}
```

Tags are validated against `TAG_DEFINITIONS` in `config.js` on load via `normalizeGame()`.

**Future migration** (when you outgrow JSON blobs):
```sql
CREATE TABLE matches (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  player text NOT NULL,
  match_num int, session int, played_at date,
  mode text, result text,
  goals int, assists int, saves int,
  start_mmr int, end_mmr int,
  notes text,
  tags text[] DEFAULT '{}'
);
```

## Features

- **Live session panel** — sticky floating UI with timer, W/L, MMR, streak
- **Filter system** — date range, session, result, tags (composable predicates)
- **Performance insights** — loss correlations, recurring mistakes, coach notes
- **Mobile responsive** — stacked charts, scrollable tables, touch-friendly tags

## GitHub Pages Deployment

1. Push this repo to GitHub
2. Settings → Pages → Source: `main` branch, `/ (root)`
3. ES modules work natively — no build step

## Local Development

ES modules require a local server (file:// won't work):

```bash
npx serve .
# or
python -m http.server 8080
```

Then open `http://localhost:8080`

## Adding a New Player

1. Add to `PLAYERS` in `config.js`
2. Add a page tab in `index.html`
3. Supabase row auto-created on first save

## Adding a New Tag

1. Add to `TAG_DEFINITIONS` in `config.js`
2. Tag chips auto-render from `TAG_GROUPS`

## Adding a New Filter

1. Add predicate to `filters.js` `predicates` object
2. Add UI control in `ui.js` `renderFilterBar()`
