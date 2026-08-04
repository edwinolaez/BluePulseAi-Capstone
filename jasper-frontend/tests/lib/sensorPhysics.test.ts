// Unit tests for lib/sensorPhysics.ts
//
// Each helper is a pure function — no mocking required.
// Expected values are derived by hand from the formulas and checked to
// ≥ 3 significant figures so rounding in toFixed() calls is captured.

import {
  catchmentFrom,
  computeErosion,
  computeForestRecovery,
  computeFloodFlow,
  gaussianConc,
  computeContaminant,
} from "../../lib/sensorPhysics";

// ─── catchmentFrom ────────────────────────────────────────────────────────────

describe("catchmentFrom", () => {
  it("computes area from a 500 m radius", () => {
    const { areaM2, areaHa } = catchmentFrom(500);
    // π × 500² = 785 398.16...
    expect(areaM2).toBeCloseTo(785_398.16, 0);
    expect(areaHa).toBeCloseTo(78.54, 1);
  });

  it("computes area from a 1 000 m radius", () => {
    const { areaM2, areaHa } = catchmentFrom(1000);
    expect(areaM2).toBeCloseTo(3_141_592.65, 0);
    expect(areaHa).toBeCloseTo(314.16, 1);
  });

  it("returns zero area for zero radius", () => {
    const { areaM2, areaHa } = catchmentFrom(0);
    expect(areaM2).toBe(0);
    expect(areaHa).toBe(0);
  });

  it("areaHa equals areaM2 / 10 000", () => {
    const { areaM2, areaHa } = catchmentFrom(750);
    expect(areaHa).toBeCloseTo(areaM2 / 10_000, 5);
  });
});

// ─── computeErosion ───────────────────────────────────────────────────────────

describe("computeErosion", () => {
  it("returns rate 2.0 t/ha/yr and label Medium at baseline slope=22, rain=82", () => {
    // 2.0 × (82/82)^1.2 × (22/22)^1.4 = 2.0
    const { rate, label, totalLoad } = computeErosion(22, 82, 10);
    expect(rate).toBeCloseTo(2.0, 3);
    expect(label).toBe("Medium");
    expect(totalLoad).toBeCloseTo(20.0, 1);
  });

  it("returns High label when slope=38.5 and rain=82", () => {
    // (38.5/22)^1.4 ≈ 2.189 → rate ≈ 4.38
    const { rate, label } = computeErosion(38.5, 82, 10);
    expect(rate).toBeGreaterThanOrEqual(4.0);
    expect(label).toBe("High");
  });

  it("returns Low label when slope=12 and rain=82", () => {
    // (12/22)^1.4 ≈ 0.428 → rate ≈ 0.856
    const { rate, label } = computeErosion(12, 82, 10);
    expect(rate).toBeLessThan(1.5);
    expect(label).toBe("Low");
  });

  it("returns zero rate when slope is 0 (guard clause)", () => {
    const { rate, label, totalLoad } = computeErosion(0, 82, 50);
    expect(rate).toBe(0);
    expect(label).toBe("Low");
    expect(totalLoad).toBe(0);
  });

  it("returns zero rate when rainfall is 0 (guard clause)", () => {
    const { rate, label } = computeErosion(22, 0, 50);
    expect(rate).toBe(0);
    expect(label).toBe("Low");
  });

  it("totalLoad scales with catchment area", () => {
    const { totalLoad: load10 } = computeErosion(22, 82, 10);
    const { totalLoad: load20 } = computeErosion(22, 82, 20);
    expect(load20).toBeCloseTo(load10 * 2, 1);
  });

  it("rate increases with steeper slope", () => {
    const { rate: low  } = computeErosion(10, 82, 1);
    const { rate: high } = computeErosion(35, 82, 1);
    expect(high).toBeGreaterThan(low);
  });

  it("rate increases with higher rainfall", () => {
    const { rate: dry } = computeErosion(22, 40, 1);
    const { rate: wet } = computeErosion(22, 120, 1);
    expect(wet).toBeGreaterThan(dry);
  });
});

// ─── computeForestRecovery ────────────────────────────────────────────────────

describe("computeForestRecovery", () => {
  it("returns 2 (% early pioneer) when yearsSinceFire is 0", () => {
    expect(computeForestRecovery(0, 450)).toBe(2);
  });

  it("returns 2 (%) when yearsSinceFire is negative", () => {
    expect(computeForestRecovery(-5, 450)).toBe(2);
  });

  it("returns ~2.5 % at 2 years with baseline precipitation (450 mm/yr)", () => {
    // 1 / (1 + 49 × e^(-0.24)) × 100 ≈ 2.5
    expect(computeForestRecovery(2, 450)).toBeCloseTo(2.5, 0);
  });

  it("returns ~6.3 % at 10 years with baseline precipitation", () => {
    // 1 / (1 + 49 × e^(-1.2)) × 100 ≈ 6.3
    expect(computeForestRecovery(10, 450)).toBeCloseTo(6.3, 0);
  });

  it("recovery grows monotonically with years", () => {
    const y2  = computeForestRecovery(2,  450);
    const y10 = computeForestRecovery(10, 450);
    const y50 = computeForestRecovery(50, 450);
    expect(y10).toBeGreaterThan(y2);
    expect(y50).toBeGreaterThan(y10);
  });

  it("higher precipitation produces faster recovery", () => {
    const low  = computeForestRecovery(10, 300);
    const high = computeForestRecovery(10, 600);
    expect(high).toBeGreaterThan(low);
  });

  it("approaches 100 % recovery after many decades", () => {
    expect(computeForestRecovery(200, 450)).toBeGreaterThan(95);
  });
});

