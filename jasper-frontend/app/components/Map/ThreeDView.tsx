/**
 * ThreeDView.tsx — 3D risk visualization of the Jasper watershed using deck.gl.
 *
 * Renders a full-screen interactive 3D scene over real Rocky Mountain terrain:
 *   - TerrainLayer   — SRTM 30m elevation mesh with ESRI satellite imagery
 *   - PolygonLayer   — OSM 3D building footprints for the Jasper townsite
 *   - ColumnLayer    — risk score bars (height = score, colour = High/Med/Low)
 *   - ScatterplotLayer — coloured sensor dots at each monitoring position
 *
 * Data flow:
 *   1. Fetches timeline scans for all five sectors on mount
 *   2. Re-interpolates values whenever the centerDate (slider position) changes
 *   3. Column heights and colours update to reflect the current interpolated state
 *
 * Hover tooltips show the sector label, risk score, real GPS coordinates, and
 * whether the position is from a real database record or estimated.
 *
 * Loaded dynamically with ssr:false in MapViewPage — deck.gl requires WebGL.
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DeckGL from "@deck.gl/react";
import { LightingEffect, AmbientLight, DirectionalLight } from "@deck.gl/core";
import { ColumnLayer, ScatterplotLayer, PolygonLayer } from "@deck.gl/layers";
import { TerrainLayer, TripsLayer } from "@deck.gl/geo-layers";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import { fetchTimeline, fetchErosionSimulation } from "../../../lib/api";
import type { TimelineScan, SimulationResults, ModelOutput } from "../../../lib/api";
import type { PlacedSensor } from "../../../lib/terrainLookup";
import { interpolateScans } from "../../../lib/interpolation";
import type { InterpolatedState } from "../../../lib/interpolation";

// ── View ─────────────────────────────────────────────────────────────────────

const INITIAL_VIEW_STATE = {
  longitude:  -118.070,
  latitude:    52.872,
  zoom:        11.8,
  pitch:       62,           // steep angle to show Rocky Mountain terrain clearly
  bearing:    -25,
  minZoom:     10,
  maxZoom:     16,
};

// ── Terrain tiles ─────────────────────────────────────────────────────────────

// AWS Terrain Tiles — Terrarium encoding, public, no API key required
const ELEVATION_TILES = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

// Terrarium decoding: elevation (m) = R×256 + G + B/256 − 32768
const ELEVATION_DECODER = {
  rScaler:  256,
  gScaler:  1,
  bScaler:  1 / 256,
  offset:  -32768,
};

// ESRI World Imagery — free satellite tiles, no API key, much higher visual quality than OSM
// Note: ESRI uses {z}/{y}/{x} ordering (row/col), not {z}/{x}/{y}
const SURFACE_TILES = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

// ── Lighting ──────────────────────────────────────────────────────────────────

// Simulates afternoon sun over the Rockies — southwest direction, moderate elevation angle
const SUN_LIGHT   = new DirectionalLight({ color: [255, 248, 220], intensity: 1.8, direction: [-2, -3, -1] });
const SKY_AMBIENT = new AmbientLight({ color: [200, 220, 255], intensity: 0.6 });
const LIGHTING    = new LightingEffect({ SUN_LIGHT, SKY_AMBIENT });

// ── Simulation helpers ────────────────────────────────────────────────────────

const PLUME_LOOP = 1000; // animation cycle length in arbitrary time units

// Compute downstream waypoints from a source point using compass bearing.
// Returns [lon, lat, elevation] triples — elevation floats above terrain mesh.
function computePlumePath(
  startLon: number,
  startLat: number,
  directionDeg: number,
  numPoints = 12,
  stepKm = 0.35,
): [number, number, number][] {
  const kmPerDegLat = 111.0;
  const kmPerDegLon = 111.0 * Math.cos((startLat * Math.PI) / 180);
  const bearingRad  = (directionDeg * Math.PI) / 180;
  const pts: [number, number, number][] = [];
  let lon = startLon;
  let lat = startLat;
  for (let i = 0; i < numPoints; i++) {
    pts.push([lon, lat, 1180]);
    lat += (Math.cos(bearingRad) * stepKm) / kmPerDegLat;
    lon += (Math.sin(bearingRad) * stepKm) / kmPerDegLon;
  }
  return pts;
}

interface HeatPoint { lon: number; lat: number; weight: number; }

// ── Sector definitions ────────────────────────────────────────────────────────

// Sector GPS positions and elevations.
// ★ = real public-database coordinates   ○ = estimated (no public point-sensor network exists)
//
// ATH-001-W: Water Survey of Canada station 07AA001, Miette River at Jasper
//            Source: wateroffice.ec.gc.ca
// ATH-001-A: 2024 Jasper Wildfire burn-scar centroid
//            Source: Alberta Wildfire open data / NFDB fire polygon
// ATH-001-H/M/L: approximate erosion-risk zones derived from DEM terrain analysis
//                (no public point-sensor network for soil erosion in Jasper NP)
const SECTORS = [
  { id: "ATH-001-H", label: "Steep Valley Slope",           lat: 52.858,  lon: -118.092,  elevation: 1380, defaultScore: 0.87, defaultRisk: "High",   source: ""                      },
  { id: "ATH-001-M", label: "Mid-Slope Terrace",            lat: 52.870,  lon: -118.070,  elevation: 1180, defaultScore: 0.52, defaultRisk: "Medium", source: ""                      },
  { id: "ATH-001-L", label: "Lower Valley Bench",           lat: 52.884,  lon: -118.045,  elevation: 1090, defaultScore: 0.22, defaultRisk: "Low",    source: ""                      },
  { id: "ATH-001-A", label: "2024 Wildfire Burn Scar",     lat: 52.848,  lon: -118.083,  elevation: 1080, defaultScore: 0.75, defaultRisk: "High",   source: "Alberta Wildfire 2024" },
  { id: "ATH-001-W", label: "Miette River (WSC 07AA001)",  lat: 52.8639, lon: -118.1069, elevation: 1062, defaultScore: 0.44, defaultRisk: "Medium", source: "WSC 07AA001"           },
] as const;

type SectorId = typeof SECTORS[number]["id"];

// ── Visibility mapping ────────────────────────────────────────────────────────

const SECTOR_LAYER: Record<SectorId, "erosion" | "contaminant" | "burnScar"> = {
  "ATH-001-H": "erosion",
  "ATH-001-M": "erosion",
  "ATH-001-L": "erosion",
  "ATH-001-W": "contaminant",
  "ATH-001-A": "burnScar",
};

// ── Colour map ────────────────────────────────────────────────────────────────

const RISK_RGBA: Record<string, [number, number, number, number]> = {
  High:   [239, 68,  68,  220],
  Medium: [245, 158, 11,  220],
  Low:    [34,  197, 94,  220],
};

// Sensor dot colours — match the toggle dotColor props in MapViewPage
const SENSOR_COLOR: Record<"erosion" | "contaminant" | "burnScar", [number, number, number, number]> = {
  erosion:     [109, 32,  119, 255],  // #6D2077 SAIT Purple  — Soil Erosion
  contaminant: [0,   163, 224, 255],  // #00A3E0 SAIT Sky    — River Water Quality
  burnScar:    [0,   94,  184, 255],  // #005EB8 SAIT Blue   — Forest Regrowth
};


// ── Datum types ───────────────────────────────────────────────────────────────

interface SensorDot {
  id:        SectorId;
  label:     string;
  lon:       number;
  lat:       number;
  elevation: number;
  layerType: "erosion" | "contaminant" | "burnScar";
}

interface SectorDatum {
  id:          SectorId;
  label:       string;
  lat:         number;
  lon:         number;
  elevation:   number;
  score:       number;
  risk:        string;
  isActive:    boolean;
  isEstimated: boolean;
  source:      string;
}

interface OsmBuilding {
  polygon: [number, number][];
  height:  number;
}

interface ElevationZoneDatum {
  category: number;
  label:    string;
  sublabel: string;
  fill:     [number, number, number, number];
  line:     [number, number, number, number];
  polygon:  [number, number, number][];
}

interface BurnScarZoneDatum {
  kind:        "burn-scar-zone";
  label:       string;
  recovery:    number;
  statusLabel: string;
  polygon:     [number, number, number][];
  fillColor:   [number, number, number, number];
  lineColor:   [number, number, number, number];
}

interface ErosionZoneDatum {
  kind:        "erosion-zone";
  sectorId:    string;
  label:       string;
  slopeDeg:    number;
  rainfallMm:  number;
  riskLabel:   string;
  riskScore:   number | null;
  confidence:  number | null;
  polygon:     [number, number, number][];
  fillColor:   [number, number, number, number];
  lineColor:   [number, number, number, number];
}

// Static polygon configs for the three erosion monitoring zones.
// Coordinates are [lon, lat, elevation] — deck.gl format (swapped from Leaflet).
// Elevations float ~80 m above typical terrain so slabs clear the mesh surface.
const EROSION_ZONE_CONFIGS = [
  { sectorId: "ATH-001-H", label: "Steep Valley Slope",  slopeDeg: 38.5, rainfallMm: 82.0,
    polygon: [
      [-118.110, 52.866, 1460], [-118.121, 52.860, 1460], [-118.113, 52.846, 1460],
      [-118.094, 52.840, 1460], [-118.076, 52.845, 1460], [-118.074, 52.860, 1460],
      [-118.087, 52.870, 1460],
    ] as [number, number, number][],
  },
  { sectorId: "ATH-001-M", label: "Mid-Slope Terrace",   slopeDeg: 22.0, rainfallMm: 82.0,
    polygon: [
      [-118.082, 52.880, 1280], [-118.062, 52.875, 1280], [-118.056, 52.862, 1280],
      [-118.064, 52.854, 1280], [-118.080, 52.858, 1280], [-118.088, 52.870, 1280],
    ] as [number, number, number][],
  },
  { sectorId: "ATH-001-L", label: "Lower Valley Bench",  slopeDeg: 12.0, rainfallMm: 82.0,
    polygon: [
      [-118.058, 52.894, 1170], [-118.040, 52.890, 1170], [-118.032, 52.878, 1170],
      [-118.040, 52.868, 1170], [-118.056, 52.872, 1170], [-118.064, 52.884, 1170],
    ] as [number, number, number][],
  },
];

// Flood inundation threshold — mirrors ElevationRiskLayer logic for 2D/3D parity
function floodedFromCategory(waterLevelM: number): number {
  if (waterLevelM >= 4.8) return 1; // catastrophic — all zones including high ridges
  if (waterLevelM >= 4.5) return 2;
  if (waterLevelM >= 3.0) return 3;
  if (waterLevelM >= 1.5) return 4;
  if (waterLevelM >= 0.5) return 5;
  return 6; // nothing flooded
}

const FLOOD_FILL: [number, number, number, number] = [59,  130, 246, 180];
const FLOOD_LINE: [number, number, number, number] = [29,  78,  216, 220];

// RGBA colour lookup for each ML risk_label — fill and border variants
const EROSION_RISK_RGBA: Record<string, {
  fill: [number, number, number, number];
  line: [number, number, number, number];
}> = {
  High:    { fill: [220, 38,  38,  140], line: [153, 27,  27,  200] },
  Medium:  { fill: [245, 158, 11,  130], line: [217, 119, 6,   200] },
  Low:     { fill: [34,  197, 94,  120], line: [22,  163, 74,  200] },
  Unknown: { fill: [156, 163, 175, 100], line: [107, 114, 128, 150] },
};

// What each ML risk_label means in the field — shown in the 3D tooltip
const EROSION_RISK_DESC: Record<string, string> = {
  High:    "Active soil loss · burn scar destabilisation · urgent slope stabilisation needed",
  Medium:  "Moderate sediment transport · elevated runoff · monitoring & revegetation advised",
  Low:     "Minimal surface loss · stable vegetation cover · routine observation only",
  Unknown: "Awaiting ML model response",
};

// ── Forest regrowth (burn scar perimeter) ────────────────────────────────────

const FOREST_PRECIP_BASELINE = 450;
const FOREST_GROWTH_RATE     = 0.12;
const FOREST_INITIAL_RECOVERY = 0.02;

function calcForestRecovery(yearsSinceFire: number, precipMmYr: number): number {
  if (yearsSinceFire <= 0) return FOREST_INITIAL_RECOVERY;
  const rEff = FOREST_GROWTH_RATE * Math.sqrt(precipMmYr / FOREST_PRECIP_BASELINE);
  return 1 / (1 + ((1 - FOREST_INITIAL_RECOVERY) / FOREST_INITIAL_RECOVERY) * Math.exp(-rEff * yearsSinceFire));
}

// Simplified 2024 Jasper wildfire perimeter — ~35,000 ha.
// Coordinates in deck.gl [lon, lat, elevation] format (note: lon first, opposite of Leaflet).
// Floated at 1160 m (~80 m above the burn scar valley floor at ~1080 m).
const BURN_SCAR_POLYGON_3D: [number, number, number][] = [
  [-118.200, 52.938, 1160],
  [-118.135, 52.920, 1160],
  [-118.068, 52.905, 1160],
  [-118.010, 52.893, 1160],
  [-117.965, 52.872, 1160],
  [-117.945, 52.848, 1160],
  [-117.960, 52.822, 1160],
  [-117.995, 52.800, 1160],
  [-118.050, 52.778, 1160],
  [-118.110, 52.762, 1160],
  [-118.175, 52.758, 1160],
  [-118.228, 52.770, 1160],
  [-118.258, 52.795, 1160],
  [-118.258, 52.828, 1160],
  [-118.240, 52.862, 1160],
  [-118.215, 52.898, 1160],
  [-118.208, 52.925, 1160],
  [-118.200, 52.938, 1160],
];

// 3D elevation flood risk zones — same 5-class system as the 2D ElevationRiskLayer.
// Coordinates are [lon, lat, baseElevation] in deck.gl format (swapped from Leaflet's [lat, lon]).
// Each zone floats ~100 m above its typical terrain elevation so it clears the terrain mesh.
const ELEVATION_ZONE_DATA: ElevationZoneDatum[] = [
  // ── Category 1 — Minimal (Gray) — high-elevation bedrock ridges ──────────────
  {
    category: 1, label: "Category 1 — Minimal Risk", sublabel: "High ridges · stable bedrock",
    fill: [156, 163, 175, 100], line: [107, 114, 128, 140],
    polygon: [
      [-118.245, 52.972, 2200], [-118.175, 52.988, 2200], [-118.095, 52.978, 2200],
      [-118.058, 52.958, 2200], [-118.075, 52.938, 2200], [-118.145, 52.936, 2200],
      [-118.210, 52.950, 2200],
    ],
  },
  {
    category: 1, label: "Category 1 — Minimal Risk", sublabel: "High ridges · stable bedrock",
    fill: [156, 163, 175, 100], line: [107, 114, 128, 140],
    polygon: [
      [-117.942, 52.962, 2200], [-117.895, 52.974, 2200], [-117.848, 52.952, 2200],
      [-117.838, 52.918, 2200], [-117.862, 52.898, 2200], [-117.902, 52.893, 2200],
      [-117.932, 52.914, 2200], [-117.942, 52.942, 2200],
    ],
  },
  // ── Category 2 — Low (Orange) — upper forested slopes ────────────────────────
  {
    category: 2, label: "Category 2 — Low Risk", sublabel: "Upper slopes · stable terrain",
    fill: [245, 158, 11, 100], line: [217, 119, 6, 140],
    polygon: [
      [-118.210, 52.942, 1900], [-118.158, 52.958, 1900], [-118.105, 52.952, 1900],
      [-118.078, 52.935, 1900], [-118.068, 52.920, 1900], [-118.092, 52.906, 1900],
      [-118.132, 52.913, 1900], [-118.172, 52.928, 1900],
    ],
  },
  {
    category: 2, label: "Category 2 — Low Risk", sublabel: "Upper slopes · stable terrain",
    fill: [245, 158, 11, 100], line: [217, 119, 6, 140],
    polygon: [
      [-118.012, 52.942, 1900], [-117.970, 52.953, 1900], [-117.930, 52.936, 1900],
      [-117.920, 52.912, 1900], [-117.938, 52.893, 1900], [-117.965, 52.884, 1900],
      [-117.985, 52.896, 1900], [-117.997, 52.920, 1900], [-118.018, 52.934, 1900],
    ],
  },
  // ── Category 3 — Moderate (Green) — mid-elevation transitional ───────────────
  {
    category: 3, label: "Category 3 — Moderate Risk", sublabel: "Transitional terrain · partial burn",
    fill: [34, 197, 94, 100], line: [22, 163, 74, 140],
    polygon: [
      [-118.052, 52.902, 1500], [-118.020, 52.915, 1500], [-117.988, 52.906, 1500],
      [-117.972, 52.888, 1500], [-117.965, 52.868, 1500], [-117.975, 52.852, 1500],
      [-118.005, 52.845, 1500], [-118.024, 52.858, 1500], [-118.038, 52.877, 1500],
      [-118.044, 52.892, 1500],
    ],
  },
  {
    category: 3, label: "Category 3 — Moderate Risk", sublabel: "Transitional terrain · partial burn",
    fill: [34, 197, 94, 100], line: [22, 163, 74, 140],
    polygon: [
      [-118.105, 52.922, 1500], [-118.072, 52.933, 1500], [-118.038, 52.922, 1500],
      [-118.033, 52.904, 1500], [-118.058, 52.896, 1500], [-118.092, 52.904, 1500],
    ],
  },
  // ── Category 4 — High (Blue) — Athabasca / Miette river corridors ────────────
  {
    category: 4, label: "Category 4 — High Risk", sublabel: "River corridor · flood-prone lowlands",
    fill: [59, 130, 246, 110], line: [29, 78, 216, 150],
    polygon: [
      [-118.188, 52.898, 1180], [-118.145, 52.907, 1180], [-118.098, 52.902, 1180],
      [-118.062, 52.889, 1180], [-118.042, 52.876, 1180], [-118.044, 52.862, 1180],
      [-118.068, 52.860, 1180], [-118.092, 52.874, 1180], [-118.122, 52.886, 1180],
      [-118.160, 52.894, 1180],
    ],
  },
  {
    category: 4, label: "Category 4 — High Risk", sublabel: "River corridor · flood-prone lowlands",
    fill: [59, 130, 246, 110], line: [29, 78, 216, 150],
    polygon: [
      [-118.222, 52.884, 1180], [-118.205, 52.872, 1180], [-118.215, 52.862, 1180],
      [-118.238, 52.865, 1180], [-118.248, 52.876, 1180], [-118.238, 52.887, 1180],
    ],
  },
  // ── Category 5 — Extreme (Red) — 2024 wildfire burn scar ─────────────────────
  {
    category: 5, label: "Category 5 — Extreme Risk", sublabel: "Active burn scar · extreme erosion",
    fill: [239, 68, 68, 110], line: [185, 28, 28, 150],
    polygon: [
      [-118.110, 52.872, 1200], [-118.128, 52.862, 1200], [-118.135, 52.846, 1200],
      [-118.120, 52.830, 1200], [-118.098, 52.816, 1200], [-118.068, 52.812, 1200],
      [-118.044, 52.824, 1200], [-118.035, 52.842, 1200], [-118.046, 52.860, 1200],
      [-118.065, 52.874, 1200], [-118.088, 52.876, 1200],
    ],
  },
  {
    category: 5, label: "Category 5 — Extreme Risk", sublabel: "Active burn scar · extreme erosion",
    fill: [239, 68, 68, 110], line: [185, 28, 28, 150],
    polygon: [
      [-118.032, 52.857, 1200], [-118.015, 52.846, 1200], [-118.022, 52.830, 1200],
      [-118.044, 52.820, 1200], [-118.058, 52.834, 1200], [-118.050, 52.852, 1200],
    ],
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

// Pin colours for stakeholder-placed sensors — one per sensor type
const PLACED_COL_COLOR: Record<string, [number, number, number, number]> = {
  forest:  [34,  197, 94,  220],
  erosion: [245, 158, 11,  220],
  water:   [0,   163, 224, 220],
  flood:   [59,  130, 246, 220],
};

// Normalise sim results to a 0-1 risk score for column height
function placedSensorScore(sensor: PlacedSensor): number {
  const { erosionRateTPerHaYr, forestRecoveryPct, floodFlowM3s, contaminantConcNorm } =
    sensor.simulationResults;
  switch (sensor.sensorType) {
    case "erosion": return Math.min(1, (erosionRateTPerHaYr ?? 0) / 6);
    case "forest":  return 1 - (forestRecoveryPct ?? 100) / 100;
    case "flood":   return Math.min(1, (floodFlowM3s ?? 0) / 50);
    case "water":   return contaminantConcNorm ?? 0;
  }
}

interface PlacedSensorDatum extends PlacedSensor {
  score: number;
}

interface Props {
  centerDate:          string;
  activeSectorId:      string | null;
  onSectorClick:       (id: string) => void;
  showErosion:         boolean;
  showContaminant:     boolean;
  showBurnScar:        boolean;
  showElevation:       boolean;
  simulationResults:   SimulationResults | null;
  /** Scenario panel: contamination level 0–1 (drives plume colour + length) */
  contaminationLevel?: number;
  /** Scenario panel: hours to project forward (extends plume path) */
  projectionHours?:    number;
  /** Soil erosion panel: slope angle in degrees — syncs polygon colors to panel */
  slopeDeg?:           number;
  /** Soil erosion panel: rainfall in mm — syncs polygon colors to panel */
  rainfallMm?:         number;
  /** Flood elevation panel: water level rise in metres — drives elevation zone flood colors */
  waterLevelM?:        number;
  /** Forest growth panel: years since fire — drives burn scar polygon color */
  yearsSinceFire?:     number;
  /** Forest growth panel: annual precipitation mm/yr — drives burn scar polygon color */
  precipMmYr?:         number;
  /** Stakeholder-placed sensor pins from MapViewPage */
  placedSensors?:      PlacedSensor[];
}

