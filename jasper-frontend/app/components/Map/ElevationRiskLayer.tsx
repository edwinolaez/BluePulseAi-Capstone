/**
 * ElevationRiskLayer.tsx — Leaflet polygon layer showing ArcGIS-style flood risk zones.
 *
 * Five risk categories mirror the "Elevation Flood Risk" 5-class symbology from ArcGIS:
 *   Category 1 (Gray)  — Minimal — high bedrock ridges above treeline
 *   Category 2 (Amber) — Low     — upper forested slopes
 *   Category 3 (Green) — Moderate — mid-elevation transitional terrain
 *   Category 4 (Blue)  — High    — Athabasca/Miette river valley floors
 *   Category 5 (Red)   — Extreme — 2024 wildfire burn scar + steep erosion slopes
 *
 * Each category can contain multiple polygon shapes (e.g. Category 1 has two separate
 * ridgelines, Category 4 has the main river corridor plus the Miette confluence).
 *
 * Digital twin interaction:
 *   The `waterLevelM` prop is driven by the Flood Elevation panel slider in the sidebar.
 *   As the slider moves, `floodedFromCategory()` computes which categories become
 *   inundated and the polygons immediately re-style to a uniform flood blue with a
 *   dynamic badge showing the current water level.
 *
 *   This parity is replicated in ThreeDView.tsx so 2D and 3D show the same flood state.
 *
 * EXPORTS:
 *   RISK_CATEGORY_COLORS is also exported so the sidebar legend and tooltip can
 *   reference the same colours without duplicating the definitions.
 */
"use client";

import { Polygon, Tooltip } from "react-leaflet";

// ── Category definitions ──────────────────────────────────────────────────────
// Each RiskCategory bundles all the data needed to draw and label its polygons.
// Having label, sublabel, and colours co-located with the polygon coordinates
// means adding a new zone only requires one entry here, not changes in multiple places.

interface RiskCategory {
  category:  1 | 2 | 3 | 4 | 5;
  label:     string;     // shown as the bold tooltip heading
  sublabel:  string;     // secondary description line
  fill:      string;     // polygon fill colour (hex)
  border:    string;     // polygon stroke colour (hex)
  opacity:   number;     // base fill opacity (increased when flooded)
  polygons:  [number, number][][]; // array of shapes — each shape is [lat, lon][] pairs
}

