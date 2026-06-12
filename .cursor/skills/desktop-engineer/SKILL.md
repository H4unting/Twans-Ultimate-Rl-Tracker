---
name: desktop-engineer
description: >-
  Implements desktop packaging, Electron launcher, and tray-app fixes for Twans
  Ultimate Tracker — twans:// protocol, bundled bridge auto-start, EXE-first
  paths, and startup optimization. Use when the user mentions desktop app,
  Electron, exe, twans://, launcher, bridge auto-start, packaged build, tray
  app, or Twans Ultimate Tracker as a native Windows app.
disable-model-invocation: true
---

# Desktop Engineer

**Role:** Implement desktop packaging and launcher fixes for **Twans Ultimate Tracker**. Unlike review agents in `AGENTS.md`, this skill **applies minimal code changes** in `tools/launcher/`, bridge scripts, and desktop-aware app code — not read-only reports.

## Purpose

Treat the project as a native desktop app.

## Rules

Never rely on localhost if avoidable.
No browser assumptions.
No batch files.
Everything should work from the EXE.
Auto-start bridge/services internally.
Optimize startup time.

## Global constraints

- **Minimal diffs** — fix the EXE path, protocol, or spawn chain; no unrelated refactors.
- **Security and release blockers** from review agents outrank packaging polish.
- **Performance** — coordinate with `performance-engineer` on startup; do not block first paint waiting for bridge.
- **Developer bats** — `build-tray-app.bat` exists for maintainers only; end users must never need it (do not delete bats).

## Scope map

| Area | Primary paths |
|------|----------------|
| Electron launcher | `tools/launcher/src/main.cjs` |
| Packaged resources | `tools/launcher/package.json` → `extraResources` |
| Desktop host detection | `js/env.js` — `isTwansAppHost()`, `isDesktopHost()`, `getInternalTrackerApiOrigin()` |
| Bridge + static server | `scripts/start-grind.mjs`, `scripts/rl-bridge.mjs` |
| Build output | `tools/launcher/dist/` |
| Maintainer build | `build-tray-app.bat` (dev-only; users run the EXE) |

## Architecture (EXE-first)

```
Twans Ultimate Tracker.exe (Electron)
├── twans://app/index.html     ← UI (custom protocol; no visible localhost URL)
├── spawn node start-grind.mjs ← bridge-scripts/ (extraResources)
│   ├── :8080 static tracker + /api/bridge proxy
│   └── :49200 RL bridge status
└── tray icon + auto-restart on crash
```

Internal loopback (`127.0.0.1:8080`, `:49200`) is allowed for API/proxy — **never** expose it as the user-facing URL or primary navigation target.

## Workflow

```
Desktop fix:
- [ ] 1. Reproduce — packaged EXE vs dev Electron; tray vs window
- [ ] 2. Trace — startup log `[startup +Nms]` in bridge.log / dev console
- [ ] 3. Root cause — missing resource, wrong root, node not found, protocol 404
- [ ] 4. Fix — minimal diff in launcher, extraResources filter, or env.js host checks
- [ ] 5. Verify — launch EXE cold; twans:// loads; bridge auto-starts; no manual bats
```

### Step 1 — Reproduce

- **Packaged:** run `tools/launcher/dist/Twans Ultimate Tracker.exe` (or portable at repo root after `postbuild` copy).
- **Dev:** `cd tools/launcher && npm start` — uses repo `scripts/` and tracker files, not bundled resources.
- Confirm: single instance lock, tray menu, window loads splash then `twans://app/index.html`.

### Step 2 — Trace startup

Read `[startup +Nms]` lines from `main.cjs` `logStartup()` — also appended to `config/bridge.log` under data root.

Key phases: `app ready` → `protocol registered` → `bridge process spawned` → `tracker SPA loaded`.

Poll endpoints (internal only): `http://127.0.0.1:49200/status`, `http://127.0.0.1:8080/api/bridge/status`.

### Step 3 — Common failures

