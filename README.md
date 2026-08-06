# Project Jasper — BluePulse AI

> Post-wildfire environmental monitoring platform for the Athabasca watershed, Jasper National Park.

**Demo Day:** August 3, 2026 — SAIT Faculty + CERCUTS researchers  
**Status:** Production Live (M5 complete August 1, 2026) ✅

---

## What is Project Jasper?

The 2024 Jasper wildfire burned approximately **35,000 hectares** of Jasper National Park, leaving behind serious environmental risks — soil erosion, contaminated waterways, and slow forest recovery. Monitoring these risks across such a large area is difficult and expensive using traditional field surveys alone.

**Project Jasper** is a web-based platform that lets environmental researchers and land managers:

- **See the damage on an interactive map** — a live satellite-style map showing the exact fire perimeter, erosion-risk zones, contaminated river stretches, and flood-prone areas.
- **Run "what-if" simulations** — adjust sliders for rainfall, slope angle, and contamination level to see how conditions could change, without waiting for a field visit.
- **Place virtual sensors** — stakeholders can drop sensors anywhere on the map to preview what that sensor would detect, before physically installing expensive hardware.
- **Track recovery over time** — a timeline slider shows how conditions changed from June to July 2024, with AI-powered predictions of what comes next.
- **Get AI analysis** — a built-in AI assistant summarises risk, explains model outputs in plain language, and answers researcher questions.

The platform pulls real data from Environment Canada (water flow), NASA SRTM (terrain elevation), and Alberta Wildfire open data (fire perimeter), and feeds it through machine learning models that run every time a slider moves.

---

## Features at a Glance

| Feature | What it does |
|---|---|
| Interactive 2D map | Leaflet map with four toggleable hazard layers (erosion, water quality, burn scar, flood elevation) |
| 3D terrain view | Click "3D" to switch to a deck.gl 3D terrain view with the same layers |
| Digital twin panels | Sliders for slope, rainfall, and contamination — map colours update in real time |
| Sensor placement | Drop virtual sensors with a coverage-radius preview; saved to the database |
| AI Overview | Risk summaries, simulation graphs, and an AI chatbot powered by Claude |
| Dashboard | Field photo uploads, simulation result cards |
| Reports | Exportable monitoring reports |
| Role-based access | Viewer → Analyst → Admin → Superadmin, each with different permissions |
| Keyboard shortcuts | Full keyboard navigation (press `?` in the app to see all shortcuts) |
| Live GIS logs | Real-time diagnostic log stream for field operators |

---

## Team

| Name | Role | Module |
|---|---|---|
| **Edwin Olaez** | Project Manager · QA & Security Lead | `tests/`, CI/CD, Auth, integration |
| **Reyta** | Frontend Developer | `jasper-frontend/` — Next.js map UI |
| **Feven** | Backend Developer | `jasper-backend/` — FastAPI + Kong Gateway |
| **Richard** | AI/ML Specialist | `jasper-ml/` — erosion, contaminant, change detection models |
| **Rahil** | Database Engineer | `jasper-db/` — Supabase + PostGIS + Convex |

---

## How the System Works

```
Browser (React / Next.js)
    │
    ├── Interactive Map (Leaflet 2D / deck.gl 3D)
    ├── Digital Twin Sliders → ML API calls → live map updates
    ├── AI Chatbot (Claude API)
    │
    ▼
Convex (real-time database — sensor data, placed sensors)
    │
FastAPI Backend (Kong Gateway for rate limiting)
    │
    ├── ML Module (scikit-learn / TensorFlow)
    │     ├── Erosion simulation (RUSLE-inspired)
    │     ├── Contaminant plume tracking
    │     └── Burn scar change detection (Random Forest)
    │
    └── Supabase + PostGIS (geospatial data storage)
```

Real environmental data sources:
- **Environment Canada WSC** — live river flow and water level readings
- **NASA SRTM** — terrain elevation and slope data
- **Alberta Wildfire open data** — 2024 fire perimeter boundary

---

## Repository Structure

```
BluePulseAi-Capstone/
├── jasper-frontend/    # Reyta — Next.js 14 + React-Leaflet map UI
├── jasper-backend/     # Feven — FastAPI + Kong Gateway API
├── jasper-ml/          # Richard — ML models + simulation API
├── jasper-db/          # Rahil — Supabase + PostGIS database config
├── convex/             # Rahil — Convex real-time schema + queries
├── tests/              # Edwin — integration, contract, and benchmark tests
├── docs/               # Edwin — API contracts, runbook, agent docs
└── .github/
    ├── workflows/      # CI/CD pipelines (test, lint, deploy)
    ├── dependabot.yml  # Automated dependency security updates
    └── pull_request_template.md
```

---

## Tech Stack

