# Ban Safety Audit — Twans Ultimate Tracker

**Audit date:** 2026-06-10  
**Scope:** Full repository — bridge scripts, frontend live clients, Overwolf integration, Electron launcher, game launch, process detection, BakkesMod/Henrik paths  
**Guiding principle:** Passive tracking only. If removing a feature makes the product safer without harming core manual logging, prefer the safer path.

---

## Executive verdict: **WARN**

Twans Ultimate Tracker **does not** inject DLLs, read/write game memory, hook rendering, simulate input, bypass anti-cheat, ship kernel drivers, or modify game binaries. The shipped Node/Electron stack is **passive**: localhost APIs, public match-history HTTP, optional Riot-sanctioned Overwolf GEP, `tasklist` process names, and normal launcher URIs.

**WARN** (not FAIL) because Rocket League auto-log **depends on user-installed BakkesMod** (third-party mod) and optionally patches `DefaultStatsAPI.ini`. Those are **outside** the tracker binary but are **required touchpoints** for RL auto-log. Valorant auto-log via **Henrik API alone** is **PASS**-grade passive. Optional **Overwolf** is low–medium (official GEP, third-party overlay).

| Path | Verdict |
|------|---------|
| Valorant — Henrik API only | **PASS** |
| Valorant — Overwolf GEP (optional) | **WARN** (approved channel; overlay still third-party) |
| Rocket League — BakkesMod Stats API TCP | **WARN** (passive read; mod is user-installed) |
| Manual log / Supabase only | **PASS** |
| Desktop launcher (Electron + Node bridge) | **PASS** |

**No HIGH ban-risk findings in Twans-authored code.** Highest practical risk is **user choice to run BakkesMod** for RL stats export.

---

## Per-technique matrix

| Technique | Present? | Evidence | Ban risk | Notes |
|-----------|----------|----------|----------|-------|
| DLL injection into games | **No** | No `LoadLibrary`, `CreateRemoteThread`, or injection strings in repo | **LOW** | BakkesMod injects into RL separately; Twans never loads into the game process |
| Read/write protected game memory | **No** | No `ReadProcessMemory`, `WriteProcessMemory`, `OpenProcess` | **LOW** | Stats come from BakkesMod TCP JSON or external APIs |
| Hook rendering / game functions | **No** | No D3D/OpenGL/Vulkan hooks in Twans code | **LOW** | Overwolf GEP is Riot-provided event channel, not Twans hooks |
| Simulated player input | **No** | No `SendInput`, `keybd_event`, `mouse_event` | **LOW** | — |
| Anti-cheat bypass / interference | **No** | No Vanguard/BE/EAC interaction | **LOW** | Bridge binds `127.0.0.1` only |
| Game **binary** modification | **No** | No patches to `.exe`/`.pak` | **LOW** | — |
| Game **config** modification | **Yes (RL setup)** | `scripts/local-setup.mjs` → `DefaultStatsAPI.ini` | **MEDIUM** | User-opt-in via setup wizard; standard Stats API port/rate only |
| Kernel drivers / rootkit | **No** | Electron + Node only | **LOW** | — |
| Undocumented cheat-like techniques | **No** | Code review of scoped files | **LOW** | — |
| Process enumeration | **Yes** | `tasklist /FI IMAGENAME eq …` | **LOW** | Read-only; no injection |
| Normal game launch | **Yes** | Steam URI, Riot Client CLI/URI | **LOW** | Same as player launching manually |

---

## Rocket League — interaction map

```
Player PC
  │
  ├─ [User installs] BakkesMod + Stats API plugin
  │     └─ Exports match JSON → TCP 127.0.0.1:49123
  │
  ├─ scripts/rl-bridge.mjs
  │     └─ net.connect(49123) — passive TCP client, parse JSON events
  │     └─ Derives G/A/S, W/L, playlist from event payload
  │
  ├─ scripts/local-setup.mjs (optional, wizard)
  │     └─ patchStatsApiIni() — writes Port=49123, PacketSendRate=10
  │     └─ patchStartGrindBat() — updates .bat RLNAME (not game)
  │
  ├─ scripts/process-watcher.mjs
  │     └─ tasklist RocketLeague.exe — session auto-start hint only
  │
  ├─ scripts/game-launch.mjs
  │     └─ start "" "steam://rungameid/252950"
  │
  └─ js/rl-live.js
        └─ Polls local bridge HTTP /status, /last-match (localhost proxy)
        └─ Writes stats to Supabase via normal app save path
```

