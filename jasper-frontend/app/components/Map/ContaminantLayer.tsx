/**
 * ContaminantLayer.tsx — Athabasca River water contamination layer for the Leaflet map.
 *
 * Draws the river course as two Polyline overlays (main channel + branch),
 * places animated directional arrow markers to visualise where the contaminant
 * plume is heading, and renders a HazardZone circle at the critical point
 * (WSC station 07AA001 — Miette River at Jasper).
 *
 * Digital twin scenario mode (contaminationLevel / projectionHours props):
 *   When the ContaminantScenarioPanel sliders are moved, the river lines change
 *   colour to reflect contamination severity (blue → orange → red), a dashed
 *   hazard-boundary polyline extends downstream to the point where concentration
 *   falls to 5% of the source, and a marker labels that boundary.
 *
 * Arrow behaviour:
 *   - Direction comes from contaminant_vector.direction_deg returned by Richard's API
 *   - Animation speed is inversely proportional to velocity (faster water = faster pulse)
 *   - Arrow count scales with zoom level (hidden at low zoom to reduce clutter)
 *
 * Falls back to direction=180°, velocity=0.65 if the API is unreachable.
 */

"use client";

import { useEffect, useRef, useState } from "react";
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

// Physics constants — must match contaminant_model.py exactly
const DECAY_FACTOR = 0.05;       // km⁻¹ — exponential decay rate
const SAFETY_THRESHOLD = 0.05;   // 5 % of source concentration = safe level

/** Distance (km) at which concentration decays to the 5% safety threshold. */
function impactDistKm(contamLevel: number): number {
  if (contamLevel <= SAFETY_THRESHOLD) return 0;
  return -Math.log(SAFETY_THRESHOLD / contamLevel) / DECAY_FACTOR;
}

/**
 * Project a point `distKm` kilometres downstream of [lat, lon]
 * along the given compass bearing (0° = north, 90° = east).
 */
function projectPoint(
  lat: number, lon: number,
  bearingDeg: number, distKm: number
): [number, number] {
  const rad = (bearingDeg * Math.PI) / 180;
  const dlat = (Math.cos(rad) * distKm) / 111.0;
  const dlon = (Math.sin(rad) * distKm) / (111.0 * Math.cos((lat * Math.PI) / 180));
  return [lat + dlat, lon + dlon];
}

/**
 * arrowIcon — builds a Leaflet DivIcon shaped like a rotating directional arrow.
 *
 * The SVG arrow is rotated to directionDeg so it points the way the plume is
 * moving.  The CSS pulse animation duration is shortened for higher velocities
 * so faster-moving water produces a more urgent visual rhythm.
 * Arrow colour shifts from sky-blue → amber → red as contamination increases.
 *
 * @param directionDeg    - compass heading (0–360°) the arrow should point
 * @param velocity        - normalised plume speed (0–1); higher = faster animation
 * @param contamLevel     - 0–1 contamination level driving the colour shift
 * @returns a Leaflet DivIcon with inline SVG and CSS animation
 */
