// ErosionLayer.tsx — The Soil Erosion Risk Zones on the Map
//
// This layer shows three purple dashed circles on the map, each representing
// a different area of Jasper that is at risk of soil erosion after the wildfire.
//
// Why three zones?
//   Different parts of the terrain have different slope angles and rainfall levels,
//   so the risk is different in each area. One zone might be High risk while
//   another is Low — this gives a more accurate picture than one single zone.
//
// How it works:
//   1. When the component loads, it calls the backend ML erosion model three times —
//      once per zone — sending the slope angle and rainfall amount for each location
//   2. All three calls run at the same time so the page loads faster
//   3. Each zone gets back a risk level (High, Medium, or Low) and displays it
//   4. Clicking a badge sends that zone's data to the right side panel
//
// The purple colour is consistent with the 3D Risk view so both views match.

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
