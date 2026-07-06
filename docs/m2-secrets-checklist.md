# M2 GitHub Actions Secrets Checklist

**Owner:** Edwin Olaez (PM / QA)
**Due:** July 4, 2026 (M2 sign-off) — secrets collected July 6, 2026
**Where to add:** GitHub repo → Settings → Secrets and variables → Actions → New repository secret

---

## How to Add a Secret

1. Go to the repo on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Paste the name exactly as shown below (case-sensitive) and the value

---

## Required Secrets

### From Feven (Backend / Railway)

| Secret Name | Description | Status |
|---|---|---|
| `RAILWAY_API_URL` | Full Railway URL for jasper-backend (e.g. `https://jasper-backend.up.railway.app`) | [x] received July 6 |
| `NEXT_PUBLIC_API_KEY` | Kong Gateway API key for authenticated requests | [x] received July 6 |

**Ask Feven for:** Railway deployment URL + Kong API key value

---

### From Rahil (Supabase / Convex / RBAC)

| Secret Name | Description | Status |
|---|---|---|
| `SUPABASE_URL` | Supabase project URL (e.g. `https://xxxx.supabase.co`) | [x] received July 6 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (Settings → API in Supabase dashboard) | [x] received July 6 |
| `TEST_ANALYST_JWT` | A valid JWT token for the `analyst` role — for RBAC tests | [x] received July 6 |
| `TEST_INGEST_JWT` | A valid JWT token for the `ingest` role — for RBAC tests | [x] received July 6 |
| `NEXT_PUBLIC_CONVEX_URL` | Convex deployment URL after `npx convex deploy` runs | [x] received July 6 |

**Ask Rahil for:** All 5 above. JWT tokens can be generated from the Supabase Auth dashboard or via the Supabase client using a test user with the matching role.

---

### From Reyta (Frontend / Vercel)

| Secret Name | Description | Status |
|---|---|---|
| `VERCEL_STAGING_URL` | Vercel preview/staging URL for the frontend (needed for Lighthouse CI in Sprint 3) | [ ] |

**Ask Reyta for:** Vercel deployment URL (can be the auto-generated preview URL)

---

### Edwin to Set Up (CI tools)

| Secret Name | Description | Status |
|---|---|---|
| `SEMGREP_APP_TOKEN` | Token from semgrep.dev — needed for SAST security scans in Stage 2 | [ ] |
| `LHCI_GITHUB_APP_TOKEN` | Lighthouse CI GitHub App token — needed for Stage 6 performance gate (Sprint 3) | [ ] |

**How to get `SEMGREP_APP_TOKEN`:** Sign up free at semgrep.dev → Settings → Tokens → Create token
**How to get `LHCI_GITHUB_APP_TOKEN`:** Install the Lighthouse CI GitHub App from lhci.appspot.com/sign-up

---

## M2 Sign-Off Criteria

Once secrets are in place and CI is green, these must all pass:

- [ ] Stage 4 integration tests pass (needs `RAILWAY_API_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)
- [ ] RBAC tests pass (needs `TEST_ANALYST_JWT`, `TEST_INGEST_JWT`)
- [ ] Staging auto-deploy triggers after CI passes (`deploy-staging.yml`)
- [ ] `develop → main` PR merged (Edwin approves)

---

## Notes

- `SEMGREP_APP_TOKEN` is optional for CI to pass (Stage 2 will still run without it, just with limited rules)
- `VERCEL_STAGING_URL` and `LHCI_GITHUB_APP_TOKEN` are Sprint 3 gates — Stage 6 skips gracefully if missing
- Never commit secret values to the repo — always use GitHub Secrets
