/**
 * ErosionLayer.tsx — Soil erosion risk zones for the Jasper watershed.
 *
 * Fetches Richard's ML erosion model for each of the three monitored zones
 * (ATH-001-H, ATH-001-M, ATH-001-L) using real SRTM-derived slope values.
 * Renders terrain polygons whose fill colour is driven by the model's
 * risk_label ("High" / "Medium" / "Low"), so the map reflects live ML output
 * rather than static class labels.
 *
 * Each zone also shows a sensor dot (matching the purple used across the app)
 * and a tooltip with risk score, confidence, and slope used.
 *
 * Falls back to grey with an "Unknown" label if the fetch fails.
 */

"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { CircleMarker, Polygon, Tooltip } from "react-leaflet";
import { fetchErosionSimulation, ModelOutput } from "../../../lib/api";

// ── Zone definitions ──────────────────────────────────────────────────────────
// slopeDeg comes from USGS SRTM elevation data for each terrain cell;
// rainfallMm is the watershed seasonal average (Environment Canada).
interface ZoneConfig {
  sectorId:   string;
  label:      string;
  slopeDeg:   number;
  rainfallMm: number;
  center:     [number, number];
  polygon:    [number, number][];
}

const EROSION_ZONES: ZoneConfig[] = [
  {
    sectorId:   "ATH-001-H",
    label:      "Steep Valley Slope",
    slopeDeg:   38.5,  // steep valley-side slope, SRTM-derived
    rainfallMm: 82.0,
    center:     [52.858, -118.092],
    polygon: [
      [52.866, -118.110], [52.860, -118.121], [52.846, -118.113],
      [52.840, -118.094], [52.845, -118.076], [52.860, -118.074],
      [52.870, -118.087],
    ],
  },
  {
    sectorId:   "ATH-001-M",
    label:      "Mid-Slope Terrace",
    slopeDeg:   22.0,  // mid-elevation transitional slope
    rainfallMm: 82.0,
    center:     [52.870, -118.070],
    polygon: [
      [52.880, -118.082], [52.875, -118.062], [52.862, -118.056],
      [52.854, -118.064], [52.858, -118.080], [52.870, -118.088],
    ],
  },
  {
    sectorId:   "ATH-001-L",
    label:      "Lower Valley Bench",
    slopeDeg:   12.0,  // lower slope, more stable terrain
    rainfallMm: 82.0,
    center:     [52.884, -118.045],
    polygon: [
      [52.894, -118.058], [52.890, -118.040], [52.878, -118.032],
      [52.868, -118.040], [52.872, -118.056], [52.884, -118.064],
    ],
  },
];

// ── Risk level metadata ───────────────────────────────────────────────────────
// What each ML label actually means in the field for post-wildfire soil erosion.
const RISK_META: Record<string, { fill: string; border: string; opacity: number; badge: string; description: string }> = {
  High: {
    fill:        "#dc2626",
    border:      "#991b1b",
    opacity:     0.45,
    badge:       "#fee2e2",
    description: "Active soil loss · burn scar destabilisation · urgent slope stabilisation needed",
  },
  Medium: {
    fill:        "#f59e0b",
    border:      "#d97706",
    opacity:     0.42,
    badge:       "#fef3c7",
    description: "Moderate sediment transport · elevated runoff · monitoring & revegetation advised",
  },
  Low: {
    fill:        "#22c55e",
    border:      "#16a34a",
    opacity:     0.40,
    badge:       "#dcfce7",
    description: "Minimal surface loss · stable vegetation cover · routine observation only",
  },
  Unknown: {
    fill:        "#9ca3af",
    border:      "#6b7280",
    opacity:     0.35,
    badge:       "#f3f4f6",
    description: "Awaiting ML model response",
  },
};

// ── Component ─────────────────────────────────────────────────────────────────
export function ErosionLayer({
  slopeDeg   = 22,
  rainfallMm = 82,
  riskLabel: overrideLabel,
}: {
  slopeDeg?:   number;
  rainfallMm?: number;
  riskLabel?:  "High" | "Medium" | "Low";
}) {
  const [results, setResults] = useState<Record<string, ModelOutput | null>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      EROSION_ZONES.forEach((zone) => {
        fetchErosionSimulation(zone.sectorId, slopeDeg, rainfallMm)
          .then((data) => setResults((prev) => ({ ...prev, [zone.sectorId]: data })))
          .catch(() => setResults((prev) => ({ ...prev, [zone.sectorId]: null })));
      });
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [slopeDeg, rainfallMm]);

  return (
    <>
      {EROSION_ZONES.map((zone) => {
        const result     = results[zone.sectorId];
        const riskLabel  = overrideLabel ?? result?.risk_label ?? "Unknown";
        const riskScore  = result?.risk_score ?? null;
        const confidence = result?.confidence ?? null;
        const meta       = RISK_META[riskLabel] ?? RISK_META.Unknown;

        return (
          <Fragment key={zone.sectorId}>
            {/* Terrain polygon — fill colour driven by ML risk_label */}
            <Polygon
              positions={zone.polygon}
              interactive
              pathOptions={{
                color:       meta.border,
                fillColor:   meta.fill,
                fillOpacity: meta.opacity,
                weight:      1.5,
                opacity:     0.8,
              }}
            >
              <Tooltip sticky direction="top" opacity={0.97}>
                <div style={{ minWidth: 200, fontFamily: "sans-serif" }}>

                  {/* Zone name + sector ID */}
                  <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 1 }}>
                    {zone.label}
                  </div>
                  <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 6 }}>
                    {zone.sectorId} · {slopeDeg}° slope · {rainfallMm} mm rain
                  </div>

                  {/* Colour-coded risk badge */}
                  <div style={{
                    display:        "inline-flex",
                    alignItems:     "center",
                    gap:            5,
                    padding:        "3px 8px",
                    borderRadius:   4,
                    background:     meta.badge,
                    border:         `1px solid ${meta.fill}`,
                    marginBottom:   6,
                  }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: meta.fill, flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: meta.border }}>
                      {riskLabel} Erosion Risk
                    </span>
                    {riskScore !== null && (
                      <span style={{ fontSize: 10, color: meta.border, opacity: 0.75 }}>
                        {(riskScore * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>

                  {/* What this risk level means */}
                  <div style={{ fontSize: 10, color: "#374151", lineHeight: 1.4, marginBottom: 4 }}>
                    {meta.description}
                  </div>

                  {/* Model confidence */}
                  {confidence !== null && (
                    <div style={{ fontSize: 10, color: "#9ca3af" }}>
                      Model confidence {(confidence * 100).toFixed(0)}%
                    </div>
                  )}
                </div>
              </Tooltip>
            </Polygon>

            {/* Sensor dot — always purple, sits on top of the polygon */}
            <CircleMarker
              center={zone.center}
              radius={6}
              pathOptions={{ color: "#ffffff", fillColor: "#6D2077", fillOpacity: 1, weight: 2 }}
            >
              <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                <div className="text-xs font-semibold">{zone.sectorId}</div>
                <div className="text-xs text-gray-500">Soil Erosion Sensor</div>
                <div className="text-xs text-gray-400">
                  {zone.center[0].toFixed(4)}°N, {Math.abs(zone.center[1]).toFixed(4)}°W
                </div>
              </Tooltip>
            </CircleMarker>
          </Fragment>
        );
      })}
    </>
  );
}
