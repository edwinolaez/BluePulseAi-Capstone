# Project Jasper — Team Environment Setup Guide
## Version 1.0 | All Members Must Complete This Before Any Coding Begins

---

## Alignment Check Results (Pre-Setup Audit)

Before the setup steps, here is a summary of the cross-member alignment review.

### ✅ Confirmed Alignments

| Contract | Owner | Consumer | Status |
|---|---|---|---|
| Ingest record schema (layer_type, sector_id, coordinates, timestamp) | Feven | Rahil | ✅ Match |
| Map query endpoint `GET /api/v1/layers/{sector_id}` | Feven | Reyta | ✅ Match |
| ML output schema (risk_score, contaminant_vector, simulation_type) | Richard | Rahil + Reyta | ✅ Match |
| Convex mutation names (updatePipelineStatus, updateWaterQuality, updateModelMetadata) | Rahil | Feven + Richard | ✅ Match |
| Convex query names (getPipelineStatus, getLiveWaterQuality, getModelMetadata) | Rahil | Reyta | ✅ Match |
| RBAC roles (admin, analyst, ingest, viewer) | Rahil | Edwin (tests) | ✅ Match |
| Branch protection: only Edwin merges to main | Edwin | All | ✅ Match |
| CI pipeline stages (Lint → Security → Unit → Integration → Build) | Edwin | All | ✅ Match |

### ⚠️ One Architecture Issue Found — Action Required

**Issue: Convex folder location mismatch.**

Rahil's CLAUDE.md places Convex files inside `/jasper-db/convex/`. However, Reyta's frontend imports the Convex client using:
```typescript
import { api } from "../../convex/_generated/api";
```
This relative path only resolves if the `convex/` folder is at the **repository root**, not inside `/jasper-db/`.

**Decision Edwin must make and communicate to the team before Sprint 1 ends:**

**Option A (Recommended):** Move Convex to the repo root. Folder becomes `/convex/`. Rahil still owns it. Reyta's import path works as written.

**Option B:** Keep Convex inside `/jasper-db/convex/` and update Reyta's import paths to `../../../jasper-db/convex/_generated/api`. Requires updating Reyta's CLAUDE.md.

**Owner:** Edwin to decide and update the team by June 15.

---

## What You Are Building

Project Jasper is a post-wildfire environmental monitoring platform for the Athabasca watershed. It uses satellite imagery, terrain data, and water quality telemetry to detect burn scars, predict erosion risk, and track hydrocarbon contamination. The system will be demonstrated to SAIT Faculty and CERCUTS on **August 3, 2026**.

### Tech Stack at a Glance

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

Every team member installs these before their role-specific setup.

### 1.1 Git

```bash
# Verify Git is installed
git --version
# Should return: git version 2.x.x

# If not installed:
# macOS: brew install git
# Windows: https://git-scm.com/download/win
# Ubuntu/Debian: sudo apt install git
```

### 1.2 Node.js and npm

```bash
# Verify Node.js (minimum v18)
node --version
# Should return: v18.x.x or higher

# Verify npm
npm --version

# If not installed: https://nodejs.org (download LTS version)
# Or use nvm (recommended):
#   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
#   nvm install 18
#   nvm use 18
```

### 1.3 Python

```bash
# Verify Python (minimum 3.11)
python3 --version
# Should return: Python 3.11.x or higher

# If not installed:
# macOS: brew install python@3.11
# Windows: https://www.python.org/downloads
# Ubuntu: sudo apt install python3.11 python3.11-venv
```

### 1.4 Docker Desktop

Docker is required for building and testing the FastAPI backend container locally.

Download: https://www.docker.com/products/docker-desktop

```bash
# Verify after install
docker --version
docker compose version
```

### 1.5 VS Code (Recommended IDE)

Download: https://code.visualstudio.com

**Recommended extensions for this project:**
- GitLens — for branch and history visualization
- Pylance + Python — for Python IntelliSense
- ESLint — for frontend linting feedback inline
- Prettier — for consistent formatting
- Thunder Client — for testing API endpoints locally
- Tailwind CSS IntelliSense (if using Tailwind in frontend)

---

## Part 2 — Clone the Repository and Configure Git Identity

### 2.1 Accept the GitHub Invite

Edwin will send each team member a GitHub collaboration invite to the repo:
`https://github.com/edwinolaez/BluePulseAi-Capstone`

Accept the invite before cloning.

### 2.2 Clone the Repo

```bash
# Choose a folder on your machine (e.g., your Documents or Projects folder)
cd ~/Projects

git clone https://github.com/edwinolaez/BluePulseAi-Capstone.git
cd BluePulseAi-Capstone
```

### 2.3 Set Your Git Identity

Every team member must configure their name and email so commits are attributed correctly.

```bash
git config user.name "Your Full Name"
git config user.email "your.sait.email@edu.sait.ca"

# Verify
git config user.name
git config user.email
```

### 2.4 Checkout Your Personal Branch

