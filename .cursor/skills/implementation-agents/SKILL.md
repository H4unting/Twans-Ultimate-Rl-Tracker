---
name: implementation-agents
description: >-
  Orchestrates Twans Ultimate Tracker implementation skills (startup, performance,
  logic, UI, desktop, auto-log, security, data, code quality, dev overlay).
  Routes fix and feature tasks to the right owning skill(s). Use when the user
  requests a fix, optimization, polish pass, or multi-domain implementation work
  — not read-only audits (use review-agents for those).
disable-model-invocation: true
---

# Implementation Agents — Twans Ultimate Tracker

Ten **implementation** skills apply minimal code diffs in owned domains. Unlike `review-agents`, these skills **implement fixes** — not report-only audits.

**Invoke:** by skill name in chat (e.g. *"Run startup-optimizer"*, *"Use logic-validator"*) or ask this orchestrator to route.

## Agents

| Agent | Skill | Owns |
|-------|-------|------|
| Startup Optimizer | `startup-optimizer` | First paint, boot path, cached shell, deferred sync |
| Performance Engineer | `performance-engineer` | Lag, renderAll guardrails, listeners, lazy load |
| Logic Validator | `logic-validator` | Tracking invariants, RR ladder, session ↔ auth |
| UI / UX Designer | `ui-ux-designer` | Dashboard spacing, hierarchy, Today's Focus |
| Desktop Engineer | `desktop-engineer` | EXE/launcher, twans://, bridge auto-start |
| Auto-Logging Specialist | `auto-logging-specialist` | RL/Val process detection, bridge ingest |
| Security Engineer | `security-engineer` | RLS, XSS, validation, rate limits, secrets |
| Data Engineer | `data-engineer` | Stats, rank chain, RR/MMR math, sync integrity |
| Code Quality Auditor | `code-quality-auditor` | Dead code, dupes, unused CSS, stale imports |
| Dev Overlay Engineer | `dev-overlay-engineer` | ?dev=1 overlay, FPS, boot/render metrics |

Legacy alias: `performance-hunter` → same domain as `performance-engineer`.

## Priority (non-negotiable)

1. **Release blockers** and **Security P0** from `review-agents` outrank all implementation work
2. **Startup + performance** on boot/lag complaints before polish
3. **Logic + auto-log** before data/UX when behavior is wrong
4. **Minimal diffs** — one invariant or one hotspot per pass

## Routing

| User intent | Load skill(s) |
|-------------|----------------|
| Slow launch, cold start, first paint, splash | `startup-optimizer` |
| Lag after boot, jank, renderAll, duplicate renders | `performance-engineer` (+ `startup-optimizer` if on open) |
| Tracking wrong, RR rank stuck, session after logout | `logic-validator` (+ `auto-logging-specialist` if process-gated) |
| Dashboard spacing, Today's Focus, premium feel | `ui-ux-designer` |
| EXE, installer, twans://, tray, bridge spawn | `desktop-engineer` |
| Auto-log, bridge, RL/Val detection, match ingest | `auto-logging-specialist` (+ `logic-validator` for pill state) |
| XSS, RLS, secrets, validation, abuse | `security-engineer` |
| Stats wrong, MMR chain, sync drift | `data-engineer` (+ `logic-validator` for ladder rules) |
| Dead code, unused CSS, cleanup | `code-quality-auditor` |
| Dev overlay, FPS panel, boot marks | `dev-overlay-engineer` |
| Full app health / fix pass | See **Recommended order** below |
| Read-only audit, ship gate, release verdict | `review-agents` (not this orchestrator) |

## Recommended order — full app health pass

Run implementation skills in this order when doing a broad fix sweep (skip domains with no findings):

1. **`startup-optimizer`** — boot marks: `interactive` before `load-user-data-start`
2. **`logic-validator`** — Tracking ↔ process, session ↔ auth, RR ladder
3. **`auto-logging-specialist`** — process gates, match-completion ingest
4. **`performance-engineer`** — match-save refresh path, off-page renders
5. **`data-engineer`** — rank chain repair, stats integrity
6. **`security-engineer`** — only if review flagged P0 or quick scan finds exposure
7. **`ui-ux-designer`** — hierarchy/spacing after behavior is correct
8. **`desktop-engineer`** — packaging only if desktop-specific
9. **`code-quality-auditor`** — cleanup last (never before blockers)
10. **`dev-overlay-engineer`** — instrumentation gaps if QA needs metrics

Then run **`review-agents`** (Security → QA → Release Manager) for ship gates.

## Pairing rules

| Pair | When |
|------|------|
| `startup-optimizer` + `performance-engineer` | Boot feels slow **and** dashboard janks after load |
| `logic-validator` + `auto-logging-specialist` | Tracking pill wrong or phantom auto-log |
| `logic-validator` + `data-engineer` | Rank/RR display wrong after ingest |
| `performance-engineer` + `ui-ux-designer` | UI change must not add renderAll or heavy filters |
| `desktop-engineer` + `auto-logging-specialist` | Bridge not starting from EXE |

## Project context

- **Client:** `js/`, `index.html`, `css/`
- **Bridge:** `scripts/*.mjs`, `js/bridge-client.js`, `js/bridge-ui.js`
- **Boot:** `js/boot.js`, `js/app.js` init, `tools/launcher/`
- **Workflow:** [`docs/TEAM-WORKFLOW.md`](../../docs/TEAM-WORKFLOW.md), [`AGENTS.md`](../../AGENTS.md)

## Output (implementation tasks)

Summarize in chat or PR:

1. **Skill(s) used** — which agent owned the fix
2. **Symptom** — user-visible problem
3. **Changes** — files and minimal diff rationale
4. **Verify** — repro steps, `node --check`, boot marks or counters if perf-related
