const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? "";
const FETCH_TIMEOUT_MS = 10_000;

function apiHeaders(): HeadersInit {
  return { "X-API-Key": API_KEY };
}

/** Wraps fetch with an AbortController timeout so hung requests don't freeze the UI. */
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

export interface GeoFeature {
  id: string;
  geometry: {
    type: string;
    coordinates: number[][] | number[][][];
  };
  properties: Record<string, unknown>;
}

export interface LayerData {
  sector_id: string;
  layer_type: string;
  features: GeoFeature[];
  date_from: string;
  date_to: string;
}

// Unified ML output — matches ModelOutput in jasper-ml/ML_OUTPUT_SCHEMA.md
export interface ModelOutput {
  sector_id: string;
  model_version: string;
  simulation_type: string;
  risk_score: number;
  risk_label: "High" | "Medium" | "Low";
  contaminant_vector: {
    direction_deg: number;
    velocity: number;
  };
  timestamp: string;
  confidence: number;
}

export async function fetchLayerData(
  sectorId: string,
  dateFrom: string,
  dateTo: string,
  layerType: string
): Promise<LayerData> {
  const url = `${API_BASE}/api/v1/layers/${sectorId}?date_from=${dateFrom}&date_to=${dateTo}&layer_type=${layerType}`;
  const res = await fetchWithTimeout(url, { headers: apiHeaders() });
  if (!res.ok) throw new Error(`Layer fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchChangeDetection(
  sectorId: string
): Promise<ModelOutput> {
  const res = await fetchWithTimeout(`${API_BASE}/api/v1/predict/change-detection`, {
    method: "POST",
    headers: { ...apiHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ sector_id: sectorId }),
  });
  if (!res.ok) throw new Error(`Change detection failed: ${res.status}`);
  return res.json();
}

// slopeDeg and rainfallMm default to typical Jasper watershed terrain values
export async function fetchErosionSimulation(
  sectorId: string,
  slopeDeg: number = 30,
  rainfallMm: number = 50
): Promise<ModelOutput> {
  const res = await fetchWithTimeout(
    `${API_BASE}/api/v1/simulate/erosion?sector_id=${sectorId}&slope_deg=${slopeDeg}&rainfall_mm=${rainfallMm}`,
    { headers: apiHeaders() }
  );
  if (!res.ok) throw new Error(`Erosion simulation failed: ${res.status}`);
  return res.json();
}

// Flow parameters default to observed Athabasca river conditions
export async function fetchContaminantSimulation(
  sectorId: string,
  flowDirectionDeg: number = 180,
  waterVelocityMs: number = 2.1,
  contaminationLevel: number = 0.5
): Promise<ModelOutput> {
  const res = await fetchWithTimeout(
    `${API_BASE}/api/v1/simulate/contaminant?sector_id=${sectorId}&flow_direction_deg=${flowDirectionDeg}&water_velocity_ms=${waterVelocityMs}&contamination_level=${contaminationLevel}`,
    { headers: apiHeaders() }
  );
  if (!res.ok) throw new Error(`Contaminant simulation failed: ${res.status}`);
  return res.json();
}
