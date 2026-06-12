# Review Agents

Specialized read-only agents for pre-release review of **Twans Ultimate Tracker**.  
Skills live in `.cursor/skills/`. Invoke by name in chat (e.g. *"Run the Security Auditor"*).

## Global rules

- Agents **do not implement features** — they document findings.
- **Security findings** take priority over UX findings.
- **Release blockers** take priority over feature requests.
- **Minimal diffs** only (report updates unless you explicitly request a fix).

## Agents

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
| UI / UX Designer | `ui-ux-designer` | Implements layout/spacing polish; premium hierarchy |
| Desktop Engineer | `desktop-engineer` | Implements EXE/launcher packaging; twans://, bridge auto-start |

## Development workflow

Role-based implementation and priority order live in:

- [`docs/TEAM-WORKFLOW.md`](docs/TEAM-WORKFLOW.md) — roles, ownership, Audit→Verify workflow
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — Product Owner priorities

Review agents document only; feature work goes through the owning role in TEAM-WORKFLOW.

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
