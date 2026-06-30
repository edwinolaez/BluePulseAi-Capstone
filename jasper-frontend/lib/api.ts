const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? "";

function apiHeaders(): HeadersInit {
  return { "X-API-Key": API_KEY };
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

export interface ChangeDetectionResult {
  sector_id: string;
  burn_polygons: GeoFeature[];
  confidence: number;
}

export interface ErosionResult {
  sector_id: string;
  zones: Array<{
    level: "High" | "Medium" | "Low";
    geometry: GeoFeature["geometry"];
  }>;
}

export interface ContaminantResult {
  sector_id: string;
  vectors: Array<{
    origin: [number, number];
    direction: [number, number];
    magnitude: number;
  }>;
}

export async function fetchLayerData(
  sectorId: string,
  dateFrom: string,
  dateTo: string,
  layerType: string
): Promise<LayerData> {
  const url = `${API_BASE}/api/v1/layers/${sectorId}?date_from=${dateFrom}&date_to=${dateTo}&layer_type=${layerType}`;
  const res = await fetch(url, { headers: apiHeaders() });
  if (!res.ok) throw new Error(`Layer fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchChangeDetection(
  sectorId: string
): Promise<ChangeDetectionResult> {
  const res = await fetch(`${API_BASE}/api/v1/predict/change-detection`, {
    method: "POST",
    headers: { ...apiHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ sector_id: sectorId }),
  });
  if (!res.ok) throw new Error(`Change detection failed: ${res.status}`);
  return res.json();
}

export async function fetchErosionSimulation(
  sectorId: string
): Promise<ErosionResult> {
  const res = await fetch(
    `${API_BASE}/api/v1/simulate/erosion?sector_id=${sectorId}`,
    { headers: apiHeaders() }
  );
  if (!res.ok) throw new Error(`Erosion simulation failed: ${res.status}`);
  return res.json();
}

export async function fetchContaminantSimulation(
  sectorId: string
): Promise<ContaminantResult> {
  const res = await fetch(
    `${API_BASE}/api/v1/simulate/contaminant?sector_id=${sectorId}`,
    { headers: apiHeaders() }
  );
  if (!res.ok) throw new Error(`Contaminant simulation failed: ${res.status}`);
  return res.json();
}