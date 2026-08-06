/**
 * sensorPhysics.ts — Pure physics helpers for the stakeholder sensor placement feature.
 *
 * All six functions are deterministic with no side effects and no network calls,
 * which makes them straightforward to unit-test (see tests/lib/sensorPhysics.test.ts).
 *
 * Why a separate file?
 *   The same formulas are used in PlaceSensorModal.tsx (live preview as the slider
 *   moves) and need to be independently verifiable.  Keeping them here means the
 *   test file can import them directly without mounting any React component.
 *
 * Disclaimer shown to all users:
 *   These are simplified physical models intended for stakeholder planning discussions
 *   only.  They have not been validated against field measurements and must not be
 *   used to drive environmental or policy decisions.
 */

// ── Catchment area ─────────────────────────────────────────────────────────────

/**
 * catchmentFrom — derive the monitoring area from a circular sensor coverage radius.
 *
 * A sensor with radius r covers a circle of area π·r².  We return both the raw
 * m² value (needed for the flood flow formula) and the hectare equivalent
 * (displayed in the UI and used by the erosion formula).
 *
 * @param radiusM  - coverage radius in metres (slider range 100–2000)
 * @returns areaM2 in square metres and areaHa in hectares
 */
export function catchmentFrom(radiusM: number): { areaM2: number; areaHa: number } {
  const areaM2 = Math.PI * radiusM * radiusM;
  const areaHa = areaM2 / 10000;
  return { areaM2, areaHa };
}

// ── Soil erosion (simplified RUSLE — R·LS factors only) ───────────────────────

/**
 * computeErosion — estimate annual soil erosion rate using a simplified RUSLE model.
 *
 * RUSLE (Revised Universal Soil Loss Equation) normally has 6 factors: R·K·L·S·C·P.
 * Here we use only the rainfall (R) and slope (LS) factors because those are the
 * two variables the user controls via sliders; the others are assumed constant for
 * post-fire Jasper terrain.
 *
 * Formula:  rate = 2.0 × (rainfallMm / 82)^1.2 × (slopeDeg / 22)^1.4
 *   - Baseline values (rain=82 mm, slope=22°) produce exactly 2.0 t/ha/yr (Medium risk).
 *   - Power 1.2 on rainfall and 1.4 on slope reflect that steeper slopes amplify loss
 *     more aggressively than higher rainfall.
 *   - Guard: if either input is zero or negative the rate is forced to 0 (avoids NaN
 *     from 0^1.2 and negative exponents).
 *
 * Risk labels: Low < 1.5 t/ha/yr ≤ Medium < 4.0 ≤ High
 *
 * @param slopeDeg     - terrain slope in degrees (0–90)
 * @param rainfallMm   - rainfall intensity in mm (0–500)
 * @param catchmentHa  - monitoring area in hectares (from catchmentFrom)
 * @returns rate (t/ha/yr), risk label, and total sediment load for the catchment (t/yr)
 */
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
  // totalLoad = rate per hectare × total catchment area
  const totalLoad = parseFloat((rate * catchmentHa).toFixed(2));
  return { rate: parseFloat(rate.toFixed(3)), label, totalLoad };
}

// ── Logistic forest recovery ───────────────────────────────────────────────────

/**
 * computeForestRecovery — estimate the fraction of forest canopy that has regrown
 * since the 2024 Jasper wildfire using a logistic growth model.
 *
 * Why logistic?  Forest recovery is sigmoid-shaped: slow at first (pioneer stage),
 * fast through sapling/shrub establishment, then levelling off as canopy closes.
 * A simple exponential would overshoot 100%.
 *
 * Formula:  P(t) = 1 / (1 + ((1 - P₀) / P₀) × e^(−r·t))   [logistic]
 *   where:
 *     P₀ = 0.02   — initial coverage fraction (2%, "Early Pioneer" stage)
 *     r  = 0.12 × √(precip / 450)   — growth rate scaled by precipitation
 *     t  = yearsSinceFire
 *
 * The precipitation scaling (√ ratio to 450 mm/yr baseline) captures the fact that
 * wetter years produce faster canopy re-establishment.
 *
 * Returns a percentage (0–100), not a fraction, for direct display in the UI.
 * Returns exactly 2 when yearsSinceFire ≤ 0 (before or at the fire year).
 *
 * @param yearsSinceFire - integer years since the 2024 fire (slider range 0–30)
 * @param precipMmYr     - annual precipitation in mm/yr (slider range 200–800)
 * @returns recovery percentage rounded to 1 decimal place
 */
export function computeForestRecovery(yearsSinceFire: number, precipMmYr: number): number {
  if (yearsSinceFire <= 0) return 2; // Early Pioneer baseline — fire just happened
  const r   = 0.12 * Math.sqrt(precipMmYr / 450);
  const pct = 1 / (1 + ((1 - 0.02) / 0.02) * Math.exp(-r * yearsSinceFire));
  return parseFloat((pct * 100).toFixed(1));
}