function arrowIcon(directionDeg: number, velocity: number, contamLevel: number): L.DivIcon {
  const duration = Math.max(0.6, 2.5 - velocity * 2).toFixed(1);
  const color =
    contamLevel >= 0.7 ? "#EF4444"
    : contamLevel >= 0.4 ? "#F59E0B"
    : "#00A3E0";
  return L.divIcon({
    className: "",
    html: `
      <div style="transform:rotate(${directionDeg}deg);width:28px;height:28px;display:flex;align-items:center;justify-content:center;animation:jasper-arrow-pulse ${duration}s ease-in-out infinite;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.9">
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
 * the river polylines, animated flow arrows, sensor dot, hazard zone, and (when
 * the scenario panel is active) a downstream impact boundary marker.
 * Subscribes to map zoom changes so arrow density adjusts as the user zooms.
 *
 * @param contaminationLevel - 0–1 scenario slider value (default 0.72)
 * @param projectionHours    - scenario hours slider (unused in 2D, passed for parity)
 */
export function ContaminantLayer({
  contaminationLevel = 0.72,
}: {
  contaminationLevel?: number;
  projectionHours?: number;
}) {
  const [result, setResult] = useState<ModelOutput | null>(null);
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onZoomEnd = () => setZoom(map.getZoom());
    map.on("zoomend", onZoomEnd);
    return () => { map.off("zoomend", onZoomEnd); };
  }, [map]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchContaminantSimulation("ATH-001-W", 180, 2.1, contaminationLevel)
        .then(setResult)
        .catch(() => setResult(null));
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [contaminationLevel]);

  const directionDeg = result?.contaminant_vector.direction_deg ?? 180;
  const velocity     = result?.contaminant_vector.velocity     ?? 0.65;

  // Scale arrow count and river line weight with zoom level
  const arrowPositions = zoom >= 12 ? ARROW_POSITIONS
    : zoom >= 10 ? ARROW_POSITIONS.slice(1, 3)
    : [];
  const lineWeight = zoom >= 11 ? 5 : zoom >= 9 ? 3 : 2;

  // River line colour shifts from sky-blue → amber → red as contamination rises
  const riverColor =
    contaminationLevel >= 0.7 ? "#EF4444"
    : contaminationLevel >= 0.4 ? "#F59E0B"
    : "#00A3E0";

  const branchColor =
    contaminationLevel >= 0.7 ? "#FCA5A5"
    : contaminationLevel >= 0.4 ? "#FCD34D"
    : "#55CAF0";

  // Scenario: hazard boundary marker and dashed line
  const hazardDist = impactDistKm(contaminationLevel);
  const [hazardLat, hazardLon] = projectPoint(
    CRITICAL_CENTER[0], CRITICAL_CENTER[1], directionDeg, hazardDist
  );

  const hazardColor =
    contaminationLevel >= 0.7 ? "#EF4444"
    : contaminationLevel >= 0.4 ? "#F59E0B"
    : "#22C55E";

  return (
    <>
      {/* Main river channel — colour reflects current contamination level */}
      <Polyline
        positions={RIVER_MAIN}
        interactive={false}
        pathOptions={{ color: riverColor, weight: lineWeight, opacity: 0.85, lineCap: "round", lineJoin: "round" }}
      />
      <Polyline
        positions={RIVER_BRANCH}
        interactive={false}
        pathOptions={{ color: branchColor, weight: Math.max(1, lineWeight - 2), opacity: 0.7, lineCap: "round", lineJoin: "round" }}
      />

      {/* Animated flow-direction arrows */}
      {arrowPositions.map((pos, i) => (
        <Marker key={i} position={pos} icon={arrowIcon(directionDeg, velocity, contaminationLevel)} />
      ))}

      {/* River Water Quality sensor dot — cyan #00A3E0 matches 3D map colour */}
      {/*
        Sensor dot at WSC station 07AA001 (Miette River at Jasper).
        The dot fill is always sky-blue (#00A3E0) regardless of contamination level
        so the sensor location is always recognisable.  Risk severity is communicated
        via the text label inside the tooltip, not the dot colour.
      */}
      <CircleMarker
        center={CRITICAL_CENTER}
        radius={7}
        pathOptions={{ color: "#ffffff", fillColor: "#00A3E0", fillOpacity: 1, weight: 2 }}
      >
        <Tooltip direction="top" offset={[0, -8]} opacity={1}>
          <div className="text-xs font-semibold">ATH-001-W</div>
          <div className="text-xs text-gray-500">River Water Quality Sensor</div>

          {/*
            Dynamic risk level — added Aug 5 2026.
            This line updates in real time as the Contaminant Scenario panel slider moves.
            riverColor is derived from contaminationLevel (blue → amber → red) so the text
            colour matches the river polyline colour the user is looking at on the map.
            Thresholds: < 0.4 = Low (blue), 0.4–0.7 = Medium (amber), ≥ 0.7 = High (red).
          */}
          <div className="text-xs font-semibold" style={{ color: riverColor }}>
            {contaminationLevel >= 0.7 ? "High" : contaminationLevel >= 0.4 ? "Medium" : "Low"} Risk
            &nbsp;· {(contaminationLevel * 100).toFixed(0)}% contamination
          </div>
          <div className="text-xs text-gray-400">52.8639°N, 118.1069°W</div>
        </Tooltip>
      </CircleMarker>

      {/* ── Scenario: downstream hazard boundary ──────────────────────────
          Shown whenever the contamination level is above the safety threshold.
          A dashed line projects downstream from the sensor to the point where
          concentration decays to 5% of the source level. */}
      {hazardDist > 0 && (
        <>
          {/* Dashed line from source to hazard boundary */}
          <Polyline
            positions={[CRITICAL_CENTER, [hazardLat, hazardLon]]}
            interactive={false}
            pathOptions={{
              color: hazardColor,
              weight: 2,
              opacity: 0.6,
              dashArray: "6 5",
            }}
          />

          {/* Hazard boundary marker */}
          <CircleMarker
            center={[hazardLat, hazardLon]}
            radius={8}
            pathOptions={{
              color: "#ffffff",
              fillColor: hazardColor,
              fillOpacity: 0.9,
              weight: 2,
            }}
          >
            <Tooltip direction="top" offset={[0, -10]} opacity={1} permanent={false}>
              <div className="text-xs font-bold" style={{ color: hazardColor }}>
                Hazard Boundary
              </div>
              <div className="text-xs text-gray-600">
                {hazardDist.toFixed(1)} km downstream
              </div>
              <div className="text-xs text-gray-400">
                Concentration drops to 5% here
              </div>
            </Tooltip>
          </CircleMarker>
        </>
      )}
    </>
  );
}
