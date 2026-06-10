# Desktop Polish & Performance Sprint

Checklist mapped to the 15-section desktop vision. **Session:** 2026-06-10.

| # | Section | Priority | Status | Notes |
|---|---------|----------|--------|-------|
| 1 | Tray icon & branding | P0 | **Done** | `integrations/overwolf/icon.png` → `tools/launcher/assets/icon.ico` via `npm run generate-icon` |
| 2 | Remove browser feel | P0 | **Done** | `twans://` protocol, dark `backgroundColor`, splash, block F5/Ctrl+R in production, block localhost navigation |
| 3 | Startup optimization | P0 | **Partial** | Window+splash immediate; app shell loads before backend ready; parallel Supabase + bridge wait in `boot.js`; cold-start timing in `bridge.log` |
| 4 | Performance audit | P1 | **Done** | See [`DESKTOP-PERFORMANCE-AUDIT.md`](DESKTOP-PERFORMANCE-AUDIT.md) |
| 5 | Animations polish | P2 | **Deferred** | Phase 2 — micro-interactions on nav/dock |
| 6 | Lazy module loading | P1 | **Done** | `reports-ui`, `focus`, `groups` dynamic import on first nav |
| 7 | Render scope trimming | P1 | **Done** | `renderAll()` skips off-page review/squad renders |
| 8 | Image optimization | P2 | **Deferred** | Phase 2 — avatar lazy-load, WebP where safe |
| 9 | Electron hardening | P1 | **Verified** | `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` in `main.cjs` |
| 10 | Interval / listener cleanup | P1 | **Partial** | Diagnostics poll pauses on tab hide; bridge heartbeat already visibility-aware |
| 11 | Responsive layout | P2 | **Deferred** | Phase 2 — narrow-window dashboard breakpoints |
| 12 | Auto recovery | P1 | **Done** | Bridge child auto-restart (max 8); UI `Reconnecting…` / `Tracking resumed` |
| 13 | Nav precache | P2 | **Deferred** | Phase 2 — prefetch review modules after idle |
| 14 | Native notifications | P2 | **Deferred** | Electron `Notification` stub documented; match-logged toast remains in-app |
| 15 | Release packaging | P0 | **Done** | `icon.ico` wired in electron-builder; `prebuild` regenerates icon |

---

## Rebuild

From repo root:

```bat
build-tray-app.bat
```

Or manually:

```bat
cd tools\launcher
npm install
npm run generate-icon
npm run build
```

Output: `tools/launcher/dist/Twans Ultimate Tracker.exe` (and NSIS installer).

---

## Icon asset chain

| Role | Path |
|------|------|
| **Canonical source** | `integrations/overwolf/icon.png` |
| **Launcher PNG sync** | `tools/launcher/assets/icon.png` |
| **Windows ICO (multi-size)** | `tools/launcher/assets/icon.ico` |
| **Web favicon / login / navbar** | `integrations/overwolf/icon.png` (unchanged) |
| **Generator script** | `tools/launcher/scripts/generate-icon.mjs` |

`public/icon.svg` is a generic placeholder — **not** used for desktop branding.

---

## Startup timing

Electron logs `[startup +Nms]` lines to `config/bridge.log` (and dev console). Key milestones:

1. `app ready`
2. `protocol registered`
3. `splash window shown`
4. `bridge process spawned`
5. `loading app shell`
6. `app window ready`
7. `backend services ready` (async, non-blocking)
8. `startup pipeline complete`

Target cold start &lt;2s to visible shell — backend may still be warming; SPA handles via `boot.js` + bridge heartbeat.
