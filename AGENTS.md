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

## Recommended release gate order

1. **Security Auditor** → P0/RLS/XSS
2. **QA Lead** → smoke matrix
3. **Release Manager** → ship verdict
4. UX + Architecture in parallel when time allows

## Related docs

- [`docs/RELEASE-RISKS.md`](docs/RELEASE-RISKS.md)
- [`docs/PRODUCTION-READINESS.md`](docs/PRODUCTION-READINESS.md)
- [`docs/QA-TOOLS.md`](docs/QA-TOOLS.md)
