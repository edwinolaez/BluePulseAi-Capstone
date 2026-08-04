"use client";

import { CircleMarker, Polygon, Tooltip } from "react-leaflet";

const CENTER: [number, number] = [52.848, -118.083];

// Simplified perimeter of the 2024 Jasper wildfire (~35,000 ha burn area).
// Derived from Alberta Wildfire open-data boundary; coordinates in [lat, lon].
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

const JASPER_PRECIP_BASELINE = 450;
const GROWTH_RATE_BASE = 0.12;
const INITIAL_RECOVERY = 0.02;

function calcRecovery(yearsSinceFire: number, precipMmYr: number): number {
  if (yearsSinceFire <= 0) return INITIAL_RECOVERY;
  const rEff = GROWTH_RATE_BASE * Math.sqrt(precipMmYr / JASPER_PRECIP_BASELINE);
  return 1 / (1 + ((1 - INITIAL_RECOVERY) / INITIAL_RECOVERY) * Math.exp(-rEff * yearsSinceFire));
}

interface Props {
  yearsSinceFire?: number;
  precipMmYr?: number;
}

export function BurnScarLayer({ yearsSinceFire = 2, precipMmYr = 450 }: Props) {
  const recovery = calcRecovery(yearsSinceFire, precipMmYr);

  const fillColor =
    recovery < 0.10 ? "#ef4444"
    : recovery < 0.30 ? "#f59e0b"
    : recovery < 0.60 ? "#84cc16"
    : "#22c55e";

  const statusLabel =
    recovery < 0.10 ? "Early Pioneer"
    : recovery < 0.30 ? "Shrub · Herb"
    : recovery < 0.60 ? "Sapling Stage"
    : "Canopy Closure";

  return (
    <>
      {/* Burn scar polygon — fills real 2024 fire perimeter, colour tracks recovery */}
      <Polygon
        positions={BURN_SCAR_POLYGON}
        pathOptions={{
          color: fillColor,
          weight: 1.5,
          fillColor,
          fillOpacity: 0.22,
          dashArray: "4 3",
        }}
      >
        <Tooltip sticky opacity={1}>
          <div className="text-xs font-semibold">ATH-001-A · Forest Regrowth Sensor</div>
          <div className="text-xs text-gray-500">2024 Jasper Wildfire Perimeter · ~35,000 ha</div>
          <div className="text-xs" style={{ color: fillColor }}>{statusLabel} · {(recovery * 100).toFixed(1)}%</div>
        </Tooltip>
      </Polygon>

      {/* Sensor pin at centroid */}
      <CircleMarker
        center={CENTER}
        radius={7}
        pathOptions={{ color: "#ffffff", fillColor, fillOpacity: 1, weight: 2 }}
      >
        <Tooltip direction="top" offset={[0, -8]} opacity={1}>
          <div className="text-xs font-semibold">ATH-001-A</div>
          <div className="text-xs text-gray-500">Forest Regrowth Sensor</div>
          <div className="text-xs" style={{ color: fillColor }}>{statusLabel} · {(recovery * 100).toFixed(1)}%</div>
          <div className="text-xs text-gray-400">52.8480°N, 118.0830°W</div>
        </Tooltip>
      </CircleMarker>
    </>
  );
}
