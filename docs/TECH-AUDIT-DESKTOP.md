# Desktop Technical Audit

Companion to [`ARCHITECTURE.md`](ARCHITECTURE.md). Documents dead/duplicate artifacts and safe cleanup candidates. **No HIGH-risk deletions executed** in this pass.

Audit date: 2026-06-10 (product reset session)

---

## Dead / duplicate files (document only)

| Item | Risk | Notes |
|------|------|-------|
| `launcher/` (repo root) | **HIGH** | Legacy duplicate of `tools/launcher/`. `build-tray-app.bat` uses `tools/launcher/`. Old docs reference `Twans Auto-Log.exe` naming. **Do not delete** until all references verified. |
| `Twans Auto-Log.exe` / `Twans-Tracker-Bridge.exe` aliases | **HIGH** | `copy-exe.cjs` still copies legacy names for backward compatibility. |
| `launcher/src/main.cjs` vs `tools/launcher/src/main.cjs` | **HIGH** | Diverged branding; only `tools/` is canonical. |
| `app/` Next.js scaffold | **MEDIUM** | Not used by desktop SPA; separate experiment. |
| `integrations/overwolf/` | **LOW** | Optional Val path; Henrik is default. Keep for power users. |
| `js/valorant-config.js` | **LOW** | Small constants file — used by auto-log handlers. **Not dead.** |
| `config/qa.local.example.js` | **LOW** | Dev QA only — keep. |

### Naming drift (cleanup backlog)

| Location | Issue |
|----------|-------|
| `js/games/rocketleague/meta.js` | Still says "Twans Auto-Log" in setup desc |
| `js/games/valorant/meta.js` | Same |
| `launcher/src/main.cjs` | Old "Twans Auto-Log" strings if anyone builds from wrong folder |

Phase 2 should unify copy to `DESKTOP_APP.name` without deleting files.

---

## Safe removals considered

| Candidate | Verdict |
|-----------|---------|
| Delete `launcher/` folder | **Rejected** — HIGH risk, may break OneDrive clones / old scripts |
| Delete packaged exe from repo root | **Rejected** — user artifact, gitignored in ideal state |
| Delete `launcher/README.md` only | **Skipped** — marginal value, could confuse if `launcher/` still exists |

**Executions this session: 0 deletions.** Evidence insufficient for LOW-risk file removal without grep-based import proof across CI and batch files.

---

## Friction fixes applied (this session)

| Area | Change |
|------|--------|
| Manual session UI | Hide Start on Electron + auto-session; dashboard action removed; End relabeled "End early" |
| Boot gate | `boot.js` waits for bridge reachable on desktop before data load completes |
| User-visible jargon | `auth.js`, `app.js`, `supabase.js`, `game-launcher.js`, `sessions.js`, `bridge-ui.js`, `index.html` |
| Detection helpers | `isDesktopHost()`, `shouldHideManualSessionControls()` in `env.js` |

---

## Static analysis

| Check | Result |
|-------|--------|
| `node --check` on `js/**/*.js` (89 files) | **PASS** (0 failures) |
| Import graph spot-check | `app.js` → `boot.js` → new `env.js` exports — no circular dependency introduced |

---

## Commercial desktop gaps (unchanged)

| Gap | Phase |
|-----|-------|
| Installer smoke on fresh VM | Pre-v1.0 QA |
| Bundled Node in installer | Phase 3 |
| `electron-updater` auto-update | Phase 4 |
| Native notifications | Phase 4 |
| In-app settings (no JSON) | Phase 2 |

See gap matrix in [`ARCHITECTURE.md`](ARCHITECTURE.md).
