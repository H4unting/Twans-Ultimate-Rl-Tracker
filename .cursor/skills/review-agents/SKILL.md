---
name: review-agents
description: >-
  Orchestrates Twans Ultimate Tracker specialized review agents (Security,
  UX/Frontend, QA Lead, Architecture, Release Manager). Use when the user
  requests a security audit, UX review, QA pass, architecture review, release
  readiness check, or v1.0 blocker investigation across multiple domains.
disable-model-invocation: true
---

# Review Agents — Twans Ultimate Tracker

Five read-only review agents for `rl-grind-tracker`. Each agent **documents findings only** — no feature work.

## Agents

| Agent | Skill | Output |
|-------|-------|--------|
| Security Auditor | `review-security-auditor` | `docs/SECURITY-AUDIT.md` |
| UX / Frontend Reviewer | `review-ux-frontend` | `docs/UX-REPORT.md` |
| QA Lead | `review-qa-lead` | `docs/QA-REPORT.md` |
| Architecture Reviewer | `review-architecture` | `docs/ARCHITECTURE-REPORT.md` |
| Release Manager | `review-release-manager` | `docs/RELEASE-STATUS.md` |

## Priority (non-negotiable)

1. **Release blockers** over feature requests
2. **Security findings** over UX findings
3. **Minimal diffs** — update report docs only unless user explicitly asks for a fix

## Routing

| User intent | Load skill |
|-------------|------------|
| RLS, auth, XSS, API keys, abuse | `review-security-auditor` |
| Nav, layout, a11y, mobile, empty states | `review-ux-frontend` |
| Smoke test, regression, pass/fail matrix | `review-qa-lead` |
| Dead code, deps, perf, listeners | `review-architecture` |
| Version, deploy, cache bust, ship/no-ship | `review-release-manager` |
| Full release gate / v1.0 readiness | Run **Security → QA → Release Manager** first; UX and Architecture in parallel if time allows |

## Project context

- **App:** Twans Ultimate Tracker — GitHub Pages SPA + local bridge (`localhost:8080`, Overwolf `:49200`) + Supabase
- **Client:** `js/`, `index.html`, `css/`
- **Bridge:** `scripts/start-grind.mjs`, `scripts/bridge-security.mjs`
- **DB:** `docs/supabase/v1-full-setup.sql`, `docs/supabase/schema.sql`
- **Existing risk docs:** `docs/RELEASE-RISKS.md`, `docs/PRODUCTION-READINESS.md`

## Cross-agent handoff

When one agent finds a blocker, note it in their report and flag for Release Manager. Security P0/Critical items must appear in `docs/RELEASE-STATUS.md` under **Blockers**.

## Implementation counterpart

Read-only agents **document**; they do not apply fixes. For minimal code changes, route to `implementation-agents` (or the owning skill: `security-engineer`, `logic-validator`, etc.). See [`AGENTS.md`](../../AGENTS.md).
