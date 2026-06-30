# Project Jasper — Deployment Runbook
## Owner: Edwin Olaez | Last updated: June 25, 2026

---

## What Is a Runbook?

A runbook is a step-by-step recipe for deploying the system.
If someone needs to deploy Jasper at 2am before the demo with zero context,
this document should be enough to get the system live.

Every step is numbered. Do them in order. Do not skip steps.

---

## Environments

| Environment | Frontend URL | Backend URL | When Used |
|---|---|---|---|
| Local Dev | http://localhost:3000 | http://localhost:8000 | Daily development |
| Staging | jasper-staging.vercel.app | Railway staging URL | Sprint reviews, M4 sign-off |
| Production | jasper-app.vercel.app | Railway production URL | M5 onwards, demo day |

---

## Part 1 — Deploying to Staging

Staging deploys **automatically** when anyone merges to `develop`.
No manual steps needed — GitHub Actions handles it.

But if the auto-deploy fails, here is how to trigger it manually:

### 1.1 Manual Staging Deploy (Frontend — Vercel)

```bash
# Install Vercel CLI if you don't have it
npm install -g vercel

# Navigate to the frontend folder
cd jasper-frontend/

# Deploy to staging (preview, not production)
# Vercel will ask you to log in the first time
vercel --token=$VERCEL_TOKEN
```

After deploying, Vercel prints a unique preview URL like:
`https://jasper-abc123.vercel.app`
That URL is your staging frontend.

### 1.2 Manual Staging Deploy (Backend — Railway)

Railway auto-deploys from `develop` via webhook.
If the webhook fails:

1. Log into Railway dashboard: https://railway.app
2. Select the `jasper-backend` service
3. Click "Deploy" → "Deploy Latest Commit"
4. Watch the build logs — it should take about 2 minutes

### 1.3 Smoke Test After Staging Deploy

After any staging deploy, run these checks manually:

```bash
# Step 1: Is the backend alive?
curl https://YOUR-RAILWAY-STAGING-URL/health
# Expected: {"status": "ok"}

# Step 2: Does Kong reject unauthenticated requests?
curl https://YOUR-RAILWAY-STAGING-URL/api/v1/layers/ATH-001
# Expected: {"message": "Unauthorized"} with status 401

# Step 3: Does a valid API key work?
curl -H "X-API-Key: YOUR_KONG_API_KEY" \
     https://YOUR-RAILWAY-STAGING-URL/api/v1/layers/ATH-001
# Expected: 200 (data) or 404 (no data yet — both are fine)
```

---

## Part 2 — Deploying to Production (M5 Checklist)

**Production deploy is manual — Edwin only.**
**Every item on this checklist must be confirmed before you hit Deploy.**

### Pre-Deploy Checklist (12 items — all binary pass/fail)

Go through these in order. If any item fails, stop and fix it before proceeding.

**Code Quality**
- [ ] 1. All Sprint 4 tasks marked Done; no open blockers in GitHub Issues
- [ ] 2. Semgrep: zero HIGH-severity findings (attach report artifact from CI)
- [ ] 3. Dependabot: zero unpatched HIGH-severity CVEs (check Security tab on GitHub)
- [ ] 4. All unit + integration tests passing on `main` branch (CI must be green)

**Team Sign-Off**
- [ ] 5. Staging URL reviewed and approved by all 5 team members (confirm in team chat)

**Infrastructure**
- [ ] 6. All environment variables confirmed in Vercel production settings (Settings → Environment Variables)
- [ ] 7. All environment variables confirmed in Railway production settings
- [ ] 8. Kong Gateway: rate limits and CORS whitelist verified in staging (Feven confirms)
- [ ] 9. Supabase RBAC: analyst and viewer roles manually tested in staging (Rahil confirms)

**Quality Gates**
- [ ] 10. ML model F1 score meets threshold — confirmed in `jasper-ml/model_card.md` (Richard confirms)
- [ ] 11. Lighthouse score >= 85 performance in staging (run: `npx lhci autorun`)

**Documentation**
- [ ] 12. README.md, AGENTS.md, api-contracts.md, and this runbook are complete and up to date

---

### 2.1 Trigger the Production Deploy

Production deploys via GitHub Actions with a manual confirmation gate.

1. Go to: `https://github.com/edwinolaez/BluePulseAi-Capstone/actions`
2. Click **"Deploy — Production"** in the left sidebar
3. Click **"Run workflow"**
4. In the **"confirm"** field, type exactly: `DEPLOY`
5. Click **"Run workflow"** to start

The workflow will:
1. Wait for Edwin's GitHub Environment approval (you approve in the GitHub UI)
2. Build the Next.js app with production environment variables
3. Deploy to Vercel production
4. Run a post-deploy smoke test on the Railway backend

---

### 2.2 Post-Deploy Verification

Run these checks **immediately** after the production deploy completes.

