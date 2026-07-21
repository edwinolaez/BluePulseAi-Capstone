// BurnScarLayer shows the forest burn scar zone on the map.
// It calls Richard's change-detection ML model to find out the current risk level
// for the Athabasca watershed sector, then draws a coloured circle on the map.

"use client";

import { useEffect, useState } from "react";
import { CircleMarker, Tooltip } from "react-leaflet";
import { fetchChangeDetection, ModelOutput } from "../../../lib/api";
import { HazardZone } from "./HazardZone";
import type { SensorInfo } from "./JasperMap";

const DEFAULT_SECTOR = "ATH-001-A";
// GPS centre from 2024 Jasper Wildfire centroid (Alberta Wildfire open data / NFDB fire polygon)
const CENTER: [number, number] = [52.848, -118.083];

const RISK_STYLE = {
  High:   { borderColor: "#ef4444", fillColor: "#f43f5e", badge: "CRITICAL" as const, badgeVariant: "red"   as const, valueColor: "#ef4444", dotColor: "#ef4444" },
  Medium: { borderColor: "#f59e0b", fillColor: "#fbbf24", badge: "WARNING"  as const, badgeVariant: "amber" as const, valueColor: "#f59e0b", dotColor: "#f59e0b" },
  Low:    { borderColor: "#22c55e", fillColor: "#4ade80", badge: "LOW"      as const, badgeVariant: "green" as const, valueColor: "#22c55e", dotColor: "#22c55e" },
} as const;

interface Props {
  onSectorClick?:  (id: string) => void;
  onSensorSelect?: (info: SensorInfo) => void;
  onMarkerClick?:  () => void;
}

export function BurnScarLayer({ onSectorClick, onSensorSelect, onMarkerClick }: Props) {
  const [result, setResult] = useState<ModelOutput | null>(null);

  useEffect(() => {
    fetchChangeDetection(DEFAULT_SECTOR)
      .then(setResult)
      .catch(() => setResult(null));
  }, []);

  const risk  = result?.risk_label ?? "High";
  const style = RISK_STYLE[risk as keyof typeof RISK_STYLE] ?? RISK_STYLE.High;

  const sensorInfo: SensorInfo = {
    icon: "flame",
    title: "FOREST BURN SCAR",
    badge: style.badge,
    badgeVariant: style.badgeVariant,
    name: `Burn Scar Zone ${DEFAULT_SECTOR}`,
    fields: [
      { label: "SECTOR ID",  value: DEFAULT_SECTOR },
      { label: "RISK LEVEL", value: risk,             valueColor: style.valueColor },
      { label: "RISK SCORE", value: result?.risk_score != null ? result.risk_score.toFixed(2) : "—" },
      { label: "STATUS",     value: "Active Monitoring", valueColor: "#0ea5e9" },
    ],
  };

  const dot = (
    <CircleMarker
      center={CENTER}
      radius={7}
      pathOptions={{ color: "#ffffff", fillColor: "#005EB8", fillOpacity: 1, weight: 2 }}
    >
      <Tooltip direction="top" offset={[0, -8]} opacity={1}>
        <div className="text-xs font-semibold">ATH-001-A</div>
        <div className="text-xs text-gray-500">Forest Regrowth Sensor</div>
        <div className="text-xs text-gray-400">52.8480°N, 118.0830°W</div>
      </Tooltip>
    </CircleMarker>
  );

  const zone = (
    <HazardZone
      center={CENTER}
      radius={2400}
      borderColor={style.borderColor}
      fillColor={style.fillColor}
      fillOpacity={0.08}
      badgeIcon="flame"
      badgeBg="#fff1f2"
      dotColor={style.dotColor}
      dotPulse
      sensorInfo={sensorInfo}
      onSectorClick={onSectorClick}
      onSensorSelect={onSensorSelect}
      onMarkerClick={onMarkerClick}
    />
  );

  return <>{dot}{zone}</>;
}
