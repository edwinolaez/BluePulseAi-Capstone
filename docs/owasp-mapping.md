# Project Jasper — OWASP Top 10 Threat Mapping
## Sprint 3 Security Deliverable | M3 Sign-Off: July 18, 2026
**Owner:** Edwin Olaez (PM + QA/Security)
**Reference:** OWASP Top 10 (2021) | docs/CLAUDE-edwin.md Security Gates

---

> **Purpose:** Each of the OWASP Top 10 application security risks must be explicitly addressed before M3 sign-off. This document maps each risk to Project Jasper's architecture and documents the control in place.
>
> **Rule:** Edwin signs off this document at Sprint 3. Any row marked UNMITIGATED blocks the M3 milestone until resolved.

---

## OWASP Top 10 Mapping

### A01 — Broken Access Control

**Risk:** Users access resources or perform actions beyond their permissions.

| Component | Threat | Control | Owner | Status |
|---|---|---|---|---|
| Supabase REST API | Analyst reads admin-only data | Row-Level Security (RLS) policies on all tables | Rahil | Rahil to confirm |
| FastAPI backend | Viewer POSTs to /ingest | Kong API key + RLS (two-layer protection) | Feven + Rahil | Feven to confirm |
| Convex mutations | Viewer calls updatePipelineStatus | Convex function-level auth rules | Rahil | Rahil to confirm |

**Edwin's test coverage:** `tests/test_rbac.py` — all four roles tested for read/write/delete boundaries.
**Gate:** RBAC tests must be green at M3. Any role that can do more than its permissions table allows blocks the milestone.

---

### A02 — Cryptographic Failures

**Risk:** Sensitive data exposed due to weak/missing encryption.

| Component | Threat | Control | Owner | Status |
|---|---|---|---|---|
| API keys (Kong) | Key in plaintext in source code | Keys in env vars only; `.env` in `.gitignore`; Semgrep secret scan | Edwin | Active — Semgrep running |
| Supabase credentials | JWT leaked in frontend bundle | Service role key NEVER in frontend; only anon key in NEXT_PUBLIC_* | Edwin + Rahil | Edwin to verify |
| Data in transit | MITM attack on API calls | Vercel HTTPS, Railway HTTPS — TLS enforced by platform | Platform | Active |
| Data at rest | DB compromise exposes raw records | Supabase encrypts at rest (AES-256) by default | Supabase | Active |

**Edwin's gate:** Confirm `SUPABASE_SERVICE_ROLE_KEY` never appears in `jasper-frontend/` source. Run `grep -r SERVICE_ROLE jasper-frontend/` — must return empty.

---

### A03 — Injection

**Risk:** Untrusted data sent to an interpreter as part of a command or query.

| Injection Type | Attack Vector | Control | Owner | Status |
|---|---|---|---|---|
| SQL injection | Malicious sector_id in GET /api/v1/layers/{sector_id} | FastAPI path params are type-validated; Supabase uses parameterized queries | Feven | Semgrep active |
| SQL injection | Malicious payload in POST /ingest body | Pydantic model validation; ORM/parameterized queries | Feven | Semgrep active |
| NoSQL injection | Malicious args to Convex mutations | Convex validator schemas enforce argument types | Rahil | Rahil to confirm |
| Command injection | ML model receives untrusted input | Pydantic validation before inference; no shell execution in ML code | Richard | Semgrep active |
| XSS (reflected) | Script tag in sector_id displayed in frontend | React escapes output by default; no `dangerouslySetInnerHTML` | Reyta | Semgrep ESLint rule active |

**Semgrep rules catching these:** `p/python` (SQL injection patterns), `p/typescript` (XSS patterns), custom `.semgrep.yml`.

---

### A04 — Insecure Design

**Risk:** Fundamental architectural flaws that security controls cannot fix.

| Design Decision | Risk | Mitigation |
|---|---|---|
| API key shared across all consumers | Single key compromise exposes all endpoints | Rate limiting (20 req/min) on Kong limits blast radius; keys can be rotated via Kong admin |
| ML models accept any sector_id | Attacker probes non-existent sectors | FastAPI returns 404 for unknown sectors — no information leakage |
| Ingest endpoint is public via Kong | Bulk data poisoning if key is stolen | Ingest-role Supabase JWT limits write scope; Pydantic validates every field |
| Convex real-time updates are broadcast | Sensitive readings exposed to all subscribers | Convex function-level auth restricts which roles can subscribe |

**Design sign-off:** Edwin reviews with Feven and Rahil before M2 that all API routes are gated behind Kong.

---

### A05 — Security Misconfiguration

**Risk:** Insecure default configurations, incomplete setups, open cloud storage.

| Misconfiguration Risk | Control | Owner | Status |
|---|---|---|---|
| DEBUG mode enabled in FastAPI production | Semgrep scans for `DEBUG=True` and `reload=True` | Edwin (Semgrep) | Active |
| Stack traces returned in API error responses | FastAPI custom exception handlers return generic errors | Feven | Feven to confirm |
| CORS allows all origins (`*`) in production | Kong CORS whitelist: Vercel URL only | Feven | Go-live checklist item 7 |
| Supabase anon key exposed in frontend | Acceptable — anon key is designed to be public; RLS is the real control | Rahil | Documented |
| Railway/Vercel env vars not set | Go-live checklist item 6 confirms all env vars set before M5 | Edwin | Sprint 4 |

**Semgrep rule in `.semgrep.yml`:** Catches `DEBUG=True`, `reload=True`, and bare `except: pass` patterns.

---

### A06 — Vulnerable and Outdated Components

**Risk:** Components with known CVEs are used without patching.

