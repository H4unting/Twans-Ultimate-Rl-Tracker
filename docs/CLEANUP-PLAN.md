# Cleanup Plan — Phase 6 Safe Proposals ONLY

**Product:** Twans Ultimate Tracker  
**Audit date:** June 7, 2026  
**Rule:** Document only — **DO NOT execute** without explicit approval and smoke test.

**Risk levels:** LOW = isolated, easy rollback · MEDIUM = touches shared paths · HIGH = data/sync/auth impact

---

## Summary

| Risk | Count |
|------|------:|
| LOW | 12 |
| MEDIUM | 6 |
| HIGH | 2 |

Recommended order: LOW cosmetic dead code first → MEDIUM shim consolidation → HIGH only after v1.0.1 with full regression.

---

## 1. Dead / orphaned code

### CL-01 — Remove `renderWelcomeHeader` (unused)

| Field | Value |
|-------|-------|
| **File** | `js/ui.js` (~204–210) |
| **Reason** | Targets `#welcome-header` which does not exist in `index.html`; no callers in codebase |
| **Risk** | LOW |
| **Benefit** | Smaller bundle, less confusion for contributors |
| **Verify** | `rg renderWelcomeHeader` returns only definition |

### CL-02 — Remove deprecated `isGlanceMode` / `isGrindHost`

| Field | Value |
|-------|-------|
| **File** | `js/env.js` (38–45) |
| **Reason** | Marked `@deprecated`; no imports found outside `env.js` |
| **Risk** | LOW |
| **Benefit** | Clearer env API |
| **Verify** | Grep for callers before removal |

### CL-03 — Remove empty `onLoad()` stubs

| Field | Value |
|-------|-------|
| **Files** | `js/games/rocketleague/index.js:14`, `js/games/valorant/index.js:17` |
| **Reason** | No-op functions never invoked |
| **Risk** | LOW |
| **Benefit** | Noise reduction |
| **Verify** | Grep `onLoad` across repo |

### CL-04 — Remove debug `console.log('[REVIEW]'` / `[SQUAD]`

| Field | Value |
|-------|-------|
| **Files** | `js/nav.js`, `js/app.js` |
| **Reason** | Debug noise in production console |
| **Risk** | LOW |
| **Benefit** | Cleaner console for support |
| **Verify** | None — logging only |

---

## 2. Legacy DOM / CSS

### CL-05 — Remove sr-only legacy sinks after home.js migration complete

| Field | Value |
|-------|-------|
| **Files** | `index.html` (`#home-summary`, `#val-dashboard`); `js/home.js` references; `css/styles.css` `.home-summary-*`; `css/valorant-theme.css` `.val-dashboard` |
| **Reason** | v0 dashboard uses `#dash-*` sections; legacy containers hidden |
| **Risk** | MEDIUM |
| **Benefit** | ~200 lines CSS removed, simpler DOM |
| **Verify** | Full dashboard smoke RL + Val; screen reader pass |

### CL-06 — Prune unused `.home-summary-*` CSS

| Field | Value |
|-------|-------|
| **File** | `css/styles.css`, `css/layout-polish.css` |
| **Reason** | Selectors target removed/hidden elements |
| **Risk** | LOW (if CL-05 done) |
| **Benefit** | Smaller CSS |

---

## 3. Dual-stack / scaffold

### CL-07 — Archive or clearly mark Next.js scaffold

| Field | Value |
|-------|-------|
| **Files** | `app/`, `components/tracker/`, `lib/tracker-data.ts`, `app/globals.css`, `package.json` Next deps |
| **Reason** | Not production runtime; confuses contributors (`npm run dev` ≠ tracker) |
| **Risk** | MEDIUM |
| **Benefit** | Clear single-stack mental model |
| **Options** | (a) Move to `scaffold/next/` folder, (b) README warning only, (c) delete after UI migration abandoned |
| **Verify** | Confirm GitHub Pages deploy does not use Next build |

### CL-08 — Remove placeholder public assets used only by Next

| Field | Value |
|-------|-------|
| **Files** | `public/placeholder*.png`, `placeholder.svg`, `placeholder.jpg`, `placeholder-user.jpg` |
| **Reason** | Vanilla SPA uses different assets (`avatar-gamer.png`, rank icons) |
| **Risk** | LOW |
| **Benefit** | Repo hygiene |
| **Verify** | Grep each filename in `js/` and `index.html` |

---

## 4. Compatibility shims (consolidate imports)

### CL-09 — Migrate imports from `js/state.js` to `js/core/state.js`

| Field | Value |
|-------|-------|
| **Files** | All importers of `./state.js` (~30 files) |
| **Reason** | Shim adds indirection; `@deprecated` comment on shim |
| **Risk** | MEDIUM |
| **Benefit** | Single canonical state module |
| **Verify** | Full app boot + log smoke |

