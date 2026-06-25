# CLAUDE.md — Edwin Olaez
## Project Jasper | PM + Lead QA/Security Engineer
**Deadline: August 3, 2026**

---

> This file was synthesized from all five Project Jasper planning documents: JASPER-IMPL-001, JASPER-DEPLOY-001, JASPER-TEST-001, JASPER-SEC-001, and JASPER-COORD-001. It is the single source of truth for Edwin's PM and QA role.

---

## Who You Are in This Project

You are the **PM and Lead QA/Security Engineer**. You do not build individual features — you make sure everything connects, nothing breaks, and the pipeline stays green. You are the only person who merges to `main`.

---

## Your Branch

```
feature/edwin-qa
```

- Pull from `develop` before every session
- Open PRs: `feature/edwin-qa` -> `develop`
- You are the **only** person who merges `develop` -> `main`
- Emergency patches: `hotfix/[issue-description]` -> merges to **both** `main` AND `develop`

---

## Your Folders

```
/tests/               -- all integration tests, API contract tests, regression suite
/docs/                -- api-contracts.md, README.md, AGENTS.md, deployment-runbook.md
/.github/
    workflows/
        ci.yml                 -- main CI pipeline (you own this)
        deploy-staging.yml     -- auto-deploy on develop merge
        deploy-production.yml  -- manual approval gate for production
    pull_request_template.md   -- PR checklist with security gates
    dependabot.yml             -- weekly npm + pip CVE scan config
```

---

## Alignment Decisions (Final)

| Issue | Resolution |
|---|---|
| Sprint 2 start date conflict | Official: June 23 (IMPL-001 is master schedule) |
| Convex folder location | Confirmed: `/convex/` at repo root. Rahil owns it. |
| CI pipeline stages | Confirmed: 6 stages (added Stage 6 Performance Gate) |

---

## Your Tasks by Sprint

### Sprint 1 — Foundation (June 10–20) | M1

**Repo & Infrastructure:**
- [ ] Initialize GitHub repo — Private; invite all 5 members
- [ ] Create folder structure: jasper-frontend, jasper-backend, jasper-ml, jasper-db, tests, docs, .github/workflows
- [ ] Create .gitignore (env files, node_modules, __pycache__, *.pem, *.key)
- [ ] Create .env.example with placeholder keys
- [ ] Set branch protection on main: require PR + Edwin review + CI pass + block direct push
- [ ] Set branch protection on develop: require CI pass before merge
- [ ] Confirm all 5 team branches exist and each member has pushed at least one commit

**CI Pipeline:**
- [ ] Stage 1 — Lint: ESLint + tsc (frontend), Pylint (backend + ML)
- [ ] Stage 2 — Security: Semgrep SAST + pip-audit
- [ ] Stage 3 — Unit Tests: pytest + Jest
- [ ] Stage 4 — Integration Tests: pytest + httpx
- [ ] Stage 5 — Build: Next.js build + Docker image build
- [ ] Stage 6 — Performance Gate (Sprint 3+): Lighthouse CI + pytest-benchmark

**Security Tooling:**
- [ ] Configure Semgrep SAST (.semgrep.yml)
- [ ] Configure Dependabot (.github/dependabot.yml) — weekly npm + pip scan
- [ ] Create PR template (.github/pull_request_template.md) with security checklist

**API Contracts:**
- [ ] Create /docs/api-contracts.md framework
- [ ] Action by June 15: Confirm Convex at repo root — announce to team
- [ ] Action by June 20: Confirm CERCUTS dataset availability with Feven

**M1 Sign-Off Criteria (June 20):**
- [ ] CI running on every push; all 6 stages scaffolded
- [ ] Semgrep + Dependabot + pip-audit configured; baseline clean scan documented
- [ ] All 5 team branches exist; each member has pushed a scaffold
- [ ] All API contracts in /docs/api-contracts.md
- [ ] Supabase live + PostGIS enabled (Rahil confirms)
- [ ] Kong health at /health (Feven confirms)
- [ ] React-Leaflet map at localhost:3000 (Reyta confirms)

---

### Sprint 2 — Core Pipeline (June 23–July 4) | M2

- [ ] E2E integration test: ingest -> PostGIS -> API -> frontend
- [ ] API contract tests for all Feven endpoints (pytest + httpx)
- [ ] RBAC access control tests with Rahil
- [ ] Review and merge all Sprint 2 PRs (CI must be green)
- [ ] Configure deploy-staging.yml — auto-deploy on develop merge
- [ ] Sprint 2 integration test report
- [ ] Update /docs/api-contracts.md with any contract changes

**M2 Sign-Off (July 4):** Integration tests passing, staging auto-deploy working, RBAC initial tests passing, Convex queries working.

---

### Sprint 3 — AI & Simulation (July 7–18) | M3

**Security Sweep (M3 Hard Gate — 0 HIGH findings):**
- [ ] Full Semgrep sweep across all modules
- [ ] Semgrep report artifact attached to Sprint 3 CI run
- [ ] Dependabot: zero unpatched HIGH CVEs
- [ ] OWASP Top 10 mapping confirmed for all 10 rows

