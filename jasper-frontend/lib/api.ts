// This file is the main connection point between the frontend and the backend APIs.
// Feven's backend handles the map layer data, and Richard's ML backend handles
// the three AI model predictions (burn scar, erosion, and contaminant).
// All the API URLs are stored in environment variables so they're easy to swap out.

// Feven's backend URL — handles data pipeline and environmental layer queries
const FEVEN_API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
// Richard's ML model API — runs the three AI simulations; falls back to FEVEN_API if not set separately
const ML_API    = process.env.NEXT_PUBLIC_ML_API_BASE_URL ?? FEVEN_API;
// API key sent in every request header to authenticate with the backend
const API_KEY   = process.env.NEXT_PUBLIC_API_KEY ?? "";

const FETCH_TIMEOUT_MS = 10_000;

// Attaches the API key to every request so the server knows it's coming from us
function apiHeaders(): HeadersInit {
  return { "X-API-Key": API_KEY };
}

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

// ─── Functions that call Feven's backend ─────────────────────────────────────

// Fetches environmental layer data for a given sector and date range.
// Used by the map layers to colour the zones based on real data.
export async function fetchLayerData(
  sectorId:  string,
  dateFrom:  string,
  dateTo:    string,
  layerType: string
): Promise<LayerData> {
  const url = `${FEVEN_API}/api/v1/layers/${encodeURIComponent(sectorId)}?date_from=${dateFrom}&date_to=${dateTo}&layer_type=${layerType}`;
  const res = await fetchWithTimeout(url, { headers: apiHeaders() });
  if (!res.ok) throw new Error(`Layer fetch failed: ${res.status}`);
  return res.json();
}

// ─── Functions that call Richard's ML backend ─────────────────────────────────

// Asks Richard's model to predict the burn scar / forest damage risk for a sector.
export async function fetchChangeDetection(
  sectorId: string
): Promise<ModelOutput> {
  const res = await fetchWithTimeout(`${ML_API}/api/v1/predict/change-detection`, {
    method:  "POST",
    headers: { ...apiHeaders(), "Content-Type": "application/json" },
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
  const res = await fetchWithTimeout(`${ML_API}/api/v1/simulate/erosion?${params}`, {
    headers: apiHeaders(),
  });
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
  const res = await fetchWithTimeout(`${ML_API}/api/v1/simulate/contaminant?${params}`, {
    headers: apiHeaders(),
  });
  if (!res.ok) throw new Error(`Contaminant simulation failed: ${res.status}`);
  return res.json();
}