// ── Rational method flood flow (Q = C·i·A) ────────────────────────────────────

/**
 * computeFloodFlow — estimate peak runoff using the Rational Method.
 *
 * The Rational Method (Q = C·i·A) is the standard formula for small catchments
 * (< ~50 ha) and is widely used in stormwater engineering.
 *
 * Parameters:
 *   C = 0.6  — runoff coefficient for post-fire terrain.  Post-wildfire soils have
 *              reduced infiltration due to hydrophobic ash layers, so C is higher
 *              than undisturbed forest (≈0.3) but lower than paved surface (1.0).
 *   i = (rainfallMm / 24 hours) converted to m/s  — rainfall intensity
 *   A = catchmentAreaM2 in m²
 *
 * Result Q is in m³/s (cubic metres per second) — standard hydrological unit.
 *
 * @param rainfallMm      - rainfall in mm over a 24-hour period
 * @param catchmentAreaM2 - catchment area in m² (from catchmentFrom)
 * @returns peak flow Q in m³/s, rounded to 3 decimal places
 */
export function computeFloodFlow(rainfallMm: number, catchmentAreaM2: number): number {
  const C = 0.6;                       // post-fire runoff coefficient (dimensionless)
  const i = (rainfallMm / 24) / 3600; // convert mm/24hr → m/s rainfall intensity
  return parseFloat((C * i * catchmentAreaM2).toFixed(3));
}

// ── Gaussian contamination decay from Miette River ───────────────────────────

/**
 * gaussianConc — estimate normalised contaminant concentration at a point on the map.
 *
 * Models how a hydrocarbon plume originating at the Miette River WSC station
 * (52.8639°N, 118.1069°W) decays with distance using a 2D Gaussian kernel.
 *
 * The Gaussian dispersion formula for a stationary source:
 *   C(x,y) = C₀ × exp(−dist² / (2·σ²))
 *
 * where:
 *   C₀    = contaminationLevel (source concentration, 0–1)
 *   dist  = Euclidean distance in metres from source to (lat, lon)
 *   σ     = 3000 m (3 km standard deviation — dispersion radius of the plume)
 *
 * Distance calculation converts lat/lon differences to metres:
 *   1° latitude ≈ 111,000 m everywhere.
 *   1° longitude varies by latitude: multiply by cos(lat).
 *
 * Output is clamped to [0, 1] so the function is safe even for contaminationLevel > 1.
 *
 * @param lat               - latitude of the point to evaluate
 * @param lon               - longitude of the point to evaluate
 * @param contaminationLevel - source concentration 0–1 (from the scenario slider)
 * @returns normalised concentration at (lat, lon), clamped to [0, 1]
 */
export function gaussianConc(lat: number, lon: number, contaminationLevel: number): number {
  // Convert angular differences to metres (approximate for small areas)
  const dLat  = (lat - 52.8639)     * 111000;
  const dLon  = (lon - -118.1069)   * 111000 * Math.cos((lat * Math.PI) / 180);
  const dist  = Math.sqrt(dLat * dLat + dLon * dLon);
  const sigma = 3000; // 3 km plume dispersion standard deviation
  return Math.max(
    0,
    Math.min(1, contaminationLevel * Math.exp(-(dist * dist) / (2 * sigma * sigma))),
  );
}

/**
 * computeContaminant — compute contamination at the sensor's centre and edge points.
 *
 * Calls gaussianConc twice: once at the sensor's exact lat/lon (centre) and once
 * at a point radiusM metres due north of the sensor (the edge of the coverage ring).
 *
 * The edge point is always at a greater distance from the Miette River source than
 * the centre (since it moves further north), so edgeConc ≤ centerConc always.
 * This gives users an intuition for the concentration gradient across the monitored area.
 *
 * The "due north" offset (lat + radiusM / 111000) is a flat-earth approximation
 * valid for the small distances involved (up to 2 km).
 *
 * @param lat               - sensor latitude
 * @param lon               - sensor longitude
 * @param contaminationLevel - source concentration 0–1
 * @param radiusM           - coverage radius in metres
 * @returns centerConc and edgeConc, each rounded to 3 decimal places
 */
export function computeContaminant(
  lat: number,
  lon: number,
  contaminationLevel: number,
  radiusM: number,
): { centerConc: number; edgeConc: number } {
  const centerConc = gaussianConc(lat, lon, contaminationLevel);
  const edgeLat    = lat + radiusM / 111000; // project radiusM metres due north
  const edgeConc   = gaussianConc(edgeLat, lon, contaminationLevel);
  return {
    centerConc: parseFloat(centerConc.toFixed(3)),
    edgeConc:   parseFloat(edgeConc.toFixed(3)),
  };
}
