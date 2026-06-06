# QA Test Data Tools (dev only)

Generate realistic synthetic data for smoke testing without playing hundreds of matches.

**Architecture:** [QA-ARCHITECTURE.md](./QA-ARCHITECTURE.md)

## Enable

1. Run `Rocket League Tracker.bat` → http://localhost:8080/
2. Press **Ctrl+Shift+D** or visit `/?qa=enable` once
3. Sign in (use a throwaway `+qa` email for Supabase persist tests)

The **Developer Tools** panel toggles bottom-left. Hidden on GitHub Pages.

## Panel actions

### Rocket League
- **Generate 10 / 50 / 100 RL Matches** — 1's/2's/3's, MMR ±8/9/10, streaks, tags

### Valorant
- **Generate 10 / 50 / 100 Val Matches** — Competitive only, RR +18/22/27 or -15/18/22
- Full competitive ladder (Iron 1 → Radiant) with promotion carry-over via `applyRRDelta` in `js/games/valorant/rank-ladder.js` — same helper as production.

### Sessions
- **Generate 5 / 10 / 25 Sessions** — for the **active game** (4–11 games per session, good/bad nights)

### Data
- **Generate Full QA Dataset** — 100 RL + 100 Val + goal targets for reports/analytics/focus
- **Clear Test Data** — removes only `[QA]` rows from memory
- **Clear + Supabase** — same, synced to DB (QA account, type `DELETE QA`)
- **Export Test Data** — JSON download
- **Persist to Supabase** — saves current QA data (QA account, type `PERSIST`)

## Safety

| Rule | Detail |
|------|--------|
| Host | localhost only |
| Generate | Memory only — safe on any account |
| Persist / Clear+DB | QA allowlist only (`+qa` email or `config/qa.local.js`) |
| Marker | All rows: `notes` starts with `[QA]` |
| Real data | Never deleted by Clear |

Copy `config/qa.local.example.js` → `config/qa.local.js` to allow specific emails (gitignored).

## Generated data includes

- Win/loss streaks, good/bad sessions
- Edge cases: empty notes, long notes, no tags, many tags
- Recent-week games for weekly reports and goal progress
- Goal states: completed targets, active, nearly complete

## Do not

- Run **Persist** on your main grind account
- Ship v1.0 without manual smoke test on real flows too
