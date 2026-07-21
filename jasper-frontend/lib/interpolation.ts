// Timeline interpolation — blends map layer values between real scan dates.
//
// When the user drags the slider to a date that sits between two actual scans,
// this module finds the two nearest real data points and linearly blends their
// vegetation, erosion, and water quality values. This is a rendering estimation
// only — no predictive model is involved. See scope doc section 2 for rationale.

export interface ScanRecord {
  timestamp:           string;
  layer_type:          string;
  vegetation_pct:      number; // 0–100, percentage of vegetation health
  erosion_risk_score:  number; // 0.0 (low) → 1.0 (critical)
  water_turbidity:     number; // NTU, higher = murkier
}

export interface InterpolatedState {
  vegetation_pct:      number;
  erosion_risk_score:  number;
  water_turbidity:     number;
  erosion_risk:        "High" | "Medium" | "Low";
  blend_factor:        number;       // 0 = exactly on left scan, 1 = exactly on right scan
  is_estimated:        boolean;      // false only when slider is exactly on a real scan date
  nearest_before:      string | null; // ISO timestamp of the left anchor scan
  nearest_after:       string | null; // ISO timestamp of the right anchor scan
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function scoreToLabel(score: number): "High" | "Medium" | "Low" {
  if (score >= 0.7)  return "High";
  if (score >= 0.35) return "Medium";
  return "Low";
}

function scanToState(
  s: ScanRecord,
  blendFactor: number,
  isEstimated: boolean,
  before: string | null,
  after: string | null
): InterpolatedState {
  return {
    vegetation_pct:     s.vegetation_pct,
    erosion_risk_score: s.erosion_risk_score,
    water_turbidity:    s.water_turbidity,
    erosion_risk:       scoreToLabel(s.erosion_risk_score),
    blend_factor:       blendFactor,
    is_estimated:       isEstimated,
    nearest_before:     before,
    nearest_after:      after,
  };
}

/**
 * Given an array of real scan records and a target timestamp (ms since epoch),
 * returns a linearly interpolated state for that moment in time.
 *
 * - Exactly on a scan date → returns that scan's values, is_estimated = false
 * - Between two scans → blends linearly, is_estimated = true
 * - Before first scan → clamps to first scan, is_estimated = true
 * - After last scan → clamps to last scan, is_estimated = true
 * - Empty scans array → returns null
 */
export function interpolateScans(
  scans: ScanRecord[],
  currentMs: number
): InterpolatedState | null {
  if (scans.length === 0) return null;

  const times = scans.map(s => new Date(s.timestamp).getTime());

  // Exact hit — slider is on a real scan date
  const exactIdx = times.findIndex(t => t === currentMs);
  if (exactIdx !== -1) {
    const s = scans[exactIdx];
    return scanToState(s, 0, false, s.timestamp, s.timestamp);
  }

  // Find left anchor (largest timestamp ≤ currentMs)
  // Find right anchor (smallest timestamp > currentMs)
  let leftIdx  = -1;
  let rightIdx = -1;
  for (let i = 0; i < times.length; i++) {
    if (times[i] <= currentMs) leftIdx = i;
    if (times[i] > currentMs && rightIdx === -1) rightIdx = i;
  }

  // Before all scans — clamp to first
  if (leftIdx === -1) {
    return scanToState(scans[0], 0, true, null, scans[0].timestamp);
  }

  // After all scans — clamp to last
  if (rightIdx === -1) {
    const last = scans[scans.length - 1];
    return scanToState(last, 1, true, last.timestamp, null);
  }

  // Between two scans — linear blend
  const left  = scans[leftIdx];
  const right = scans[rightIdx];
  const t = (currentMs - times[leftIdx]) / (times[rightIdx] - times[leftIdx]);

  const vegetation_pct      = lerp(left.vegetation_pct,      right.vegetation_pct,      t);
  const erosion_risk_score  = lerp(left.erosion_risk_score,  right.erosion_risk_score,  t);
  const water_turbidity     = lerp(left.water_turbidity,     right.water_turbidity,     t);

  return {
    vegetation_pct,
    erosion_risk_score,
    water_turbidity,
    erosion_risk:   scoreToLabel(erosion_risk_score),
    blend_factor:   t,
    is_estimated:   true,
    nearest_before: left.timestamp,
    nearest_after:  right.timestamp,
  };
}
