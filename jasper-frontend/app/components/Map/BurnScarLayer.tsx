/**
 * BurnScarLayer.tsx — 2D Leaflet layer for the 2024 Jasper wildfire burn scar.
 *
 * Draws three elements:
 *   1. A large polygon tracing the ~35,000 ha fire perimeter (from Alberta Wildfire open data)
 *   2. A CircleMarker sensor dot at the centroid (ATH-001-A)
 *   Both elements show dynamic recovery information in their tooltips.
 *
 * Digital twin interaction:
 *   The Forest Growth panel in the sidebar exposes two sliders:
 *     - yearsSinceFire — how many years have passed since the 2024 fire
 *     - precipMmYr    — annual precipitation (affects how fast vegetation regrows)
 *   When either slider moves, `calcRecovery()` re-runs and the polygon/dot:
 *     - Changes fill colour (red → amber → lime → green)
 *     - Updates the recovery % and stage label in the tooltip badge
 *
 *   The same logistic formula is used in sensorPhysics.ts > computeForestRecovery()
 *   and in ThreeDView.tsx > calcForestRecovery() so all three views stay consistent.
 */
"use client";

import { CircleMarker, Polygon, Tooltip } from "react-leaflet";

/** Centre of the 2024 Jasper wildfire burn scar — used as the sensor pin location. */
const CENTER: [number, number] = [52.848, -118.083];

/**
 * BURN_SCAR_POLYGON — simplified perimeter of the 2024 Jasper wildfire (~35,000 ha).
 *
 * Derived from Alberta Wildfire open-data boundary; coordinates in [lat, lon] order
 * (Leaflet convention — note deck.gl in ThreeDView.tsx uses [lon, lat] order).
 * The polygon is a simplified approximation — the actual fire boundary has thousands
 * of vertices; this version uses 18 points for performance.
 */
const BURN_SCAR_POLYGON: [number, number][] = [
  [52.938, -118.200],
  [52.920, -118.135],
  [52.905, -118.068],
  [52.893, -118.010],
  [52.872, -117.965],
  [52.848, -117.945],
  [52.822, -117.960],
  [52.800, -117.995],
  [52.778, -118.050],
  [52.762, -118.110],
  [52.758, -118.175],
  [52.770, -118.228],
  [52.795, -118.258],
  [52.828, -118.258],
  [52.862, -118.240],
  [52.898, -118.215],
  [52.925, -118.208],
  [52.938, -118.200],
];

// ── Logistic forest recovery model constants ──────────────────────────────────
// These must match the constants in sensorPhysics.ts and ThreeDView.tsx exactly.
// If the formula is updated, update all three locations to maintain parity.
const JASPER_PRECIP_BASELINE = 450; // mm/yr — historical average precipitation for Jasper NP
const GROWTH_RATE_BASE = 0.12;      // base logistic growth rate at baseline precipitation
const INITIAL_RECOVERY = 0.02;      // 2% — "Early Pioneer" fraction immediately after fire

/**
 * calcRecovery — logistic regrowth fraction (0–1) as a function of time and rainfall.
 *
 * The logistic model captures three stages of post-fire recovery:
 *   P₀ = 2%  → "Early Pioneer" (fire-tolerant species like fireweed)
 *   ~10–30%  → "Shrub · Herb"  (dense herbaceous and shrub establishment)
 *   ~30–60%  → "Sapling Stage" (conifer saplings competing with shrubs)
 *   > 60%    → "Canopy Closure" (mature canopy re-established)
 *
 * The growth rate rEff scales with precipitation so that drier-than-average years
 * produce slower recovery (realistic for drought-stressed forest).
 *
 * @param yearsSinceFire - years elapsed since the 2024 fire (0 = year of fire)
 * @param precipMmYr     - annual precipitation in mm/yr
 * @returns recovery fraction in [0, 1]
 */
function calcRecovery(yearsSinceFire: number, precipMmYr: number): number {
  if (yearsSinceFire <= 0) return INITIAL_RECOVERY; // fire just happened — only pioneer cover
  const rEff = GROWTH_RATE_BASE * Math.sqrt(precipMmYr / JASPER_PRECIP_BASELINE);
  return 1 / (1 + ((1 - INITIAL_RECOVERY) / INITIAL_RECOVERY) * Math.exp(-rEff * yearsSinceFire));
}

