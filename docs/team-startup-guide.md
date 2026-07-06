# Project Jasper — Daily Startup Guide

**Every time you sit down to work, run through your section below.**
Jump to your name: [Feven](#feven) · [Richard](#richard) · [Reyta](#reyta) · [Rahil](#rahil) · [Edwin](#edwin)

---

## Feven
**Branch:** `feature/feven-ingest` | **Folder:** `jasper-backend/`
**Stack:** FastAPI · Uvicorn · Kong Gateway · Supabase · Docker

### Step 1 — Pull latest from develop
```bash
git checkout feature/feven-ingest
git pull origin feature/feven-ingest
git merge origin/develop
```

### Step 2 — Check your .env.local exists
```bash
# jasper-backend/.env.local must have:
# SUPABASE_URL=https://xxxx.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```
If missing, ask Rahil for the values.

### Step 3 — Start the server

**Option A — Local (no Docker):**
```bash
cd jasper-backend
pip install -r requirements.txt      # first time only
uvicorn main:app --reload --port 8000
```

**Option B — Full stack with Kong (Docker):**
```bash
cd jasper-backend
docker-compose up --build
# Backend: http://localhost:8000
# Kong proxy: http://localhost:8080
```

### Step 4 — Verify it's working
```bash
curl http://localhost:8000/health
# Expected: {"status": "ok"}
```

### Step 5 — Run your tests
```bash
cd jasper-backend
pytest tests/ -v
```

### Before you push
- Make sure `jasper-backend/.env.local` is NOT committed (it's in .gitignore)
- Push to `feature/feven-ingest`, not directly to develop

---

## Richard
**Branch:** `feature/richard-ml` | **Folder:** `jasper-ml/`
**Stack:** FastAPI · scikit-learn · TensorFlow · rasterio · Python 3.13

### Step 1 — Pull latest from develop
```bash
git checkout feature/richard-ml
git pull origin feature/richard-ml
git merge origin/develop
```

### Step 2 — Activate your virtual environment
```bash
cd jasper-ml

# Windows
ml-env\Scripts\activate

# Mac/Linux
source ml-env/bin/activate
```
If `ml-env` doesn't exist yet:
```bash
python -m venv ml-env
source ml-env/bin/activate        # or ml-env\Scripts\activate on Windows
pip install -r requirements.txt
```

### Step 3 — Start the ML API
```bash
cd jasper-ml
uvicorn api.model_endpoint:app --reload --port 8001
```
Or with Docker:
```bash
docker-compose up --build
# ML API: http://localhost:8001
```

### Step 4 — Verify it's working
```bash
curl http://localhost:8001/health
# Or open http://localhost:8001/docs for the Swagger UI
```

### Step 5 — Run your tests
```bash
cd jasper-ml
pytest tests/ -v
# Expected: ~45 tests passing
```

### Before you push
- Never commit trained model binary files (`.pkl`, `.h5`, `.joblib`) — add to `.gitignore` if needed
- Push to `feature/richard-ml`, not directly to develop

---

## Reyta
**Branch:** `feature/reyta-frontend` | **Folder:** `jasper-frontend/`
**Stack:** Next.js 14 · TypeScript · React-Leaflet · Convex · Tailwind CSS

### Step 1 — Pull latest from develop
```bash
git checkout feature/reyta-frontend
git pull origin feature/reyta-frontend
git merge origin/develop
```

### Step 2 — Check your .env.local exists
```bash
# jasper-frontend/.env.local must have:
# NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
# NEXT_PUBLIC_API_KEY=your-kong-api-key
```
If missing, ask Rahil for `NEXT_PUBLIC_CONVEX_URL` and Feven for `NEXT_PUBLIC_API_KEY`.

### Step 3 — Install dependencies (first time or after package.json changes)
```bash
cd jasper-frontend
npm install
```

### Step 4 — Start the dev server
```bash
cd jasper-frontend
npm run dev
# Open http://localhost:3000
```

### Step 5 — Run type check and tests
```bash
npx tsc --noEmit          # TypeScript check — should have 0 errors
npm test                   # Jest unit tests
```

### Before you push
- `jasper-frontend/.env.local` must NOT be committed
- Run `npm run lint` before pushing — CI will catch lint errors
- Push to `feature/reyta-frontend`, not directly to develop

---

## Rahil
**Branch:** `feature/rahil-db` | **Folders:** `jasper-db/` + `convex/`
**Stack:** Supabase · PostGIS · Convex · SQL migrations

### Step 1 — Pull latest from develop
```bash
git checkout feature/rahil-db
git pull origin feature/rahil-db
git merge origin/develop
```

### Step 2 — Start Convex dev server (real-time sync)
```bash
# From the repo root
npx convex dev
# This watches convex/ and syncs changes to your Convex cloud project
# Keep this running in a terminal while you work
```
First time setup:
```bash
npm install convex             # if not installed
npx convex login               # log in to your Convex account
npx convex dev                 # will prompt you to link/create a project
```

### Step 3 — Apply Supabase migrations (if you added a new one)
```bash
cd jasper-db
supabase db push               # pushes all migrations in supabase/migrations/
```
Or use the Supabase dashboard SQL editor to run migrations manually.

### Step 4 — Verify Convex is working
```bash
# After npx convex dev starts, open your Convex dashboard
# at dashboard.convex.dev — you should see your tables:
# pipelineStatus, waterQualityLive, modelMetadata
```

### Giving Edwin the secrets he needs
Edwin needs these to wire up CI — send them to him directly (not in the repo):
- `SUPABASE_URL` — from Supabase dashboard → Settings → API → Project URL
- `SUPABASE_SERVICE_ROLE_KEY` — from Supabase dashboard → Settings → API → service_role key
- `NEXT_PUBLIC_CONVEX_URL` — shown in terminal when `npx convex dev` runs, or in Convex dashboard
- `TEST_ANALYST_JWT` + `TEST_INGEST_JWT` — JWT tokens for test users with analyst/ingest roles

### Before you push
- Never commit Supabase keys or Convex tokens
- New migrations go in `jasper-db/supabase/migrations/` with the next number (e.g. `004_...sql`)
- Push to `feature/rahil-db`, not directly to develop

---

## Edwin
**Branch:** `feature/edwin-qa` | **Folders:** `tests/` · `.github/` · `docs/`
**Stack:** pytest · httpx · GitHub Actions

### Step 1 — Pull latest from develop
```bash
git checkout feature/edwin-qa
git pull origin feature/edwin-qa
git merge origin/develop
```

### Step 2 — Set up your test environment
```bash
cd tests
pip install -r requirements.txt
```
Create `tests/.env.local` with:
```
RAILWAY_API_URL=https://jasper-backend.up.railway.app
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
TEST_ANALYST_JWT=...
TEST_INGEST_JWT=...
```

### Step 3 — Run the test suite
```bash
cd tests

# Run all tests
pytest -v

# Run a specific file
pytest test_health.py -v
pytest test_rbac.py -v
pytest test_api_contracts.py -v
pytest test_e2e_pipeline.py -v
pytest test_ml_integration.py -v
pytest test_convex_integration.py -v
```

### Step 4 — Check CI status
After any push to `develop`, check the Actions tab on GitHub to make sure all 6 stages pass:
1. Lint
2. Security (Semgrep)
3. Unit Tests
4. Integration Tests
5. Build
6. Performance Gate

### M2 merge checklist (before merging develop → main)
- [ ] All 6 CI stages green on the latest develop commit
- [ ] Secrets added to GitHub (see `docs/m2-secrets-checklist.md`)
- [ ] Open PR: `develop → main`
- [ ] Review and merge

### Before you push
- Never commit `.env.local` or any file with real secrets
- Push to `feature/edwin-qa`, not directly to develop or main
- Only Edwin merges to main

---

## Quick Reference — Ports

| Service | URL | Who |
|---|---|---|
| Frontend | http://localhost:3000 | Reyta |
| Backend API | http://localhost:8000 | Feven |
| Kong Gateway | http://localhost:8080 | Feven |
| ML API | http://localhost:8001 | Richard |
| Kong Admin | http://localhost:9001 | Feven |
| Convex dev | dashboard.convex.dev | Rahil |

## Quick Reference — Git Workflow

```
feature/your-branch  →  (PR)  →  develop  →  (PR, Edwin only)  →  main
```

1. Always work on your feature branch
2. Pull from `develop` daily to stay current (`git merge origin/develop`)
3. Push to your feature branch and open a PR to `develop` when ready
4. Edwin reviews and merges to `develop`
5. Edwin merges `develop → main` at each milestone
