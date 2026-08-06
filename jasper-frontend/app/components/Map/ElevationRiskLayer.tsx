"use client";

import { Polygon, Tooltip } from "react-leaflet";

// ── Category definitions ──────────────────────────────────────────────────────
// Mirrors the ArcGIS "Elevation Flood Risk" 5-class symbology.
// Polygons are terrain-derived approximations for the Jasper NP area.

interface RiskCategory {
  category:  1 | 2 | 3 | 4 | 5;
  label:     string;
  sublabel:  string;
  fill:      string;
  border:    string;
  opacity:   number;
  polygons:  [number, number][][];
}

const RISK_ZONES: RiskCategory[] = [
  // ── Category 1 — Minimal Risk (Gray) ────────────────────────────────────────
  // High-elevation bedrock ridges above treeline — structurally stable
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
  // Upper forested slopes outside the 2024 burn perimeter — some post-fire stress
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
  // Mid-elevation transitional slopes — partial burn exposure, moderate runoff
  {
    category: 3,
    label:    "Category 3 — Moderate Risk",
    sublabel: "Transitional terrain · partial burn",
    fill:     "#22c55e",
    border:   "#16a34a",
    opacity:  0.42,
    polygons: [
      // Eastern transitional (ATH-001-L low erosion zone)
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
  // River valley floors — Athabasca and Miette corridors, flood-prone lowlands
  // ATH-001-W (water sensor) and ATH-001-M (mid erosion) sit in this zone
  {
    category: 4,
    label:    "Category 4 — High Risk",
    sublabel: "River corridor · flood-prone lowlands",
    fill:     "#3b82f6",
    border:   "#1d4ed8",
    opacity:  0.45,
    polygons: [
      // Athabasca River valley (main corridor, E-W through town)
      [
        [52.898, -118.188], [52.907, -118.145], [52.902, -118.098],
        [52.889, -118.062], [52.876, -118.042], [52.862, -118.044],
        [52.860, -118.068], [52.874, -118.092], [52.886, -118.122],
        [52.894, -118.160],
      ],
      // Miette River confluence (west of town)
      [
        [52.884, -118.222], [52.872, -118.205], [52.862, -118.215],
        [52.865, -118.238], [52.876, -118.248], [52.887, -118.238],
      ],
    ],
  },

  // ── Category 5 — Extreme Risk (Red) ─────────────────────────────────────────
  // 2024 Jasper wildfire burn scar + steep erosion slopes
  // ATH-001-A (burn scar) and ATH-001-H (high erosion) sit in this zone
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

// ── Colour lookup by category ─────────────────────────────────────────────────
export const RISK_CATEGORY_COLORS: Record<number, { fill: string; label: string }> = {
  1: { fill: "#9ca3af", label: "Minimal" },
  2: { fill: "#f59e0b", label: "Low"     },
  3: { fill: "#22c55e", label: "Moderate"},
  4: { fill: "#3b82f6", label: "High"    },
  5: { fill: "#ef4444", label: "Extreme" },
};

// ── Flood inundation threshold ────────────────────────────────────────────────
// Returns the lowest risk category that becomes inundated at a given water level.
// Categories at or above this threshold are highlighted as flood zones.
function floodedFromCategory(waterLevelM: number): number {
  if (waterLevelM >= 4.8) return 1; // catastrophic — all zones including high ridges
  if (waterLevelM >= 4.5) return 2;
  if (waterLevelM >= 3.0) return 3;
  if (waterLevelM >= 1.5) return 4;
  if (waterLevelM >= 0.5) return 5;
  return 6; // nothing flooded
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ElevationRiskLayer({ waterLevelM = 0 }: { waterLevelM?: number }) {
  const floodCat = floodedFromCategory(waterLevelM);

  return (
    <>
      {RISK_ZONES.map((zone) => {
        const flooded = zone.category >= floodCat;
        return zone.polygons.map((coords, polyIdx) => (
          <Polygon
            key={`risk-${zone.category}-${polyIdx}`}
            positions={coords}
            interactive
            pathOptions={{
              color:       flooded ? "#1d4ed8" : zone.border,
              fillColor:   flooded ? "#3b82f6" : zone.fill,
              fillOpacity: flooded ? Math.min(zone.opacity + 0.25, 0.80) : zone.opacity,
              weight:      flooded ? 2 : 1,
              opacity:     flooded ? 1 : 0.7,
            }}
          >
            <Tooltip sticky direction="top" opacity={0.95}>
              <div style={{ minWidth: 190 }}>
                <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 2 }}>
                  {zone.label}
                </div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>
                  {zone.sublabel}
                </div>
                {/* Dynamic flood status badge — updates as slider moves */}
                <div style={{
                  marginTop: 5, padding: "2px 6px", borderRadius: 4,
                  background: flooded ? "#dbeafe" : `${zone.fill}18`,
                  border: `1px solid ${flooded ? "#3b82f6" : zone.fill}`,
                  fontSize: 10, fontWeight: 700,
                  color: flooded ? "#1d4ed8" : zone.fill,
                }}>
                  {flooded
                    ? `⚠ Flood Inundation Active · +${waterLevelM.toFixed(1)} m`
                    : `✓ Not flooded at +${waterLevelM.toFixed(1)} m`}
                </div>
                <div style={{
                  marginTop: 6, display: "flex", alignItems: "center", gap: 6,
                  fontSize: 11, fontWeight: 600,
                  color: flooded ? "#1d4ed8" : zone.fill,
                }}>
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
        ));
      })}
    </>
  );
}
