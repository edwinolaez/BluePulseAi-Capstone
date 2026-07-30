/**
 * ContaminantLayer.tsx — Athabasca River water contamination layer for the Leaflet map.
 *
 * Draws the river course as two Polyline overlays (main channel + branch),
 * places animated directional arrow markers to visualise where the contaminant
 * plume is heading, and renders a HazardZone circle at the critical point
 * (WSC station 07AA001 — Miette River at Jasper).
 *
 * Arrow behaviour:
 *   - Direction comes from contaminant_vector.direction_deg returned by Richard's API
 *   - Animation speed is inversely proportional to velocity (faster water = faster pulse)
 *   - Arrow count scales with zoom level (hidden at low zoom to reduce clutter)
 *
 * Falls back to direction=180°, velocity=0.65 if the API is unreachable.
 */

"use client";

import { useEffect, useState } from "react";
import L from "leaflet";
import { CircleMarker, Marker, Polyline, Tooltip, useMap } from "react-leaflet";
import { fetchContaminantSimulation, ModelOutput } from "../../../lib/api";

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

/**
 * arrowIcon — builds a Leaflet DivIcon shaped like a rotating directional arrow.
 *
 * The SVG arrow is rotated to directionDeg so it points the way the plume is
 * moving.  The CSS pulse animation duration is shortened for higher velocities
 * so faster-moving water produces a more urgent visual rhythm.
 *
 * @param directionDeg - compass heading (0–360°) the arrow should point
 * @param velocity     - normalised plume speed (0–1); higher = faster animation
 * @returns a Leaflet DivIcon with inline SVG and CSS animation
 */
function arrowIcon(directionDeg: number, velocity: number): L.DivIcon {
  // Lower duration = faster animation = faster moving water
  const duration = Math.max(0.6, 2.5 - velocity * 2).toFixed(1);
  return L.divIcon({
    className: "",
    html: `
      <div style="transform:rotate(${directionDeg}deg);width:28px;height:28px;display:flex;align-items:center;justify-content:center;animation:jasper-arrow-pulse ${duration}s ease-in-out infinite;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00A3E0" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.9">
          <path d="M5 12h14M13 6l6 6-6 6"/>
        </svg>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

/**
 * ContaminantLayer — react-leaflet layer component for the river contamination visualisation.
 *
 * Fetches contaminant simulation data from Richard's API on mount, then renders
 * the river polylines, animated flow arrows, sensor dot, and hazard zone.
 * Subscribes to map zoom changes so arrow density adjusts as the user zooms.
 * No props required.
 */
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
        pathOptions={{ color: "#00A3E0", weight: lineWeight, opacity: 0.8, lineCap: "round", lineJoin: "round" }}
      />
      <Polyline
        positions={RIVER_BRANCH}
        interactive={false}
        pathOptions={{ color: "#55CAF0", weight: Math.max(1, lineWeight - 2), opacity: 0.7, lineCap: "round", lineJoin: "round" }}
      />

      {arrowPositions.map((pos, i) => (
        <Marker key={i} position={pos} icon={arrowIcon(directionDeg, velocity)} />
      ))}

      {/* River Water Quality sensor dot — cyan #00A3E0, matches 3D map colour */}
      <CircleMarker
        center={CRITICAL_CENTER}
        radius={7}
        pathOptions={{ color: "#ffffff", fillColor: "#00A3E0", fillOpacity: 1, weight: 2 }}
      >
        <Tooltip direction="top" offset={[0, -8]} opacity={1}>
          <div className="text-xs font-semibold">ATH-001-W</div>
          <div className="text-xs text-gray-500">River Water Quality Sensor</div>
          <div className="text-xs text-gray-400">52.8639°N, 118.1069°W</div>
        </Tooltip>
      </CircleMarker>

    </>
  );
}
