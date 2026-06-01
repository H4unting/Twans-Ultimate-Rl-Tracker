# QA Test Data Tools (dev only)

Generate synthetic match data for smoke testing without playing hundreds of games.

**Not visible on GitHub Pages.** Only works on `localhost` after explicit opt-in.

## Enable (once per browser session)

1. Run the tracker locally: `start-grind.bat` → http://localhost:8080/
2. Visit: **http://localhost:8080/?qa=enable**
3. Sign in with a **throwaway QA account** (never your main grind account)

The red **QA Tools (dev)** panel appears bottom-left after sign-in.

## Safety rules

| Layer | What it does |
|-------|----------------|
| Host gate | Panel never loads off localhost |
| Opt-in | `?qa=enable` sets session flag |
| Allowlist | **Preview** works on any account; **Save/Clear+DB** only on QA accounts |
| Markers | All synthetic rows have `[QA]` in notes |
| Clear | Only removes `[QA]` rows — real matches untouched |

### QA accounts

Use a throwaway email, e.g. `you+qa@gmail.com`.

Optional: copy `config/qa.local.example.js` → `config/qa.local.js` and add your QA email (gitignored).

Default allow pattern without `qa.local.js`: email contains `+qa`.

## Actions

| Button | Effect |
|--------|--------|
| **Preview 10/50/100** | Loads synthetic data in memory — charts, reports, focus update. **Not saved.** |
| **Save 10/50/100** | Writes to Supabase (requires QA account + type `PERSIST N`) |
| **Clear [QA] (memory)** | Removes QA rows from app state only |
| **Clear [QA] + Supabase** | Removes QA rows from DB (type `DELETE QA`) |
| **Export [QA] JSON** | Downloads QA matches as JSON |

## What gets generated

- Realistic sessions (3–7 games each) over ~75 days
- Win/loss ratios ~52–55%
- MMR/RR chains, tags on losses, goals patch on persist
- RL: 1's / 2's / 3's mix
- Val: mostly Competitive + K/D/A/ACS

## Release testing

Use **Preview** for reports/analytics/focus/scaling UI checks.

Use **Save 100** on a QA-only account for boot time + large-account DB tests.

Do **not** run Save on your main account.
