# AI Team Workflow — Twans Ultimate Tracker

Role-based development workflow. **One active implementer per task domain** — do not let multiple roles modify the same code simultaneously.

Planning and review agents document findings; implementation roles apply minimal diffs.

---

## Roles

| Role | Owns | Produces | May modify |
|------|------|----------|------------|
| **Product Owner** | Priority order, scope, acceptance criteria | [`ROADMAP.md`](ROADMAP.md), feature briefs in chat | Docs only — no application code |
| **Frontend Lead** | UI markup, CSS, client rendering, UX polish | Profile, dashboard, themes, components | `index.html`, `css/`, `js/*-ui.js`, `js/home.js`, `js/ui.js` |
| **Backend Lead** | Supabase schema, RLS, auth, sync, API | Migrations, `js/supabase.js`, server policies | `supabase/`, `js/supabase.js`, `js/state.js` (sync paths) |
| **Auto-Log Engineer** | Bridge, BakkesMod, Valorant auto-log, tray | Bridge services, ingest pipelines | `bridge/`, `js/bridge*.js`, `js/quicklog.js`, game ingest modules |
| **QA Lead** | Smoke matrix, regression checks, test plans | [`QA-REPORT.md`](QA-REPORT.md), [`RELEASE-CHECKLIST.md`](RELEASE-CHECKLIST.md) | Docs + test scripts only — no feature code |
| **Security Auditor** | RLS, XSS, secrets, auth flows | [`SECURITY-AUDIT.md`](SECURITY-AUDIT.md) | Docs only — escalates fixes to owning implementer |
| **Performance Engineer** | Bundle size, render cost, bridge latency | [`PERFORMANCE-AUDIT.md`](PERFORMANCE-AUDIT.md) | Docs + targeted perf fixes in owned files |
| **Release Manager** | Ship gates, RC tags, release notes | [`RELEASE-STATUS.md`](RELEASE-STATUS.md), tag checklist | Docs + version/changelog only |

### Review agents (read-only)

Pre-release reviewers live in [`AGENTS.md`](../AGENTS.md). They **do not implement** — they update audit reports. Route fixes to the owning role above.

---

## Mandatory change workflow

Every implementation task follows this sequence. Skip no step.

1. **Audit** — Read relevant files; note current behavior and data sources.
2. **Identify** — List concrete issues or gaps vs acceptance criteria.
3. **Explain** — Write commit-ready rationale (what/why, not drive-by refactors).
4. **Propose** — Minimal diff plan; one owning role; no parallel edits on same files.
5. **Apply** — Implement within role boundary; match existing conventions.
6. **Verify** — Lint, manual smoke of affected flows, confirm data binds correctly.

---

## Stabilization rules

- **One writer per file set** — If Frontend Lead owns a task, Backend Lead does not edit the same PR unless explicitly sequenced (API contract first, then UI).
- **Security findings block release** — Security Auditor P0/P1 items must be fixed or accepted in [`V1-ACCEPTED-RISKS.md`](V1-ACCEPTED-RISKS.md) before Release Manager signs off.
- **No scope creep during RC** — Product Owner must reprioritize [`ROADMAP.md`](ROADMAP.md) before new features land during a release gate.
- **Minimal diffs** — Fix the stated problem; do not refactor unrelated modules.
- **Docs vs code** — QA, Security, Performance, Release, and Product Owner update reports; they do not ship feature code unless user explicitly requests a fix from that session.
- **Data integrity** — Backend Lead approves any schema or RLS change; Frontend Lead consumes existing APIs/state only unless coordinated.

---

## Typical handoffs

| Task type | Lead role | Consult |
|-----------|-----------|---------|
| Profile / dashboard UI | Frontend Lead | Product Owner (layout), QA Lead (smoke) |
| Supabase / sync bug | Backend Lead | Security Auditor (RLS) |
| Auto-log not ingesting | Auto-Log Engineer | Backend Lead (persist), QA Lead |
| Pre-release gate | Release Manager | Security Auditor → QA Lead → Release Manager |
| Slow dashboard render | Performance Engineer | Frontend Lead (apply fix) |

---

## Related docs

- [`ROADMAP.md`](ROADMAP.md) — current priorities (Product Owner)
- [`AGENTS.md`](../AGENTS.md) — review agent skills and release gate order
- [`PRODUCTION-READINESS.md`](PRODUCTION-READINESS.md)
- [`RELEASE-RISKS.md`](RELEASE-RISKS.md)
