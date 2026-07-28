// BurnScarLayer.tsx — The Forest Burn Scar Zone on the Map
//
// This layer represents the area of Jasper that was damaged by the 2024 wildfire.
// It draws the large dashed circle you see on the map and colours it based on
// how severe the current risk level is.
//
// How it works:
//   1. When the component loads, it calls the backend ML model (change detection)
//      and asks: "What is the current risk level for this sector?"
//   2. The model responds with High, Medium, or Low
//   3. BurnScarLayer picks the matching colour — red, amber, or green
//   4. It draws the circle on the map in that colour
//   5. If the user clicks the badge, it sends the zone's sensor data up to
//      MapViewPage so the right panel can display it
//
// If the backend is unreachable, it defaults to High risk so the map
// never appears broken — it always shows something.

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
