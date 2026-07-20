// ContaminantLayer visualises water contamination flowing through the Athabasca River.
// It draws two river path lines on the map (main channel + branch),
// places animated directional arrows along the river to show which way the plume is moving,
// and adds a hazard zone circle at the critical contamination point.
//
// The arrow direction and animation speed come directly from Richard's contaminant API —
// so as the model updates, the arrows update too.

"use client";

import { useEffect, useState } from "react";
import L from "leaflet";
import { CircleMarker, Marker, Polyline, Tooltip, useMap } from "react-leaflet";
import { fetchContaminantSimulation, ModelOutput } from "../../../lib/api";
import { HazardZone } from "./HazardZone";

// GPS coordinates that trace the main river channel through the monitored area
const RIVER_MAIN: [number, number][] = [
  [52.820, -118.200],
  [52.840, -118.155],
  [52.858, -118.105],
  [52.875, -118.060],
  [52.890, -118.020],
  [52.910, -117.975],
  [52.935, -117.920],
];

// The secondary river branch — offset slightly from the main channel
const RIVER_BRANCH: [number, number][] = RIVER_MAIN.map(
  ([lat, lng]): [number, number] => [lat + 0.004, lng + 0.006]
);

// WSC station 07AA001 — Miette River at Jasper (Water Survey of Canada)
const CRITICAL_CENTER: [number, number] = [52.8639, -118.1069];

// Four evenly-spaced positions along the river where animated arrows are placed
const ARROW_POSITIONS: [number, number][] = [
  [52.840, -118.155],
  [52.858, -118.105],
  [52.875, -118.060],
  [52.905, -117.988],
];

// Creates a Leaflet custom icon that looks like a directional arrow.
// The arrow rotates to match the plume's direction, and its pulse animation
// speeds up when the water velocity is higher.
function arrowIcon(directionDeg: number, velocity: number): L.DivIcon {
  // Lower duration = faster animation = faster moving water
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

  const directionDeg = result?.contaminant_vector.direction_deg ?? 180;
  const velocity     = result?.contaminant_vector.velocity     ?? 0.65;
  const risk         = result?.risk_label ?? "Warning";

  // Scale arrow count and river line weight with zoom level
  const arrowPositions = zoom >= 12 ? ARROW_POSITIONS
    : zoom >= 10 ? ARROW_POSITIONS.slice(1, 3)
    : [];
  const lineWeight = zoom >= 11 ? 5 : zoom >= 9 ? 3 : 2;

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
        <Marker key={i} position={pos} icon={arrowIcon(directionDeg, velocity)} />
      ))}

      {/* River Water Quality sensor dot — cyan #0ea5e9, matches 3D map colour */}
      <CircleMarker
        center={CRITICAL_CENTER}
        radius={7}
        pathOptions={{ color: "#ffffff", fillColor: "#0ea5e9", fillOpacity: 1, weight: 2 }}
      >
        <Tooltip direction="top" offset={[0, -8]} opacity={1}>
          <div className="text-xs font-semibold">ATH-001-W</div>
          <div className="text-xs text-gray-500">River Water Quality Sensor</div>
          <div className="text-xs text-gray-400">52.8639°N, 118.1069°W</div>
        </Tooltip>
      </CircleMarker>

      {/* Hazard zone circle at the most critical contamination point */}
      <HazardZone
        center={CRITICAL_CENTER}
        radius={1500}
        borderColor="#0ea5e9"
        fillColor="#38bdf8"
        fillOpacity={0.12}
        label="River Flow Warning"
        badgeIcon="map"
        badgeBorderColor="#0ea5e9"
        dotColor={risk === "High" ? "#ef4444" : risk === "Low" ? "#22c55e" : "#f59e0b"}
        popupIcon="💧"
        popupTitle="River Water Quality"
        status="WARNING"
        name="Athabasca River — SEC-W2"
        fields={[
          { label: "Station ID",        value: "SEC-W2" },
          { label: "Risk Level",        value: risk,                              valueColor: risk === "High" ? "text-red-600" : risk === "Low" ? "text-green-600" : "text-amber-600" },
          { label: "Plume Direction",   value: `${directionDeg.toFixed(0)}°`,    valueColor: "text-amber-600" },
          // Velocity is normalized 0–1 from the model, multiply by 5 to get m/s estimate
          { label: "Flow Velocity",     value: `${(velocity * 5).toFixed(1)} m/s` },
          { label: "Water Cloudiness",  value: "18.4 NTU (High)",                valueColor: "text-red-600" },
          { label: "Connection Status", value: "Active Sync",                    valueColor: "text-green-600" },
        ]}
      />
    </>
  );
}
