// ErosionLayer draws three overlapping erosion risk zones on the map —
// one High, one Medium, one Low — at different terrain positions in the watershed.
// Each zone fetches its own risk prediction from Richard's erosion simulation API
// using the real slope angle and rainfall amount for that specific location.
// All three API calls run at the same time for speed.

"use client";

import { useEffect, useState } from "react";
import { CircleMarker, Tooltip } from "react-leaflet";
import { fetchErosionSimulation, ModelOutput } from "../../../lib/api";
import { HazardZone } from "./HazardZone";
import type { SensorInfo } from "./JasperMap";

const ZONES = [
  { sectorId: "ATH-001-H", center: [52.858, -118.092] as [number, number], radius: 1400, slopeDeg: 42, rainfallMm: 95 },
  { sectorId: "ATH-001-M", center: [52.870, -118.070] as [number, number], radius: 1100, slopeDeg: 28, rainfallMm: 68 },
  { sectorId: "ATH-001-L", center: [52.884, -118.045] as [number, number], radius: 900,  slopeDeg: 16, rainfallMm: 40 },
];

const STYLE_BY_LABEL = {
  High:   { borderColor: "#a855f7", fillColor: "#c084fc", badge: "CRITICAL" as const, badgeVariant: "red"   as const, valueColor: "#ef4444", dotColor: "#ef4444" },
  Medium: { borderColor: "#8b5cf6", fillColor: "#a78bfa", badge: "WARNING"  as const, badgeVariant: "amber" as const, valueColor: "#f59e0b", dotColor: "#f59e0b" },
  Low:    { borderColor: "#6d28d9", fillColor: "#7c3aed", badge: "LOW"      as const, badgeVariant: "green" as const, valueColor: "#22c55e", dotColor: "#22c55e" },
} as const;

const DEFAULT_RISK = ["High", "Medium", "Low"] as const;

interface Props {
  onSectorClick?:  (id: string) => void;
  onSensorSelect?: (info: SensorInfo) => void;
  onMarkerClick?:  () => void;
}

export function ErosionLayer({ onSectorClick, onSensorSelect, onMarkerClick }: Props) {
  const [results, setResults] = useState<(ModelOutput | null)[]>([null, null, null]);

  useEffect(() => {
    Promise.allSettled(
      ZONES.map((z) => fetchErosionSimulation(z.sectorId, z.slopeDeg, z.rainfallMm))
    ).then((settled) => {
      setResults(settled.map((r) => (r.status === "fulfilled" ? r.value : null)));
    });
  }, []);

  return (
    <>
      {ZONES.map((zone, i) => {
        const risk  = results[i]?.risk_label ?? DEFAULT_RISK[i];
        const style = STYLE_BY_LABEL[risk as keyof typeof STYLE_BY_LABEL] ?? STYLE_BY_LABEL.Medium;
        const score = results[i]?.risk_score;

        const sensorInfo: SensorInfo = {
          icon: "mountain",
          title: "SOIL EROSION ANALYSIS",
          badge: style.badge,
          badgeVariant: style.badgeVariant,
          name: `Slope Area ${zone.sectorId}`,
          fields: [
            { label: "AREA ID",        value: zone.sectorId },
            { label: "RISK LEVEL",     value: risk,                               valueColor: style.valueColor },
            { label: "RISK SCORE",     value: score != null ? score.toFixed(2) : "—" },
            { label: "SLOPE ANGLE",    value: `${zone.slopeDeg}°`,                valueColor: "#a855f7" },
            { label: "RAINFALL INPUT", value: `${zone.rainfallMm} mm`, fullWidth: true },
          ],
        };

        return (
          <HazardZone
            key={zone.sectorId}
            center={zone.center}
            radius={zone.radius}
            borderColor={style.borderColor}
            fillColor={style.fillColor}
            fillOpacity={0.12}
            badgeIcon="mountain"
            dotColor={style.dotColor}
            sensorInfo={sensorInfo}
            onSectorClick={onSectorClick}
            onSensorSelect={onSensorSelect}
            onMarkerClick={onMarkerClick}
          />
        );
      })}

      {/* Soil Erosion sensor dots — purple #6D2077, matches 3D map colour */}
      {ZONES.map((zone) => (
        <CircleMarker
          key={`dot-${zone.sectorId}`}
          center={zone.center}
          radius={7}
          pathOptions={{ color: "#ffffff", fillColor: "#6D2077", fillOpacity: 1, weight: 2 }}
        >
          <Tooltip direction="top" offset={[0, -8]} opacity={1}>
            <div className="text-xs font-semibold">{zone.sectorId}</div>
            <div className="text-xs text-gray-500">Soil Erosion Sensor</div>
            <div className="text-xs text-gray-400">{zone.center[0].toFixed(4)}°N, {Math.abs(zone.center[1]).toFixed(4)}°W</div>
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  );
}
