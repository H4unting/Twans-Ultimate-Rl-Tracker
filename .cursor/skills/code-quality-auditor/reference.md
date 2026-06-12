# Code Quality Auditor — Reference

## Known shim map (do not delete while imported)

| Shim | Canonical | Verify with |
|------|-----------|-------------|
| `js/state.js` | `js/core/state.js` | `rg "from ['\"]./state"` / `from ['\"]\\.\\./state"` |
| `js/games.js` | `js/games/registry.js` | `rg "from ['\"]./games"` |

## CSS inventory (`index.html`)

- `css/styles.css`
- `css/valorant-theme.css`
- `css/layout-polish.css`
- `css/v0-design-system.css`
- `css/dashboard-v0.css`
- `css/legal.css`

`app/globals.css` is outside the tracker bundle — do not assume it ships in the EXE.

## Safe deletion checklist

1. Module has zero static and dynamic imports.
2. No `index.html` `<script type="module">` or legacy script tag.
3. No CSS class used in JS template strings or `classList` calls.
4. No bridge script `require`/`import` of client paths.
5. `node --check` passes on every touched file.

## Prior audit sources

- `docs/CODEBASE-AUDIT.md` — shim notes, no `js/js/` duplicate tree
- `docs/ARCHITECTURE-REPORT.md` — open dead-code and duplicate findings from Architecture Reviewer

## Coordination

| Skill | When to involve |
|-------|-----------------|
| `review-architecture` | Prioritize cleanup targets; do not duplicate full audits |
| `performance-engineer` | Function splits in render or poll paths |
| `desktop-engineer` | Changes to launcher, twans://, or bridge spawn paths |
| `review-security-auditor` | Removing auth/RLS-related branches — confirm with Security first |
