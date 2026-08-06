# jasper-frontend

**Owner:** Reyta · Next.js 14 + TypeScript + React-Leaflet + Convex  
**Live URL:** Vercel auto-deploy on push to `main`

---

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000` — the app loads with a login screen.

**Demo accounts** (visible on the login page under "Demo accounts"):

| Role | Email | Password |
|---|---|---|
| Superadmin | superadmin@jasper.ca | JasperAdmin2026! |
| Admin | admin@jasper.ca | JasperAdmin2026! |
| Analyst | analyst@jasper.ca | JasperAnalyst2026! |
| Viewer | viewer@jasper.ca | JasperViewer2026! |

---

## What's Inside

### Pages (tabs across the top)

| Tab | Component | What it shows |
|---|---|---|
| Map | `MapViewPage.tsx` | Interactive 2D/3D map with hazard layers + digital twin panels |
| Dashboard | `DashboardPage.tsx` | Field photo uploads, simulation result cards |
| AI Overview | `AiOverviewPage.tsx` | Risk summaries, simulation graphs, AI chatbot |
| Reports | `ReportsPage.tsx` | Exportable monitoring reports |
| Archives | `ArchivesPage.tsx` | Historical scan archive |
| Admin | `AdminPage.tsx` | Superadmin only — user management |

### Map Layers (toggleable from sidebar or keyboard)

| Layer | Key | File | What it shows |
|---|---|---|---|
| Erosion | `E` | `ErosionLayer.tsx` | ML-coloured risk zones by severity |
| Water / Contaminant | `W` | `ContaminantLayer.tsx` | River contamination + animated flow arrows |
| Forest Burn | `F` | `BurnScarLayer.tsx` | 2024 fire perimeter + forest recovery stage |
| Flood Elevation | `L` | `ElevationRiskLayer.tsx` | ArcGIS flood risk zones + water level |

### Digital Twin Panels

Each hazard layer has a simulation panel in the sidebar. Moving the sliders triggers a live ML API call and updates the map colours in real time.

| Panel | Sliders |
|---|---|
| Soil Erosion | Slope angle (°), Rainfall (mm) |
| River Contaminant | Contamination level (0–100%) |
| Forest Growth | Years since fire, Precipitation (mm/yr) |
| Flood Elevation | Water level rise (m) |

Slider state (`slopeDeg`, `rainfallMm`, `contaminationLevel`) is lifted to `page.tsx` so both the Map tab and the AI Overview tab stay in sync.

### Sensor Placement

Stakeholders can click "Add Sensor" on the map to place a virtual sensor anywhere. A coverage-radius preview ring is drawn on the map (2D) and as a 3D ring (3D view). Sensors are saved to Convex and persist across sessions.

Physics simulations run on placement:
- Erosion risk at the sensor point
- Forest recovery rate
- Flood flow estimate
- Contaminant concentration

Unit-tested in `tests/lib/sensorPhysics.test.ts` — **34 tests, all passing**.

---

## Folder Structure

```
jasper-frontend/
├── app/
│   ├── page.tsx                    # Root — all top-level state lives here
│   ├── contexts/
│   │   └── AuthContext.tsx         # Login state, session cookie, role
│   ├── components/
│   │   ├── Auth/                   # LoginPage, SuperadminConfirmModal
│   │   ├── Layout/                 # TopNav, Sidebar, Footer, LiveGisLogsPanel
│   │   ├── Map/                    # JasperMap, ErosionLayer, ContaminantLayer,
│   │   │                           # BurnScarLayer, ElevationRiskLayer,
│   │   │                           # PlacedSensorLayer, PlaceSensorModal,
│   │   │                           # ThreeDView (deck.gl), and more
│   │   ├── Pages/                  # MapViewPage, DashboardPage, AiOverviewPage,
│   │   │                           # ReportsPage, ArchivesPage, AdminPage
│   │   └── UI/                     # KeyboardShortcutsHelp, shared UI components
│   └── ...
├── lib/
│   ├── api.ts                      # All fetch calls to the ML + backend APIs
│   ├── interpolation.ts            # Timeline scan interpolation
│   └── sensorPhysics.ts            # Pure physics functions (unit-tested)
├── tests/
│   └── lib/
│       └── sensorPhysics.test.ts   # 34 unit tests for physics formulas
├── public/
│   └── bluepulse-logo.svg          # BluePulse AI logo (TopNav + LoginPage)
└── convex/                         # Generated Convex types (do not edit manually)
```

---

## Authentication

Sessions use **server-side `httpOnly` cookies** — no passwords are stored in `localStorage` or `sessionStorage`. The auth check runs on first load (`AuthContext.tsx`) and shows a spinner until resolved.

Roles: `viewer` → `analyst` → `admin` → `superadmin`

The "Demo accounts" collapsible on the login page must never be removed — it is how the team logs in during development and demos.

---

## State Architecture

All shared state lives in `page.tsx` (the root component):

- `activeTab` — which page is visible
- `flyTo` — map pan/zoom target (set by sidebar sector clicks)
- `is3D`, `showErosion`, `showContaminant`, `showBurnScar`, `showElevation` — layer toggles
- `slopeDeg`, `rainfallMm`, `contaminationLevel` — digital twin slider values (shared between Map and AI Overview)
- `sectorId`, `dateFrom`, `dateTo`, `centerDate`, `timelineScans`, `interpolated` — timeline state

---

## Keyboard Shortcuts

Press **`?`** in the app to open the shortcuts panel (compact corner panel, bottom-right).

| Key | Action |
|---|---|
| `M` | Map view |
| `D` | Dashboard |
| `A` | AI Overview |
| `R` | Reports |
| `S` | Toggle sidebar |
| `3` | Toggle 2D / 3D |
| `E / F / W / L` | Toggle hazard layers |
| `+ / -` | Zoom in / out (2D only) |
| `?` | Show / hide shortcuts |
| `Esc` | Close panel or sidebar |

Note: shortcuts fire even immediately after using sliders — range inputs (`<input type="range">`) are intentionally excluded from the "don't fire shortcuts inside inputs" guard.

---

## Convex (real-time database)

The `convex/` folder is at the **repo root**, not inside `jasper-frontend/`.

Import path from frontend code:
```typescript
import { api } from "../../convex/_generated/api";
```

To run Convex in development (from repo root):
```bash
npx convex dev
```

Leave it running — it watches schema changes and auto-generates types.

---

## Running Tests

```bash
# Run all frontend unit tests
npx jest

# Run only physics tests
npx jest sensorPhysics

# Run with coverage
npx jest --coverage
```

---

## Deployment

The frontend auto-deploys to Vercel on push to `main`.

Environment variables needed on Vercel:
- `ANTHROPIC_API_KEY` — for the AI chatbot (AI Overview page)
- `NEXT_PUBLIC_CONVEX_URL` — Convex deployment URL
- Any backend API base URLs

---

_Last updated: August 5, 2026_
