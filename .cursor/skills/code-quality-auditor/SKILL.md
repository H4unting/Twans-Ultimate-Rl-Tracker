---
name: code-quality-auditor
description: >-
  Continuously cleans the Twans Ultimate Tracker codebase by removing dead code,
  duplicate utilities, unused CSS, stale imports, unreachable branches, and
  oversized functions. Implements minimal cleanup diffs in js/, css/, and
  scripts/. Use when the user mentions dead code, duplicate utilities, unused
  CSS, stale imports, refactor, cleanup, code quality, or Twans Ultimate
  Tracker maintenance.
disable-model-invocation: true
---

# Code Quality Auditor

**Role:** **Implement** codebase cleanup in **Twans Ultimate Tracker**. Unlike `review-architecture` (read-only report to `docs/ARCHITECTURE-REPORT.md`), this skill **deletes and consolidates** — minimal diffs only.

## Purpose

Continuously clean the codebase.

## Rules

Remove dead code.
Remove duplicate utilities.
Remove unused CSS.
Remove stale imports.
Remove unreachable branches.
Keep functions short.

## Global constraints

- **Minimal diffs** — one cleanup category per change set; no drive-by features.
- **Security and release blockers** from review agents outrank cleanup polish.
- **Do not break** twans:// EXE bundle — verify `index.html` module graph still resolves.
- **Performance** — coordinate with `performance-engineer` on hot-path extractions; do not split render-loop functions without measuring.
- **Architecture findings** — use `review-architecture` to **prioritize**; this skill **fixes** documented dead code and duplicates.

## Twans context

| Area | Paths | Notes |
|------|-------|-------|
| Client modules | `js/` | Vanilla ES modules; entry `js/boot.js` → `js/app.js` |
| Styles | `css/` | Linked from `index.html`; no build step |
| Bridge (not bundled) | `scripts/*.mjs` | Node-only; clean separately from client bundle |
| Legacy | `js/js/` | **Deleted tree** — do not reintroduce paths or imports |
| Shims | `js/state.js`, `js/games.js` | Re-export `js/core/state.js`, `js/games/registry.js` — remove only after zero-import proof |

```
js/
  app.js, boot.js, nav.js, supabase.js
  games/       — per-game plugins
  core/        — shared utilities
```

## Workflow

```
Code quality cleanup:
- [ ] 1. Search — grep dead code, duplicates, stale imports, unused CSS
- [ ] 2. Verify — no references (imports, HTML, CSS selectors, dynamic import)
- [ ] 3. Plan — minimal diff; one category; list files touched
- [ ] 4. Apply — delete or consolidate; shorten functions only when clearly safe
- [ ] 5. Validate — node --check on changed .js / .mjs
```

### Step 1 — Search

| Target | Search approach |
|--------|-----------------|
| Dead modules | Unimported `js/**/*.js` — trace from `boot.js`, `app.js`, `index.html` |
| Duplicate utilities | Parallel helpers in `js/utils.js` vs `js/core/*`; game vs root copies |
| Unused CSS | Classes in `css/*.css` not referenced in `index.html` or `js/**/*.js` strings |
| Stale imports | Unused named imports; imports of deleted or shim-only modules |
| Unreachable branches | `if (false)`, dead `else`, post-return code, obsolete feature flags |
| Long functions | >80 lines — extract only when duplication or clarity wins; no behavior change |

### Step 2 — Verify no references

Before deleting:

1. `rg` symbol, filename, and class name across `js/`, `css/`, `index.html`, `scripts/`.
2. Check dynamic paths: `import()`, string-built module IDs, `querySelector('.class')`.
3. Confirm launcher/bridge paths unchanged if touching `desktop-engineer` owned files.

### Step 3 — Apply (minimal diff)

- **Dead code:** delete file or export; remove from `index.html` if script tag.
- **Duplicates:** keep one canonical copy in `js/core/`; update imports; delete shim only when unused.
- **Unused CSS:** remove rule blocks; keep cascade-dependent selectors if parent still used.
- **Stale imports:** remove unused bindings; fix broken paths.
- **Unreachable branches:** delete branch; simplify condition.
- **Short functions:** extract named helpers in same file; no new abstraction layers.

**Do not:**

- Broad refactors across module boundaries in one change set.
- Change public handler signatures without grepping all call sites.
- Remove CSS tied to QA/dev overlays (`?dev=1`) without checking `js/dev-overlay.js`.
- Delete `js/state.js` or `js/games.js` shims while imports remain.

### Step 4 — Validate

```bash
node --check js/path/changed.js
node --check scripts/changed.mjs
```

Manual smoke if cleanup touched boot, nav, or game registry.

## vs review-architecture

| | `review-architecture` | `code-quality-auditor` |
|--|----------------------|------------------------|
| Mode | Read-only | Implements cleanup |
| Output | `docs/ARCHITECTURE-REPORT.md` | Code deletions and consolidation |
| Scope | Full architecture audit | Dead code, dupes, CSS, imports, branches, function size |

Run Architecture Reviewer to **find**; run Code Quality Auditor to **fix** (or user-directed cleanup).

## Output (cleanup tasks)

Summarize in chat or PR:

1. **Removed** — what was deleted and why (zero references)
2. **Consolidated** — duplicate → canonical path
3. **Files** — list touched paths
4. **Verify** — `node --check` results; manual smoke if needed

## Additional resources

- Cleanup patterns and audit backlog: [reference.md](reference.md)
- Architecture findings: `docs/ARCHITECTURE-REPORT.md`, `docs/CODEBASE-AUDIT.md`
