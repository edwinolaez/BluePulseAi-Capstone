"use client";

import { useEffect, useState } from "react";
import L from "leaflet";
import { Marker, Polyline } from "react-leaflet";
import { fetchContaminantSimulation, ModelOutput } from "../../../lib/api";
import { HazardZone } from "./HazardZone";

// River path points — arrows placed at intervals along this path
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

// Arrow marker positions (evenly spaced along river)
const ARROW_POSITIONS: [number, number][] = [
  [52.840, -118.155],
  [52.858, -118.105],
  [52.875, -118.060],
  [52.905, -117.988],
];

function arrowIcon(directionDeg: number, velocity: number): L.DivIcon {
  // CSS animation speed: faster arrows for higher velocity
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

export function ContaminantLayer() {
  const [result, setResult] = useState<ModelOutput | null>(null);

  useEffect(() => {
    fetchContaminantSimulation("ATH-001-W", 180, 2.1, 0.72)
      .then(setResult)
      .catch(() => setResult(null));
  }, []);

  const directionDeg = result?.contaminant_vector.direction_deg ?? 180;
  const velocity     = result?.contaminant_vector.velocity     ?? 0.65;
  const risk         = result?.risk_label ?? "Warning";

  return (
    <>
      <Polyline
        positions={RIVER_MAIN}
        pathOptions={{ color: "#0ea5e9", weight: 5, opacity: 0.8, lineCap: "round", lineJoin: "round" }}
      />
      <Polyline
        positions={RIVER_BRANCH}
        pathOptions={{ color: "#38bdf8", weight: 3, opacity: 0.7, lineCap: "round", lineJoin: "round" }}
      />

      {/* Animated direction arrows using contaminant_vector from Richard's API */}
      {ARROW_POSITIONS.map((pos, i) => (
        <Marker key={i} position={pos} icon={arrowIcon(directionDeg, velocity)} />
      ))}

      <HazardZone
        center={CRITICAL_CENTER}
        radius={1500}
        borderColor="#ef4444"
        fillColor="#f87171"
        fillOpacity={0.12}
        label="River Flow Warning"
        sublabel="Discharge Detected"
        badgeIcon="map"
        badgeBorderColor="#0ea5e9"
        dotColor="#ef4444"
        popupIcon="💧"
        popupTitle="River Water Quality"
        status="WARNING"
        name="Athabasca River — SEC-W2"
        fields={[
          { label: "Station ID", value: "SEC-W2" },
          { label: "Risk Level", value: risk, valueColor: "text-red-600" },
          { label: "Plume Direction", value: `${directionDeg.toFixed(0)}°`, valueColor: "text-amber-600" },
          { label: "Flow Velocity", value: `${(velocity * 5).toFixed(1)} m/s` },
          { label: "Water Cloudiness", value: "18.4 NTU (High)", valueColor: "text-red-600" },
          { label: "Connection Status", value: "Active Sync", valueColor: "text-green-600" },
        ]}
      />
    </>
  );
}