| What it does | Technology used |
|---|---|
| Web app (the interface you see) | Next.js 14 + TypeScript + Tailwind CSS |
| 2D map | React-Leaflet (OpenStreetMap tiles) |
| 3D terrain map | deck.gl + @deck.gl/geo-layers |
| Real-time data sync | Convex |
| Backend API | FastAPI (Python) behind Kong Gateway |
| AI/ML models | scikit-learn, TensorFlow, rasterio, SciPy |
| Geospatial database | Supabase + PostGIS |
| AI chatbot | Anthropic Claude API |
| Hosting (frontend) | Vercel |
| Hosting (backend) | Railway |
| CI/CD | GitHub Actions |
| Security scanning | Semgrep, Dependabot, pip-audit, ESLint |

---

## Getting Started (Developers)

### Prerequisites
- Node.js 18+
- Python 3.11+
- A `.env.local` file with API keys (ask Edwin or Rahil for the values)

### Run the frontend

```bash
cd jasper-frontend
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

**Demo login accounts** (available on the login page under "Demo accounts"):

| Role | Email | Password |
|---|---|---|
| Superadmin | superadmin@jasper.ca | JasperAdmin2026! |
| Admin | admin@jasper.ca | JasperAdmin2026! |
| Analyst | analyst@jasper.ca | JasperAnalyst2026! |
| Viewer | viewer@jasper.ca | JasperViewer2026! |

### Run the ML API

```bash
cd jasper-ml
source ml-env/bin/activate      # Windows: ml-env\Scripts\activate
python -m uvicorn api.model_endpoint:app --reload --port 8001
```

Interactive API docs: `http://localhost:8001/docs`

### Run the backend

```bash
cd jasper-backend
source venv/bin/activate        # Windows: venv\Scripts\activate
uvicorn main:app --reload --port 8000
```

### Run tests

```bash
# Frontend physics unit tests (34 tests)
cd jasper-frontend && npx jest

# ML model + API tests (45 tests)
cd jasper-ml && pytest tests/ -v

# Integration + contract tests
cd tests && pytest --tb=short
```

---

## Keyboard Shortcuts

Press **`?`** anywhere in the app to open the shortcuts panel.

| Key | Action |
|---|---|
| `M` | Map view |
| `D` | Dashboard |
| `A` | AI Overview |
| `R` | Reports |
| `S` | Toggle sidebar |
| `3` | Switch 2D / 3D (map tab only) |
| `E` | Toggle Erosion layer |
| `F` | Toggle Forest Burn layer |
| `W` | Toggle Water / Contaminant layer |
| `L` | Toggle Flood Elevation layer |
| `+` / `-` | Zoom in / out (2D only) |
| `Esc` | Close panel or sidebar |

---

## Branch Strategy

| Branch | Who uses it | Purpose |
|---|---|---|
| `main` | Edwin (merges only) | Production — what's live on Vercel |
| `develop` | All team | Integration — CI must pass before merge |
| `feature/edwin-qa` | Edwin | CI, tests, security, docs |
| `feature/feven-ingest` | Feven | Backend + data ingest pipeline |
| `feature/richard-ml` | Richard | ML models + simulation API |
| `feature/reyta-frontend` | Reyta | Next.js map UI |
| `feature/rahil-db` | Rahil | Supabase + Convex database |

---

## Project Milestones

| Milestone | Date | Status |
|---|---|---|
| M1 — Foundation | June 20, 2026 | ✅ Done |
| M2 — Pipeline Live | July 4, 2026 | ✅ Done |
| M3 — AI Live | July 18, 2026 | ✅ Done |
| M4 — Staging Verified | July 25, 2026 | ✅ Done |
| M5 — Production Live | August 1, 2026 | ✅ Done |
| M6 — Demo Day | August 3, 2026 | 🎯 Target |

---

## Deployments

| Environment | URL | Trigger |
|---|---|---|
| Production (CI) | Vercel auto-deploy URL | Push to `main` |
| Reyta's frontend | jasper-frontend-nu.vercel.app | Manual deploy |
| ML API | Railway | Push to `feature/richard-ml` → `develop` |

---

## Security

- All passwords stored as server-side `httpOnly` cookies — never in browser storage
- Role-based access control: viewer / analyst / admin / superadmin
- Automated dependency scanning: Dependabot + pip-audit
- Static code analysis: Semgrep + ESLint on every pull request
- API rate limiting: Kong Gateway (20 requests/minute per endpoint)

---

## Questions?

- **Running the app?** See the Getting Started section above.
- **API documentation?** Start the ML server and visit `http://localhost:8001/docs`
- **Access / credentials?** Contact Edwin Olaez (edwinolaez02@gmail.com)
- **Bug reports?** Open a GitHub issue on this repository

---

_Built by Team BluePulse AI — SAIT Capstone 2026_  
_Last updated: August 5, 2026_