| Team Member | Branch Name |
|---|---|
| Edwin | `feature/edwin-qa` |
| Feven | `feature/feven-ingest` |
| Richard | `feature/richard-ml` |
| Reyta | `feature/reyta-frontend` |
| Rahil | `feature/rahil-db` |

```bash
# Example for Feven:
git checkout feature/feven-ingest

# If the branch doesn't exist yet, create it:
git checkout -b feature/feven-ingest
git push -u origin feature/feven-ingest
```

### 2.5 Verify Branch Protection Rules (Edwin Only)

Edwin sets these in GitHub → Settings → Branches after the repo is created:

- `main`: Require pull request, require Edwin's review, require CI to pass
- `develop`: Require CI to pass before merge (anyone can merge to develop after CI green)

---

## Part 3 — The .env File System (Everyone Must Understand This)

Project Jasper uses a two-file environment variable system. **Never commit real secrets to Git.**

### How it works

| File | Purpose | Committed? |
|---|---|---|
| `.env.example` | Template with placeholder keys — shows what variables exist | ✅ Yes — safe to commit |
| `.env.local` | Your actual values for local development | ❌ Never — in .gitignore |

### What this looks like in practice

The `.env.example` file in the repo root will look like:

```
# Supabase
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Convex
NEXT_PUBLIC_CONVEX_URL=your_convex_deployment_url_here

# API
NEXT_PUBLIC_API_KEY=your_kong_api_key_here

# Railway (backend)
RAILWAY_API_URL=your_railway_backend_url_here
```

**When you start local development:**
1. Copy `.env.example` to `.env.local`
2. Ask Edwin or Rahil (via private DM) for the real values
3. Fill in `.env.local` — this file stays on your machine only

**Rule: If you accidentally commit a real key, tell Edwin immediately.** Edwin will rotate the key. This is a security incident — don't hide it.

---

## Part 4 — Role-Specific Setup

Complete Part 1, 2, and 3 first. Then go to your role section.

---

### Part 4A — Edwin (PM + QA/Security)

Edwin's setup focuses on the CI pipeline, testing tools, and repo configuration.

```bash
# Navigate to your folder
cd tests/
cd ../docs/

# Install Python test tools globally
pip3 install pytest httpx pylint semgrep

# Verify
pytest --version
pylint --version

# Install Node security tools
npm install -g eslint

# Configure Dependabot (done via GitHub UI)
# Go to: repo → Insights → Dependency graph → Dependabot → Enable
```

**GitHub Actions setup:**

Create the CI workflow file at `.github/workflows/ci.yml`. The full CI pipeline Edwin owns is in your CLAUDE.md. Push this file on your first commit.

**PR Template:**

Create `.github/pull_request_template.md` with a security checklist (see your CLAUDE.md).

**Semgrep:**

```bash
# Install Semgrep
pip3 install semgrep

# Test run (from repo root)
semgrep --config=p/python .
semgrep --config=p/typescript .
```

---

### Part 4B — Feven (Data Pipeline & API)

Feven's setup focuses on the FastAPI backend and Kong Gateway.

```bash
# Navigate to your folder
cd jasper-backend/

# Create a Python virtual environment (keeps your dependencies isolated)
python3 -m venv venv

# Activate it
# macOS/Linux:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# Your terminal prompt should now show (venv) at the start

# Install FastAPI and dependencies
pip install fastapi uvicorn pydantic python-multipart httpx pytest pylint supabase rasterio
pip freeze > requirements.txt

# Run the dev server
uvicorn main:app --reload --port 8000

# Verify it's working: open http://localhost:8000/health in your browser
# Should return: {"status": "ok"}
```

**Kong Gateway (local testing):**

```bash
# Kong runs in Docker for local dev
# From the jasper-backend/ folder:
docker compose up -d kong

# Verify Kong is running
curl http://localhost:8001/status
```

**Docker:**

```bash
# Build your backend image
docker build -t jasper-backend .

# Run it
docker run -p 8000:8000 jasper-backend
```

---

### Part 4C — Richard (AI/ML & Simulation)

Richard's setup focuses on the ML Python environment.

```bash
# Navigate to your folder
cd jasper-ml/

# Create a dedicated ML virtual environment
python3 -m venv ml-env

# Activate it
# macOS/Linux:
source ml-env/bin/activate
# Windows:
ml-env\Scripts\activate

# Install ML dependencies
pip install scikit-learn numpy scipy rasterio fastapi uvicorn pytest pylint supabase

# For deep learning (install one, not both):
# Option A — TensorFlow:
pip install tensorflow

# Option B — PyTorch:
pip install torch torchvision

# Freeze requirements
pip freeze > requirements.txt

# Verify rasterio can read a GeoTIFF
python3 -c "import rasterio; print('rasterio OK:', rasterio.__version__)"

# Verify scikit-learn
python3 -c "from sklearn.ensemble import RandomForestClassifier; print('sklearn OK')"
```

**Jupyter (for spike notebook in Sprint 1):**

```bash
pip install jupyter
jupyter notebook notebooks/change_detection_spike.ipynb
```