interface Props {
  yearsSinceFire?: number; // from Forest Growth panel slider (default = 2 = current Jasper situation)
  precipMmYr?:    number;  // from Forest Growth panel slider (default = 450 = Jasper baseline)
}

/**
 * BurnScarLayer — renders the wildfire perimeter polygon and sensor pin.
 *
 * Both elements colour-code by recovery stage and show dynamic tooltips that update
 * in real time as the Forest Growth panel sliders move.
 */
export function BurnScarLayer({ yearsSinceFire = 2, precipMmYr = 450 }: Props) {
  // Compute current recovery fraction — re-runs on every slider tick
  const recovery = calcRecovery(yearsSinceFire, precipMmYr);

  // Colour shifts from red (early pioneer) → amber → lime → green (canopy closure)
  // These thresholds and colours are shared with sensorPhysics.ts and ThreeDView.tsx
  const fillColor =
    recovery < 0.10 ? "#ef4444"  // red   — Early Pioneer (< 10%)
    : recovery < 0.30 ? "#f59e0b"  // amber — Shrub · Herb (10–30%)
    : recovery < 0.60 ? "#84cc16"  // lime  — Sapling Stage (30–60%)
    : "#22c55e";                    // green — Canopy Closure (> 60%)

  // Human-readable stage label shown in tooltip badges
  const statusLabel =
    recovery < 0.10 ? "Early Pioneer"
    : recovery < 0.30 ? "Shrub · Herb"
    : recovery < 0.60 ? "Sapling Stage"
    : "Canopy Closure";

  return (
    <>
      {/*
        Burn scar polygon — traces the 2024 fire perimeter.
        Fill and stroke colour both use fillColor so the slab reads as a single colour.
        dashArray gives it a distinct visual style vs the solid elevation risk polygons.
      */}
      <Polygon
        positions={BURN_SCAR_POLYGON}
        pathOptions={{
          color:       fillColor,
          weight:      1.5,
          fillColor,
          fillOpacity: 0.22,  // light enough to see the map tiles underneath
          dashArray:   "4 3", // dashed perimeter — signals this is a derived boundary, not infrastructure
        }}
      >
        {/*
          Polygon tooltip — shows the fire metadata and the dynamic recovery stage badge.
          The badge background and text colour both come from fillColor so it always matches
          the current polygon colour even as the slider changes it.
        */}
        <Tooltip sticky opacity={1}>
          <div className="text-xs font-semibold">ATH-001-A · Forest Regrowth Sensor</div>
          <div className="text-xs text-gray-500">2024 Jasper Wildfire Perimeter · ~35,000 ha</div>

          {/* Dynamic recovery stage badge — updates live as Forest Growth sliders move */}
          <div style={{
            marginTop: 4, display: "inline-block",
            padding: "1px 6px", borderRadius: 4,
            background: `${fillColor}22`,   // 22 hex ≈ 13% opacity fill
            border: `1px solid ${fillColor}`,
            fontSize: 10, fontWeight: 700, color: fillColor,
          }}>
            {statusLabel} · {(recovery * 100).toFixed(1)}% recovery
          </div>
        </Tooltip>
      </Polygon>

      {/*
        Sensor pin at the burn scar centroid — a small CircleMarker so the exact
        monitoring location is visible at all zoom levels.
        White stroke + coloured fill matches the ContaminantLayer and ErosionLayer pins.
      */}
      <CircleMarker
        center={CENTER}
        radius={7}
        pathOptions={{ color: "#ffffff", fillColor, fillOpacity: 1, weight: 2 }}
      >
        {/*
          Pin tooltip — shows the sensor ID, type, and the same dynamic recovery data.
          Showing both the stage and the percentage gives researchers two reference points:
          the qualitative stage they can compare against field photos, and the numeric
          value they can cite in reports.
        */}
        <Tooltip direction="top" offset={[0, -8]} opacity={1}>
          <div className="text-xs font-semibold">ATH-001-A</div>
          <div className="text-xs text-gray-500">Forest Regrowth Sensor</div>
          {/* Dynamic recovery status — colour-coded to match the current polygon */}
          <div className="text-xs font-semibold" style={{ color: fillColor }}>
            {statusLabel} · {(recovery * 100).toFixed(1)}% recovery
          </div>
          <div className="text-xs text-gray-400">52.8480°N, 118.0830°W</div>
        </Tooltip>
      </CircleMarker>
    </>
  );
}