### CL-10 — Migrate imports from `js/games.js` to `js/games/registry.js`

| Field | Value |
|-------|-------|
| **Files** | All importers of `./games.js` |
| **Reason** | Same as CL-09 |
| **Risk** | MEDIUM |
| **Benefit** | Clearer module boundaries |
| **Verify** | Game switch RL ↔ Val smoke |

### CL-11 — Delete shim files after CL-09 + CL-10

| Field | Value |
|-------|-------|
| **Files** | `js/state.js`, `js/games.js` |
| **Reason** | Re-export only |
| **Risk** | LOW after migration |
| **Benefit** | Fewer files |

---

## 5. Documentation / SQL hygiene

### CL-12 — Add deprecation banner to `docs/supabase/schema.sql`

| Field | Value |
|-------|-------|
| **File** | `docs/supabase/schema.sql` |
| **Reason** | Contains unsafe anon RLS policy — operators might run wrong file |
| **Risk** | LOW |
| **Benefit** | Prevents security misconfiguration |
| **Note** | Doc-only change |

### CL-13 — Consolidate overlapping audit docs

| Field | Value |
|-------|-------|
| **Files** | `docs/AUDIT-REPORT.md`, `docs/SECURITY-AUDIT.md`, `docs/SECURITY-AUDIT-FULL.md` vs new v1 audit set |
| **Reason** | Multiple audit generations |
| **Risk** | LOW |
| **Benefit** | Single source of truth with links |
| **Note** | Add index in `AGENTS.md` pointing to v1 audit files |

---

## 6. Legacy launchers

### CL-14 — Remove legacy bat wrappers (optional)

| Field | Value |
|-------|-------|
| **Files** | `start-grind.bat`, `start-val-grind.bat` |
| **Reason** | Documented as legacy wrappers in `STRUCTURE.md` |
| **Risk** | LOW |
| **Benefit** | Fewer entry points |
| **Verify** | Users may have shortcuts — keep one release cycle with redirect message |

---

## 7. QA / dev-only (keep but gate)

### CL-15 — Ensure QA panel never ships enabled by default

| Field | Value |
|-------|-------|
| **Files** | `js/qa/qa-gate.js`, `js/qa/qa-panel.js` |
| **Reason** | Dev tools in production bundle |
| **Risk** | LOW to remove from bundle; MEDIUM if tree-shaking breaks |
| **Benefit** | Smaller prod JS |
| **Note** | Currently gated by URL param — acceptable for v1.0 |

---

## 8. HIGH risk — defer past v1.0

### CL-H1 — Remove `syncGameSliceLegacy` fallback

| Field | Value |
|-------|-------|
| **File** | `js/supabase.js:211–216, 248–251` |
| **Reason** | Delete-all-then-insert is dangerous |
| **Risk** | **HIGH** |
| **Benefit** | Eliminates catastrophic data loss path |
| **Prerequisite** | Confirm 100% of prod DBs have upsert index via `multi-game.sql` |
| **Do not execute** | Until operator confirms all environments migrated |

### CL-H2 — Remove boot-time silent ghost/dupe purge

| Field | Value |
|-------|-------|
| **Files** | `js/boot.js:119–126`, `js/app.js:402–406` |
| **Reason** | Mutates user data without explicit consent |
| **Risk** | **HIGH** |
| **Benefit** | User trust; opt-in maintenance |
| **Prerequisite** | UI buttons already exist on Match Logs — could rely on manual only |
| **Do not execute** | Without product decision and backup strategy |

---

## 9. Unused dependency cleanup (Next scaffold)

### CL-16 — Remove unused npm dependencies if Next scaffold archived

| Field | Value |
|-------|-------|
| **File** | `package.json` |
| **Reason** | next, react, tailwind, etc. unused by vanilla SPA |
| **Risk** | MEDIUM |
| **Benefit** | Faster CI, smaller install |
| **Prerequisite** | CL-07 decision |

---

## Execution checklist (when approved)

For each cleanup item:

1. [ ] Grep verify zero callers
2. [ ] Run manual smoke: auth, RL log, Val log, edit, delete, squad view
3. [ ] Check `docs/RELEASE-CHECKLIST.md`
4. [ ] Single commit per logical cleanup
5. [ ] Update `docs/VERIFICATION-LOG.md`

---

## Findings vs recommendations

### Findings

- Most cleanup candidates are LOW risk dead code and CSS.
- Shim files exist for backward-compatible imports — consolidation is MEDIUM effort.
- Two HIGH risk items involve data integrity — must not run before v1.0 without explicit sign-off.

### Recommendations

- Execute CL-01 through CL-04 in v1.0.1 patch (LOW only).
- Defer CL-H1 and CL-H2 indefinitely unless product owner accepts risk.
- Do not delete Next scaffold until UI migration decision is recorded.

---

*Phase 6 complete. No cleanup executed.*