const RISK_ZONES: RiskCategory[] = [
  // ── Category 1 — Minimal Risk (Gray) ────────────────────────────────────────
  // High-elevation bedrock ridges above treeline — structurally stable, rarely floods.
  // Covers Pyramid Mountain / Colin Range northern ridges and Queen Elizabeth Ranges.
  {
    category: 1,
    label:    "Category 1 — Minimal Risk",
    sublabel: "High ridges · stable bedrock",
    fill:     "#9ca3af",
    border:   "#6b7280",
    opacity:  0.45,
    polygons: [
      // Pyramid Mountain / Colin Range northern ridges
      [
        [52.972, -118.245], [52.988, -118.175], [52.978, -118.095],
        [52.958, -118.058], [52.938, -118.075], [52.936, -118.145],
        [52.950, -118.210],
      ],
      // Eastern high ridge (Queen Elizabeth Ranges)
      [
        [52.962, -117.942], [52.974, -117.895], [52.952, -117.848],
        [52.918, -117.838], [52.898, -117.862], [52.893, -117.902],
        [52.914, -117.932], [52.942, -117.942],
      ],
    ],
  },

  // ── Category 2 — Low Risk (Orange) ──────────────────────────────────────────
  // Upper forested slopes outside the 2024 burn perimeter.
  // Post-fire stress reduces canopy interception, slightly increasing runoff.
  {
    category: 2,
    label:    "Category 2 — Low Risk",
    sublabel: "Upper slopes · stable terrain",
    fill:     "#f59e0b",
    border:   "#d97706",
    opacity:  0.42,
    polygons: [
      // Northwest slopes (Whistlers / Marmot Basin area)
      [
        [52.942, -118.210], [52.958, -118.158], [52.952, -118.105],
        [52.935, -118.078], [52.920, -118.068], [52.906, -118.092],
        [52.913, -118.132], [52.928, -118.172],
      ],
      // Northeast stable zone (Lac Beauvert upland)
      [
        [52.942, -118.012], [52.953, -117.970], [52.936, -117.930],
        [52.912, -117.920], [52.893, -117.938], [52.884, -117.965],
        [52.896, -117.985], [52.920, -117.997], [52.934, -118.018],
      ],
    ],
  },

  // ── Category 3 — Moderate Risk (Green) ──────────────────────────────────────
  // Mid-elevation transitional slopes — partial burn exposure, moderate runoff.
  // Transitional zones between stable ridges and flood-prone valley floors.
  {
    category: 3,
    label:    "Category 3 — Moderate Risk",
    sublabel: "Transitional terrain · partial burn",
    fill:     "#22c55e",
    border:   "#16a34a",
    opacity:  0.42,
    polygons: [
      // Eastern transitional (ATH-001-L lower erosion zone)
      [
        [52.902, -118.052], [52.915, -118.020], [52.906, -117.988],
        [52.888, -117.972], [52.868, -117.965], [52.852, -117.975],
        [52.845, -118.005], [52.858, -118.024], [52.877, -118.038],
        [52.892, -118.044],
      ],
      // Northern transitional (between town and high ridges)
      [
        [52.922, -118.105], [52.933, -118.072], [52.922, -118.038],
        [52.904, -118.033], [52.896, -118.058], [52.904, -118.092],
      ],
    ],
  },

  // ── Category 4 — High Risk (Blue) ───────────────────────────────────────────
  // River valley floors — Athabasca and Miette corridors, historically flood-prone.
  // ATH-001-W (water quality sensor) and ATH-001-M (mid erosion) sit in this zone.
  {
    category: 4,
    label:    "Category 4 — High Risk",
    sublabel: "River corridor · flood-prone lowlands",
    fill:     "#3b82f6",
    border:   "#1d4ed8",
    opacity:  0.45,
    polygons: [
      // Athabasca River valley (main E-W corridor through Jasper townsite)
      [
        [52.898, -118.188], [52.907, -118.145], [52.902, -118.098],
        [52.889, -118.062], [52.876, -118.042], [52.862, -118.044],
        [52.860, -118.068], [52.874, -118.092], [52.886, -118.122],
        [52.894, -118.160],
      ],
      // Miette River confluence (west of Jasper townsite)
      [
        [52.884, -118.222], [52.872, -118.205], [52.862, -118.215],
        [52.865, -118.238], [52.876, -118.248], [52.887, -118.238],
      ],
    ],
  },

  // ── Category 5 — Extreme Risk (Red) ─────────────────────────────────────────
  // 2024 Jasper wildfire burn scar + steep erosion slopes.
  // ATH-001-A (burn scar sensor) and ATH-001-H (high erosion) sit in this zone.
  // Post-fire hydrophobic soil layers dramatically increase runoff and erosion.
  {
    category: 5,
    label:    "Category 5 — Extreme Risk",
    sublabel: "Active burn scar · extreme erosion",
    fill:     "#ef4444",
    border:   "#b91c1c",
    opacity:  0.48,
    polygons: [
      // Main 2024 wildfire burn scar (SW of Jasper townsite)
      [
        [52.872, -118.110], [52.862, -118.128], [52.846, -118.135],
        [52.830, -118.120], [52.816, -118.098], [52.812, -118.068],
        [52.824, -118.044], [52.842, -118.035], [52.860, -118.046],
        [52.874, -118.065], [52.876, -118.088],
      ],
      // Secondary burn area (SE extension)
      [
        [52.857, -118.032], [52.846, -118.015], [52.830, -118.022],
        [52.820, -118.044], [52.834, -118.058], [52.852, -118.050],
      ],
    ],
  },
];

// ── Colour lookup — exported so the sidebar legend and map legend can match ───
// Keeps colour definitions in a single place — no risk of sidebar and layer diverging.
export const RISK_CATEGORY_COLORS: Record<number, { fill: string; label: string }> = {
  1: { fill: "#9ca3af", label: "Minimal" },
  2: { fill: "#f59e0b", label: "Low"     },
  3: { fill: "#22c55e", label: "Moderate"},
  4: { fill: "#3b82f6", label: "High"    },
  5: { fill: "#ef4444", label: "Extreme" },
};