| Dependency Set | Scan Tool | Frequency | Block Condition | Status |
|---|---|---|---|---|
| npm packages (jasper-frontend) | Dependabot | Weekly | HIGH CVE unpatched | Active |
| pip packages (jasper-backend) | Dependabot + pip-audit in CI | Weekly + every push | HIGH CVE unpatched | Active |
| pip packages (jasper-ml) | Dependabot + pip-audit in CI | Weekly + every push | HIGH CVE unpatched | Active |
| GitHub Actions (actions/*) | Dependabot | Weekly | — (pinned to SHA recommended) | Active |

**Edwin's process:** When Dependabot raises a HIGH CVE PR, Edwin reviews and merges within 48 hours.
**Gate:** Zero unpatched HIGH CVEs at M3 (July 18) and M5 (August 1).

---

### A07 — Identification and Authentication Failures

**Risk:** Weak or broken authentication allows unauthorized access.

| Auth Point | Risk | Control | Status |
|---|---|---|---|
| Kong API key | Key guessing / brute force | Kong rate limit (20 req/min per IP); key rotation possible | Active |
| Supabase JWT | Token replay attack | JWTs have expiry; Supabase rotates keys on request | Supabase-managed |
| Convex auth | Unauthenticated mutation calls | Convex function-level identity checks | Rahil to confirm |
| No MFA on admin account | Admin (Edwin) account compromised | GitHub 2FA required; Supabase admin access via GitHub SSO | Active |

**Edwin's test coverage:** `tests/test_health.py::TestKongGateway` — verifies 401 on missing API key.

---

### A08 — Software and Data Integrity Failures

**Risk:** Code and infrastructure update failures; insecure CI/CD pipelines.

| Risk | Control | Status |
|---|---|---|
| Malicious dependency injected via supply chain | Dependabot + pip-audit; `pip install` uses pinned versions from requirements.txt | Active |
| Force-push to main overwrites good code | Branch protection: direct push to main blocked; requires Edwin review + CI pass | Active |
| CI pipeline tampered with | `.github/workflows/` protected by branch rules; Actions permissions are read-only for forks | Active |
| Unsigned commits bypass policy | CODEOWNERS + required review — any PR to develop/main needs Edwin approval | Active |

---

### A09 — Security Logging and Monitoring Failures

**Risk:** Attacks go undetected because logging is insufficient.

| Log Source | What It Captures | Where to View |
|---|---|---|
| Railway backend logs | FastAPI request/response logs, error traces | Railway dashboard → Logs tab |
| Kong Gateway logs | All requests, auth failures, rate limit hits | Kong admin API or Railway stdout |
| GitHub Actions | CI pass/fail per commit, Semgrep findings | GitHub → Actions tab |
| Semgrep artifact | Full SAST scan results, HIGH/MEDIUM/LOW counts | GitHub Actions → Artifacts → semgrep-report-{sha} |
| Supabase logs | Auth events, RLS violations, DB queries | Supabase dashboard → Logs |

**Edwin's gate at M3:** Verify that a deliberate 401 attempt (invalid API key) appears in Kong/Railway logs.
**Recommended:** Set up Railway alerts for 5xx error rate spikes before M4.

---

### A10 — Server-Side Request Forgery (SSRF)

**Risk:** Attacker tricks the server into making requests to internal resources.

| Component | SSRF Risk | Control |
|---|---|---|
| FastAPI ingest endpoint | Accepts URLs in payload field → server fetches URL | Pydantic model validates `payload` is object, not URL string; no `requests.get(payload)` calls |
| ML service | Source point coordinates passed to ODE solver | Coordinates are floats, not URLs — no HTTP request made from model code |
| Convex | Args passed to mutations | Convex validators enforce argument types; no URL-type arguments accepted |

**Semgrep check:** Scan for `requests.get(`, `httpx.get(`, `urllib.request.urlopen(` calls that accept user-supplied values.
**Edwin to verify at M3:** `grep -r "requests.get" jasper-backend/ jasper-ml/` — audit any hits.

---

## Summary Table

| # | Risk | Mitigation | Gate | Status |
|---|---|---|---|---|
| A01 | Broken Access Control | Supabase RLS + Kong auth + RBAC tests | M3 | Rahil confirms RLS policies |
| A02 | Cryptographic Failures | Env vars only; HTTPS; Supabase AES-256 | M3 | Semgrep secret scan active |
| A03 | Injection | Pydantic + ORM + Semgrep SAST | M3 | Semgrep running every push |
| A04 | Insecure Design | Rate limiting; 404 on unknown sectors | M3 | Architecture review at M2 |
| A05 | Security Misconfiguration | Semgrep DEBUG rules; CORS whitelist | M5 | Go-live checklist item 7 |
| A06 | Vulnerable Components | Dependabot + pip-audit | M3 + M5 | Weekly scans active |
| A07 | Auth Failures | Kong + Supabase JWT + 2FA on admin | M3 | CI gate active |
| A08 | Integrity Failures | Branch protection; pinned deps | M3 | Branch protection active |
| A09 | Logging Failures | Railway + Kong + Supabase logs | M3 | Verify 401 logging at M3 |
| A10 | SSRF | No URL-type params; Semgrep audit | M3 | Manual grep at M3 |

---

## Edwin's M3 Sign-Off Checklist

- [ ] All 10 OWASP rows reviewed with team
- [ ] Zero HIGH Semgrep findings on Sprint 3 CI run
- [ ] Semgrep report artifact attached to Sprint 3 PR
- [ ] Dependabot: zero unpatched HIGH CVEs
- [ ] A01: RBAC tests green (test_rbac.py fully passing)
- [ ] A09: 401 log entry verified in Kong/Railway logs
- [ ] A10: Manual grep for URL-type user inputs in backend and ML code
- [ ] This document signed off and committed to docs/
