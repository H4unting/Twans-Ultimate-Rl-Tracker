# QA Test Data — Architecture

Development-only tooling for V1.0 smoke testing. **Does not modify production user flows.**

## Safety strategy

| Layer | Mechanism |
|-------|-----------|
| **Host gate** | Code only activates on `localhost` / `127.0.0.1` — invisible on GitHub Pages |
| **Dev mode gate** | `?qa=enable`, `localStorage` DEV flag, or **Ctrl+Shift+D** (localhost only) |
| **Dynamic import** | `js/qa/*` loaded on demand — zero impact when dev mode off |
| **Account allowlist** | **Generate** = memory only (any account). **Persist** = QA emails only (`+qa` or `config/qa.local.js`) |
| **Data marker** | Every synthetic row: `notes` starts with `[QA]` |
| **Clear** | Deletes **only** `[QA]` rows; renumbers real matches; never wipes whole account |

### Isolation

- Preview/generate updates `state.games` in memory — same path as real data, but tagged.
- Persist calls existing `saveGames()` / `saveSettings()` — no new DB APIs.
- Real matches (notes without `[QA]`) are never removed by Clear.

### Identification

```text
notes: "[QA] · seed · session 3 · edge:long"
user_settings.data.__qaMeta: { seededAt, version }  // optional on persist
```

## Storage strategy

| Action | Storage |
|--------|---------|
| Generate / Preview | In-memory `state.games` + `state.goals` only |
| Persist (QA account) | Supabase `matches` + `user_settings.data` via existing modules |
| Export | JSON file download (client-side blob) |
| Clear (memory) | Filter `[QA]` from state |
| Clear (+ DB) | Filter `[QA]`, then `saveGames()` per game slice |

## Files

| File | Role |
|------|------|
| `js/qa/qa-constants.js` | Markers, storage keys |
| `js/qa/qa-gate.js` | Host/dev-mode gates, allowlist, Ctrl+Shift+D |
| `js/qa/qa-generators.js` | RL/Val/session/full dataset factories |
| `js/qa/qa-export.js` | JSON export |
| `js/qa/qa-panel.js` | Developer Tools UI |
| `config/qa.local.example.js` | Allowlist template (copy → `qa.local.js`, gitignored) |
| `js/app.js` | `maybeEnableQaFromUrl()`, `wireDevModeShortcut()` |
| `js/boot.js` | `initQaToolsIfEnabled()` after successful boot |

**Not modified:** auth, match CRUD, reports, analytics logic — they consume generated data like real matches.

## Enable

1. `Rocket League Tracker.bat` → http://localhost:8080/
2. **Ctrl+Shift+D** or visit `/?qa=enable` once
3. Sign in (throwaway `+qa` email for persist tests)

See [QA-TOOLS.md](./QA-TOOLS.md) for usage.