```bash
# Replace with real production URLs after Railway + Vercel are configured

# 1. Backend health check
curl https://YOUR-RAILWAY-PROD-URL/health
# Must return: {"status": "ok"}

# 2. Frontend is loading
# Open https://jasper-app.vercel.app in a browser
# Map tiles must load; no blank white screen

# 3. Ingest a test record
curl -X POST https://YOUR-RAILWAY-PROD-URL/api/v1/ingest \
     -H "X-API-Key: YOUR_KONG_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"layer_type":"burn_scar","sector_id":"ATH-PROD-TEST",
          "coordinates":{"lat":56.72,"lon":-111.37},
          "timestamp":"2026-08-01T00:00:00Z","payload":{}}'
# Must return 201 Created

# 4. Run change detection on the test sector
curl -X POST https://YOUR-RAILWAY-PROD-URL/predict/change-detection \
     -H "X-API-Key: YOUR_KONG_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"sector_id":"ATH-PROD-TEST","imagery_date":"2026-08-01"}'
# Must return 200 with risk_score field

# 5. Verify Prometheus metrics are live
curl https://YOUR-RAILWAY-PROD-URL/metrics
# Must return text starting with "# HELP ..."

# 6. Verify Kong blocks unauthenticated requests
curl https://YOUR-RAILWAY-PROD-URL/api/v1/layers/ATH-001
# Must return 401

# 7. Full user journey (do this manually in a browser):
#    Load map -> click a sector -> apply temporal filter
#    -> confirm risk overlay appears -> open contaminant panel
```

---

## Part 3 — Rollback Procedure

If something goes wrong after a production deploy, here is how to undo it fast.

### 3.1 Frontend Rollback (Vercel — 30 seconds)

1. Go to: https://vercel.com/edwinolaez/jasper-app/deployments
2. Find the previous successful deployment (green checkmark)
3. Click the three-dot menu next to it
4. Click **"Promote to Production"**

Vercel instantly switches production traffic back to the previous build.
No code changes needed.

### 3.2 Backend Rollback (Railway — 2 minutes)

1. Go to: https://railway.app → `jasper-backend` service
2. Click **"Deployments"** tab
3. Find the last successful deployment
4. Click **"Rollback"**

Railway redeploys the previous Docker image.

### 3.3 Database Rollback (Supabase — Rahil runs this)

If a database migration was part of the failed deploy:

```sql
-- Run in Supabase SQL Editor
-- Rahil maintains migration files in jasper-db/migrations/

-- Check current migration version
SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;

-- Run the down migration for the latest version
-- (Rahil's migration files have both 'up' and 'down' SQL)
-- Example: if migration 004 caused the problem:
\i jasper-db/migrations/004_rollback.sql
```

**Important:** Tell Edwin before running any DB rollback.
Data written after the failed migration may be lost.

### 3.4 After Any Rollback

1. Open a GitHub Issue describing what went wrong
2. Label it `critical` and assign to the relevant team member
3. Do NOT re-deploy until the root cause is identified and fixed
4. Update this runbook if the rollback procedure had any gaps

---

## Part 4 — Demo Day Procedure (August 3, 2026)

### Morning of Demo (1–2 hours before)

```bash
# 1. Wake the Railway backend (it auto-sleeps after 30 min of inactivity)
curl https://YOUR-RAILWAY-PROD-URL/health
# Wait for the response — first request after sleep takes ~15 seconds

# 2. Verify the full system is live
curl https://YOUR-RAILWAY-PROD-URL/health  # must be instant now (< 200ms)

# 3. Open the production frontend in a browser
# Walk through the full demo script once before the audience arrives
```

### 5 Minutes Before Demo

```bash
# Final wake-up ping — Railway may have gone back to sleep
curl https://YOUR-RAILWAY-PROD-URL/health
```

### If the System Goes Down During Demo

1. Stay calm — don't announce the failure, transition to the slides
2. While someone else presents, hit the Railway backend health endpoint
3. If Railway is down: switch the demo to the staging URL (`jasper-staging.vercel.app`)
4. Staging is always warm (we keep it active during the demo period)

---

## Part 5 — Environment Variables Reference

All secrets are stored in GitHub Actions (for CI), Vercel (for frontend), and Railway (for backend).

| Variable | Where Stored | Owner | Used For |
|---|---|---|---|
| `SUPABASE_URL` | GitHub + Railway | Rahil | DB connection string |
| `SUPABASE_ANON_KEY` | GitHub + Vercel | Rahil | Frontend DB reads |
| `SUPABASE_SERVICE_ROLE_KEY` | GitHub + Railway | Rahil | Backend admin DB access |
| `NEXT_PUBLIC_CONVEX_URL` | GitHub + Vercel | Rahil | Real-time data connection |
| `NEXT_PUBLIC_API_KEY` | GitHub + Vercel | Feven | Kong authentication |
| `RAILWAY_API_URL` | GitHub | Feven | CI integration tests |
| `VERCEL_TOKEN` | GitHub | Edwin | CI auto-deploy |
| `VERCEL_ORG_ID` | GitHub | Edwin | CI auto-deploy |
| `VERCEL_PROJECT_ID` | GitHub | Edwin | CI auto-deploy |
| `SEMGREP_APP_TOKEN` | GitHub | Edwin | SAST scanning |
| `LHCI_GITHUB_APP_TOKEN` | GitHub | Edwin | Lighthouse CI |

**If any secret is exposed:** Tell Edwin immediately. He will rotate it.
Rotation procedure: generate new value in the provider dashboard, update GitHub Secrets, redeploy.

---

*Owner: Edwin Olaez | Project Jasper | Last updated: June 25, 2026*
