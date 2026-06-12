# Startup Optimizer — Reference

Detailed boot-path map. Read when tracing a specific startup symptom.

## Electron pipeline (`tools/launcher/src/main.cjs`)

```
app.whenReady()
  → logStartup('app ready')
  → registerAppProtocol(trackerRoot)   // twans:// serves bundled SPA
  → createMainWindow()
      → BrowserWindow({ show: true })
      → loadURL(getSplashDataUrl())    // data: splash — instant paint
      → logStartup('window-visible')
  → startBridge()                      // spawn node bridge — background
  → openTrackerOnStart()
      → loadURL(twans://app/index.html) // do NOT wait for backend first
      → void waitForTrackerReady()     // background; SPA retries bridge
```

**Key functions:** `createMainWindow`, `loadAppIntoWindow`, `openTrackerOnStart`, `waitForTrackerReady`, `logStartup`, `registerAppProtocol`.

**Verify:** `config/bridge.log` — `[startup +Nms] window-visible` should precede `backend services ready`.

## SPA init (`js/app.js`)

```
init()
  → installGlobalErrorHandlers, wireNavigation, wireBootContext(...)
  → ensureBridgeServices()           // starts bridge client — non-blocking
  → onAuthChange → bootApp() when session
  → await initAuth()                   // auth probe — must not block unsigned shell
  → if (getAuthUser()) await bootApp()
```

**Risk:** `await getBootPromise()` at end of init blocks `window.__appReady` — keep `bootApp()` shell path fast.

## bootApp sequence (`js/boot.js`)

| Phase | markBoot | Blocking? |
|-------|----------|-----------|
| Hide login, apply mode | `shell-visible` | sync |
| Cache hydrate | — | sync (`loadProfileCache`) |
| Skeleton UI | `shell-painted` | sync (`renderDashboardShell`) |
| rAF ×2 | `first-paint`, `interactive` | await rAF only |
| Bridge probe | `bridge-reachable` / `bridge-wait-capped` | **void** — background |
| Supabase | `load-user-data-start` → `data-loaded` | await (after paint) |
| Rank repair | `repair-chains-start`, `hydrate-state` | await |
| Full dashboard | `first-render-complete` | `ctx.renderAll()` |
| Idle cleanup | `deferred-maintenance-*` | `requestIdleCallback` |

**markBoot:** logs `[boot +Nms] <phase>` and pushes to `window.__BOOT_MARKS`.

## Profile cache (`js/profile-cache.js`)

- Key: `twans-profile-cache` in `localStorage`
- Fields: `display_name`, `avatar_url`, colors, `activeGame`, `savedAt`
- Written after successful `loadUserData` via `saveProfileCache`
- Cleared on sign-out (`clearProfileCache`)

## Cached UI targets

| Asset | Current pattern | Startup goal |
|-------|-----------------|--------------|
| Auth bar | `renderAuthBar` with cached profile | Instant name/avatar |
| Dashboard shell | `renderDashboardShell()` skeleton | Visible before games load |
| Rank badges | `rankBadgeHTML` in `js/ranks.js` | Preload/cache images; `loading="lazy"` below fold |
| Tray/window icons | `createTrayIcon`, `getWindowIcon` in main.cjs | Generated once; cache buffer |

## Auth / sync deferral

- **Authenticate later:** `initAuth()` runs after DOM wiring; signed-out users see login without waiting for Supabase games
- **Sync later:** `loadUserData()` only after shell painted; rank repair and `renderAll()` after data arrives
- **No sync before paint:** grep `js/app.js` init for `await loadUserData`, `await fetch`, `supabase` calls

## Symptom → first checks

| Symptom | Likely cause | First check |
|---------|--------------|-------------|
| Blank window >1s | Launcher waits for backend | `[startup]` order in bridge.log |
| Spinner during fetch | Overlay not dismissed early | `showLoading(false)` before `loadUserData` |
| Slow first paint | Auth awaited before shell | `auth-ready` vs `shell-painted` in `__BOOT_MARKS` |
| Cold EXE slow | Bridge spawn blocks window | `createMainWindow` before `waitForTrackerReady` |
| Warm boot still slow | Cache miss or full renderAll early | `twans-profile-cache` in Application tab |
| Rank icons pop in | No preload/cache | Network tab on boot; rank img requests |

## Premium desktop targets (`docs/PREMIUM-DESKTOP-POLISH.md` §1)

- Electron splash: window + splash **<150ms** after `app.whenReady`
- Signed-in shell before data: dashboard visible before `loadUserData` resolves
- Bridge probe non-blocking: `interactive` before `load-user-data-start`

## Coordination boundaries

| Skill | Owns |
|-------|------|
| **startup-optimizer** | First paint, shell cache, boot await order, Electron show timing, asset preload |
| **performance-engineer** | `renderAll` guardrails, dashboard throttle, match-save path, idle churn |
| **desktop-engineer** | EXE packaging, `twans://` protocol, bridge spawn, tray menu |
| **data-engineer** | Rank repair correctness inside `loadUserData` path — do not defer repair incorrectly |
