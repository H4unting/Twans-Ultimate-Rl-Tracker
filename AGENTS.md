# Twans Ultimate Tracker — Agent Skills

Skills live in `.cursor/skills/`. Invoke by name in chat (e.g. *"Run the Security Auditor"*, *"Run Code Quality Auditor"*).

## Global rules

- **Review agents** document findings — they do not implement features (report updates only unless you explicitly request a fix).
- **Implementation skills** apply minimal diffs in owned domains.
- **Security findings** take priority over UX findings.
- **Release blockers** take priority over feature requests and cleanup.

## Review agents (read-only)

| # | Agent | Skill | Output |
|---|--------|-------|--------|
| 1 | Security Auditor | `review-security-auditor` | [`docs/SECURITY-AUDIT.md`](docs/SECURITY-AUDIT.md) |
| 2 | UX / Frontend Reviewer | `review-ux-frontend` | [`docs/UX-REPORT.md`](docs/UX-REPORT.md) |
| 3 | QA Lead | `review-qa-lead` | [`docs/QA-REPORT.md`](docs/QA-REPORT.md) |
| 4 | Architecture Reviewer | `review-architecture` | [`docs/ARCHITECTURE-REPORT.md`](docs/ARCHITECTURE-REPORT.md) |
| 5 | Release Manager | `review-release-manager` | [`docs/RELEASE-STATUS.md`](docs/RELEASE-STATUS.md) |

Orchestrator: `review-agents` — routes multi-domain release gates.

## Implementation skills

| Agent | Skill | Notes |
|-------|-------|-------|
| Performance Engineer (Highest Priority) | `performance-engineer` | Implements perf fixes; measure before changing |
| Code Quality Auditor | `code-quality-auditor` | Implements cleanup; dead code, dupes, unused CSS, stale imports |
| UI / UX Designer | `ui-ux-designer` | Implements layout/spacing polish; premium hierarchy |
| Desktop Engineer | `desktop-engineer` | Implements EXE/launcher packaging; twans://, bridge auto-start |
| Auto-Logging Specialist | `auto-logging-specialist` | Implements RL/Valorant detection, bridge auto-log, match-completion ingest |
| Security Engineer | `security-engineer` | Implements RLS, XSS guards, validation, rate limits, secrets hygiene |
| Data Engineer | `data-engineer` | Implements stats, rank chain, RR/MMR math, sync integrity fixes |

## Development workflow

Role-based implementation and priority order live in:

- [`docs/TEAM-WORKFLOW.md`](docs/TEAM-WORKFLOW.md) — roles, ownership, Audit→Verify workflow
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — Product Owner priorities

Review agents document only; feature work and cleanup go through the owning implementation skill in TEAM-WORKFLOW.

## Recommended release gate order

1. **Security Auditor** → P0/RLS/XSS
2. **QA Lead** → smoke matrix
3. **Release Manager** → ship verdict
4. UX + Architecture in parallel when time allows

## Related docs

- [`docs/TEAM-WORKFLOW.md`](docs/TEAM-WORKFLOW.md)
- [`docs/ROADMAP.md`](docs/ROADMAP.md)
- [`docs/RELEASE-RISKS.md`](docs/RELEASE-RISKS.md)
- [`docs/PRODUCTION-READINESS.md`](docs/PRODUCTION-READINESS.md)
- [`docs/QA-TOOLS.md`](docs/QA-TOOLS.md)
