# Desktop Engineer — Twans Ultimate Tracker Reference

Architecture and file map for packaged desktop work. Read when tracing EXE startup, protocol serving, or bridge spawn issues.

## Component map

| Component | Path | Role |
|-----------|------|------|
| Electron main | `tools/launcher/src/main.cjs` | Tray, window, `twans://` protocol, bridge spawn, crash restart |
| Launcher manifest | `tools/launcher/package.json` | electron-builder config, `extraResources` bundles |
| Bridge entry | `scripts/start-grind.mjs` | HTTP :8080 static server + :49200 bridge; bundled as `bridge-scripts/` |
| RL bridge | `scripts/rl-bridge.mjs` | Game stats ingestion (spawned by start-grind) |
| Desktop env | `js/env.js` | `isTwansAppHost()`, `isDesktopHost()`, internal API origin |
| App config | `js/config.js` | `LOCAL_TRACKER_URL` (dev/docs; desktop UI uses twans://) |
| Maintainer build | `build-tray-app.bat` | **Developer only** — cd to `tools/launcher`, calls `build-bridge.bat`. End users must not need this. |
| Build copy | `tools/launcher/scripts/copy-exe.cjs` | `postbuild` copies portable EXE to repo root |

## Packaged layout (extraResources)

From `tools/launcher/package.json`:

```
process.resourcesPath/
├── bridge-scripts/          ← from ../../scripts/*.mjs
│   └── start-grind.mjs
└── tracker-app/             ← from repo root filter
    ├── index.html
    ├── js/**/*
    ├── css/**/*
    ├── config/**/*
    └── ...
```

Electron `files` array includes only `src/**` and launcher `assets/**` — tracker UI lives in `extraResources`, not the asar.

## Root resolution (`main.cjs`)

| Function | Packaged priority |
|----------|-------------------|
| `findDataRoot()` | `TWANS_TRACKER_ROOT`, `PORTABLE_EXECUTABLE_DIR`, exe dir |
| `findTrackerRoot()` | `resources/tracker-app`, then dataRoot |
| `findBridgeScriptsDir()` | `resources/bridge-scripts`, dataRoot/scripts, dev fallbacks |
| `findNodeExecutable()` | bundled `node-runtime/node.exe`, then `where node` |

Spawn env for bridge:

```javascript
bridgeProc = spawn(nodePath, [scriptPath], {
  cwd: scriptsDir,
  env: { ...process.env, TWANS_TRACKER_ROOT: dataRoot, ... },
});
```

## twans:// protocol

- Registered in `registerAppProtocol(trackerRoot)` after `app.whenReady`.
- Privileged scheme: `standard`, `secure`, `supportFetchAPI`, `corsEnabled`.
- Request URL: `twans://app/index.html` → serves `tracker-app/index.html`.
- Path traversal blocked via `isPathUnderRoot`.
- Window navigation wired to block user-visible localhost redirects (`wireWindowNavigation`).

Constants:

```javascript
const APP_PROTOCOL = 'twans';
const APP_HOST = 'app';
const APP_URL = 'twans://app/index.html';
const INTERNAL_TRACKER_ORIGIN = 'http://127.0.0.1:8080';
const BRIDGE_STATUS_URL = 'http://127.0.0.1:49200/status';
```

## Startup sequence

1. `app.requestSingleInstanceLock()` — second instance focuses existing window.
2. `findDataRoot` / `findTrackerRoot` / `findBridgeScriptsDir` / `findNodeExecutable` — fail fast with dialog if missing.
3. `registerAppProtocol(trackerRoot)`.
4. Create tray icon.
5. If `openTrackerOnStart` (default from `config/bridge-launcher.json`): create window with splash, then load app.
6. `startBridge()` — spawn `node start-grind.mjs` immediately (parallel with splash).
7. `openTrackerOnStart()` — wait for tracker HTTP ready, then `loadURL(twans://...)`.
8. `pollStatus()` every 3s — updates tray icon phase.

Startup logs: `[startup +Nms] <message>` via `logStartup()` → dev console + `config/bridge.log`.

## `js/env.js` desktop helpers

| Export | Use |
|--------|-----|
| `isTwansAppHost()` | `window.location.protocol === 'twans:'` |
| `isDesktopHost()` | Electron userAgent |
| `isLocalTrackerHost()` | true for twans:// or localhost:8080 |
| `getInternalTrackerApiOrigin()` | `http://127.0.0.1:8080` for fetch/proxy — never shown in UI |
| `getLocalTrackerUrl()` | From config — used in copy/docs for web bookmark context |
| `getAssetUrl(relativePath)` | Resolves static paths for twans:// and http dev |
| `shouldHideManualSessionControls()` | Desktop auto-session when bridge active |

App code must branch on `isTwansAppHost()` / `isDesktopHost()` instead of assuming a browser tab or `http://` page origin.

## `scripts/start-grind.mjs`

- Serves tracker static files on port 8080.
- Starts RL bridge on port 49200.
- Respects `TWANS_TRACKER_ROOT` for file paths.
- Used by EXE via spawn — not invoked by end users directly.

Ports (internal):

| Port | Service |
|------|---------|
| 8080 | Tracker HTTP + `/api/bridge` proxy |
| 49200 | Bridge status / game connection |

## Build commands (maintainers)

From repo root, developers may use `build-tray-app.bat` (calls `tools/launcher/build-bridge.bat`). Preferred npm path:

```bash
cd tools/launcher
npm run build          # portable + NSIS
npm run build:portable # portable only
```

Output: `tools/launcher/dist/Twans Ultimate Tracker.exe` (+ NSIS installer).

**Rule reminder:** bats are for developers packaging the app. Ship behavior must work from the EXE alone.

## Bridge auto-restart

`main.cjs` watches bridge process exit; restarts with backoff up to `MAX_RESTARTS` (8) unless `appQuitting`. On persistent failure, tray shows error phase and dialog may prompt user to relaunch EXE.

## Related config

- `config/bridge-launcher.json` — `openTrackerOnStart` (default true)
- `config/bridge.log` — launcher + protocol errors (rotates at 2MB)

## Verification checklist (packaged)

1. Delete any running bridge/tracker processes.
2. Launch EXE cold — tray + window without manual scripts.
3. Confirm `twans://app/index.html` loads (dev: DevTools URL bar).
4. Confirm internal status endpoints respond.
5. Quit from tray — child node process terminates.
