# Project Jasper — Team Environment Setup Guide
## Version 1.0 | All Members Must Complete This Before Any Coding Begins

---

## Alignment Check Results (Pre-Setup Audit)

Before the setup steps, here is a summary of the cross-member alignment review.

### Confirmed Alignments

| Contract | Owner | Consumer | Status |
|---|---|---|---|
| Ingest record schema (layer_type, sector_id, coordinates, timestamp) | Feven | Rahil | Match |
| Map query endpoint `GET /api/v1/layers/{sector_id}` | Feven | Reyta | Match |
| ML output schema (risk_score, contaminant_vector, simulation_type) | Richard | Rahil + Reyta | Match |
| Convex mutation names (updatePipelineStatus, updateWaterQuality, updateModelMetadata) | Rahil | Feven + Richard | Match |
| Convex query names (getPipelineStatus, getLiveWaterQuality, getModelMetadata) | Rahil | Reyta | Match |
| RBAC roles (admin, analyst, ingest, viewer) | Rahil | Edwin (tests) | Match |
| Branch protection: only Edwin merges to main | Edwin | All | Match |
| CI pipeline stages (Lint -> Security -> Unit -> Integration -> Build) | Edwin | All | Match |

### One Architecture Issue Found — Resolved

**Issue: Convex folder location mismatch.**

Rahil's original plan placed Convex files inside `/jasper-db/convex/`. However, Reyta's frontend imports the Convex client using:

```typescript
import { api } from "../../convex/_generated/api";
```

**Decision (Edwin, June 25):** Convex lives at the **repo root** as `/convex/`. Rahil still owns it. Reyta's import path works as written. Do not put it inside `/jasper-db/`.

---

## What You Are Building

Project Jasper is a post-wildfire environmental monitoring platform for the Athabasca watershed. It uses satellite imagery, terrain data, and water quality telemetry to detect burn scars, predict erosion risk, and track hydrocarbon contamination. The system will be demonstrated to SAIT Faculty and CERCUTS on **August 3, 2026**.

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 + TypeScript + React-Leaflet + Convex Client |
| Backend API | FastAPI (Python) + Kong Gateway OSS |
| ML / Simulation | scikit-learn / TensorFlow + rasterio + SciPy |
| Geospatial DB | Supabase + PostGIS |
| Real-time DB | Convex |
| Deployment | Vercel (frontend) + Railway (backend) |
| CI/CD | GitHub Actions |
| Security | Semgrep + Dependabot + pip-audit + ESLint |

---

## Part 1 — Prerequisites (Everyone)

### 1.1 Git

```bash
git --version   # Should return: git version 2.x.x
```

### 1.2 Node.js and npm

```bash
node --version   # Minimum v18
npm --version
```

Install via https://nodejs.org (LTS) or nvm.

### 1.3 Python

```bash
python3 --version   # Minimum 3.11
```

### 1.4 Docker Desktop

Required for local Kong Gateway testing.
Download: https://www.docker.com/products/docker-desktop

```bash
docker --version
docker compose version
```

### 1.5 VS Code (Recommended)

Extensions: GitLens, Pylance + Python, ESLint, Prettier, Thunder Client, Tailwind CSS IntelliSense.

---

## Part 2 — Clone and Configure Git Identity

### 2.1 Accept the GitHub Invite

Edwin will send each member an invite to: `https://github.com/edwinolaez/BluePulseAi-Capstone`

### 2.2 Clone

```bash
git clone https://github.com/edwinolaez/BluePulseAi-Capstone.git
cd BluePulseAi-Capstone
```

### 2.3 Set Your Git Identity

```bash
git config user.name "Your Full Name"
git config user.email "your.sait.email@edu.sait.ca"
```

### 2.4 Checkout Your Branch

| Member | Branch |
|---|---|
| Edwin | `feature/edwin-qa` |
| Feven | `feature/feven-ingest` |
| Richard | `feature/richard-ml` |
| Reyta | `feature/reyta-frontend` |
| Rahil | `feature/rahil-db` |

```bash
git checkout feature/YOUR-branch
# If the branch doesn't exist yet:
git checkout -b feature/YOUR-branch
git push -u origin feature/YOUR-branch
```

### 2.5 Branch Protection (Edwin Only)

Set in GitHub > Settings > Branches:
- `main`: Require PR, require Edwin's review, require CI to pass, block direct push
- `develop`: Require CI to pass before merge

---

## Part 3 — The .env File System

