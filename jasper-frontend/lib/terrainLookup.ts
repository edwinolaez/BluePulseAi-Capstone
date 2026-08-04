// Terrain elevation + slope lookup for stakeholder-placed sensors.
// Uses Open-Topo-Data SRTM30m (free, no key) with Open-Meteo as fallback.
// Slope is derived via 5-point central difference: center + N/S/E/W ~100 m offsets.

export interface TerrainData {
  elevationM: number;
  slopeDeg:   number;
}

export interface PlacedSensor {
  localId:    string;            // crypto.randomUUID() — stable key for local state
  convexId?:  string;            // Id<"userSimulations"> after Convex save
  name:       string;
  lat:        number;
  lon:        number;
  sensorType: "forest" | "erosion" | "water" | "flood";
  elevationM: number;
  slopeDeg:   number;
  radiusM:    number;            // user-set monitoring radius in metres
  simulationResults: {
    catchmentAreaHa?:     number;  // π·r²/10000
    forestRecoveryPct?:   number;
    erosionRateTPerHaYr?: number;
    erosionRiskLabel?:    string;
    erosionTotalLoadTYr?: number;  // rate × catchmentAreaHa
    floodFlowM3s?:        number;  // Q = C·i·π·r² (accurate with real area)
    contaminantConcNorm?: number;  // Gaussian at drop point
    contaminantEdgeConc?: number;  // Gaussian at radius edge
  };
}

const STEP_KM = 0.1; // 100 m offsets for central-difference slope

function offsetPoint(lat: number, lon: number, dLatKm: number, dLonKm: number): [number, number] {
  const kmPerDegLat = 111.0;
  const kmPerDegLon = 111.0 * Math.cos((lat * Math.PI) / 180);
  return [lat + dLatKm / kmPerDegLat, lon + dLonKm / kmPerDegLon];
}

async function fetchOpenTopo(points: [number, number][]): Promise<number[]> {
  const locs = points.map(([lat, lon]) => `${lat},${lon}`).join("|");
  const res = await fetch(
    `https://api.opentopodata.org/v1/srtm30m?locations=${encodeURIComponent(locs)}`
  );
  if (!res.ok) throw new Error("opentopodata error");
  const json = (await res.json()) as { results: { elevation: number }[] };
  return json.results.map((r) => r.elevation ?? 0);
}

async function fetchOpenMeteoCenter(lat: number, lon: number): Promise<number> {
  const res = await fetch(
    `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`
  );
  if (!res.ok) throw new Error("open-meteo error");
  const json = (await res.json()) as { elevation: number[] };
  return json.elevation[0] ?? 0;
}

export async function lookupTerrain(lat: number, lon: number): Promise<TerrainData> {
  const [nLat, nLon] = offsetPoint(lat, lon,  STEP_KM, 0);
  const [sLat, sLon] = offsetPoint(lat, lon, -STEP_KM, 0);
  const [eLat, eLon] = offsetPoint(lat, lon, 0,  STEP_KM);
  const [wLat, wLon] = offsetPoint(lat, lon, 0, -STEP_KM);

  const pts: [number, number][] = [[lat, lon], [nLat, nLon], [sLat, sLon], [eLat, eLon], [wLat, wLon]];

  let elevations: number[];
  try {
    elevations = await fetchOpenTopo(pts);
  } catch {
    // Fallback: Open-Meteo center elevation only — slope defaults to 0
    const center = await fetchOpenMeteoCenter(lat, lon);
    return { elevationM: Math.round(center), slopeDeg: 0 };
  }

  const [elev, eN, eS, eE, eW] = elevations;
  const stepM = STEP_KM * 1000;
  const dzNS  = (eN - eS) / (2 * stepM);
  const dzEW  = (eE - eW) / (2 * stepM);
  const slopeDeg = Math.atan(Math.sqrt(dzNS * dzNS + dzEW * dzEW)) * (180 / Math.PI);

  return {
    elevationM: Math.round(elev),
    slopeDeg:   parseFloat(slopeDeg.toFixed(1)),
  };
}
