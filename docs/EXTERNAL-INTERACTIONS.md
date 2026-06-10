# External Interactions Reference

Quick audit checklist for every Rocket League and Valorant touchpoint outside the SPA/Supabase core. See [`BAN-SAFETY-AUDIT.md`](BAN-SAFETY-AUDIT.md) for full analysis.

**Legend — anti-cheat risk:** LOW = passive / official / no game attach; MEDIUM = third-party mod or config write; HIGH = memory/injection/hooks (none present).

---

## Rocket League

| ID | Interaction | Direction | Mechanism | Data | Risk |
|----|-------------|-----------|-----------|------|------|
| RL-1 | BakkesMod Stats API | In ← localhost | TCP `127.0.0.1:49123` JSON stream | Match events, G/A/S, playlist, W/L | **MEDIUM** (user-installed mod export) |
| RL-2 | Stats API INI | Out → disk | Write `Documents/My Games/Rocket League/.../DefaultStatsAPI.ini` | Port, packet rate | **MEDIUM** (config only, opt-in) |
| RL-3 | Bridge status | Internal | HTTP `127.0.0.1:49200` (via `/api/bridge` proxy) | Connection + match cache | **LOW** |
| RL-4 | Process detect | Read OS | `tasklist` → `RocketLeague.exe` | Running yes/no | **LOW** |
| RL-5 | Game launch | Out → OS | `steam://rungameid/252950` | None | **LOW** |
| RL-6 | Supabase | Out → cloud | HTTPS + user JWT | Match rows, settings | **LOW** |

**Safer alternatives:** RL-1/RL-2 → manual log only (no BakkesMod).

---

## Valorant

| ID | Interaction | Direction | Mechanism | Data | Risk |
|----|-------------|-----------|-----------|------|------|
| VAL-1 | Henrik Dev API | Out → internet | HTTPS `api.henrikdev.xyz` + `Authorization` | Match history, MMR history | **LOW** |
| VAL-2 | Overwolf GEP | In ← Overwolf SDK | Game events + info updates (game 21640) | K/D/A, agent, map, outcome | **LOW–MEDIUM** |
| VAL-3 | Overwolf → bridge | Internal | POST `127.0.0.1:49200/valorant/overwolf-*` | Match payload | **LOW** |
| VAL-4 | Bridge Val routes | Internal | HTTP `/valorant/status`, `/last-match`, `/arm` | Poll state | **LOW** |
| VAL-5 | Process detect | Read OS | `tasklist` → `VALORANT-Win64-Shipping.exe` | Running yes/no | **LOW** |
| VAL-6 | Game launch | Out → OS | `RiotClientServices.exe` or `riotclient://` | None | **LOW** |
| VAL-7 | Supabase | Out → cloud | HTTPS + user JWT | Match rows, settings | **LOW** |

**Safer alternatives:** VAL-2 → use VAL-1 (Henrik) only.

---

## Shared / desktop

| ID | Interaction | Mechanism | Risk |
|----|-------------|-----------|------|
| SH-1 | Tracker HTTP | `127.0.0.1:8080` static + `/api/bridge` proxy | **LOW** |
| SH-2 | Bridge HTTP | `127.0.0.1:49200` local API | **LOW** |
| SH-3 | Electron shell | Spawns Node bridge, tray poll | **LOW** |
| SH-4 | Browser open | `start "" url` on first launch (bat mode) | **LOW** |

---

## Explicitly absent

- DLL injection, memory R/W, graphics hooks, input simulation
- Kernel drivers, anti-cheat bypass, game binary patches
- Riot local lockfile / live client API scraping
- Discord webhooks, remote control of game processes (except launching via official URIs)

---

## Change control

When adding a new external touch:

1. Add a row to this file and the relevant map in `BAN-SAFETY-AUDIT.md`
2. Default risk to **MEDIUM** until reviewed
3. Prefer passive APIs over in-process techniques
