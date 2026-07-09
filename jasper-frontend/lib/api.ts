const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
// ML service may be on a separate deployment — falls back to API_BASE if not set
const ML_BASE = process.env.NEXT_PUBLIC_ML_API_BASE_URL ?? API_BASE;
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

// Matches ChangeDetectionResponse in jasper-ml/api/model_endpoint.py
export interface ChangeDetectionResult {
  sector_id: string;
  risk_label: "High" | "Medium" | "Low";
  confidence: number;
  predicted_at: string;
}

// Matches ErosionSimulationResponse in jasper-ml/api/model_endpoint.py
export interface ErosionResult {
  sector_id: string;
  soil_loss_t_ha: number;
  risk_level: "High" | "Medium" | "Low";
}

// Matches ContaminantSimulationResponse in jasper-ml/api/model_endpoint.py
export interface ContaminantResult {
  sector_id: string;
  spread_radius_km: number;
  peak_concentration: number;
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
): Promise<ChangeDetectionResult> {
  const res = await fetchWithTimeout(`${ML_BASE}/predict/change-detection`, {
    method: "POST",
    headers: { ...apiHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ sector_id: sectorId }),
  });
  if (!res.ok) throw new Error(`Change detection failed: ${res.status}`);
  return res.json();
}

export async function fetchErosionSimulation(
  sectorId: string,
  rainfallMm: number = 50
): Promise<ErosionResult> {
  const res = await fetchWithTimeout(`${ML_BASE}/simulate/erosion`, {
    method: "POST",
    headers: { ...apiHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ sector_id: sectorId, rainfall_mm: rainfallMm }),
  });
  if (!res.ok) throw new Error(`Erosion simulation failed: ${res.status}`);
  return res.json();
}

export async function fetchContaminantSimulation(
  sectorId: string,
  sourcePoint: [number, number] = [52.875, -118.060]
): Promise<ContaminantResult> {
  const res = await fetchWithTimeout(`${ML_BASE}/simulate/contaminant`, {
    method: "POST",
    headers: { ...apiHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ sector_id: sectorId, source_point: sourcePoint }),
  });
  if (!res.ok) throw new Error(`Contaminant simulation failed: ${res.status}`);
  return res.json();
}