---

### Part 4D — Reyta (Frontend GIS)

Reyta's setup focuses on the Next.js frontend and React-Leaflet.

```bash
# Navigate to your folder
cd jasper-frontend/

# Install all frontend dependencies
npm install

# If starting from scratch (no package.json yet):
npx create-next-app@14 . --typescript --tailwind --app --no-src-dir

# Install GIS and UI dependencies
npm install react-leaflet leaflet @types/leaflet
npm install convex

# Install testing tools
npm install -D jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom @types/jest

# Run the dev server
npm run dev

# Verify: open http://localhost:3000 in your browser
```

**Configure Jest** — create `jest.config.js` in `/jasper-frontend/`:

```javascript
const nextJest = require('next/jest');
const createJestConfig = nextJest({ dir: './' });
module.exports = createJestConfig({
  setupFilesAfterFramework: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
});
```

**Leaflet CSS fix** — add to `app/layout.tsx`:

```typescript
import 'leaflet/dist/leaflet.css';
```

---

### Part 4E — Rahil (DB & Analytics)

Rahil's setup focuses on Supabase, PostGIS, and Convex.

**Supabase:**

```bash
# Install Supabase CLI
npm install -g supabase

# Verify
supabase --version

# Login to Supabase
supabase login

# Initialize Supabase in the jasper-db folder
cd jasper-db/
supabase init

# Link to your Supabase project (get project-ref from Supabase dashboard)
supabase link --project-ref YOUR_PROJECT_REF
```

**Enable PostGIS** — run this in Supabase SQL Editor (Dashboard):

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

-- Verify
SELECT PostGIS_Version();
```

**Convex:**

```bash
# Install Convex CLI globally
npm install -g convex

# Navigate to repo root (NOT inside jasper-db — see alignment note at top)
cd /path/to/BluePulseAi-Capstone

# Initialize Convex project
npx convex dev
# This creates the convex/ folder and _generated/ subfolder automatically
# It will prompt you to log in via browser — do that

# Note: Leave this terminal running while developing — it watches for schema changes
```

**Python test tools for RBAC testing:**

```bash
cd jasper-db/
python3 -m venv db-env
source db-env/bin/activate  # or db-env\Scripts\activate on Windows
pip install pytest supabase python-dotenv
pip freeze > requirements.txt
```

---

## Part 5 — First Day Verification Checklist (Everyone)

Complete this on Day 1 and confirm with Edwin.

- [ ] Repo cloned successfully
- [ ] On your personal branch (not main, not develop)
- [ ] `.env.local` created from `.env.example` (never committed)
- [ ] Local dev environment starts without errors
- [ ] You can push a commit to your branch and see it on GitHub
- [ ] CI pipeline runs (even if some stages are empty) — Edwin confirms this

---

## Part 6 — Daily Git Workflow (Everyone, Every Session)

This is the same for every team member. Do this at the start of every coding session without exception.

```bash
# Step 1 — Sync with develop
git checkout develop
git pull origin develop

# Step 2 — Switch to your branch and bring in the latest changes
git checkout feature/YOUR-branch
git merge develop

# If there are merge conflicts:
# Open the conflicting files, resolve them, then:
git add .
git commit -m "chore: resolve merge conflicts from develop"

# Step 3 — Do your work, commit often
git add .
git commit -m "feat: describe what you built"

# Step 4 — Push your branch at least once a day
git push origin feature/YOUR-branch

# Step 5 — When a task is done, open a PR on GitHub
# feature/YOUR-branch → develop
# CI must be green before tagging Edwin for review
```

**Commit message prefixes (use the right one every time):**

| Prefix | Use for |
|---|---|
| `feat:` | New feature, endpoint, component, model |
| `fix:` | Bug fix |
| `test:` | New or updated test |
| `ci:` | CI/CD pipeline changes (Edwin only) |
| `docs:` | README, API contracts, runbooks |
| `chore:` | Config, setup, dependency updates |
| `style:` | CSS/layout changes with no logic change (Reyta) |

---

## Part 7 — Milestone and Deadline Reference

| Milestone | Date | Who Signs Off |
|---|---|---|
| M1 — Foundation | June 20, 2026 | Edwin |
| M2 — Pipeline Live | July 4, 2026 | Edwin |
| M3 — AI Live | July 18, 2026 | Edwin |
| M4 — Staging Verified | July 25, 2026 | Edwin |
| M5 — Production Live | August 1, 2026 | Edwin |
| M6 — Demo Day | August 3, 2026 | Whole Team |

**Hard rule:** No milestone sign-off without a green CI pipeline and Edwin's PR approval.

---

## Part 8 — If You're Stuck

1. Try to solve it yourself for up to **30 minutes**
2. If still stuck, message Edwin on the team channel — don't go silent
3. Edwin will either unblock you directly or connect you with the right teammate
4. Never push broken code to develop hoping Edwin won't notice — the CI will catch it and block the whole team

---

*Document owner: Edwin Olaez | Project Jasper | Last updated: June 25, 2026*
