// ─── API Configuration ────────────────────────────────────────────────────────
// Feven's backend (data pipeline + layer queries)
const FEVEN_API  = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
// Richard's ML API (change detection, erosion, contaminant simulations)
const ML_API     = process.env.NEXT_PUBLIC_ML_API_BASE_URL ?? "";
const API_KEY    = process.env.NEXT_PUBLIC_API_KEY ?? "";

function apiHeaders(): HeadersInit {
  return { "X-API-Key": API_KEY };
}

// ─── Feven's Response Types ───────────────────────────────────────────────────
export interface LayerData {
  sector_id:  string;
  date_from:  string | null;
  date_to:    string | null;
  layer_type: string | null;
  layers:     unknown[];
}

// ─── Richard's ML Output Schema (shared by all 3 simulations) ─────────────────
// Source: jasper-ml/ML_OUTPUT_SCHEMA.md
export interface ModelOutput {
  sector_id:          string;
  model_version:      string;
  simulation_type:    "change_detection" | "erosion" | "contaminant";
  risk_score:         number;             // [0.0, 1.0]
  risk_label:         "High" | "Medium" | "Low";
  contaminant_vector: {
    direction_deg: number;                // [0.0, 360.0) — plume heading
    velocity:      number;                // [0.0, 1.0]  — normalized speed
  };
  timestamp:   string;
  confidence:  number;                    // [0.0, 1.0]
}

// ─── Feven's Endpoints ────────────────────────────────────────────────────────

/**
 * Fetch environmental layer data for a sector and date range.
 * GET /api/v1/layers/{sector_id}?date_from=&date_to=&layer_type=
 */
export async function fetchLayerData(
  sectorId:   string,
  dateFrom:   string,
  dateTo:     string,
  layerType:  string
): Promise<LayerData> {
  const url = `${FEVEN_API}/api/v1/layers/${encodeURIComponent(sectorId)}?date_from=${dateFrom}&date_to=${dateTo}&layer_type=${layerType}`;
  const res = await fetch(url, { headers: apiHeaders() });
  if (!res.ok) throw new Error(`Layer fetch failed: ${res.status}`);
  return res.json();
}

// ─── Richard's ML Endpoints ───────────────────────────────────────────────────

/**
 * Predict post-fire burn scar risk for a sector.
 * POST /api/v1/predict/change-detection
 * Body: { sector_id }
 */
export async function fetchChangeDetection(
  sectorId: string
): Promise<ModelOutput> {
  const res = await fetch(`${ML_API}/api/v1/predict/change-detection`, {
    method:  "POST",
    headers: { ...apiHeaders(), "Content-Type": "application/json" },
    body:    JSON.stringify({ sector_id: sectorId }),
  });
  if (!res.ok) throw new Error(`Change detection failed: ${res.status}`);
  return res.json();
}

/**
 * Simulate erosion risk for a sector given terrain + rainfall conditions.
 * GET /api/v1/simulate/erosion?sector_id=&slope_deg=&rainfall_mm=
 *
 * Default params reflect Jasper watershed typical values.
 */
export async function fetchErosionSimulation(
  sectorId:   string,
  slopeDeg:   number = 38.5,   // typical steep Jasper valley slope
  rainfallMm: number = 82.0    // historical avg post-fire rainfall (mm)
): Promise<ModelOutput> {
  const params = new URLSearchParams({
    sector_id:   sectorId,
    slope_deg:   String(slopeDeg),
    rainfall_mm: String(rainfallMm),
  });
  const res = await fetch(`${ML_API}/api/v1/simulate/erosion?${params}`, {
    headers: apiHeaders(),
  });
  if (!res.ok) throw new Error(`Erosion simulation failed: ${res.status}`);
  return res.json();
}

/**
 * Simulate contaminant plume movement for a sector.
 * GET /api/v1/simulate/contaminant?sector_id=&flow_direction_deg=&water_velocity_ms=&contamination_level=
 *
 * Default params reflect Athabasca River typical summer flow.
 */
export async function fetchContaminantSimulation(
  sectorId:           string,
  flowDirectionDeg:   number = 180,  // south-flowing river segment
  waterVelocityMs:    number = 2.1,  // m/s — measured in mock data
  contaminationLevel: number = 0.72  // moderate-high post-fire ash load
): Promise<ModelOutput> {
  const params = new URLSearchParams({
    sector_id:           sectorId,
    flow_direction_deg:  String(flowDirectionDeg),
    water_velocity_ms:   String(waterVelocityMs),
    contamination_level: String(contaminationLevel),
  });
  const res = await fetch(`${ML_API}/api/v1/simulate/contaminant?${params}`, {
    headers: apiHeaders(),
  });
  if (!res.ok) throw new Error(`Contaminant simulation failed: ${res.status}`);
  return res.json();
}