/**
 * ThreeDView
 * Deck.gl 3D risk visualization.  Fetches timeline data for all five sectors
 * in parallel on mount and re-renders column heights whenever the slider moves.
 *
 * @param centerDate     - current slider position as ISO date
 * @param activeSectorId - ID of the sector the user has selected
 * @param onSectorClick  - handler called when a column or sensor dot is clicked
 * @param showErosion    - visibility toggle for erosion columns
 * @param showContaminant - visibility toggle for contaminant column
 * @param showBurnScar   - visibility toggle for burn scar column
 */
export function ThreeDView({
  centerDate,
  activeSectorId,
  onSectorClick,
  showErosion,
  showContaminant,
  showBurnScar,
  showElevation,
  simulationResults,
  contaminationLevel = 0.72,
  projectionHours    = 24,
  slopeDeg           = 22,
  rainfallMm         = 82,
  waterLevelM        = 1.5,
  yearsSinceFire     = 2,
  precipMmYr         = 450,
  placedSensors      = [],
}: Props) {
  const floodCat = floodedFromCategory(waterLevelM);

  // Same RUSLE formula as SoilErosionPanel so 3D polygon colors stay in sync with the panel
  const erosionRate = slopeDeg > 0 && rainfallMm > 0
    ? 2.0 * Math.pow(rainfallMm / 82, 1.2) * Math.pow(slopeDeg / 22, 1.4)
    : 0;
  const erosionRiskLabel: "High" | "Medium" | "Low" =
    erosionRate >= 4.0 ? "High" : erosionRate >= 1.5 ? "Medium" : "Low";

  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);

  const handleZoomIn  = () => setViewState(v => ({ ...v, zoom: Math.min(v.zoom + 1, INITIAL_VIEW_STATE.maxZoom),  transitionDuration: 250 }));
  const handleZoomOut = () => setViewState(v => ({ ...v, zoom: Math.max(v.zoom - 1, INITIAL_VIEW_STATE.minZoom), transitionDuration: 250 }));

  const [sectorScans, setSectorScans] = useState<Record<string, TimelineScan[]>>(
    () => Object.fromEntries(SECTORS.map(s => [s.id, []]))
  );
  const [sectorInterps, setSectorInterps] = useState<Record<string, InterpolatedState | null>>(
    () => Object.fromEntries(SECTORS.map(s => [s.id, null]))
  );

  // Fetch all five sector timelines in parallel on mount
  useEffect(() => {
    let cancelled = false;
    SECTORS.forEach(async (s) => {
      try {
        const data = await fetchTimeline(s.id);
        if (!cancelled) setSectorScans(prev => ({ ...prev, [s.id]: data.scans }));
      } catch {
        // backend has no scans for this sector yet — keep empty array
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Re-interpolate every sector on every slider tick
  useEffect(() => {
    const ms = new Date(centerDate).getTime();
    setSectorInterps(
      Object.fromEntries(
        SECTORS.map(s => [s.id, interpolateScans(sectorScans[s.id] ?? [], ms)])
      )
    );
  }, [centerDate, sectorScans]);

  const [buildings, setBuildings] = useState<OsmBuilding[]>([]);

  // Fetch ML erosion simulation for each of the three monitored zones
  const [erosionML, setErosionML] = useState<Record<string, ModelOutput | null>>({});
  useEffect(() => {
    EROSION_ZONE_CONFIGS.forEach((cfg) => {
      fetchErosionSimulation(cfg.sectorId, cfg.slopeDeg, cfg.rainfallMm)
        .then((data) => setErosionML((prev) => ({ ...prev, [cfg.sectorId]: data })))
        .catch(()  => setErosionML((prev) => ({ ...prev, [cfg.sectorId]: null })));
    });
  }, []);

  // Contaminant plume animation
  const [plumeTime, setPlumeTime] = useState(0);
  const velocityRef = useRef(0.44);
  useEffect(() => {
    velocityRef.current = simulationResults?.contaminant?.contaminant_vector?.velocity ?? 0.44;
  }, [simulationResults?.contaminant?.contaminant_vector?.velocity]);
  useEffect(() => {
    let frame: number;
    const tick = () => {
      setPlumeTime(t => (t + 1 + velocityRef.current * 3) % PLUME_LOOP);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Fetch OSM building footprints for Jasper townsite on mount
  useEffect(() => {
    const query = `
      [out:json][timeout:25];
      (way["building"](52.84,-118.16,52.92,-118.03););
      out body;>;out skel qt;
    `;
    fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`)
      .then(r => r.json())
      .then((json: { elements: { type: string; id: number; lat?: number; lon?: number; nodes?: number[]; tags?: Record<string, string> }[] }) => {
        const nodes = new Map<number, [number, number]>();
        for (const el of json.elements) {
          if (el.type === "node" && el.lon != null && el.lat != null)
            nodes.set(el.id, [el.lon, el.lat]);
        }
        const polys: OsmBuilding[] = [];
        for (const el of json.elements) {
          if (el.type !== "way" || !el.nodes) continue;
          const coords = el.nodes.map(id => nodes.get(id)).filter((c): c is [number, number] => c != null);
          if (coords.length < 3) continue;
          const levels = parseFloat(el.tags?.["building:levels"] ?? "2");
          const tagged = parseFloat(el.tags?.["height"] ?? "0");
          polys.push({ polygon: coords, height: tagged > 0 ? tagged : levels * 3.2 });
        }
        setBuildings(polys);
      })
      .catch(() => { /* Overpass unavailable — render without buildings */ });
  }, []);

  // Build burn scar perimeter polygon — color driven by logistic regrowth model
  const burnScarZoneData = useMemo<BurnScarZoneDatum[]>(() => {
    const recovery = calcForestRecovery(yearsSinceFire, precipMmYr);
    const statusLabel =
      recovery < 0.10 ? "Early Pioneer"
      : recovery < 0.30 ? "Shrub · Herb"
      : recovery < 0.60 ? "Sapling Stage"
      : "Canopy Closure";
    const rgb: [number, number, number] =
      recovery < 0.10 ? [239, 68,  68]
      : recovery < 0.30 ? [245, 158, 11]
      : recovery < 0.60 ? [132, 204, 22]
      : [34,  197, 94];
    return [{
      kind:        "burn-scar-zone" as const,
      label:       "2024 Jasper Wildfire Perimeter",
      recovery,
      statusLabel,
      polygon:     BURN_SCAR_POLYGON_3D,
      fillColor:   [...rgb, 55]  as [number, number, number, number],
      lineColor:   [...rgb, 200] as [number, number, number, number],
    }];
  }, [yearsSinceFire, precipMmYr]);

  // Build erosion zone polygons — color driven by RUSLE risk label for instant slider sync
  const erosionZoneData = useMemo<ErosionZoneDatum[]>(
    () => EROSION_ZONE_CONFIGS.map((cfg) => {
      const ml     = erosionML[cfg.sectorId];
      const colors = EROSION_RISK_RGBA[erosionRiskLabel] ?? EROSION_RISK_RGBA.Unknown;
      return {
        kind:       "erosion-zone" as const,
        sectorId:   cfg.sectorId,
        label:      cfg.label,
        slopeDeg,
        rainfallMm,
        riskLabel:  erosionRiskLabel,
        riskScore:  ml?.risk_score  ?? null,
        confidence: ml?.confidence  ?? null,
        polygon:    cfg.polygon,
        fillColor:  colors.fill,
        lineColor:  colors.line,
      };
    }),
    [erosionRiskLabel, erosionML, slopeDeg, rainfallMm]
  );

  const data = useMemo<SectorDatum[]>(
    () => {
      const visible: Record<string, boolean> = {
        erosion:     showErosion,
        contaminant: showContaminant,
        burnScar:    showBurnScar,
      };
      return SECTORS
        .filter(s => visible[SECTOR_LAYER[s.id]])
        .map((s) => {
          const interp = sectorInterps[s.id];
          return {
            id:          s.id,
            label:       s.label,
            lat:         s.lat,
            lon:         s.lon,
            elevation:   s.elevation,
            score:       interp ? interp.erosion_risk_score : s.defaultScore,
            risk:        interp ? interp.erosion_risk       : s.defaultRisk,
            isActive:    s.id === activeSectorId,
            isEstimated: interp ? interp.is_estimated : false,
            source:      s.source,
          };
        });
    },
    [sectorInterps, showErosion, showContaminant, showBurnScar, activeSectorId]
  );

  const liveCount = useMemo(
    () => SECTORS.filter(s => (sectorScans[s.id]?.length ?? 0) > 0).length,
    [sectorScans]
  );

  // Sensor dots — SECTORS and SECTOR_LAYER are module-level constants so deps are empty
  const sensorDots = useMemo<SensorDot[]>(
    () => SECTORS.map(s => ({
      id:        s.id,
      label:     s.label,
      lon:       s.lon,
      lat:       s.lat,
      elevation: s.elevation + 50,
      layerType: SECTOR_LAYER[s.id],
    })),
    []
  );

  // ── Simulation layer data ─────────────────────────────────────────────────
  // Use AI simulation score for the High zone; derive Medium/Low proportionally.
  // Falls back to interpolated live-sensor scores when no simulation has run yet.
  const erosionScore = simulationResults?.erosion?.risk_score
    ?? (sectorInterps["ATH-001-H"]?.erosion_risk_score ?? 0.87);

  const heatPoints = useMemo<HeatPoint[]>(
    () => [
      { lon: -118.092, lat: 52.858, weight: erosionScore },
      { lon: -118.100, lat: 52.851, weight: erosionScore * 0.80 },
      { lon: -118.085, lat: 52.862, weight: erosionScore * 0.70 },
      { lon: -118.070, lat: 52.870, weight: erosionScore * 0.55 },
      { lon: -118.078, lat: 52.865, weight: erosionScore * 0.45 },
      { lon: -118.057, lat: 52.877, weight: erosionScore * 0.35 },
      { lon: -118.045, lat: 52.884, weight: erosionScore * 0.22 },
    ],
    [erosionScore]
  );

  const directionDeg = simulationResults?.contaminant?.contaminant_vector?.direction_deg ?? 180;

  // Scale plume waypoints and step size from the scenario sliders.
  // More contamination → more waypoints (longer visible trail).
  // More hours → larger step size (plume front reaches further downstream).
  const plumeNumPts = Math.max(4, Math.round(4 + contaminationLevel * 18)); // 4–22 pts
  const plumeStepKm = Math.min(1.8, 0.35 + (projectionHours / 72) * 1.45); // 0.35–1.8 km

  // Plume colour and opacity shift blue → amber → red as contamination rises
  const plumeColor: [number, number, number] =
    contaminationLevel >= 0.7 ? [239, 68,  68]  // red
    : contaminationLevel >= 0.4 ? [245, 158, 11]  // amber
    : [0, 163, 224];                              // sky blue

  const plumeOpacity     = 0.45 + contaminationLevel * 0.45; // 0.45–0.90
  const plumeTrailLength = 150  + Math.round(contaminationLevel * 280); // 150–430

  const plumeData = useMemo(
    () => showContaminant ? [{
      path:       computePlumePath(-118.1069, 52.8639, directionDeg, plumeNumPts, plumeStepKm),
      timestamps: Array.from({ length: plumeNumPts }, (_, i) => i * (PLUME_LOOP / plumeNumPts)),
    }] : [],
    [showContaminant, directionDeg, plumeNumPts, plumeStepKm]
  );

  // Placed sensor columns + dots — scored for column height, colored by type
  const placedSensorData = useMemo<PlacedSensorDatum[]>(
    () => placedSensors.map((s) => ({ ...s, score: placedSensorScore(s) })),
    [placedSensors]
  );

  const layers = [
    // 3D terrain — high-res elevation mesh with satellite imagery draped on top
    new TerrainLayer({
      id:               "terrain",
      minZoom:          0,
      maxZoom:          15,
      strategy:         "no-overlap",
      elevationDecoder: ELEVATION_DECODER,
      elevationData:    ELEVATION_TILES,
      texture:          SURFACE_TILES,
      elevationScale:   1,
      meshMaxError:     1.5,   // default 4m — lower = sharper ridgelines and valleys
    }),

    // Erosion risk heatmap — continuous risk surface driven by AI simulation score
    new HeatmapLayer<HeatPoint>({
      id:           "erosion-heatmap",
      data:         showErosion ? heatPoints : [],
      getPosition:  (d) => [d.lon, d.lat],
      getWeight:    (d) => d.weight,
      radiusPixels: 100,
      intensity:    1.4,
      threshold:    0.05,
      opacity:      0.55,
      colorRange: [
        [34,  197, 94],
        [132, 204, 22],
        [234, 179, 8],
        [245, 158, 11],
        [239, 68,  68],
        [185, 28,  28],
      ],
    }),

    // Contaminant plume — colour, opacity, and length driven by scenario sliders
    new TripsLayer({
      id:             "contaminant-plume",
      data:           plumeData,
      getPath:        (d) => d.path,
      getTimestamps:  (d) => d.timestamps,
      getColor:       plumeColor,
      opacity:        plumeOpacity,
      widthMinPixels: 4,
      trailLength:    plumeTrailLength,
      currentTime:    plumeTime,
    }),

    // Elevation flood risk zones — same 5-class system as the 2D map, floating as thin slabs
    // above their respective terrain elevations (cat1 ridges at 2200m, cat5 burn scar at 1200m)
    new PolygonLayer<ElevationZoneDatum>({
      id:                 "elevation-risk-zones",
      data:               showElevation ? ELEVATION_ZONE_DATA : [],
      getPolygon:         (d) => d.polygon,
      getElevation:       30,
      getFillColor:       (d) => d.category >= floodCat ? FLOOD_FILL : d.fill,
      getLineColor:       (d) => d.category >= floodCat ? FLOOD_LINE : d.line,
      lineWidthMinPixels: 1,
      extruded:           true,
      pickable:           true,
      opacity:            0.75,
      updateTriggers:     { getFillColor: [floodCat], getLineColor: [floodCat] },
      material: {
        ambient:       0.55,
        diffuse:       0.45,
        shininess:     4,
        specularColor: [255, 255, 255],
      },
    }),

    // 2024 Jasper wildfire perimeter — large semi-transparent slab, colour tracks forest recovery sliders
    new PolygonLayer<BurnScarZoneDatum>({
      id:                 "burn-scar-perimeter",
      data:               showBurnScar ? burnScarZoneData : [],
      getPolygon:         (d) => d.polygon,
      getElevation:       15,
      getFillColor:       (d) => d.fillColor,
      getLineColor:       (d) => d.lineColor,
      lineWidthMinPixels: 1,
      extruded:           true,
      pickable:           true,
      opacity:            0.85,
      updateTriggers:     { getFillColor: [yearsSinceFire, precipMmYr], getLineColor: [yearsSinceFire, precipMmYr] },
      material: { ambient: 0.55, diffuse: 0.45, shininess: 4, specularColor: [255, 255, 255] },
    }),

    // Soil erosion risk zones — ML-coloured extruded slabs, one per monitored sector
    new PolygonLayer<ErosionZoneDatum>({
      id:                 "erosion-risk-zones",
      data:               showErosion ? erosionZoneData : [],
      getPolygon:         (d) => d.polygon,
      getElevation:       25,
      getFillColor:       (d) => d.fillColor,
      getLineColor:       (d) => d.lineColor,
      lineWidthMinPixels: 1,
      extruded:           true,
      pickable:           true,
      opacity:            0.80,
      updateTriggers: { getFillColor: [erosionRiskLabel] },
      material: {
        ambient:       0.55,
        diffuse:       0.45,
        shininess:     4,
        specularColor: [255, 255, 255],
      },
    }),

    // OSM 3D buildings — extruded footprints from Overpass API
    new PolygonLayer<OsmBuilding>({
      id:                   "osm-buildings",
      data:                 buildings,
      getPolygon:           (d) => d.polygon,
      getElevation:         (d) => d.height,
      getFillColor:         [235, 228, 215, 210],
      getLineColor:         [180, 170, 155, 120],
      lineWidthMinPixels:   1,
      extruded:             true,
      pickable:             false,
      material: {
        ambient:       0.35,
        diffuse:       0.65,
        shininess:     24,
        specularColor: [255, 255, 255],
      },
    }),

    // Sensor location dots — visual only, not pickable (hit-target layer below handles events)
    new ScatterplotLayer<SensorDot>({
      id:                  "sensor-dots",
      data:                sensorDots,
      getPosition:         (d) => [d.lon, d.lat, d.elevation],
      getFillColor:        (d) => SENSOR_COLOR[d.layerType],
      getRadius:           160,
      radiusMinPixels:     6,
      radiusMaxPixels:     12,
      filled:              true,
      stroked:             false,
      pickable:            false,
    }),

    // Risk columns — bases anchored at sector terrain elevation, height = risk score
    new ColumnLayer<SectorDatum>({
      id:             "sector-columns",
      data,
      diskResolution: 24,
      radius:         200,
      extruded:       true,
      pickable:       true,
      opacity:        0.88,
      getPosition:    (d) => [d.lon, d.lat, d.elevation],
      getElevation:   (d) => d.score * 900,
      getFillColor:   (d) => RISK_RGBA[d.risk] ?? RISK_RGBA.Medium,
      getLineColor:   [20, 20, 20, 60],
      lineWidthMinPixels: 1,
      updateTriggers: {
        getElevation: [centerDate, showErosion, showContaminant, showBurnScar],
        getFillColor:  [centerDate, showErosion, showContaminant, showBurnScar],
      },
      onClick: (info) => {
        if (info.object) onSectorClick(info.object.id);
      },
    }),

    // Transparent hit-target layer for sensor dots — rendered last so it wins picking over columns.
    // Larger radius makes hover + click reliable without changing the visual dot size.
    new ScatterplotLayer<SensorDot>({
      id:              "sensor-dots-hit",
      data:            sensorDots,
      getPosition:     (d) => [d.lon, d.lat, d.elevation],
      getFillColor:    [0, 0, 0, 0],
      getLineColor:    [0, 0, 0, 0],
      getRadius:       350,
      radiusMinPixels: 20,
      radiusMaxPixels: 32,
      filled:          true,
      stroked:         false,
      pickable:        true,
      onClick: (info) => {
        if (info.object) onSectorClick(info.object.id);
      },
    }),

    // Placed sensor coverage rings — radius in metres matches the 2D dashed circle
    new ScatterplotLayer<PlacedSensorDatum>({
      id:                 "placed-sensor-rings",
      data:               placedSensorData,
      getPosition:        (d) => [d.lon, d.lat, d.elevationM],
      getFillColor:       (d): [number, number, number, number] => {
        const [r, g, b] = PLACED_COL_COLOR[d.sensorType] ?? PLACED_COL_COLOR.erosion;
        return [r, g, b, 18];
      },
      getLineColor:       (d): [number, number, number, number] => {
        const [r, g, b] = PLACED_COL_COLOR[d.sensorType] ?? PLACED_COL_COLOR.erosion;
        return [r, g, b, 150];
      },
      getRadius:          (d) => d.radiusM,
      radiusUnits:        "meters",
      filled:             true,
      stroked:            true,
      lineWidthMinPixels: 1.5,
      pickable:           false,
      updateTriggers:     { getRadius: [placedSensors], getFillColor: [placedSensors], getLineColor: [placedSensors] },
    }),

    // Stakeholder-placed sensor columns — height driven by sim score, colour by sensor type
    new ColumnLayer<PlacedSensorDatum>({
      id:             "placed-sensor-columns",
      data:           placedSensorData,
      diskResolution: 20,
      radius:         140,
      extruded:       true,
      pickable:       true,
      opacity:        0.90,
      getPosition:    (d) => [d.lon, d.lat, d.elevationM],
      getElevation:   (d) => Math.max(80, d.score * 700),
      getFillColor:   (d) => PLACED_COL_COLOR[d.sensorType] ?? PLACED_COL_COLOR.erosion,
      getLineColor:   [20, 20, 20, 80],
      lineWidthMinPixels: 1,
      updateTriggers: { getElevation: [placedSensors], getFillColor: [placedSensors] },
    }),

    // Placed sensor dots — visual marker at column top
    new ScatterplotLayer<PlacedSensorDatum>({
      id:              "placed-sensor-dots",
      data:            placedSensorData,
      getPosition:     (d) => [d.lon, d.lat, d.elevationM + Math.max(80, d.score * 700) + 40],
      getFillColor:    (d) => PLACED_COL_COLOR[d.sensorType] ?? PLACED_COL_COLOR.erosion,
      getRadius:       130,
      radiusMinPixels: 5,
      radiusMaxPixels: 10,
      filled:          true,
      stroked:         true,
      getLineColor:    [255, 255, 255, 200],
      lineWidthMinPixels: 1.5,
      pickable:        true,
      updateTriggers:  { getPosition: [placedSensors], getFillColor: [placedSensors] },
    }),
  ];

  return (
    <div className="relative w-full h-full">
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: vs }) => setViewState(vs as typeof INITIAL_VIEW_STATE)}
        controller
        layers={layers}
        effects={[LIGHTING]}
        getTooltip={({ object }: { object?: SectorDatum | SensorDot | ElevationZoneDatum | ErosionZoneDatum | BurnScarZoneDatum | PlacedSensorDatum }) => {
          if (!object) return null;

          const SENSOR_TYPE_LABEL: Record<"erosion" | "contaminant" | "burnScar", string> = {
            erosion:     "Soil Erosion Sensor",
            contaminant: "River Water Quality Sensor",
            burnScar:    "Forest Regrowth Sensor",
          };

          // Burn scar perimeter hover — show regrowth stage + recovery %
          if ("kind" in object && object.kind === "burn-scar-zone") {
            const z = object as BurnScarZoneDatum;
            const hex =
              z.recovery < 0.10 ? "#ef4444"
              : z.recovery < 0.30 ? "#f59e0b"
              : z.recovery < 0.60 ? "#84cc16"
              : "#22c55e";
            return {
              html: `
                <div style="
                  background:#1e293b;color:#f1f5f9;
                  padding:10px 14px;border-radius:10px;
                  font-size:12px;line-height:1.7;min-width:220px;
                  box-shadow:0 4px 20px rgba(0,0,0,.4);
                ">
                  <div style="font-weight:700;margin-bottom:2px;">ATH-001-A · Forest Regrowth Sensor</div>
                  <div style="color:#64748b;font-size:10px;margin-bottom:8px;">${z.label} · ~35,000 ha · Alberta Wildfire 2024</div>
                  <div style="
                    display:inline-flex;align-items:center;gap:6px;
                    padding:3px 8px;border-radius:4px;margin-bottom:8px;
                    background:rgba(255,255,255,0.07);border:1px solid ${hex};
                  ">
                    <span style="width:8px;height:8px;border-radius:50%;background:${hex};flex-shrink:0;"></span>
                    <span style="font-size:11px;font-weight:700;color:${hex};">
                      ${z.statusLabel} · ${(z.recovery * 100).toFixed(1)}% recovery
                    </span>
                  </div>
                  <div style="font-size:10px;color:#94a3b8;">Adjust Forest Growth panel sliders to see regrowth stages</div>
                </div>`,
              style: { background: "none" },
            };
          }

          // Erosion zone hover — show ML risk level + description
          if ("kind" in object && object.kind === "erosion-zone") {
            const z = object as ErosionZoneDatum;
            const hexFill: Record<string, string> = {
              High: "#dc2626", Medium: "#f59e0b", Low: "#22c55e", Unknown: "#9ca3af",
            };
            const hexBadgeBg: Record<string, string> = {
              High: "#fee2e2", Medium: "#fef3c7", Low: "#dcfce7", Unknown: "#f3f4f6",
            };
            const hex    = hexFill[z.riskLabel]    ?? hexFill.Unknown;
            const badgeBg = hexBadgeBg[z.riskLabel] ?? hexBadgeBg.Unknown;
            const desc   = EROSION_RISK_DESC[z.riskLabel] ?? EROSION_RISK_DESC.Unknown;
            const scoreStr = z.riskScore !== null ? ` · ${(z.riskScore * 100).toFixed(0)}%` : "";
            const confStr  = z.confidence !== null ? `Model confidence ${(z.confidence * 100).toFixed(0)}%` : "";
            return {
              html: `
                <div style="
                  background:#1e293b;color:#f1f5f9;
                  padding:10px 14px;border-radius:10px;
                  font-size:12px;line-height:1.7;min-width:220px;
                  box-shadow:0 4px 20px rgba(0,0,0,.4);
                ">
                  <div style="font-weight:700;margin-bottom:2px;">${z.label}</div>
                  <div style="color:#64748b;font-size:10px;margin-bottom:8px;">
                    ${z.sectorId} · ${z.slopeDeg}° slope · ${z.rainfallMm} mm rain
                  </div>
                  <div style="
                    display:inline-flex;align-items:center;gap:6px;
                    padding:3px 8px;border-radius:4px;margin-bottom:8px;
                    background:${badgeBg};border:1px solid ${hex};
                  ">
                    <span style="width:8px;height:8px;border-radius:50%;background:${hex};flex-shrink:0;"></span>
                    <span style="font-size:11px;font-weight:700;color:${hex};">
                      ${z.riskLabel} Erosion Risk${scoreStr}
                    </span>
                  </div>
                  <div style="font-size:10px;color:#94a3b8;line-height:1.5;margin-bottom:4px;">${desc}</div>
                  ${confStr ? `<div style="font-size:10px;color:#64748b;">${confStr}</div>` : ""}
                </div>`,
              style: { background: "none" },
            };
          }

          // Elevation zone hover — show risk class + flood state (dynamic with slider)
          if ("category" in object) {
            const zone    = object as ElevationZoneDatum;
            const flooded = zone.category >= floodCat;
            const HEX: Record<number, string> = {
              1: "#9ca3af", 2: "#f59e0b", 3: "#22c55e", 4: "#3b82f6", 5: "#ef4444",
            };
            const hex = flooded ? "#3b82f6" : (HEX[zone.category] ?? "#9ca3af");
            return {
              html: `
                <div style="
                  background:#1e293b;color:#f1f5f9;
                  padding:10px 14px;border-radius:10px;
                  font-size:12px;line-height:1.7;
                  box-shadow:0 4px 20px rgba(0,0,0,.4);
                ">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                    <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${hex};flex-shrink:0;"></span>
                    <div style="font-weight:700;">${zone.label}${flooded ? " · ⚠ Flooded" : ""}</div>
                  </div>
                  <div style="color:#94a3b8;font-size:11px;">${zone.sublabel}</div>
                  <div style="
                    margin-top:5px;padding:2px 8px;border-radius:4px;
                    background:${flooded ? "#1e3a8a" : "rgba(255,255,255,0.06)"};
                    border:1px solid ${flooded ? "#3b82f6" : hex};
                    font-size:10px;font-weight:700;
                    color:${flooded ? "#93c5fd" : hex};
                  ">
                    ${flooded
                      ? `⚠ Flood Inundation Active · +${waterLevelM.toFixed(1)} m`
                      : `✓ Not flooded at +${waterLevelM.toFixed(1)} m`}
                  </div>
                  <div style="color:#64748b;font-size:10px;margin-top:4px;">
                    ${flooded ? `⚠ Inundated · ` : ""}Elevation Risk Class ${zone.category}
                  </div>
                </div>`,
              style: { background: "none" },
            };
          }

          // Sensor dot hover — show name + coordinates + dynamic risk level
          if ("layerType" in object) {
            const latStr = `${Math.abs(object.lat).toFixed(4)}°${object.lat >= 0 ? "N" : "S"}`;
            const lonStr = `${Math.abs(object.lon).toFixed(4)}°${object.lon >= 0 ? "E" : "W"}`;
            // Dynamic risk line per sensor type
            const dynamicLine = object.layerType === "contaminant"
              ? `<div style="font-size:11px;font-weight:700;color:${
                  contaminationLevel >= 0.7 ? "#ef4444" : contaminationLevel >= 0.4 ? "#f59e0b" : "#00A3E0"
                };">
                  ${contaminationLevel >= 0.7 ? "High" : contaminationLevel >= 0.4 ? "Medium" : "Low"} Risk
                  · ${(contaminationLevel * 100).toFixed(0)}% contamination
                </div>`
              : object.layerType === "burnScar"
              ? `<div style="font-size:11px;font-weight:700;color:#22c55e;">
                  Forest recovery in progress · adjust Forest Growth panel
                </div>`
              : "";
            return {
              html: `
                <div style="
                  background:#1e293b;color:#f1f5f9;
                  padding:10px 14px;border-radius:10px;
                  font-size:12px;line-height:1.7;
                  box-shadow:0 4px 20px rgba(0,0,0,.4);
                ">
                  <div style="font-weight:700;margin-bottom:4px;">${object.label}</div>
                  <div style="color:#94a3b8;font-size:11px;margin-bottom:4px;">${SENSOR_TYPE_LABEL[object.layerType]}</div>
                  ${dynamicLine}
                  <div>ID: <span style="color:#94a3b8">${object.id}</span></div>
                  <div>Location: <span style="color:#94a3b8">${latStr}, ${lonStr}</span></div>
                  <div style="color:#64748b;font-size:10px;margin-top:4px;">Click to select sector</div>
                </div>`,
              style: { background: "none" },
            };
          }

          // Placed sensor hover — localId is unique to PlacedSensorDatum; must check before "score"
          if ("localId" in object) {
            const p = object as PlacedSensorDatum;
            const PLACED_TYPE_LABEL: Record<string, string> = {
              forest: "Forest Regrowth", erosion: "Soil Erosion",
              water: "Water Quality", flood: "Flood Monitor",
            };
            const PLACED_TYPE_HEX: Record<string, string> = {
              forest: "#22c55e", erosion: "#f59e0b", water: "#00A3E0", flood: "#3b82f6",
            };
            const hex = PLACED_TYPE_HEX[p.sensorType] ?? "#94a3b8";
            const sim = p.simulationResults;
            const simLines = [
              sim.erosionRateTPerHaYr !== undefined
                ? `<div>Erosion: <span style="font-weight:600">${sim.erosionRateTPerHaYr.toFixed(2)} t/ha/yr</span> <span style="color:${sim.erosionRiskLabel === "High" ? "#ef4444" : sim.erosionRiskLabel === "Medium" ? "#f59e0b" : "#22c55e"}">(${sim.erosionRiskLabel})</span></div>`
                : "",
              sim.forestRecoveryPct !== undefined
                ? `<div>Forest recovery: <span style="font-weight:600">${sim.forestRecoveryPct.toFixed(1)}%</span></div>`
                : "",
              sim.floodFlowM3s !== undefined
                ? `<div>Flood flow (Q): <span style="font-weight:600">${sim.floodFlowM3s.toFixed(2)} m³/s</span></div>`
                : "",
              sim.contaminantConcNorm !== undefined
                ? `<div>Contamination: <span style="font-weight:600">${(sim.contaminantConcNorm * 100).toFixed(0)}% of source</span></div>`
                : "",
            ].filter(Boolean).join("");
            return {
              html: `
                <div style="
                  background:#1e293b;color:#f1f5f9;
                  padding:10px 14px;border-radius:10px;
                  font-size:12px;line-height:1.7;min-width:210px;
                  box-shadow:0 4px 20px rgba(0,0,0,.4);
                ">
                  <div style="font-weight:700;margin-bottom:2px;">${p.name}</div>
                  <div style="
                    display:inline-flex;align-items:center;gap:5px;
                    font-size:10px;color:${hex};margin-bottom:6px;
                  ">
                    <span style="width:7px;height:7px;border-radius:50%;background:${hex};"></span>
                    ${PLACED_TYPE_LABEL[p.sensorType] ?? p.sensorType} · Stakeholder Pin
                  </div>
                  <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;">
                    ${Math.abs(p.lat).toFixed(4)}°N, ${Math.abs(p.lon).toFixed(4)}°W ·
                    ${p.elevationM} m asl · ${p.slopeDeg}° slope
                  </div>
                  <div style="border-top:1px solid #334155;padding-top:6px;font-size:11px;">
                    ${simLines}
                  </div>
                  <div style="
                    margin-top:8px;padding:5px 8px;border-radius:5px;
                    background:#450a0a;border:1px solid #7f1d1d;
                    font-size:9px;color:#fca5a5;line-height:1.5;
                  ">
                    ⚠ Not real sensor data. Model prediction only — not verified by a researcher.
                    Do not use for environmental or policy decisions.
                  </div>
                </div>`,
              style: { background: "none" },
            };
          }

          // Column hover — cast to SectorDatum (PlacedSensorDatum already handled above via localId)
          if ("score" in object) {
            const col = object as SectorDatum;
            return {
              html: `
                <div style="
                  background:#1e293b;color:#f1f5f9;
                  padding:10px 14px;border-radius:10px;
                  font-size:12px;line-height:1.7;
                  box-shadow:0 4px 20px rgba(0,0,0,.4);
                ">
                  <div style="font-weight:700;margin-bottom:4px;">${col.label}</div>
                  <div>Risk: <span style="font-weight:600">${col.risk}</span></div>
                  <div>Score: <span style="font-weight:600">${(col.score * 100).toFixed(0)} %</span></div>
                  <div>Terrain: <span style="color:#94a3b8">${col.elevation.toLocaleString()} m asl</span></div>
                  <div>ID: <span style="color:#94a3b8">${col.id}</span></div>
                  ${col.source      ? `<div style="color:#34d399;font-size:10px;margin-top:4px;">★ ${col.source}</div>` : '<div style="color:#94a3b8;font-size:10px;margin-top:4px;">○ Estimated position</div>'}
                  ${col.isEstimated ? '<div style="color:#00A3E0;font-size:10px;">● Timeline interpolated</div>' : ""}
                  ${col.isActive    ? '<div style="color:#6D2077;font-size:10px;">★ Selected</div>' : ""}
                </div>`,
              style: { background: "none" },
            };
          }
          return null;
        }}
      />

      {/* ── Live count badge — dot always visible, label expands on hover ── */}
      {liveCount > 0 && (
        <div className="absolute top-4 left-4 z-10 group cursor-default">
          <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-full px-2 py-1 shadow border border-gray-200/60 dark:border-gray-700/40 flex items-center overflow-hidden transition-all duration-200">
            <span className="text-[10px] text-green-500 font-semibold leading-none">●</span>
            <span className="text-[10px] text-green-500 font-semibold leading-none max-w-0 group-hover:max-w-[4rem] overflow-hidden whitespace-nowrap transition-all duration-200 group-hover:ml-1">
              {liveCount}/5 live
            </span>
          </div>
        </div>
      )}

      {/* ── Zoom buttons ── */}
      <div className="absolute bottom-16 right-4 hidden md:flex flex-col gap-2">
        <button
          onClick={handleZoomIn}
          title="Zoom in"
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white dark:bg-gray-800 text-gray-800 dark:text-white shadow-lg hover:scale-105 hover:bg-sait-sky/10 dark:hover:bg-gray-700 transition-transform border border-gray-200/60 dark:border-gray-600"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="8" y1="2" x2="8" y2="14" />
            <line x1="2" y1="8" x2="14" y2="8" />
          </svg>
        </button>
        <button
          onClick={handleZoomOut}
          title="Zoom out"
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white dark:bg-gray-800 text-gray-800 dark:text-white shadow-lg hover:scale-105 hover:bg-sait-sky/10 dark:hover:bg-gray-700 transition-transform border border-gray-200/60 dark:border-gray-600"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="2" y1="8" x2="14" y2="8" />
          </svg>
        </button>
      </div>

      {/* ── Navigation hint ── */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
        <div className="bg-black/50 text-white/80 text-[10px] px-3 py-1.5 rounded-full backdrop-blur-sm">
          Drag to orbit · Scroll to zoom · Click column to select
        </div>
      </div>
    </div>
  );
}
