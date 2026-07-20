// ContaminantLayer visualises water contamination flowing through the Athabasca River.
// It draws two river path lines, animated directional arrows, and a hazard zone circle.

"use client";

import { useEffect, useState } from "react";
import L from "leaflet";
import { Marker, Polyline, useMap } from "react-leaflet";
import { fetchContaminantSimulation, ModelOutput } from "../../../lib/api";
import { HazardZone } from "./HazardZone";
import type { SensorInfo } from "./JasperMap";

const RIVER_MAIN: [number, number][] = [
  [52.820, -118.200],
  [52.840, -118.155],
  [52.858, -118.105],
  [52.875, -118.060],
  [52.890, -118.020],
  [52.910, -117.975],
  [52.935, -117.920],
];

const RIVER_BRANCH: [number, number][] = RIVER_MAIN.map(
  ([lat, lng]): [number, number] => [lat + 0.004, lng + 0.006]
);

const CRITICAL_CENTER: [number, number] = [52.875, -118.060];

// Positions chosen to sit between river nodes AND away from all badge markers:
// ATH-001-H=[52.858,-118.092], ATH-001-M=[52.870,-118.070], ATH-001-L=[52.884,-118.045],
// Contaminant badge=CRITICAL_CENTER=[52.875,-118.060], TelemetryStation=[52.875,-118.08].
const ARROW_POSITIONS: [number, number][] = [
  [52.830, -118.178], // upstream — no badges nearby
  [52.848, -118.130], // moved north-west away from ATH-001-H badge at [52.858,-118.092]
  [52.893, -118.010], // moved downstream away from CRITICAL_CENTER at [52.875,-118.060]
  [52.920, -117.950], // far downstream — no badges nearby
];

function arrowIcon(directionDeg: number, velocity: number): L.DivIcon {
  const duration = Math.max(0.6, 2.5 - velocity * 2).toFixed(1);
  return L.divIcon({
    className: "",
    html: `
      <div style="transform:rotate(${directionDeg}deg);width:28px;height:28px;display:flex;align-items:center;justify-content:center;animation:jasper-arrow-pulse ${duration}s ease-in-out infinite;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.9">
          <path d="M5 12h14M13 6l6 6-6 6"/>
        </svg>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

interface Props {
  onSectorClick?:  (id: string) => void;
  onSensorSelect?: (info: SensorInfo) => void;
  onMarkerClick?:  () => void;
}

export function ContaminantLayer({ onSectorClick, onSensorSelect, onMarkerClick }: Props) {
  const [result, setResult] = useState<ModelOutput | null>(null);
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());

  useEffect(() => {
    const onZoomEnd = () => setZoom(map.getZoom());
    map.on("zoomend", onZoomEnd);
    return () => { map.off("zoomend", onZoomEnd); };
  }, [map]);

  useEffect(() => {
    fetchContaminantSimulation("ATH-001-W", 180, 2.1, 0.72)
      .then(setResult)
      .catch(() => setResult(null));
  }, []);

  const directionDeg = result?.contaminant_vector?.direction_deg ?? 180;
  const velocity     = result?.contaminant_vector?.velocity     ?? 0.65;
  const apiRisk      = result?.risk_label ?? "Warning";

  // API uses "Warning" for medium risk — normalise to match other layers
  const RISK_DISPLAY: Record<string, { label: string; badge: string; badgeVariant: "red" | "amber" | "green"; valueColor: string; dotColor: string }> = {
    High:    { label: "High",   badge: "CRITICAL", badgeVariant: "red",   valueColor: "#ef4444", dotColor: "#ef4444" },
    Warning: { label: "Medium", badge: "WARNING",  badgeVariant: "amber", valueColor: "#f59e0b", dotColor: "#f59e0b" },
    Low:     { label: "Low",    badge: "LOW",       badgeVariant: "green", valueColor: "#22c55e", dotColor: "#22c55e" },
  };
  const riskDisplay = RISK_DISPLAY[apiRisk] ?? RISK_DISPLAY.Warning;

  const arrowPositions = zoom >= 12 ? ARROW_POSITIONS
    : zoom >= 10 ? ARROW_POSITIONS.slice(1, 3)
    : [];
  const lineWeight = zoom >= 11 ? 5 : zoom >= 9 ? 3 : 2;

  const sensorInfo: SensorInfo = {
    icon: "map",
    title: "RIVER CONTAMINATION",
    badge: riskDisplay.badge,
    badgeVariant: riskDisplay.badgeVariant,
    name: "Athabasca River Plume",
    fields: [
      { label: "SECTOR",     value: "ATH-001-W" },
      { label: "RISK LEVEL", value: riskDisplay.label,            valueColor: riskDisplay.valueColor },
      { label: "DIRECTION",  value: `${directionDeg}°`,           valueColor: "#0ea5e9" },
      { label: "VELOCITY",   value: `${velocity.toFixed(2)} m/s`, valueColor: "#0ea5e9" },
    ],
  };

  return (
    <>
      <Polyline
        positions={RIVER_MAIN}
        interactive={false}
        pathOptions={{ color: "#0ea5e9", weight: lineWeight, opacity: 0.8, lineCap: "round", lineJoin: "round" }}
      />
      <Polyline
        positions={RIVER_BRANCH}
        interactive={false}
        pathOptions={{ color: "#38bdf8", weight: Math.max(1, lineWeight - 2), opacity: 0.7, lineCap: "round", lineJoin: "round" }}
      />

      {arrowPositions.map((pos, i) => (
        <Marker
          key={i}
          position={pos}
          icon={arrowIcon(directionDeg, velocity)}
          eventHandlers={{ click: () => { onSensorSelect?.(sensorInfo); onMarkerClick?.(); } }}
        />
      ))}

      <HazardZone
        center={CRITICAL_CENTER}
        radius={1500}
        borderColor="#ef4444"
        fillColor="#f87171"
        fillOpacity={0.10}
        badgeIcon="map"
        badgeBorderColor="#0ea5e9"
        dotColor={riskDisplay.dotColor}
        sensorInfo={sensorInfo}
        onSectorClick={onSectorClick}
        onSensorSelect={onSensorSelect}
        onMarkerClick={onMarkerClick}
      />
    </>
  );
}
