"use client";

import { CircleMarker, Tooltip } from "react-leaflet";

const CENTER: [number, number] = [52.848, -118.083];

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

  const markerColor =
    recovery < 0.10 ? "#ef4444"   // red — early pioneer
    : recovery < 0.30 ? "#f59e0b" // amber — shrub/herb
    : recovery < 0.60 ? "#84cc16" // lime — sapling
    : "#22c55e";                   // green — canopy closure

  const statusLabel =
    recovery < 0.10 ? "Early Pioneer"
    : recovery < 0.30 ? "Shrub · Herb"
    : recovery < 0.60 ? "Sapling Stage"
    : "Canopy Closure";

  return (
    <CircleMarker
      center={CENTER}
      radius={7}
      pathOptions={{ color: "#ffffff", fillColor: markerColor, fillOpacity: 1, weight: 2 }}
    >
      <Tooltip direction="top" offset={[0, -8]} opacity={1}>
        <div className="text-xs font-semibold">ATH-001-A</div>
        <div className="text-xs text-gray-500">Forest Regrowth Sensor</div>
        <div className="text-xs" style={{ color: markerColor }}>{statusLabel} · {(recovery * 100).toFixed(1)}%</div>
        <div className="text-xs text-gray-400">52.8480°N, 118.0830°W</div>
      </Tooltip>
    </CircleMarker>
  );
}