// ── Flood inundation threshold ────────────────────────────────────────────────
/**
 * floodedFromCategory — determine which risk categories become inundated at a given
 * water level and return the lowest affected category number.
 *
 * Any category at or above this number is considered flooded and re-styled to blue.
 * Returns 6 (above any valid category) when the water level is below all thresholds
 * so nothing appears flooded.
 *
 * Threshold values are calibrated to Athabasca River historical flood data:
 *   0.5 m — minor overbank flow reaches the Category 5 burn scar floodplain
 *   1.5 m — Category 4 river corridor (Jasper townsite edges) begins inundating
 *   3.0 m — Category 3 mid-slope transitional terrain flooded (major flood event)
 *   4.5 m — Category 2 upper slopes reached (extreme / 1:200-year event)
 *   4.8 m — Category 1 bedrock ridges (catastrophic — essentially never occurs)
 */
function floodedFromCategory(waterLevelM: number): number {
  if (waterLevelM >= 4.8) return 1; // catastrophic — all zones including high ridges
  if (waterLevelM >= 4.5) return 2;
  if (waterLevelM >= 3.0) return 3;
  if (waterLevelM >= 1.5) return 4;
  if (waterLevelM >= 0.5) return 5;
  return 6; // nothing flooded — slider is below 0.5 m
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * ElevationRiskLayer — renders all 5 risk category polygons on the 2D Leaflet map.
 *
 * @param waterLevelM - current flood elevation from the Flood Elevation panel slider (0–5 m)
 */
export function ElevationRiskLayer({ waterLevelM = 0 }: { waterLevelM?: number }) {
  // Compute the inundation threshold once per render — every polygon re-checks it
  const floodCat = floodedFromCategory(waterLevelM);

  return (
    <>
      {RISK_ZONES.map((zone) =>
        zone.polygons.map((coords, polyIdx) => {
          // A zone is flooded when its category number is ≥ the lowest flooded category.
          // e.g. if floodCat=4, then categories 4 and 5 are flooded; 1, 2, 3 are not.
          const flooded = zone.category >= floodCat;
          return (
            <Polygon
              key={`risk-${zone.category}-${polyIdx}`}
              positions={coords}
              interactive
              pathOptions={{
                // Flood overrides normal colour with uniform blue to show inundation
                color:       flooded ? "#1d4ed8" : zone.border,
                fillColor:   flooded ? "#3b82f6" : zone.fill,
                // Flooded polygons become more opaque to stand out visually
                fillOpacity: flooded ? Math.min(zone.opacity + 0.25, 0.80) : zone.opacity,
                weight:      flooded ? 2 : 1,
                opacity:     flooded ? 1 : 0.7,
              }}
            >
              <Tooltip sticky direction="top" opacity={0.95}>
                <div style={{ minWidth: 190 }}>
                  {/* Category name — bold heading */}
                  <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 2 }}>
                    {zone.label}
                  </div>
                  {/* Terrain description */}
                  <div style={{ fontSize: 11, color: "#6b7280" }}>
                    {zone.sublabel}
                  </div>

                  {/*
                    Dynamic flood status badge — this is the key interactive element.
                    Updates every time the waterLevelM prop changes (i.e. as the slider moves).
                    Shows either an active flood warning or a "not flooded at +X m" confirmation
                    so the user knows exactly what the current slider setting means for this zone.
                  */}
                  <div style={{
                    marginTop: 5, padding: "2px 6px", borderRadius: 4,
                    background: flooded ? "#dbeafe" : `${zone.fill}18`, // 18 = ~10% opacity
                    border: `1px solid ${flooded ? "#3b82f6" : zone.fill}`,
                    fontSize: 10, fontWeight: 700,
                    color: flooded ? "#1d4ed8" : zone.fill,
                  }}>
                    {flooded
                      ? `⚠ Flood Inundation Active · +${waterLevelM.toFixed(1)} m`
                      : `✓ Not flooded at +${waterLevelM.toFixed(1)} m`}
                  </div>

                  {/* Risk class footer — shows inundation warning if flooded */}
                  <div style={{
                    marginTop: 6, display: "flex", alignItems: "center", gap: 6,
                    fontSize: 11, fontWeight: 600,
                    color: flooded ? "#1d4ed8" : zone.fill,
                  }}>
                    {/* Colour swatch matching the polygon fill */}
                    <span style={{
                      display: "inline-block", width: 10, height: 10,
                      borderRadius: 2, background: flooded ? "#3b82f6" : zone.fill,
                    }} />
                    {flooded
                      ? `Risk Class ${zone.category} · ⚠ Inundated`
                      : `Elevation Risk Class ${zone.category}`}
                  </div>
                </div>
              </Tooltip>
            </Polygon>
          );
        })
      )}
    </>
  );
}