| File | Purpose | Committed? |
|---|---|---|
| `.env.example` | Template with placeholder keys | Yes — safe |
| `.env.local` | Your actual local values | Never — in .gitignore |

**To start local dev:**
1. Copy `.env.example` to `.env.local`
2. Ask Edwin or Rahil (private DM) for real values
3. Fill in `.env.local` — stays on your machine only

**If you accidentally commit a real key: tell Edwin immediately.** He will rotate it. This is a security incident.

---

## Part 4 — Role-Specific Setup

### Part 4A — Edwin (PM + QA/Security)

```bash
pip3 install pytest httpx pylint semgrep pip-audit
npm install -g eslint
```

Enable Dependabot in GitHub > Insights > Dependency graph > Dependabot.

### Part 4B — Feven (Data Pipeline & API)

```bash
cd jasper-backend/
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install fastapi uvicorn pydantic python-multipart httpx pytest pylint supabase rasterio
pip freeze > requirements.txt
uvicorn main:app --reload --port 8000
```

Kong (local Docker):
```bash
docker compose up -d kong
curl http://localhost:8001/status
```

### Part 4C — Richard (AI/ML)

```bash
cd jasper-ml/
python3 -m venv ml-env
source ml-env/bin/activate
pip install scikit-learn numpy scipy rasterio fastapi uvicorn pytest pylint supabase
pip install tensorflow   # or: pip install torch torchvision
pip freeze > requirements.txt
```

Verify:
```bash
python3 -c "import rasterio; print('rasterio OK:', rasterio.__version__)"
python3 -c "from sklearn.ensemble import RandomForestClassifier; print('sklearn OK')"
```

### Part 4D — Reyta (Frontend GIS)

```bash
cd jasper-frontend/
npm install
npm run dev   # http://localhost:3000
```

If starting from scratch:
```bash
npx create-next-app@14 . --typescript --tailwind --app --no-src-dir
npm install react-leaflet leaflet @types/leaflet convex
npm install -D jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom @types/jest
```

Add to `app/layout.tsx`:
```typescript
import 'leaflet/dist/leaflet.css';
```

### Part 4E — Rahil (DB & Analytics)

**Supabase:**
```bash
npm install -g supabase
supabase login
cd jasper-db/
supabase init
supabase link --project-ref YOUR_PROJECT_REF
```

Enable PostGIS in Supabase SQL Editor:
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
SELECT PostGIS_Version();
```

**Convex (run from repo root — NOT inside jasper-db):**
```bash
npm install -g convex
npx convex dev   # leaves terminal running — watches schema changes
```

---

## Part 5 — Day 1 Verification Checklist

- [ ] Repo cloned successfully
- [ ] On your personal branch (not main, not develop)
- [ ] `.env.local` created from `.env.example` (never committed)
- [ ] Local dev environment starts without errors
- [ ] You can push a commit to your branch and see it on GitHub
- [ ] CI pipeline runs — Edwin confirms

---

## Part 6 — Daily Git Workflow

```bash
# Start of every session
git checkout develop
git pull origin develop
git checkout feature/YOUR-branch
git merge develop

# Work, commit often
git add .
git commit -m "feat: describe what you built"
git push origin feature/YOUR-branch

# When a task is done: open PR on GitHub (feature/YOUR-branch -> develop)
# CI must be green before tagging Edwin for review
```

**Commit prefixes:**

| Prefix | Use for |
|---|---|
| `feat:` | New feature, endpoint, component, model |
| `fix:` | Bug fix |
| `test:` | New or updated test |
| `ci:` | CI/CD pipeline changes (Edwin only) |
| `docs:` | README, API contracts, runbooks |
| `chore:` | Config, setup, dependency updates |
| `style:` | CSS/layout only, no logic change (Reyta) |

---

## Part 7 — Milestones

| Milestone | Date | Owner |
|---|---|---|
| M1 — Foundation | June 20, 2026 | Edwin |
| M2 — Pipeline Live | July 4, 2026 | Edwin |
| M3 — AI Live | July 18, 2026 | Edwin |
| M4 — Staging Verified | July 25, 2026 | Edwin |
| M5 — Production Live | August 1, 2026 | Edwin |
| M6 — Demo Day | August 3, 2026 | Whole Team |

---

## Part 8 — If You're Stuck

1. Try to solve it yourself for up to 30 minutes
2. Message Edwin on the team channel — don't go silent
3. Never push broken code to `develop` hoping CI won't catch it — it will, and it blocks the whole team

---

*Document owner: Edwin Olaez | Project Jasper | Last updated: June 25, 2026*