**Integration Tests:**
- [ ] ML model endpoints (/predict/change-detection, /simulate/erosion, /simulate/contaminant)
- [ ] Feven's multi-source fusion endpoint
- [ ] Confirm Semgrep HIGH finding blocks CI (test with deliberate canary)

**Performance Gate (Stage 6 activates this sprint):**
- [ ] Lighthouse CI: Performance >= 85, Accessibility >= 90
- [ ] pytest-benchmark: API P95 < 500ms
- [ ] DB spatial query P95 < 500ms (with Rahil)

**M3 Sign-Off (July 18):** 0 HIGH Semgrep findings, ML tests passing, RBAC full suite passing, performance gate active.

---

### Sprint 4 — Hardening (July 21–August 1) | M4 + M5

**Regression & Testing:**
- [ ] Full regression suite — all tests must pass
- [ ] Test Completion Report signed by Edwin
- [ ] Coverage: backend >= 80%, frontend >= 75%, 100% API endpoints contract-tested

**Documentation Package:**
- [ ] README.md complete
- [ ] AGENTS.md complete
- [ ] /docs/deployment-runbook.md complete
- [ ] Richard's model_card.md collected
- [ ] Rahil's DB query benchmark report collected

**Go-Live Checklist (12 items — all binary pass/fail):**
1. [ ] All Sprint 4 tasks Done; no open blockers
2. [ ] Semgrep: zero HIGH findings on production build
3. [ ] Dependabot: zero unpatched HIGH CVEs
4. [ ] All tests passing on main
5. [ ] Staging URL approved by all 5 members
6. [ ] All env vars confirmed in Vercel + Railway production settings
7. [ ] Kong rate limits and CORS whitelist verified in staging
8. [ ] Supabase RBAC: analyst and viewer roles verified
9. [ ] ML model F1 meets Sprint 4 threshold — in model card
10. [ ] Lighthouse >= 85 in staging
11. [ ] README + AGENTS.md + API docs + runbook complete
12. [ ] Rollback procedure tested in staging

---

## CI Pipeline

| Stage | Tool | Blocks On | Activates |
|---|---|---|---|
| 1 — Lint | ESLint + tsc, Pylint | Any lint or type error | Sprint 1 |
| 2 — Security | Semgrep + pip-audit | HIGH severity | Sprint 1 |
| 3 — Unit Tests | pytest + Jest | Any failing test | Sprint 1 |
| 4 — Integration | pytest + httpx | Any failing test | Sprint 2 |
| 5 — Build | Next.js + Docker | Build failure | Sprint 1 |
| 6 — Performance | Lighthouse + pytest-benchmark | Lighthouse < 85 or P95 > 500ms | Sprint 3 |

**Rule:** No PR gets your approval until all active CI stages are fully green.

---

## Security Gates

| Tool | Catches | Block Condition |
|---|---|---|
| Semgrep | Code-level vulnerabilities | HIGH severity |
| Dependabot | CVEs in npm + pip | HIGH CVE unpatched |
| pip-audit | Python dep CVEs | HIGH severity |
| ESLint security rules | eval, dangerouslySetInnerHTML | Any lint error |

**Zero HIGH findings required at M3 (July 18) and M5 (August 1).**

---

## STRIDE Top 5 Threats

| Threat | Target | Your Gate |
|---|---|---|
| Spoofing via stolen API key | Kong Gateway | 401 without key |
| SQL injection via ingest endpoint | PostGIS | Semgrep SAST |
| Elevation via RLS misconfiguration | Supabase RBAC | Rahil's test suite |
| Stack traces in API responses | FastAPI error handlers | Semgrep DEBUG flag |
| DoS on model endpoints | Kong + FastAPI | Rate limit: 20 req/min |

---

## Risk Register

| Risk | Likelihood | Impact | Action |
|---|---|---|---|
| CERCUTS data unavailable | Medium | High | Confirm with Feven by June 20; fallback: USGS/ESA open datasets |
| ML F1 below threshold | Medium | High | Richard escalates if not trending 0.75 by end Sprint 2 |
| Integration delays | Medium | High | All contracts locked at M1 |
| Scope creep on AI | High | Medium | Richard scoped to 2 simulations only (erosion + contaminant) |
| Railway auto-sleep | Low | High | Hit /health 5 min before any demo |

---

## Team Contacts

| Person | Role | Branch | Folder |
|---|---|---|---|
| Edwin | PM + QA/Security | `feature/edwin-qa` | /tests, /docs, /.github |
| Feven | Data Pipeline & API | `feature/feven-ingest` | /jasper-backend |
| Richard | AI/ML & Simulation | `feature/richard-ml` | /jasper-ml |
| Reyta | Frontend GIS | `feature/reyta-frontend` | /jasper-frontend |
| Rahil | DB & Analytics | `feature/rahil-db` | /jasper-db + /convex |

---

## Non-Negotiables

- You are the only person who merges to `main` — no exceptions
- No PR merged to `develop` without your review and green CI (all 6 stages)
- Integration tests run after every merge to `develop` — not the next day
- Any HIGH security finding blocks the sprint milestone until resolved
- All API contracts in /docs/api-contracts.md before Sprint 2 coding begins
- The Test Completion Report is a submitted deliverable to SAIT Faculty
- Always wake Railway backend (/health) before any demo or stakeholder review
