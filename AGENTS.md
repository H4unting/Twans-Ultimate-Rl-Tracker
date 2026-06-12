# Twans Ultimate Tracker — Agent Skills

Skills live in `.cursor/skills/`. Invoke by name in chat (e.g. *"Run the Security Auditor"*, *"Run startup-optimizer"*, *"Use implementation-agents to fix lag"*).

## Global rules

- **Review agents** document findings — they do not implement features (report updates only unless you explicitly request a fix).
- **Implementation skills** apply minimal diffs in owned domains.
- **Security findings** take priority over UX findings.
- **Release blockers** take priority over feature requests and cleanup.
- All skills use `disable-model-invocation: true` — invoke explicitly by name or via an orchestrator.

## Orchestrators

| Orchestrator | Skill | Routes to |
|--------------|-------|-----------|
| Review / ship gates | `review-agents` | Read-only audit agents → `docs/*-REPORT.md` |
| Fixes & features | `implementation-agents` | Ten implementation skills (boot, perf, logic, UI, …) |

## Review agents (read-only)

| # | Agent | Skill | Invoke example | Output |
|---|--------|-------|----------------|--------|
| 1 | Security Auditor | `review-security-auditor` | *"Run the Security Auditor"* | [`docs/SECURITY-AUDIT.md`](docs/SECURITY-AUDIT.md) |
| 2 | UX / Frontend Reviewer | `review-ux-frontend` | *"Run UX review on dashboard"* | [`docs/UX-REPORT.md`](docs/UX-REPORT.md) |
| 3 | QA Lead | `review-qa-lead` | *"Run QA Lead smoke matrix"* | [`docs/QA-REPORT.md`](docs/QA-REPORT.md) |
| 4 | Architecture Reviewer | `review-architecture` | *"Run Architecture Reviewer"* | [`docs/ARCHITECTURE-REPORT.md`](docs/ARCHITECTURE-REPORT.md) |
| 5 | Release Manager | `review-release-manager` | *"Run Release Manager — ship?"* | [`docs/RELEASE-STATUS.md`](docs/RELEASE-STATUS.md) |

Orchestrator: `review-agents` — routes multi-domain release gates.

## Implementation skills

| Agent | Skill | Invoke example | Notes |
|-------|-------|----------------|-------|
| Startup Optimizer | `startup-optimizer` | *"Run startup-optimizer — cold boot is slow"* | First paint, cached shell, deferred sync |
| Performance Engineer | `performance-engineer` | *"Run performance-engineer on match save lag"* | Post-boot perf; pair with startup on open |
| Logic Validator | `logic-validator` | *"Run logic-validator — Tracking stuck"* | Tracking, RR ladder, session reset |
| UI / UX Designer | `ui-ux-designer` | *"Run ui-ux-designer — Today's Focus hierarchy"* | Layout/spacing polish |
| Desktop Engineer | `desktop-engineer` | *"Run desktop-engineer — EXE won't start bridge"* | EXE/launcher, twans:// |
| Auto-Logging Specialist | `auto-logging-specialist` | *"Run auto-logging-specialist — Val not detected"* | RL/Val detection, bridge ingest |
| Security Engineer | `security-engineer` | *"Run security-engineer — fix XSS in tags"* | RLS, XSS, validation (implements fixes) |
| Data Engineer | `data-engineer` | *"Run data-engineer — MMR chain broken"* | Stats, rank chain, sync integrity |
| Code Quality Auditor | `code-quality-auditor` | *"Run code-quality-auditor on js/home.js"* | Dead code, dupes, unused CSS |
| Dev Overlay Engineer | `dev-overlay-engineer` | *"Run dev-overlay-engineer — add boot metric"* | ?dev=1 overlay, FPS, counters |
| Performance Hunter | `performance-hunter` | *"Run performance-hunter"* | Legacy alias of `performance-engineer` |

Orchestrator: `implementation-agents` — routes fix/feature work to the skills above.

## When to use which skill

| Symptom or request | Start here | Often pair with |
|--------------------|------------|-----------------|
| Slow launch, blank screen, spinner on open | `startup-optimizer` | `performance-engineer` |
| Lag/jank after dashboard loads | `performance-engineer` | `startup-optimizer` if also slow on open |
| Tracking true but game closed | `logic-validator` | `auto-logging-specialist` |
| Auto-log missing or duplicate | `auto-logging-specialist` | `logic-validator` |
| RR stuck above 100 / wrong rank | `logic-validator` | `data-engineer` |
| Session timer after logout | `logic-validator` | — |
| Dashboard spacing / weak hierarchy | `ui-ux-designer` | `performance-engineer` (no renderAll) |
| EXE, installer, twans://, tray | `desktop-engineer` | `auto-logging-specialist` |
| XSS, RLS, secrets in client | `security-engineer` | `review-security-auditor` first for audit |
| Wrong stats / chart numbers | `data-engineer` | `logic-validator` |
| Dead code, stale imports, CSS cruft | `code-quality-auditor` | — |
| Need FPS / boot marks in dev | `dev-overlay-engineer` | `performance-engineer` |
| Ship/no-ship, full release gate | `review-agents` | Not implementation skills |
| Broad fix sweep | `implementation-agents` | Follow order below |

## Recommended order — full app health pass

**Implementation fix sweep** (when improving app health, not auditing):

1. `startup-optimizer` — boot path, first paint
2. `logic-validator` — invariants (Tracking, RR, session)
3. `auto-logging-specialist` — process gates, ingest
4. `performance-engineer` — render hot paths
5. `data-engineer` — rank chain / stats (if needed)
6. `security-engineer` — only for P0 or explicit hardening
7. `ui-ux-designer` — polish after behavior is correct
8. `code-quality-auditor` — cleanup last

**Release gate** (read-only, before ship):

1. **Security Auditor** → P0/RLS/XSS
2. **QA Lead** → smoke matrix
3. **Release Manager** → ship verdict
4. UX + Architecture in parallel when time allows

## Development workflow

Role-based implementation and priority order live in:

- [`docs/TEAM-WORKFLOW.md`](docs/TEAM-WORKFLOW.md) — roles, ownership, Audit→Verify workflow
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — Product Owner priorities

Review agents document only; feature work and cleanup go through the owning implementation skill in TEAM-WORKFLOW.

## Related docs

- [`docs/TEAM-WORKFLOW.md`](docs/TEAM-WORKFLOW.md)
- [`docs/ROADMAP.md`](docs/ROADMAP.md)
- [`docs/RELEASE-RISKS.md`](docs/RELEASE-RISKS.md)
- [`docs/PRODUCTION-READINESS.md`](docs/PRODUCTION-READINESS.md)
- [`docs/QA-TOOLS.md`](docs/QA-TOOLS.md)