| Touchpoint | What | How | Data read | Risk | Safer alternative |
|------------|------|-----|-----------|------|-------------------|
| BakkesMod Stats API | Match events | TCP client `127.0.0.1:49123` | Goals, assists, saves, playlist, W/L, match GUID | **MEDIUM** (via third-party mod) | Manual log only; or replay/log file parsers (not implemented) |
| `DefaultStatsAPI.ini` patch | Enable Stats API | Write INI section `[TAGame.MatchStatsExporter_TA]` | None (config) | **MEDIUM** | User edits INI manually (documented in USER-SETUP) |
| Bridge HTTP | UI polling | `GET /status`, `/live`, `/last-match` | Aggregated match state | **LOW** | — |
| `tasklist` | Process detect | `RocketLeague.exe` image name | Boolean running | **LOW** | User starts session manually |
| Steam launch | Start game | `steam://rungameid/252950` | None | **LOW** | Player opens Steam themselves |
| Supabase sync | Cloud stats | HTTPS JWT | User-entered match rows | **LOW** | Local-only mode (manual) |

**BakkesMod assessment:** Twans does **not** bundle or inject BakkesMod. Users install it for training/replays; Stats API is a **read-only localhost export** consumed by many community tools. Ban risk is **policy on third-party mods**, not memory scraping by Twans. Document clearly; offer manual log without BakkesMod.

---

## Valorant — interaction map

```
Player PC
  │
  ├─ Path A — Henrik API (default)
  │     scripts/valorant-bridge.mjs
  │       └─ HTTPS api.henrikdev.xyz (Authorization: HDEV-…)
  │       └─ Polls v3/matches + v2/mmr-history after match ends
  │     js/valorant-live.js → bridge /valorant/*
  │
  ├─ Path B — Overwolf (optional)
  │     integrations/overwolf/background.js
  │       └─ overwolf.games.events GEP (game_id 21640)
  │       └─ POST 127.0.0.1:49200/valorant/overwolf-match
  │
  ├─ scripts/process-watcher.mjs
  │     └─ tasklist VALORANT-Win64-Shipping.exe (session UI only)
  │     └─ NOT used for Henrik poll gating (see valorant-bridge comment)
  │
  ├─ scripts/game-launch.mjs
  │     └─ RiotClientServices.exe --launch-product=valorant OR riotclient:// URI
  │
  └─ js/valorant-live.js + Supabase
        └─ Auto-log finished matches to cloud
```

| Touchpoint | What | How | Data read | Risk | Safer alternative |
|------------|------|-----|-----------|------|-------------------|
| Henrik Dev API | Post-match history | HTTPS GET with user API key | K/D/A, agent, map, RR, rank | **LOW** | Manual log; official Riot API (dev keys blocked for personal history) |
| Overwolf GEP | Live + end-of-match | `GameInfo` permission, events `match_start`/`match_end` | Scoreboard, agent, map, outcome | **LOW–MEDIUM** | Henrik-only path (already default) |
| Bridge `/valorant/arm` | Arm polling | Local POST | None | **LOW** | — |
| `tasklist` | Process detect | Image name only | Boolean | **LOW** | Manual session start |
| Riot Client launch | Start game | Official client exe/URI | None | **LOW** | Manual launch |
| Supabase | Cloud sync | HTTPS | Match rows | **LOW** | — |

**Henrik API assessment:** **LOW** — no Vanguard interaction; public match-history service; same class as tracker.gg-style tools. Rate-limited in bridge (`checkHenrikRateLimit`).

**Vanguard note:** Twans never attaches to `VALORANT-Win64-Shipping.exe`. Henrik polls **after** matches from Riot's public-facing data pipeline. Overwolf uses **Riot-approved** GEP for Valorant (game_id 21640).

---

## Overwolf assessment

| Item | Detail |
|------|--------|
| Manifest | `GameInfo` + `game_events` for Valorant (21640) only |
| Features requested | `gep_internal`, `me`, `game_info`, `match_info`, `kill`, `death` |
| Data flow | Background page → `POST http://127.0.0.1:49200/valorant/overwolf-match` |
| Game memory | **No direct access by Twans** — Overwolf SDK provides JSON events |
| Auth | Overwolf routes rate-limited; optional `OVERWOLF_BRIDGE_TOKEN` (see SECURITY-AUDIT) |
| Risk | **LOW–MEDIUM** — sanctioned channel; users must install Overwolf + extension |
| Recommendation | Keep optional; default docs to Henrik for widest safety/compatibility |