// ─── computeFloodFlow ─────────────────────────────────────────────────────────

describe("computeFloodFlow", () => {
  it("computes Q = C·i·A correctly for 82 mm rain over 1 000 000 m²", () => {
    // C=0.6, i=(82/24)/3600 ≈ 9.49e-4 m/s, A=1e6 m² → Q ≈ 569.4 m³/s
    const Q = computeFloodFlow(82, 1_000_000);
    expect(Q).toBeCloseTo(569.4, 0);
  });

  it("returns 0 for zero rainfall", () => {
    expect(computeFloodFlow(0, 1_000_000)).toBe(0);
  });

  it("returns 0 for zero catchment area", () => {
    expect(computeFloodFlow(82, 0)).toBe(0);
  });

  it("Q scales linearly with catchment area", () => {
    const q1 = computeFloodFlow(82, 500_000);
    const q2 = computeFloodFlow(82, 1_000_000);
    expect(q2).toBeCloseTo(q1 * 2, 2);
  });

  it("Q scales linearly with rainfall", () => {
    const q1 = computeFloodFlow(41,  1_000_000);
    const q2 = computeFloodFlow(82,  1_000_000);
    expect(q2).toBeCloseTo(q1 * 2, 2);
  });
});

// ─── gaussianConc ─────────────────────────────────────────────────────────────

describe("gaussianConc", () => {
  const SOURCE_LAT = 52.8639;
  const SOURCE_LON = -118.1069;

  it("returns the full contamination level at the source point", () => {
    expect(gaussianConc(SOURCE_LAT, SOURCE_LON, 1.0)).toBeCloseTo(1.0, 3);
  });

  it("scales linearly with contaminationLevel at the source", () => {
    expect(gaussianConc(SOURCE_LAT, SOURCE_LON, 0.5)).toBeCloseTo(0.5, 3);
    expect(gaussianConc(SOURCE_LAT, SOURCE_LON, 0.0)).toBe(0);
  });

  it("decays toward zero far from the source", () => {
    // ~96 km north of source — should be essentially 0
    expect(gaussianConc(SOURCE_LAT + 0.864, SOURCE_LON, 1.0)).toBeCloseTo(0, 3);
  });

  it("is monotonically decreasing with distance", () => {
    const c0 = gaussianConc(SOURCE_LAT,         SOURCE_LON, 1.0); // at source
    const c1 = gaussianConc(SOURCE_LAT + 0.010, SOURCE_LON, 1.0); // ~1.1 km
    const c2 = gaussianConc(SOURCE_LAT + 0.030, SOURCE_LON, 1.0); // ~3.3 km
    expect(c0).toBeGreaterThan(c1);
    expect(c1).toBeGreaterThan(c2);
  });

  it("is clamped to [0, 1] even for contaminationLevel > 1", () => {
    expect(gaussianConc(SOURCE_LAT, SOURCE_LON, 2.0)).toBe(1.0);
    expect(gaussianConc(SOURCE_LAT, SOURCE_LON, -1.0)).toBe(0.0);
  });
});

// ─── computeContaminant ───────────────────────────────────────────────────────

describe("computeContaminant", () => {
  const SOURCE_LAT = 52.8639;
  const SOURCE_LON = -118.1069;

  it("returns centerConc ≈ 1 and edgeConc < centerConc at source with 500 m radius", () => {
    const { centerConc, edgeConc } = computeContaminant(SOURCE_LAT, SOURCE_LON, 1.0, 500);
    expect(centerConc).toBeCloseTo(1.0, 2);
    expect(edgeConc).toBeLessThan(centerConc);
    // Edge is 500 m north — decay at 500 m with sigma=3000: exp(-500²/18e6) ≈ 0.986
    expect(edgeConc).toBeCloseTo(0.986, 2);
  });

  it("edgeConc < centerConc (edge is always further from source than centre)", () => {
    const { centerConc, edgeConc } = computeContaminant(SOURCE_LAT, SOURCE_LON, 0.8, 1000);
    expect(edgeConc).toBeLessThan(centerConc);
  });

  it("both concentrations are 0 when contaminationLevel is 0", () => {
    const { centerConc, edgeConc } = computeContaminant(SOURCE_LAT, SOURCE_LON, 0, 500);
    expect(centerConc).toBe(0);
    expect(edgeConc).toBe(0);
  });

  it("larger radius produces lower edgeConc (edge point is further from source)", () => {
    const { edgeConc: edge500  } = computeContaminant(SOURCE_LAT, SOURCE_LON, 1.0, 500);
    const { edgeConc: edge1500 } = computeContaminant(SOURCE_LAT, SOURCE_LON, 1.0, 1500);
    expect(edge1500).toBeLessThan(edge500);
  });

  it("returns values rounded to 3 decimal places", () => {
    const { centerConc, edgeConc } = computeContaminant(SOURCE_LAT, SOURCE_LON, 0.7, 800);
    const decimals = (n: number) => (n.toString().split(".")[1] ?? "").length;
    expect(decimals(centerConc)).toBeLessThanOrEqual(3);
    expect(decimals(edgeConc)).toBeLessThanOrEqual(3);
  });
});
