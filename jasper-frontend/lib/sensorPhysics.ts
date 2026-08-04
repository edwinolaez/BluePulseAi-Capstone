// Physics helpers for stakeholder-placed sensor simulations.
// All functions are pure and deterministic — no side effects, no fetch.
// Extracted from PlaceSensorModal.tsx so they can be unit-tested independently.

// ── Catchment area ─────────────────────────────────────────────────────────────

export function catchmentFrom(radiusM: number): { areaM2: number; areaHa: number } {
  const areaM2 = Math.PI * radiusM * radiusM;
  const areaHa = areaM2 / 10000;
  return { areaM2, areaHa };
}

// ── Soil erosion (simplified RUSLE — R·LS factors only) ───────────────────────

export function computeErosion(
  slopeDeg: number,
  rainfallMm: number,
  catchmentHa: number,
): { rate: number; label: string; totalLoad: number } {
  const rate =
    slopeDeg > 0 && rainfallMm > 0
      ? 2.0 * Math.pow(rainfallMm / 82, 1.2) * Math.pow(slopeDeg / 22, 1.4)
      : 0;
  const label     = rate >= 4.0 ? "High" : rate >= 1.5 ? "Medium" : "Low";
  const totalLoad = parseFloat((rate * catchmentHa).toFixed(2));
  return { rate: parseFloat(rate.toFixed(3)), label, totalLoad };
}

// ── Logistic forest recovery ───────────────────────────────────────────────────

export function computeForestRecovery(yearsSinceFire: number, precipMmYr: number): number {
  if (yearsSinceFire <= 0) return 2;
  const r   = 0.12 * Math.sqrt(precipMmYr / 450);
  const pct = 1 / (1 + ((1 - 0.02) / 0.02) * Math.exp(-r * yearsSinceFire));
  return parseFloat((pct * 100).toFixed(1));
}

// ── Rational method flood flow (Q = C·i·A) ────────────────────────────────────

export function computeFloodFlow(rainfallMm: number, catchmentAreaM2: number): number {
  const C = 0.6;                       // post-fire runoff coefficient
  const i = (rainfallMm / 24) / 3600; // daily rainfall → m/s intensity
  return parseFloat((C * i * catchmentAreaM2).toFixed(3));
}

// ── Gaussian contamination decay from Miette River ───────────────────────────

// Returns normalised 0-1 concentration at (lat, lon) given a source level.
// Source fixed at Miette River WSC station (52.8639 °N, 118.1069 °W); sigma = 3 km.
export function gaussianConc(lat: number, lon: number, contaminationLevel: number): number {
  const dLat  = (lat - 52.8639)     * 111000;
  const dLon  = (lon - -118.1069)   * 111000 * Math.cos((lat * Math.PI) / 180);
  const dist  = Math.sqrt(dLat * dLat + dLon * dLon);
  const sigma = 3000;
  return Math.max(
    0,
    Math.min(1, contaminationLevel * Math.exp(-(dist * dist) / (2 * sigma * sigma))),
  );
}

export function computeContaminant(
  lat: number,
  lon: number,
  contaminationLevel: number,
  radiusM: number,
): { centerConc: number; edgeConc: number } {
  const centerConc = gaussianConc(lat, lon, contaminationLevel);
  const edgeLat    = lat + radiusM / 111000; // offset due north by radiusM metres
  const edgeConc   = gaussianConc(edgeLat, lon, contaminationLevel);
  return {
    centerConc: parseFloat(centerConc.toFixed(3)),
    edgeConc:   parseFloat(edgeConc.toFixed(3)),
  };
}