| Symptom | Likely cause | Fix direction |
|---------|--------------|---------------|
| "Tracker files missing" on launch | `extraResources` filter omitting files | Update `package.json` filter; rebuild |
| "Scripts missing" | `bridge-scripts/start-grind.mjs` not bundled | Check `extraResources` from `../../scripts` |
| Node not found | No bundled `node-runtime/node.exe`, no system Node | Bundle node or document installer path |
| Blank window / localhost redirect | UI navigates to `http://localhost:8080` | Keep UI on `twans://`; API via `getInternalTrackerApiOrigin()` |
| Bridge not auto-starting | `startBridge()` not called or spawn env wrong | Fix `main.cjs` spawn cwd/env (`TWANS_TRACKER_ROOT`) |
| Slow cold start | Window waits for bridge before paint | Splash first; defer `openTrackerOnStart`; parallel spawn |

### Step 4 — Apply (minimal diff)

**Launcher (`main.cjs`):**

- Resolve roots via `findDataRoot()`, `findTrackerRoot()`, `findBridgeScriptsDir()` — prefer `process.resourcesPath` when packaged.
- Register `twans` protocol before loading UI; serve static files from `tracker-app/`.
- Spawn `node start-grind.mjs` with correct `TWANS_TRACKER_ROOT`; auto-restart on exit (up to `MAX_RESTARTS`).
- Block or redirect user-visible navigation away from `twans://` and localhost URLs in the shell window.

**Packaging (`package.json`):**

- Keep `extraResources`: `bridge-scripts` (*.mjs) and `tracker-app` (index, js, css, config, vendor, etc.).
- After build, `postbuild` copies EXE to repo root via `scripts/copy-exe.cjs`.

**App code (`js/env.js`, bridge clients):**

- Use `isTwansAppHost()` / `isDesktopHost()` for desktop behavior — hide browser-only hints, manual session controls.
- API calls: `getInternalTrackerApiOrigin()` (`127.0.0.1:8080`) — not `window.location` for fetch proxy paths.
- Static assets: `getAssetUrl()` for `twans://` compatibility.

**Do not:**

- Add user-facing flows that require opening `http://localhost:8080` in a browser tab.
- Add new `.bat` files or document bats as the primary install/run path.
- Require manual `node scripts/start-grind.mjs` before the EXE works.

### Step 5 — Verify

- [ ] Cold launch EXE — no prior bridge process; tray appears; window opens without user running scripts.
- [ ] UI URL is `twans://app/...` (DevTools in dev build only).
- [ ] Auto-log bridge reachable internally; desktop session controls behave per `env.js`.
- [ ] Quit from tray kills bridge child process.
- [ ] Rebuild portable/NSIS if `extraResources` or `main.cjs` changed.

## Startup optimization checklist

- [ ] Splash (`data:` URL) paints before bridge ready — do not block window creation on HTTP polls.
- [ ] Parallelize: spawn bridge while splash visible; load `twans://` when tracker responds (see `waitForTrackerReady`, `openTrackerOnStart`).
- [ ] Avoid duplicate spawns — guard `appLoadInFlight`, single `startBridge` per session.
- [ ] Trim `extraResources` filters only when files are truly unused (missing file → 404 on protocol).
- [ ] Log `[startup +Nms]` milestones; compare before/after when tuning.

## Anti-patterns

- Assuming `window.location.origin` is HTTP — breaks on `twans://`.
- Opening external browser for core app flows.
- Hardcoding repo-relative paths that fail under `process.resourcesPath`.
- Requiring `npm start` or dev server for end-user features.
- User instructions that say "run the bat file" or "start localhost first".

## Output (fix tasks)

Summarize in chat or PR:

1. **Symptom** — EXE vs dev, tray/window behavior
2. **Root cause** — spawn chain, missing bundle, protocol, or host detection
3. **Changes** — files touched and why EXE-first
4. **Verify** — cold-start steps and startup timing if optimized

## Additional resources

- Twans desktop architecture, paths, and build notes: [reference.md](reference.md)
- Startup perf guardrails: `performance-engineer`
- Read-only architecture audit: `review-architecture` → `docs/ARCHITECTURE-REPORT.md`
