# Local config (this PC only)

These files are created when you use **Apply & Go** in the tracker or run the auto-log bat. They are **not** uploaded to GitHub (gitignored).

| File | Purpose |
|------|---------|
| `grind-config.json` | RL name, Riot ID, Henrik API key |
| `bridge-launcher.json` | Tray app: tracker URL, open browser on start |
| `.valorant-bridge-state.json` | Auto-log baseline (match IDs already seen) |
| `bridge.log` | Auto-log debug log |

Copy `example.grind-config.json` to `grind-config.json` only if you want to edit by hand — the setup page in the tracker is easier.