---

## Process watcher assessment

**File:** `scripts/process-watcher.mjs`

- **Mechanism:** Windows `tasklist /FI "IMAGENAME eq RocketLeague.exe"` and `VALORANT-Win64-Shipping.exe`
- **Purpose:** Expose `rocketLeagueRunning` / `valorantProcessRunning` on `/status`; auto-start/end grind **sessions** in `js/process-session.js`
- **Does not:** Open process handles, inject, or read memory
- **Risk:** **LOW** — common launcher/Discord pattern
- **Note:** Valorant Henrik polling intentionally **does not** gate on tasklist (avoided load-in freezes per `valorant-bridge.mjs`)

---

## Game launch assessment

**File:** `scripts/game-launch.mjs`

| Game | Command | Risk |
|------|---------|------|
| Rocket League | `start "" "steam://rungameid/252950"` | **LOW** — standard Steam protocol |
| Valorant | `RiotClientServices.exe --launch-product=valorant --launch-patchline=live` or `riotclient://launch-product=valorant&patchline=live` | **LOW** — official Riot launcher |

No elevated privileges, no custom hooks, no command-line cheats.

---

## Desktop launcher (`tools/launcher/src/main.cjs`)

| Behavior | Ban relevance |
|----------|---------------|
| Spawns `node start-grind.mjs` | Local HTTP only |
| Tray status from bridge `/status` | Passive poll |
| `taskkill` on **own** bridge child on quit | Not game-related |
| `twans://` protocol serves static SPA | No game touch |
| Blocks navigate to localhost in window | UX/security |

**Risk:** **LOW**

---

## Electron / bridge security (ban-adjacent)

- Bridge listens **`127.0.0.1`** only (`rl-bridge.mjs`, `start-grind.mjs`)
- Mutating routes require `X-Bridge-Token` (except Overwolf POSTs — rate limited)
- Not a ban vector; documented in SECURITY-AUDIT

---

## Recommendations (ranked by safety impact)

1. **Document BakkesMod as optional, user-installed, and ToS-aware** — manual log works without it. *(High clarity, no code risk change)*
2. **Default `patchIni` off or confirm checkbox** — already opt-in via setup wizard; keep "Enable DefaultStatsAPI.ini for me" explicit. *(Medium — reduces unsolicited config writes)*
3. **Prefer Henrik path in player docs** — already primary; Overwolf as advanced optional. *(Low–medium)*
4. **Keep process watcher session-only** — do not expand to memory/module scans. *(High if violated — do not implement)*
5. **Never add live Valorant client API scraping** (lockfile/local Riot API) — higher Vanguard scrutiny than Henrik. *(Critical avoidance)*
6. **Do not bundle BakkesMod or inject into RL** — maintain TCP-only client. *(Critical)*
7. **Diagnostics UI** — friendly connection status without aggressive recovery (taskkill/Kill-Port) for players. *(UX/safety perception)*

---

## Files reviewed

| File | Role |
|------|------|
| `scripts/rl-bridge.mjs` | RL TCP + HTTP bridge |
| `scripts/start-grind.mjs` | Tracker server + proxy |
| `scripts/process-watcher.mjs` | tasklist detection |
| `scripts/game-launch.mjs` | Steam/Riot launch |
| `scripts/valorant-bridge.mjs` | Henrik + Overwolf ingest |
| `scripts/local-setup.mjs` | INI/config apply |
| `scripts/bridge-security.mjs` | Auth, rate limits |
| `js/rl-live.js`, `js/valorant-live.js`, `js/bridge-client.js` | Frontend bridge clients |
| `js/process-session.js`, `js/game-launcher.js` | Session + launch UI |
| `integrations/overwolf/*` | Optional Val GEP |
| `tools/launcher/src/main.cjs` | Electron shell |

**Repo-wide grep:** No matches for injection, memory R/W, input simulation, kernel drivers in application source.

---

## Related docs

- [`EXTERNAL-INTERACTIONS.md`](EXTERNAL-INTERACTIONS.md) — quick reference table
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — passive-tracking principle
- [`USER-SETUP.md`](USER-SETUP.md) — BakkesMod / Henrik player setup
