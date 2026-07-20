/**
 * Unit tests for lib/interpolation.ts
 *
 * Owner: Edwin (QA)
 * Scope: Sprint 4 — Gradual Timeline Interpolation feature
 *
 * These tests verify the blending math is correct at every edge case:
 * exact hit, between two scans, before all scans, after all scans, empty list.
 */

import { interpolateScans } from "../lib/interpolation";
import type { ScanRecord } from "../lib/interpolation";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SCAN_A: ScanRecord = {
  timestamp:          "2024-06-01T00:00:00.000Z",
  layer_type:         "burn_scar",
  vegetation_pct:     20,
  erosion_risk_score: 0.9,
  water_turbidity:    8.0,
};

const SCAN_B: ScanRecord = {
  timestamp:          "2024-08-01T00:00:00.000Z",
  layer_type:         "burn_scar",
  vegetation_pct:     60,
  erosion_risk_score: 0.3,
  water_turbidity:    3.0,
};

const TWO_SCANS = [SCAN_A, SCAN_B];

function ms(iso: string) {
  return new Date(iso).getTime();
}

// ── Empty input ───────────────────────────────────────────────────────────────

test("returns null for empty scans array", () => {
  expect(interpolateScans([], ms("2024-07-01T00:00:00.000Z"))).toBeNull();
});

// ── Exact hits ────────────────────────────────────────────────────────────────

test("returns scan A values exactly when slider is on scan A date", () => {
  const result = interpolateScans(TWO_SCANS, ms(SCAN_A.timestamp));
  expect(result).not.toBeNull();
  expect(result!.vegetation_pct).toBe(20);
  expect(result!.erosion_risk_score).toBe(0.9);
  expect(result!.water_turbidity).toBe(8.0);
  expect(result!.is_estimated).toBe(false);
  expect(result!.blend_factor).toBe(0);
});

test("returns scan B values exactly when slider is on scan B date", () => {
  const result = interpolateScans(TWO_SCANS, ms(SCAN_B.timestamp));
  expect(result).not.toBeNull();
  expect(result!.vegetation_pct).toBe(60);
  expect(result!.erosion_risk_score).toBe(0.3);
  expect(result!.is_estimated).toBe(false);
});

// ── Linear interpolation ──────────────────────────────────────────────────────

test("blends 50% between two scans at midpoint", () => {
  const midMs = (ms(SCAN_A.timestamp) + ms(SCAN_B.timestamp)) / 2;
  const result = interpolateScans(TWO_SCANS, midMs);
  expect(result).not.toBeNull();
  expect(result!.vegetation_pct).toBeCloseTo(40, 1);       // (20+60)/2
  expect(result!.erosion_risk_score).toBeCloseTo(0.6, 2);  // (0.9+0.3)/2
  expect(result!.water_turbidity).toBeCloseTo(5.5, 1);     // (8+3)/2
  expect(result!.is_estimated).toBe(true);
  expect(result!.blend_factor).toBeCloseTo(0.5, 2);
});

test("blend_factor is 0.25 at one-quarter between two scans", () => {
  const quarterMs = ms(SCAN_A.timestamp) + (ms(SCAN_B.timestamp) - ms(SCAN_A.timestamp)) * 0.25;
  const result = interpolateScans(TWO_SCANS, quarterMs);
  expect(result!.blend_factor).toBeCloseTo(0.25, 2);
  expect(result!.vegetation_pct).toBeCloseTo(30, 1); // 20 + 0.25*(60-20)
});

test("nearest_before and nearest_after are set when between two scans", () => {
  const midMs = (ms(SCAN_A.timestamp) + ms(SCAN_B.timestamp)) / 2;
  const result = interpolateScans(TWO_SCANS, midMs);
  expect(result!.nearest_before).toBe(SCAN_A.timestamp);
  expect(result!.nearest_after).toBe(SCAN_B.timestamp);
});

// ── Clamping at boundaries ─────────────────────────────────────────────────────

test("clamps to first scan when slider is before all scans", () => {
  const result = interpolateScans(TWO_SCANS, ms("2024-01-01T00:00:00.000Z"));
  expect(result).not.toBeNull();
  expect(result!.vegetation_pct).toBe(20);
  expect(result!.is_estimated).toBe(true);
  expect(result!.nearest_before).toBeNull();
  expect(result!.nearest_after).toBe(SCAN_A.timestamp);
});

test("clamps to last scan when slider is after all scans", () => {
  const result = interpolateScans(TWO_SCANS, ms("2025-12-31T00:00:00.000Z"));
  expect(result).not.toBeNull();
  expect(result!.vegetation_pct).toBe(60);
  expect(result!.is_estimated).toBe(true);
  expect(result!.nearest_after).toBeNull();
  expect(result!.nearest_before).toBe(SCAN_B.timestamp);
});

// ── Erosion label mapping ─────────────────────────────────────────────────────

test("erosion_risk label is High when score >= 0.7", () => {
  const result = interpolateScans(TWO_SCANS, ms(SCAN_A.timestamp)); // score=0.9
  expect(result!.erosion_risk).toBe("High");
});

test("erosion_risk label is Low when score < 0.35", () => {
  const result = interpolateScans(TWO_SCANS, ms(SCAN_B.timestamp)); // score=0.3
  expect(result!.erosion_risk).toBe("Low");
});

test("erosion_risk label is Medium at blend midpoint (score ~0.6)", () => {
  const midMs = (ms(SCAN_A.timestamp) + ms(SCAN_B.timestamp)) / 2;
  const result = interpolateScans(TWO_SCANS, midMs); // score=0.6
  expect(result!.erosion_risk).toBe("Medium");
});

// ── Single scan ───────────────────────────────────────────────────────────────

test("handles single scan — exact hit is not estimated", () => {
  const result = interpolateScans([SCAN_A], ms(SCAN_A.timestamp));
  expect(result!.is_estimated).toBe(false);
});

test("handles single scan — any other date clamps and is estimated", () => {
  const result = interpolateScans([SCAN_A], ms("2024-09-01T00:00:00.000Z"));
  expect(result!.is_estimated).toBe(true);
  expect(result!.vegetation_pct).toBe(20);
});
