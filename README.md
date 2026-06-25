# Project Jasper

Post-wildfire environmental monitoring platform for the Athabasca watershed.
Demo: **August 3, 2026** — SAIT Faculty + CERCUTS.

## Tech Stack

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

## Repository Structure

```
BluePulseAi-Capstone/
├── jasper-frontend/    # Reyta — Next.js 14 + React-Leaflet
├── jasper-backend/     # Feven — FastAPI + Kong
├── jasper-ml/          # Richard — scikit-learn / TensorFlow
├── jasper-db/          # Rahil — Supabase + PostGIS config
├── convex/             # Rahil — Convex schema + mutations + queries (repo root)
├── tests/              # Edwin — integration + contract + benchmark tests
├── docs/               # Edwin — api-contracts.md, AGENTS.md, runbook
└── .github/
    ├── workflows/      # ci.yml, deploy-staging.yml, deploy-production.yml
    ├── dependabot.yml
    └── pull_request_template.md
```

## Environment Setup

See [PROJECT-JASPER-ENV-SETUP.md](docs/) for the full team setup guide.

Copy `.env.example` to `.env.local` and fill in real values (ask Edwin or Rahil).

## Branch Strategy

| Branch | Purpose |
|---|---|
| `main` | Production — Edwin merges only |
| `develop` | Integration — CI must pass before merge |
| `feature/edwin-qa` | Edwin: CI, tests, docs |
| `feature/feven-ingest` | Feven: backend + ingest pipeline |
| `feature/richard-ml` | Richard: ML models + simulation |
| `feature/reyta-frontend` | Reyta: Next.js + map UI |
| `feature/rahil-db` | Rahil: Supabase + Convex |

## Milestones

| Milestone | Date |
|---|---|
| M1 — Foundation | June 20, 2026 |
| M2 — Pipeline Live | July 4, 2026 |
| M3 — AI Live | July 18, 2026 |
| M4 — Staging Verified | July 25, 2026 |
| M5 — Production Live | August 1, 2026 |
| M6 — Demo Day | August 3, 2026 |
