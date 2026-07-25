// This file is the main connection point between the frontend and the backend APIs.
// Feven's backend handles the map layer data, and Richard's ML backend handles
// the three AI model predictions (burn scar, erosion, and contaminant).
//
// All external calls are proxied through Next.js API routes so that the backend
// API key never leaves the server and is never bundled into the client JS.

const FETCH_TIMEOUT_MS = 10_000;

// Wraps fetch with an AbortController timeout so hung requests don't freeze the UI
function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

// ─── Data types coming back from Feven's backend ─────────────────────────────

// Describes what a layer response looks like (used by the map overlays)
export interface LayerData {
  sector_id:  string;
  date_from:  string | null;
  date_to:    string | null;
  layer_type: string | null;
  layers:     unknown[];
}

// One timestamped scan record returned by the timeline endpoint.
// The three numeric fields (vegetation_pct, erosion_risk_score, water_turbidity)
// are normalized by the backend so the frontend can blend them directly.
export interface TimelineScan {
  timestamp:           string;
  layer_type:          string;
  source:              string;
  vegetation_pct:      number;
  erosion_risk_score:  number;
  water_turbidity:     number;
  data:                Record<string, unknown>;
}

// Response shape of GET /api/v1/sectors/{sector_id}/timeline
export interface TimelineData {
  sector_id:  string;
  scan_count: number;
  scans:      TimelineScan[];
}

// ─── Data type shared by all three of Richard's ML models ────────────────────
// Every model (burn scar, erosion, contaminant) returns the same shape of data.
// This makes it easy to display all three in a consistent way on the AI Overview page.
export interface ModelOutput {
  sector_id:          string;
  model_version:      string;
  simulation_type:    "change_detection" | "erosion" | "contaminant";
  risk_score:         number;
  risk_label:         "High" | "Medium" | "Low";
  // only used by contaminant — tells us which direction the plume is moving and how fast
  contaminant_vector: {
    direction_deg: number; // compass heading (0–360)
    velocity:      number; // normalized speed (0–1)
  };
  timestamp:   string;
  confidence:  number;
}

// ─── Functions that call Feven's backend (via server-side proxy) ──────────────

// Fetches all timestamped scan records for a sector — used by the timeline slider
// interpolation to blend values between real capture dates.
export async function fetchTimeline(sectorId: string): Promise<TimelineData> {
  const params = new URLSearchParams({ sector_id: sectorId });
  const res = await fetchWithTimeout(`/api/backend/timeline?${params}`);
  if (!res.ok) throw new Error(`Timeline fetch failed: ${res.status}`);
  return res.json();
}

// Fetches environmental layer data for a given sector and date range.
// Used by the map layers to colour the zones based on real data.
export async function fetchLayerData(
  sectorId:  string,
  dateFrom:  string,
  dateTo:    string,
  layerType: string
): Promise<LayerData> {
  const params = new URLSearchParams({
    sector_id:  sectorId,
    date_from:  dateFrom,
    date_to:    dateTo,
    layer_type: layerType,
  });
  const res = await fetchWithTimeout(`/api/backend/layers?${params}`);
  if (!res.ok) throw new Error(`Layer fetch failed: ${res.status}`);
  return res.json();
}

// ─── Functions that call Richard's ML backend (via server-side proxy) ─────────

// Asks Richard's model to predict the burn scar / forest damage risk for a sector.
export async function fetchChangeDetection(
  sectorId: string
): Promise<ModelOutput> {
  const res = await fetchWithTimeout("/api/ml/change-detection", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ sector_id: sectorId }),
  });
  if (!res.ok) throw new Error(`Change detection failed: ${res.status}`);
  return res.json();
}

// Asks Richard's model to simulate erosion risk based on terrain and rainfall.
// slope_deg and rainfall_mm are the terrain conditions — defaults reflect
// typical Jasper Valley watershed measurements.
export async function fetchErosionSimulation(
  sectorId:   string,
  slopeDeg:   number = 38.5,
  rainfallMm: number = 82.0
): Promise<ModelOutput> {
  const params = new URLSearchParams({
    sector_id:   sectorId,
    slope_deg:   String(slopeDeg),
    rainfall_mm: String(rainfallMm),
  });
  const res = await fetchWithTimeout(`/api/ml/erosion?${params}`);
  if (!res.ok) throw new Error(`Erosion simulation failed: ${res.status}`);
  return res.json();
}

// Asks Richard's model to simulate where the contaminant plume is heading.
export async function fetchContaminantSimulation(
  sectorId:           string,
  flowDirectionDeg:   number = 180,
  waterVelocityMs:    number = 2.1,
  contaminationLevel: number = 0.72
): Promise<ModelOutput> {
  const params = new URLSearchParams({
    sector_id:           sectorId,
    flow_direction_deg:  String(flowDirectionDeg),
    water_velocity_ms:   String(waterVelocityMs),
    contamination_level: String(contaminationLevel),
  });
  const res = await fetchWithTimeout(`/api/ml/contaminant?${params}`);
  if (!res.ok) throw new Error(`Contaminant simulation failed: ${res.status}`);
  return res.json();
}
